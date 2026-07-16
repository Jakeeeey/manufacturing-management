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

function argument(name) {
    const prefix = `--${name}=`;
    return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length) || "";
}

function positiveInteger(value, label) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer.`);
    return parsed;
}

const auditOnly = process.argv.includes("--audit-only");
const rawProductId = positiveInteger(argument("raw-product-id"), "raw-product-id");
const packagingProductId = positiveInteger(argument("packaging-product-id"), "packaging-product-id");
if (rawProductId === packagingProductId) throw new Error("Raw-material and packaging products must be different.");

const fileEnvironment = readEnvironmentFile(path.resolve(process.cwd(), ".env.local"));
const directusUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || fileEnvironment.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const staticToken = process.env.DIRECTUS_STATIC_TOKEN || fileEnvironment.DIRECTUS_STATIC_TOKEN || "";
const adminEmail = process.env.DIRECTUS_ADMIN_EMAIL || "";
const adminPassword = process.env.DIRECTUS_ADMIN_PASSWORD || "";
if (!directusUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is required.");

async function rawRequest(pathname, options = {}) {
    return fetch(`${directusUrl}${pathname}`, {
        ...options,
        headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
        cache: "no-store"
    });
}

let accessToken = staticToken;
if (!auditOnly) {
    if (!adminEmail || !adminPassword) throw new Error("Seeding requires DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD.");
    const loginResponse = await rawRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    if (!loginResponse.ok) throw new Error(`Directus admin login failed (${loginResponse.status}).`);
    accessToken = (await loginResponse.json()).data?.access_token || "";
}
if (!accessToken) throw new Error("A Directus token is required.");

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

const productIds = [rawProductId, packagingProductId];
const productParams = new URLSearchParams({
    "filter[product_id][_in]": productIds.join(","),
    fields: "product_id,product_name,product_code,product_type,isActive,status",
    limit: "2"
});
const products = (await directus(`/items/products?${productParams.toString()}`)).data || [];
const rawProduct = products.find(product => Number(product.product_id) === rawProductId);
const packagingProduct = products.find(product => Number(product.product_id) === packagingProductId);
if (!rawProduct || !packagingProduct) throw new Error("Both seed products must exist.");
for (const product of products) {
    if (Number(product.isActive) !== 1 || product.status !== "Approved") {
        throw new Error(`Seed product ${product.product_id} must be active and approved.`);
    }
}
if (!String(rawProduct.product_code || "").startsWith("RM-")) throw new Error("Raw-material seed product must use an RM- product code.");
if (!String(packagingProduct.product_code || "").startsWith("PKG-")) throw new Error("Packaging seed product must use a PKG- product code.");
if (Number(rawProduct.product_type) === Number(packagingProduct.product_type)) {
    throw new Error("Raw-material and packaging seed products must have different product types.");
}

const seeds = [
    {
        productId: rawProductId,
        parameterName: "Moisture Content",
        dataType: "Numeric",
        unitOfMeasure: "%",
        description: "Representative Phase 4 QA fixture for flour moisture.",
        targetMin: 10,
        targetMax: 14,
        expectedText: null,
        isCritical: true
    },
    {
        productId: rawProductId,
        parameterName: "Certificate of Analysis Present",
        dataType: "Boolean",
        unitOfMeasure: null,
        description: "Representative Phase 4 QA fixture for supplier documentation.",
        targetMin: null,
        targetMax: null,
        expectedText: "true",
        isCritical: true
    },
    {
        productId: rawProductId,
        parameterName: "Flour Appearance",
        dataType: "Text",
        unitOfMeasure: null,
        description: "Representative Phase 4 QA fixture for visual flour inspection.",
        targetMin: null,
        targetMax: null,
        expectedText: "Acceptable",
        isCritical: false
    },
    {
        productId: packagingProductId,
        parameterName: "Seal Strength",
        dataType: "Numeric",
        unitOfMeasure: "N/m",
        description: "Representative Phase 4 QA fixture for packaging seal strength.",
        targetMin: 15,
        targetMax: null,
        expectedText: null,
        isCritical: true
    },
    {
        productId: packagingProductId,
        parameterName: "Seal Integrity",
        dataType: "Boolean",
        unitOfMeasure: null,
        description: "Representative Phase 4 QA fixture for packaging seal integrity.",
        targetMin: null,
        targetMax: null,
        expectedText: "true",
        isCritical: true
    },
    {
        productId: packagingProductId,
        parameterName: "Print Quality",
        dataType: "Text",
        unitOfMeasure: null,
        description: "Representative Phase 4 QA fixture for packaging print inspection.",
        targetMin: null,
        targetMax: null,
        expectedText: "Acceptable",
        isCritical: false
    }
];

const createdParameterIds = [];
const createdSpecificationIds = [];
const resolved = [];

function equalNullableNumber(actual, expected) {
    if (actual === null || actual === undefined || actual === "") return expected === null;
    return expected !== null && Number(actual) === expected;
}

function equalExpectedText(actual, expected) {
    if (expected === null) return actual === null || actual === undefined || actual === "";
    return String(actual || "").trim().toLowerCase() === expected.toLowerCase();
}

try {
    for (const seed of seeds) {
        const parameterQuery = new URLSearchParams({
            "filter[parameter_name][_eq]": seed.parameterName,
            fields: "parameter_id,parameter_name,data_type,unit_of_measure",
            limit: "2"
        });
        let parameters = (await directus(`/items/purchase_order_qa_parameters?${parameterQuery.toString()}`)).data || [];
        if (parameters.length > 1) throw new Error(`Multiple QA parameters named ${seed.parameterName} exist.`);
        let parameter = parameters[0];
        if (!parameter) {
            if (auditOnly) throw new Error(`Missing QA parameter ${seed.parameterName}.`);
            parameter = (await directus("/items/purchase_order_qa_parameters", {
                method: "POST",
                body: JSON.stringify({
                    parameter_name: seed.parameterName,
                    data_type: seed.dataType,
                    unit_of_measure: seed.unitOfMeasure,
                    description: seed.description
                })
            })).data;
            createdParameterIds.push(Number(parameter.parameter_id));
            console.log(`[created] QA parameter ${seed.parameterName} (${parameter.parameter_id})`);
        }
        if (parameter.data_type !== seed.dataType || (parameter.unit_of_measure || null) !== seed.unitOfMeasure) {
            throw new Error(`QA parameter ${seed.parameterName} conflicts with the representative fixture definition.`);
        }

        const specificationQuery = new URLSearchParams({
            "filter[product_id][_eq]": String(seed.productId),
            "filter[parameter_id][_eq]": String(parameter.parameter_id),
            fields: "spec_id,product_id,parameter_id,target_min,target_max,expected_text,is_critical,product_parameter_key",
            limit: "2"
        });
        let specifications = (await directus(`/items/product_qa_specs?${specificationQuery.toString()}`)).data || [];
        if (specifications.length > 1) throw new Error(`Duplicate specification exists for ${seed.productId}/${parameter.parameter_id}.`);
        let specification = specifications[0];
        if (!specification) {
            if (auditOnly) throw new Error(`Missing specification for ${seed.productId}/${seed.parameterName}.`);
            specification = (await directus("/items/product_qa_specs", {
                method: "POST",
                body: JSON.stringify({
                    product_id: seed.productId,
                    parameter_id: parameter.parameter_id,
                    target_min: seed.targetMin,
                    target_max: seed.targetMax,
                    expected_text: seed.expectedText,
                    is_critical: seed.isCritical
                })
            })).data;
            createdSpecificationIds.push(Number(specification.spec_id));
            console.log(`[created] product QA specification ${specification.spec_id}`);
        }
        const expectedKey = `${seed.productId}:${parameter.parameter_id}`;
        const valid = equalNullableNumber(specification.target_min, seed.targetMin)
            && equalNullableNumber(specification.target_max, seed.targetMax)
            && equalExpectedText(specification.expected_text, seed.expectedText)
            && (specification.is_critical === seed.isCritical || Number(specification.is_critical) === Number(seed.isCritical))
            && specification.product_parameter_key === expectedKey;
        if (!valid) throw new Error(`Existing specification for ${seed.productId}/${seed.parameterName} differs from the fixture; it was not overwritten.`);
        resolved.push({ parameterId: Number(parameter.parameter_id), specId: Number(specification.spec_id), ...seed });
    }
} catch (error) {
    if (!auditOnly) {
        for (const specId of createdSpecificationIds.reverse()) {
            await directus(`/items/product_qa_specs/${specId}`, { method: "DELETE" }).catch(() => undefined);
        }
        for (const parameterId of createdParameterIds.reverse()) {
            await directus(`/items/purchase_order_qa_parameters/${parameterId}`, { method: "DELETE" }).catch(() => undefined);
        }
    }
    throw error;
}

for (const productId of productIds) {
    const productSpecs = resolved.filter(specification => specification.productId === productId);
    const types = new Set(productSpecs.map(specification => specification.dataType));
    if (!["Numeric", "Boolean", "Text"].every(type => types.has(type))) {
        throw new Error(`Product ${productId} does not have all three representative QA types.`);
    }
    if (!productSpecs.some(specification => specification.isCritical) || !productSpecs.some(specification => !specification.isCritical)) {
        throw new Error(`Product ${productId} must have both critical and non-critical fixtures.`);
    }
}

console.log(`${auditOnly ? "Audit" : "Seed"} complete: ${resolved.length} representative specifications verified.`);
console.log(JSON.stringify(resolved.map(({ parameterId, specId, productId, parameterName }) => ({ parameterId, specId, productId, parameterName }))));
