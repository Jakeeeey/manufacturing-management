import fs from "node:fs";
import path from "node:path";

function readEnvironmentFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const result = {};
    for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        if (separator < 1) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}

const fileEnvironment = readEnvironmentFile(path.resolve(process.cwd(), ".env.local"));
const directusUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || fileEnvironment.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL || "";
const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD || "";

if (!directusUrl || !adminEmail || !adminPassword) {
    console.error("Phase 4 setup requires NEXT_PUBLIC_API_BASE_URL, DIRECTUS_ADMIN_EMAIL, and DIRECTUS_ADMIN_PASSWORD.");
    process.exit(1);
}

async function rawRequest(pathname, options = {}) {
    return fetch(`${directusUrl}${pathname}`, {
        ...options,
        headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) }
    });
}

const loginResponse = await rawRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
});
if (!loginResponse.ok) throw new Error(`Directus admin login failed (${loginResponse.status}).`);
const accessToken = (await loginResponse.json()).data?.access_token;
if (!accessToken) throw new Error("Directus login did not return an access token.");

async function directus(pathname, options = {}) {
    const response = await rawRequest(pathname, {
        ...options,
        headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) }
    });
    if (!response.ok) {
        throw new Error(`${options.method || "GET"} ${pathname} failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

async function optional(pathname) {
    const response = await rawRequest(pathname, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GET ${pathname} failed (${response.status}).`);
    return response.json();
}

let field = (await optional("/fields/product_qa_specs/product_parameter_key"))?.data || null;
const specificationFields = field
    ? "spec_id,product_id,parameter_id,product_parameter_key"
    : "spec_id,product_id,parameter_id";
const specifications = (await directus(`/items/product_qa_specs?fields=${specificationFields}&limit=-1`)).data || [];
const seenPairs = new Map();
for (const specification of specifications) {
    const key = `${Number(specification.product_id)}:${Number(specification.parameter_id)}`;
    seenPairs.set(key, [...(seenPairs.get(key) || []), specification.spec_id]);
}
const duplicatePairs = [...seenPairs.entries()].filter(([, ids]) => ids.length > 1);
if (duplicatePairs.length) {
    throw new Error(`Duplicate product/parameter specifications must be resolved first: ${duplicatePairs.map(([key, ids]) => `${key} (${ids.join(",")})`).join("; ")}`);
}

if (!field) {
    field = (await directus("/fields/product_qa_specs", {
        method: "POST",
        body: JSON.stringify({
            field: "product_parameter_key",
            type: "string",
            meta: {
                hidden: true,
                readonly: true,
                required: false,
                interface: "input",
                note: "Flow-generated unique key for product and QA parameter."
            },
            schema: { is_nullable: true, is_unique: true, max_length: 64 }
        })
    })).data;
    console.log("[created] product_qa_specs.product_parameter_key");
}
if (!field.schema?.is_unique) throw new Error("product_parameter_key exists without a database unique constraint.");

const flowName = "Enforce Product QA Specification Identity";
const flowQuery = new URLSearchParams({ "filter[name][_eq]": flowName, fields: "id,operation,status", limit: "2" });
let flows = (await directus(`/flows?${flowQuery.toString()}`)).data || [];
if (flows.length > 1) throw new Error(`Multiple Directus flows named ${flowName} exist.`);
let flow = flows[0];
if (!flow) {
    flow = (await directus("/flows", {
        method: "POST",
        body: JSON.stringify({
            name: flowName,
            icon: "key",
            description: "Populates the database-unique product/parameter key before creating a QA specification.",
            status: "inactive",
            trigger: "event",
            accountability: "$full",
            options: {
                type: "filter",
                scope: ["items.create", "items.update"],
                collections: ["product_qa_specs"],
                return: "$last"
            }
        })
    })).data;
    console.log(`[created] flow ${flowName}`);
}

await directus(`/flows/${flow.id}`, { method: "PATCH", body: JSON.stringify({ status: "inactive" }) });
const operationQuery = new URLSearchParams({
    "filter[flow][_eq]": flow.id,
    "filter[key][_eq]": "set_product_parameter_key",
    fields: "id",
    limit: "2"
});
let operations = (await directus(`/operations?${operationQuery.toString()}`)).data || [];
if (operations.length > 1) throw new Error("Multiple product QA identity operations exist.");
const code = "module.exports = async function(data) { const payload = data.$trigger.payload || {}; const event = data.$trigger.event || ''; if (event.endsWith('.items.update')) { if (Object.prototype.hasOwnProperty.call(payload, 'product_id') || Object.prototype.hasOwnProperty.call(payload, 'parameter_id') || Object.prototype.hasOwnProperty.call(payload, 'product_parameter_key')) throw new Error('Product and QA parameter cannot be changed after creation; delete and recreate the specification.'); return payload; } const productId = typeof payload.product_id === 'object' ? payload.product_id.product_id : payload.product_id; const parameterId = typeof payload.parameter_id === 'object' ? payload.parameter_id.parameter_id : payload.parameter_id; if (!productId || !parameterId) throw new Error('Product and QA parameter are required.'); return { ...payload, product_parameter_key: String(productId) + ':' + String(parameterId) }; };";
let operation = operations[0];
if (!operation) {
    operation = (await directus("/operations", {
        method: "POST",
        body: JSON.stringify({
            name: "Set product parameter key",
            key: "set_product_parameter_key",
            type: "exec",
            position_x: 19,
            position_y: 1,
            flow: flow.id,
            options: { code }
        })
    })).data;
    console.log("[created] product QA identity operation");
} else {
    await directus(`/operations/${operation.id}`, { method: "PATCH", body: JSON.stringify({ options: { code } }) });
}

for (const specification of specifications) {
    const key = `${Number(specification.product_id)}:${Number(specification.parameter_id)}`;
    if (specification.product_parameter_key === key) continue;
    await directus(`/items/product_qa_specs/${specification.spec_id}`, {
        method: "PATCH",
        body: JSON.stringify({ product_parameter_key: key })
    });
    console.log(`[updated] product QA specification ${specification.spec_id} identity key`);
}

await directus("/fields/product_qa_specs/product_parameter_key", {
    method: "PATCH",
    body: JSON.stringify({
        meta: {
            hidden: true,
            readonly: true,
            required: true,
            interface: "input",
            note: "Flow-generated unique key for product and QA parameter."
        },
        schema: { is_nullable: false, is_unique: true, max_length: 64 }
    })
});
await directus(`/flows/${flow.id}`, {
    method: "PATCH",
    body: JSON.stringify({
        status: "active",
        operation: operation.id,
        options: {
            type: "filter",
            scope: ["items.create", "items.update"],
            collections: ["product_qa_specs"],
            return: "$last"
        }
    })
});

console.log("Purchase Order Phase 4 Directus uniqueness setup completed.");
