import fs from "node:fs";
import path from "node:path";

function readEnvironmentFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return Object.fromEntries(fs.readFileSync(filePath, "utf8").split(/\r?\n/).flatMap(rawLine => {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) return [];
        const separator = line.indexOf("=");
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [[key, value]];
    }));
}

const fileEnvironment = readEnvironmentFile(path.resolve(process.cwd(), ".env.local"));
const directusUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || fileEnvironment.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const email = process.env.DIRECTUS_ADMIN_EMAIL || "";
const password = process.env.DIRECTUS_ADMIN_PASSWORD || "";

if (!directusUrl || !email || !password) {
    console.error("Setup requires NEXT_PUBLIC_API_BASE_URL, DIRECTUS_ADMIN_EMAIL, and DIRECTUS_ADMIN_PASSWORD.");
    process.exit(1);
}

const login = await fetch(`${directusUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
});
if (!login.ok) throw new Error(`Directus login failed (${login.status}).`);
const token = (await login.json()).data?.access_token;
if (!token) throw new Error("Directus login did not return an access token.");

async function request(pathname, init = {}) {
    return fetch(`${directusUrl}${pathname}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers || {})
        }
    });
}

const fields = [
    { field: "unit_price_foreign", type: "decimal", scale: 4, width: "half" },
    { field: "gross_amount_foreign", type: "decimal", scale: 2, width: "half" },
    { field: "net_amount_foreign", type: "decimal", scale: 2, width: "half" },
    { field: "discount_percent", type: "decimal", scale: 4, width: "third" },
    { field: "vat_percent", type: "decimal", scale: 4, width: "third" },
    { field: "withholding_percent", type: "decimal", scale: 4, width: "third" }
];

for (const definition of fields) {
    const existing = await request(`/fields/purchase_order_products/${definition.field}`);
    if (existing.ok) {
        console.log(`[exists] purchase_order_products.${definition.field}`);
        continue;
    }
    if (existing.status !== 403 && existing.status !== 404) {
        throw new Error(`Unable to inspect purchase_order_products.${definition.field} (${existing.status}).`);
    }
    const created = await request("/fields/purchase_order_products", {
        method: "POST",
        body: JSON.stringify({
            field: definition.field,
            type: definition.type,
            schema: { is_nullable: false, default_value: 0, numeric_precision: 15, numeric_scale: definition.scale },
            meta: { interface: "input", width: definition.width, hidden: false, readonly: false }
        })
    });
    if (!created.ok) {
        const body = await created.text();
        throw new Error(`Failed to create purchase_order_products.${definition.field} (${created.status}): ${body.slice(0, 300)}`);
    }
    console.log(`[created] purchase_order_products.${definition.field}`);
}

console.log("Purchase Order Phase 2 Directus fields are ready.");
