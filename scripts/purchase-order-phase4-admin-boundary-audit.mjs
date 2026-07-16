import fs from "node:fs";
import path from "node:path";

function readEnvironmentFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return Object.fromEntries(fs.readFileSync(filePath, "utf8").split(/\r?\n/).flatMap(rawLine => {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) return [];
        const separator = line.indexOf("=");
        if (separator < 1) return [];
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        return [[key, value]];
    }));
}

const fileEnvironment = readEnvironmentFile(path.resolve(process.cwd(), ".env.local"));
const directusUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || fileEnvironment.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const staticToken = process.env.DIRECTUS_STATIC_TOKEN || fileEnvironment.DIRECTUS_STATIC_TOKEN || "";

if (!directusUrl || !staticToken) {
    console.error("Audit requires NEXT_PUBLIC_API_BASE_URL and DIRECTUS_STATIC_TOKEN.");
    process.exit(1);
}

async function directus(pathname) {
    const response = await fetch(`${directusUrl}${pathname}`, {
        headers: { Authorization: `Bearer ${staticToken}`, Accept: "application/json" },
        cache: "no-store"
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`GET ${pathname} failed (${response.status}): ${detail.slice(0, 300)}`);
    }
    return response.json();
}

const policyName = "Manufacturing Procurement Service";
const qaCollections = ["purchase_order_qa_parameters", "product_qa_specs"];
const mutationActions = new Set(["create", "update", "delete", "share"]);

const currentUser = (await directus("/users/me?fields=id")).data;
if (!currentUser?.id) throw new Error("The configured static token identity could not be resolved.");

const accessQuery = new URLSearchParams({
    "filter[user][_eq]": String(currentUser.id),
    fields: "policy.name,policy.admin_access,role.name",
    limit: "-1"
});
const accessRows = (await directus(`/access?${accessQuery.toString()}`)).data || [];
const administratorBacked = accessRows.some(row => row.policy?.admin_access === true || row.policy?.name === "Administrator");
if (administratorBacked) {
    console.warn("[WARN] DIRECTUS_STATIC_TOKEN is Administrator-backed; replacement remains explicitly deferred.");
} else {
    console.log("[PASS] DIRECTUS_STATIC_TOKEN is not Administrator-backed.");
}

const policyQuery = new URLSearchParams({
    "filter[name][_eq]": policyName,
    fields: "id,name,admin_access,app_access",
    limit: "2"
});
const policies = (await directus(`/policies?${policyQuery.toString()}`)).data || [];
if (policies.length !== 1) throw new Error(`Expected exactly one ${policyName} policy; found ${policies.length}.`);
const policy = policies[0];
if (policy.admin_access === true || policy.app_access === true) {
    throw new Error(`${policyName} must not have Directus administrator or application access.`);
}

const permissionQuery = new URLSearchParams({
    "filter[policy][_eq]": String(policy.id),
    "filter[collection][_in]": qaCollections.join(","),
    fields: "collection,action,fields",
    limit: "-1"
});
const permissions = (await directus(`/permissions?${permissionQuery.toString()}`)).data || [];

for (const collection of qaCollections) {
    const collectionPermissions = permissions.filter(permission => permission.collection === collection);
    if (!collectionPermissions.some(permission => permission.action === "read")) {
        throw new Error(`${policyName} is missing ${collection}.read permission.`);
    }
    const forbidden = collectionPermissions.filter(permission => mutationActions.has(permission.action));
    if (forbidden.length > 0) {
        throw new Error(`${policyName} grants forbidden ${collection} actions: ${forbidden.map(permission => permission.action).join(", ")}.`);
    }
    console.log(`[PASS] ${collection} is read-only for ${policyName}.`);
}

console.log("Phase 4 QA master admin-boundary audit completed.");
