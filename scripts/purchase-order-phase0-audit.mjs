import fs from "node:fs";
import path from "node:path";

const baselineMode = process.argv.includes("--baseline");

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

if (!directusUrl || !staticToken) {
    console.error("Phase 0 audit requires NEXT_PUBLIC_API_BASE_URL and DIRECTUS_STATIC_TOKEN.");
    process.exit(1);
}

const checks = [];
const warnings = [];

function record(name, passed, detail) {
    checks.push({ name, passed, detail });
    const symbol = passed ? "PASS" : baselineMode ? "GAP" : "FAIL";
    console.log(`[${symbol}] ${name}${detail ? ` - ${detail}` : ""}`);
}

function warn(name, detail) {
    warnings.push({ name, detail });
    console.log(`[WARN] ${name}${detail ? ` - ${detail}` : ""}`);
}

async function directus(pathname) {
    const response = await fetch(`${directusUrl}${pathname}`, {
        headers: { Authorization: `Bearer ${staticToken}`, Accept: "application/json" },
        cache: "no-store"
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
    }
    return response.json();
}

const requiredFields = {
    purchase_order: [
        "purchase_order_id", "currency_code", "exchange_rate", "total_foreign_currency", "is_import", "workflow_revision",
        "approval_rule_id", "approval_requires_finance", "approval_allow_self_approval"
    ],
    purchase_order_products: [
        "purchase_order_product_id", "purchase_order_id", "product_id", "purchase_intent", "job_order_id",
        "unit_price_foreign", "gross_amount_foreign", "net_amount_foreign", "discount_percent", "vat_percent", "withholding_percent"
    ],
    purchase_order_receiving: [
        "purchase_order_product_id", "purchase_order_id", "product_id", "received_quantity", "quantity_rejected", "qa_status"
    ],
    inventory_lots: ["id", "product_id", "branch_id", "lot_id", "batch_no", "quantity", "qa_status"],
    inventory_movements: [
        "movement_id", "product_id", "lot_id", "branch_id", "transaction_type_id", "source_document_id", "quantity", "created_by"
    ],
    purchase_order_qa_parameters: ["parameter_id", "parameter_name", "data_type", "unit_of_measure"],
    product_qa_specs: [
        "spec_id", "product_id", "parameter_id", "target_min", "target_max", "expected_text", "is_critical"
    ],
    purchase_order_receiving_qa_results: [
        "result_id", "receiving_line_id", "spec_id", "actual_reading", "is_passed"
    ],
    purchase_order_approval_rules: [
        "rule_id", "priority", "minimum_total_php", "maximum_total_php", "currency_code", "import_scope",
        "product_category_id", "requires_finance", "allow_self_approval", "is_active"
    ],
    purchase_order_approval_history: [
        "history_id", "purchase_order_id", "action", "approval_stage", "actor_id", "revision_before", "revision_after"
    ],
    purchase_order_approval_role_permissions: [
        "permission_id", "role_id", "user_id", "approval_stage", "can_reject", "is_active"
    ],
    branches: ["id", "isBadStock", "bad_stock_branch_id"],
    inventory_transaction_types: ["transaction_type_id", "type_name", "direction", "origin_table"]
};

try {
    const body = await directus("/users/me?fields=id,role.name,policies.policy.name");
    const user = body.data || {};
    const policyNames = new Set((user.policies || []).map(entry => entry?.policy?.name).filter(Boolean));
    const restricted = user.role?.name === "Manufacturing Procurement Service"
        || policyNames.has("Manufacturing Procurement Service");
    if (!restricted) {
        warn("Restricted Manufacturing static-token identity", `deferred; current role ${user.role?.name || "unknown"}`);
    } else record(
        "Restricted Manufacturing static-token identity",
        true,
        "Manufacturing Procurement Service"
    );
} catch (error) {
    warn("Restricted Manufacturing static-token identity", `deferred; ${error.message}`);
}

for (const [collection, expectedFields] of Object.entries(requiredFields)) {
    try {
        const body = await directus(`/fields/${collection}`);
        const actualFields = new Set((body.data || []).map(field => field.field));
        const missing = expectedFields.filter(field => !actualFields.has(field));
        record(`Fields: ${collection}`, missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : `${expectedFields.length} required fields`);
    } catch (error) {
        record(`Fields: ${collection}`, false, error.message);
    }
}

async function requireIds(collection, ids) {
    try {
        const body = await directus(`/items/${collection}?fields=id&filter[id][_in]=${ids.join(",")}&limit=-1`);
        const actual = new Set((body.data || []).map(row => Number(row.id)));
        const missing = ids.filter(id => !actual.has(id));
        record(`Seed IDs: ${collection}`, missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : ids.join(", "));
    } catch (error) {
        record(`Seed IDs: ${collection}`, false, error.message);
    }
}

await requireIds("transaction_status", [1, 3, 6, 7, 9, 11, 12, 13]);
await requireIds("payment_status", [1, 3, 4, 5, 8]);

try {
    const body = await directus("/items/inventory_transaction_types?fields=transaction_type_id,type_name,direction,origin_table&limit=-1");
    const rows = body.data || [];
    const accepted = rows.filter(row => row.type_name === "Purchase Receiving QA" && row.direction === "IN" && row.origin_table === "purchase_order_receiving");
    const rejected = rows.filter(row => row.type_name === "QA Reject / Bad Order Receipt" && row.direction === "IN" && row.origin_table === "purchase_order_receiving");
    const occupied = rows.filter(row => [1, 2].includes(Number(row.transaction_type_id)));
    record("Accepted movement type", accepted.length === 1, `matches ${accepted.length}`);
    record("Rejected movement type", rejected.length === 1, `matches ${rejected.length}`);
    record("Reserved job-order movement types", occupied.length === 2, "IDs 1 and 2 remain reserved");
} catch (error) {
    record("Inventory movement types", false, error.message);
}

try {
    const body = await directus("/items/branches?fields=id,isActive,isBadStock,bad_stock_branch_id&limit=-1");
    const rows = body.data || [];
    const expectedMappings = new Map([[181, 182], [183, 184], [185, 186]]);
    for (const [sourceId, targetId] of expectedMappings) {
        const source = rows.find(row => Number(row.id) === sourceId);
        const relation = source?.bad_stock_branch_id;
        const actualTarget = typeof relation === "object" ? Number(relation?.id) : Number(relation);
        const validTarget = rows.find(row => Number(row.id) === targetId);
        const valid = actualTarget === targetId && Number(validTarget?.isActive) === 1 && Number(validTarget?.isBadStock) === 1;
        record(`Bad-stock mapping ${sourceId} -> ${targetId}`, valid, valid ? "configured" : `actual ${actualTarget || "none"}`);
    }
    const urdaneta = rows.find(row => Number(row.id) === 163);
    record("Urdaneta rejection remains blocked", !urdaneta?.bad_stock_branch_id, urdaneta?.bad_stock_branch_id ? "unexpected mapping" : "no bad-stock branch");
} catch (error) {
    record("Bad-stock branch mappings", false, error.message);
}

try {
    const body = await directus("/items/purchase_order_approval_rules?filter[rule_name][_eq]=Fail-closed%20default&fields=rule_id,requires_finance,allow_self_approval,is_active&limit=2");
    const rows = body.data || [];
    const valid = rows.length === 1
        && Number(rows[0].requires_finance) === 1
        && Number(rows[0].allow_self_approval) === 1
        && Number(rows[0].is_active) === 1;
    record("Fail-closed approval rule", valid, `matches ${rows.length}`);
} catch (error) {
    record("Fail-closed approval rule", false, error.message);
}

try {
    const body = await directus("/items/purchase_order_approval_role_permissions?filter[is_active][_eq]=1&fields=approval_stage,role_id,user_id&limit=-1");
    const stages = new Set((body.data || []).map(row => row.approval_stage));
    console.log(`[INFO] Optional approval-stage mappings - ${stages.size ? [...stages].join(", ") : "not configured; Phase 3 uses /mm/approval module access"}`);
} catch (error) {
    console.log(`[INFO] Optional approval-stage mappings could not be read - ${error.message}`);
}

const failures = checks.filter(check => !check.passed);
console.log(`\nPhase 0 audit: ${checks.length - failures.length}/${checks.length} required checks passed; ${warnings.length} deferred warnings.`);
if (failures.length && !baselineMode) process.exit(1);
