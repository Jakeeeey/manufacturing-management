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
const staticToken = process.env.DIRECTUS_STATIC_TOKEN || fileEnvironment.DIRECTUS_STATIC_TOKEN || "";
const verifyWrite = process.argv.includes("--verify-write");

if (!directusUrl || !staticToken) {
    console.error("Phase 4 uniqueness audit requires NEXT_PUBLIC_API_BASE_URL and DIRECTUS_STATIC_TOKEN.");
    process.exit(1);
}

async function request(pathname, options = {}) {
    return fetch(`${directusUrl}${pathname}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${staticToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        cache: "no-store"
    });
}

async function readRows(pathname, message) {
    const response = await request(pathname);
    if (!response.ok) throw new Error(`${message} (${response.status}): ${(await response.text()).slice(0, 300)}`);
    const body = await response.json();
    if (!Array.isArray(body.data)) throw new Error(`${message}: Directus returned an invalid response.`);
    return body.data;
}

const specifications = await readRows(
    "/items/product_qa_specs?fields=spec_id,product_id,parameter_id,product_parameter_key&limit=-1",
    "Unable to scan product QA specifications"
);
const pairs = new Map();
for (const specification of specifications) {
    const productId = typeof specification.product_id === "object" ? specification.product_id?.product_id : specification.product_id;
    const parameterId = typeof specification.parameter_id === "object" ? specification.parameter_id?.parameter_id : specification.parameter_id;
    const key = `${Number(productId)}:${Number(parameterId)}`;
    if (specification.product_parameter_key !== key) {
        console.error(`[FAIL] specification ${specification.spec_id} has identity key ${specification.product_parameter_key || "missing"}; expected ${key}`);
        process.exit(1);
    }
    pairs.set(key, [...(pairs.get(key) || []), specification.spec_id]);
}
const duplicates = [...pairs.entries()].filter(([, ids]) => ids.length > 1);
if (duplicates.length) {
    for (const [key, ids] of duplicates) console.error(`[FAIL] duplicate ${key} in specs ${ids.join(", ")}`);
    process.exit(1);
}
console.log(`[PASS] ${specifications.length} product QA specifications contain no duplicate product/parameter pairs.`);

if (!verifyWrite) {
    console.log("[INFO] Run with --verify-write to prove database-level duplicate rejection.");
} else {
    const products = await readRows("/items/products?fields=product_id&sort=product_id&limit=1", "Unable to select a verification product");
    const productId = Number(products[0]?.product_id);
    if (!Number.isSafeInteger(productId) || productId <= 0) throw new Error("No product is available for uniqueness verification.");

    const marker = `__QA_UNIQUENESS_${Date.now()}`;
    let parameterId = null;
    const specificationIds = [];
    let verificationError = null;
    let cleanupError = null;

    try {
    const parameterResponse = await request("/items/purchase_order_qa_parameters", {
        method: "POST",
        body: JSON.stringify({
            parameter_name: marker,
            data_type: "Numeric",
            unit_of_measure: "%",
            description: "Temporary Phase 4 uniqueness verification record"
        })
    });
    if (!parameterResponse.ok) throw new Error(`Unable to create temporary QA parameter (${parameterResponse.status}).`);
    parameterId = Number((await parameterResponse.json()).data?.parameter_id);
    if (!Number.isSafeInteger(parameterId) || parameterId <= 0) throw new Error("Temporary QA parameter did not return an ID.");

    const payload = { product_id: productId, parameter_id: parameterId, target_min: 0, target_max: 1, is_critical: false };
    const firstResponse = await request("/items/product_qa_specs", { method: "POST", body: JSON.stringify(payload) });
    if (!firstResponse.ok) throw new Error(`Unable to create temporary QA specification (${firstResponse.status}): ${(await firstResponse.text()).slice(0, 300)}`);
    const firstSpecification = (await firstResponse.json()).data;
    specificationIds.push(Number(firstSpecification?.spec_id));
    const expectedKey = `${productId}:${parameterId}`;
    if (firstSpecification?.product_parameter_key !== expectedKey) {
        throw new Error(`Identity flow returned ${firstSpecification?.product_parameter_key || "no key"}; expected ${expectedKey}.`);
    }

    const duplicateResponse = await request("/items/product_qa_specs", { method: "POST", body: JSON.stringify(payload) });
    if (duplicateResponse.ok) {
        specificationIds.push(Number((await duplicateResponse.json()).data?.spec_id));
        throw new Error("Database accepted a duplicate product/parameter specification.");
    }
    console.log(`[PASS] Duplicate specification was rejected with status ${duplicateResponse.status}.`);
    } catch (error) {
        verificationError = error;
    } finally {
        if (parameterId) {
            const remaining = await readRows(
                `/items/product_qa_specs?fields=spec_id&filter[parameter_id][_eq]=${parameterId}&limit=-1`,
                "Unable to locate temporary specifications during cleanup"
            ).catch(error => {
                cleanupError = error;
                return [];
            });
            for (const row of remaining) specificationIds.push(Number(row.spec_id));
        }
        const uniqueSpecificationIds = [...new Set(specificationIds.filter(Number.isSafeInteger))];
        for (const specificationId of uniqueSpecificationIds.reverse()) {
            const response = await request(`/items/product_qa_specs/${specificationId}`, { method: "DELETE" });
            if (!response.ok && response.status !== 404) cleanupError = new Error(`Failed to delete temporary specification ${specificationId}.`);
        }
        if (parameterId) {
            const response = await request(`/items/purchase_order_qa_parameters/${parameterId}`, { method: "DELETE" });
            if (!response.ok && response.status !== 404) cleanupError = new Error(`Failed to delete temporary parameter ${parameterId}.`);
        }
    }

    if (cleanupError) throw cleanupError;
    const leftoverParameters = await readRows(
        `/items/purchase_order_qa_parameters?fields=parameter_id&filter[parameter_name][_eq]=${encodeURIComponent(marker)}&limit=-1`,
        "Unable to verify temporary-record cleanup"
    );
    if (leftoverParameters.length) throw new Error(`Temporary verification parameter ${marker} was not removed.`);
    console.log(`[PASS] Temporary verification records for ${marker} were removed.`);
    if (verificationError) throw verificationError;
    console.log(`[PASS] Database enforces unique product/parameter QA specifications for product ${productId}.`);
}
