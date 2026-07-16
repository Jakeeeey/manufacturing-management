import fs from "node:fs";
import path from "node:path";

function readEnvironmentFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return Object.fromEntries(fs.readFileSync(filePath, "utf8").split(/\r?\n/).flatMap(rawLine => {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || !line.includes("=")) return [];
        const separator = line.indexOf("=");
        return [[line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2")]];
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

const definitions = [
    {
        field: "approval_rule_id",
        type: "integer",
        schema: {
            is_nullable: true,
            foreign_key_table: "purchase_order_approval_rules",
            foreign_key_column: "rule_id"
        },
        meta: { interface: "select-dropdown-m2o", special: ["m2o"], readonly: true, width: "full" }
    },
    {
        field: "approval_requires_finance",
        type: "boolean",
        schema: { is_nullable: true },
        meta: { interface: "boolean", readonly: true, width: "half" }
    },
    {
        field: "approval_allow_self_approval",
        type: "boolean",
        schema: { is_nullable: true },
        meta: { interface: "boolean", readonly: true, width: "half" }
    }
];

for (const definition of definitions) {
    const existing = await request(`/fields/purchase_order/${definition.field}`);
    if (existing.ok) {
        console.log(`[exists] purchase_order.${definition.field}`);
        continue;
    }
    if (![403, 404].includes(existing.status)) {
        throw new Error(`Unable to inspect purchase_order.${definition.field} (${existing.status}).`);
    }
    const created = await request("/fields/purchase_order", {
        method: "POST",
        body: JSON.stringify({
            field: definition.field,
            type: definition.type,
            schema: definition.schema,
            meta: { hidden: false, ...definition.meta }
        })
    });
    if (!created.ok) {
        const body = await created.text();
        throw new Error(`Failed to create purchase_order.${definition.field} (${created.status}): ${body.slice(0, 300)}`);
    }
    console.log(`[created] purchase_order.${definition.field}`);
}

const defaultRuleResponse = await request("/items/purchase_order_approval_rules?filter[rule_name][_eq]=Fail-closed%20default&fields=rule_id,allow_self_approval&limit=1");
if (!defaultRuleResponse.ok) throw new Error(`Unable to load the fail-closed approval rule (${defaultRuleResponse.status}).`);
const defaultRule = (await defaultRuleResponse.json()).data?.[0];
if (!defaultRule) throw new Error("Fail-closed default approval rule was not found.");
if (Number(defaultRule.allow_self_approval) !== 1) {
    const updated = await request(`/items/purchase_order_approval_rules/${defaultRule.rule_id}`, {
        method: "PATCH",
        body: JSON.stringify({ allow_self_approval: true })
    });
    if (!updated.ok) throw new Error(`Failed to enable self-approval on the fail-closed rule (${updated.status}).`);
    console.log("[updated] Fail-closed default allows self-approval");
} else {
    console.log("[exists] Fail-closed default allows self-approval");
}

console.log("Purchase Order Phase 3 Directus fields are ready.");
