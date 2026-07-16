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
    console.error("Setup requires NEXT_PUBLIC_API_BASE_URL, DIRECTUS_ADMIN_EMAIL, and DIRECTUS_ADMIN_PASSWORD.");
    process.exit(1);
}

async function rawRequest(pathname, options = {}) {
    return fetch(`${directusUrl}${pathname}`, {
        ...options,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });
}

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function requestWithRetry(pathname, options = {}) {
    let response;
    for (let attempt = 0; attempt < 7; attempt += 1) {
        response = await rawRequest(pathname, options);
        if (![429, 503].includes(response.status)) return response;
        await response.arrayBuffer().catch(() => undefined);
        await wait(Math.min(15_000, 1_000 * 2 ** attempt));
    }
    return response;
}

const loginResponse = await requestWithRetry("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
});
if (!loginResponse.ok) {
    console.error(`Directus admin login failed (${loginResponse.status}).`);
    process.exit(1);
}
const accessToken = (await loginResponse.json()).data?.access_token;
if (!accessToken) {
    console.error("Directus login did not return an access token.");
    process.exit(1);
}

async function directus(pathname, options = {}) {
    const response = await requestWithRetry(pathname, {
        ...options,
        headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) }
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`${options.method || "GET"} ${pathname} failed (${response.status}): ${text.slice(0, 500)}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

async function exists(pathname) {
    const response = await requestWithRetry(pathname, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (response.ok) return true;
    if ([403, 404].includes(response.status)) return false;
    const text = await response.text();
    throw new Error(`GET ${pathname} failed (${response.status}): ${text.slice(0, 500)}`);
}

const integerPrimaryKey = field => ({
    field,
    type: "integer",
    meta: { hidden: true, readonly: true },
    schema: { is_primary_key: true, has_auto_increment: true, is_nullable: false }
});

const field = (name, type, schema = {}, meta = {}) => ({
    field: name,
    type,
    meta: { hidden: false, readonly: false, ...meta },
    schema: { is_nullable: true, ...schema }
});

const m2o = (name, relatedCollection, relatedField, nullable = true) => field(
    name,
    "integer",
    {
        is_nullable: nullable,
        foreign_key_table: relatedCollection,
        foreign_key_column: relatedField
    },
    { interface: "select-dropdown-m2o", special: ["m2o"] }
);

async function ensureCollection(collection, primaryKey, note) {
    if (await exists(`/collections/${collection}`)) {
        console.log(`[exists] collection ${collection}`);
        return;
    }
    await directus("/collections", {
        method: "POST",
        body: JSON.stringify({
            collection,
            meta: { icon: "fact_check", note, hidden: false, singleton: false, accountability: "all" },
            schema: { name: collection },
            fields: [integerPrimaryKey(primaryKey)]
        })
    });
    console.log(`[created] collection ${collection}`);
}

async function ensureField(collection, definition) {
    if (await exists(`/fields/${collection}/${definition.field}`)) {
        console.log(`[exists] field ${collection}.${definition.field}`);
        return;
    }
    await directus(`/fields/${collection}`, { method: "POST", body: JSON.stringify(definition) });
    console.log(`[created] field ${collection}.${definition.field}`);
}

async function ensureFields(collection, definitions) {
    for (const definition of definitions) await ensureField(collection, definition);
}

const enumOptions = choices => ({ choices: choices.map(value => ({ text: value, value })) });

await ensureFields("purchase_order", [
    field("currency_code", "string", { is_nullable: false, default_value: "PHP", max_length: 3 }, { interface: "input", width: "half" }),
    field("exchange_rate", "decimal", { is_nullable: false, default_value: 1, numeric_precision: 18, numeric_scale: 6 }, { interface: "input", width: "half" }),
    field("total_foreign_currency", "decimal", { is_nullable: false, default_value: 0, numeric_precision: 15, numeric_scale: 2 }, { interface: "input", width: "half" }),
    field("is_import", "boolean", { is_nullable: false, default_value: false }, { interface: "boolean", width: "half" }),
    field("workflow_revision", "integer", { is_nullable: false, default_value: 0 }, { interface: "input", readonly: true })
]);

await ensureFields("purchase_order_products", [
    field("purchase_intent", "string", { is_nullable: false, default_value: "Buffer_Stock", max_length: 20 }, {
        interface: "select-dropdown", options: enumOptions(["MRP_Demand", "Buffer_Stock"])
    }),
    m2o("job_order_id", "manufacturing_job_orders", "job_order_id", true),
    field("unit_price_foreign", "decimal", { is_nullable: false, default_value: 0, numeric_precision: 15, numeric_scale: 4 }, { interface: "input", width: "half" }),
    field("gross_amount_foreign", "decimal", { is_nullable: false, default_value: 0, numeric_precision: 15, numeric_scale: 2 }, { interface: "input", width: "half" }),
    field("net_amount_foreign", "decimal", { is_nullable: false, default_value: 0, numeric_precision: 15, numeric_scale: 2 }, { interface: "input", width: "half" }),
    field("discount_percent", "decimal", { is_nullable: false, default_value: 0, numeric_precision: 7, numeric_scale: 4 }, { interface: "input", width: "third" }),
    field("vat_percent", "decimal", { is_nullable: false, default_value: 0, numeric_precision: 7, numeric_scale: 4 }, { interface: "input", width: "third" }),
    field("withholding_percent", "decimal", { is_nullable: false, default_value: 0, numeric_precision: 7, numeric_scale: 4 }, { interface: "input", width: "third" })
]);

await ensureField("branches", m2o("bad_stock_branch_id", "branches", "id", true));

await ensureCollection("purchase_order_qa_parameters", "parameter_id", "QA parameter types used by purchase receiving.");
await ensureFields("purchase_order_qa_parameters", [
    field("parameter_name", "string", { is_nullable: false, max_length: 100, is_unique: true }, { interface: "input", required: true }),
    field("data_type", "string", { is_nullable: false, default_value: "Numeric", max_length: 20 }, {
        interface: "select-dropdown", required: true, options: enumOptions(["Numeric", "Boolean", "Text"])
    }),
    field("unit_of_measure", "string", { max_length: 20 }, { interface: "input" }),
    field("description", "text", {}, { interface: "input-multiline" })
]);

await ensureCollection("product_qa_specs", "spec_id", "Product-specific QA limits for purchase receiving.");
await ensureFields("product_qa_specs", [
    m2o("product_id", "products", "product_id", false),
    m2o("parameter_id", "purchase_order_qa_parameters", "parameter_id", false),
    field("target_min", "decimal", { numeric_precision: 12, numeric_scale: 4 }, { interface: "input", width: "half" }),
    field("target_max", "decimal", { numeric_precision: 12, numeric_scale: 4 }, { interface: "input", width: "half" }),
    field("expected_text", "string", { max_length: 100 }, { interface: "input" }),
    field("is_critical", "boolean", { is_nullable: false, default_value: true }, { interface: "boolean" })
]);

await ensureCollection("purchase_order_receiving_qa_results", "result_id", "Immutable QA readings recorded for purchase receipts.");
await ensureFields("purchase_order_receiving_qa_results", [
    m2o("receiving_line_id", "purchase_order_receiving", "purchase_order_product_id", false),
    m2o("spec_id", "product_qa_specs", "spec_id", false),
    field("actual_reading", "string", { is_nullable: false, max_length: 100 }, { interface: "input", required: true }),
    field("is_passed", "boolean", { is_nullable: false, default_value: true }, { interface: "boolean", readonly: true })
]);

await ensureCollection("purchase_order_approval_rules", "rule_id", "Configurable approval routing for purchase orders.");
await ensureFields("purchase_order_approval_rules", [
    field("rule_name", "string", { is_nullable: false, max_length: 150, is_unique: true }, { interface: "input", required: true }),
    field("priority", "integer", { is_nullable: false, default_value: 0 }, { interface: "input" }),
    field("minimum_total_php", "decimal", { is_nullable: false, default_value: 0, numeric_precision: 15, numeric_scale: 2 }, { interface: "input", width: "half" }),
    field("maximum_total_php", "decimal", { numeric_precision: 15, numeric_scale: 2 }, { interface: "input", width: "half" }),
    field("currency_code", "string", { max_length: 3 }, { interface: "input", width: "half" }),
    field("import_scope", "string", { is_nullable: false, default_value: "Any", max_length: 20 }, {
        interface: "select-dropdown", options: enumOptions(["Any", "Domestic", "Import"]), width: "half"
    }),
    m2o("product_category_id", "categories", "category_id", true),
    field("requires_finance", "boolean", { is_nullable: false, default_value: true }, { interface: "boolean", width: "half" }),
    field("allow_self_approval", "boolean", { is_nullable: false, default_value: true }, { interface: "boolean", width: "half", readonly: true }),
    field("effective_from", "date", {}, { interface: "datetime", width: "half" }),
    field("effective_to", "date", {}, { interface: "datetime", width: "half" }),
    field("is_active", "boolean", { is_nullable: false, default_value: true }, { interface: "boolean" }),
    field("created_at", "timestamp", { is_nullable: false, default_value: "CURRENT_TIMESTAMP" }, { interface: "datetime", readonly: true }),
    field("updated_at", "timestamp", { is_nullable: false, default_value: "CURRENT_TIMESTAMP" }, { interface: "datetime", readonly: true })
]);

await ensureCollection("purchase_order_approval_history", "history_id", "Immutable purchase-order approval audit history.");
await ensureFields("purchase_order_approval_history", [
    m2o("purchase_order_id", "purchase_order", "purchase_order_id", false),
    field("action", "string", { is_nullable: false, max_length: 40 }, { interface: "input", required: true }),
    field("approval_stage", "string", { is_nullable: false, max_length: 20 }, {
        interface: "select-dropdown", options: enumOptions(["Plant", "Finance", "System"]), required: true
    }),
    m2o("actor_id", "user", "user_id", false),
    m2o("actor_role_id", "roles", "id", true),
    field("remarks", "text", {}, { interface: "input-multiline" }),
    field("from_inventory_status", "integer", {}, { interface: "input", readonly: true, width: "half" }),
    field("to_inventory_status", "integer", {}, { interface: "input", readonly: true, width: "half" }),
    field("revision_before", "integer", { is_nullable: false }, { interface: "input", readonly: true, width: "half" }),
    field("revision_after", "integer", { is_nullable: false }, { interface: "input", readonly: true, width: "half" }),
    field("created_at", "timestamp", { is_nullable: false, default_value: "CURRENT_TIMESTAMP" }, { interface: "datetime", readonly: true })
]);

await ensureCollection("purchase_order_approval_role_permissions", "permission_id", "Plant and Finance approval assignments by ERP role or user.");
await ensureFields("purchase_order_approval_role_permissions", [
    m2o("role_id", "roles", "id", true),
    m2o("user_id", "user", "user_id", true),
    field("approval_stage", "string", { is_nullable: false, max_length: 20 }, {
        interface: "select-dropdown", options: enumOptions(["Plant", "Finance"]), required: true
    }),
    field("can_reject", "boolean", { is_nullable: false, default_value: false }, { interface: "boolean" }),
    field("is_active", "boolean", { is_nullable: false, default_value: true }, { interface: "boolean" }),
    field("created_at", "timestamp", { is_nullable: false, default_value: "CURRENT_TIMESTAMP" }, { interface: "datetime", readonly: true })
]);

const legacyOrders = (await directus("/items/purchase_order?fields=purchase_order_id,total_amount,currency_code,exchange_rate,total_foreign_currency,is_import,workflow_revision&limit=-1")).data || [];
for (const order of legacyOrders) {
    const patch = {};
    if (!order.currency_code) patch.currency_code = "PHP";
    if (!Number(order.exchange_rate)) patch.exchange_rate = 1;
    if (!Number(order.total_foreign_currency) && Number(order.total_amount)) patch.total_foreign_currency = Number(order.total_amount);
    if (order.is_import === null || order.is_import === undefined) patch.is_import = false;
    if (order.workflow_revision === null || order.workflow_revision === undefined) patch.workflow_revision = 0;
    if (Object.keys(patch).length) {
        await directus(`/items/purchase_order/${order.purchase_order_id}`, { method: "PATCH", body: JSON.stringify(patch) });
    }
}

const failClosedRules = (await directus("/items/purchase_order_approval_rules?filter[rule_name][_eq]=Fail-closed%20default&fields=rule_id&limit=1")).data || [];
if (!failClosedRules.length) {
    await directus("/items/purchase_order_approval_rules", {
        method: "POST",
        body: JSON.stringify({
            rule_name: "Fail-closed default",
            priority: -1000,
            minimum_total_php: 0,
            maximum_total_php: null,
            currency_code: null,
            import_scope: "Any",
            product_category_id: null,
            requires_finance: true,
            allow_self_approval: true,
            is_active: true
        })
    });
    console.log("[created] fail-closed approval rule");
}

const rejectTypes = (await directus("/items/inventory_transaction_types?filter[type_name][_eq]=QA%20Reject%20%2F%20Bad%20Order%20Receipt&fields=transaction_type_id&limit=1")).data || [];
if (!rejectTypes.length) {
    await directus("/items/inventory_transaction_types", {
        method: "POST",
        body: JSON.stringify({
            type_name: "QA Reject / Bad Order Receipt",
            direction: "IN",
            origin_table: "purchase_order_receiving"
        })
    });
    console.log("[created] QA rejection movement type");
}

for (const [sourceId, targetId] of [[181, 182], [183, 184], [185, 186]]) {
    await directus(`/items/branches/${sourceId}`, {
        method: "PATCH",
        body: JSON.stringify({ bad_stock_branch_id: targetId })
    });
    console.log(`[configured] bad-stock branch ${sourceId} -> ${targetId}`);
}

const policies = (await directus("/policies?filter[name][_eq]=Manufacturing%20Procurement%20Service&fields=id,name&limit=1")).data || [];
const servicePolicy = policies[0];
if (!servicePolicy) throw new Error("Manufacturing Procurement Service policy was not found.");

const permissionMatrix = {
    transaction_status: ["read"],
    payment_status: ["read"],
    inventory_transaction_types: ["read"],
    branches: ["read"],
    categories: ["read"],
    products: ["read"],
    manufacturing_job_orders: ["read"],
    roles: ["read"],
    user: ["read"],
    user_access_modules: ["read"],
    modules: ["read"],
    inventory_movements: ["read", "create"],
    purchase_order_qa_parameters: ["read"],
    product_qa_specs: ["read"],
    purchase_order_receiving_qa_results: ["read", "create"],
    purchase_order_approval_rules: ["read"],
    purchase_order_approval_history: ["read", "create"],
    purchase_order_approval_role_permissions: ["read"]
};

for (const [collection, actions] of Object.entries(permissionMatrix)) {
    for (const action of actions) {
        const query = new URLSearchParams({
            "filter[policy][_eq]": servicePolicy.id,
            "filter[collection][_eq]": collection,
            "filter[action][_eq]": action,
            fields: "id",
            limit: "1"
        });
        const current = (await directus(`/permissions?${query.toString()}`)).data || [];
        if (current.length) continue;
        await directus("/permissions", {
            method: "POST",
            body: JSON.stringify({
                policy: servicePolicy.id,
                collection,
                action,
                fields: ["*"],
                permissions: {},
                validation: {},
                presets: null
            })
        });
        console.log(`[created] service permission ${collection}.${action}`);
    }
}

console.log("Purchase Order Phase 0 Directus setup completed.");
