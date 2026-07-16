import assert from "node:assert/strict";
import {
    matchesPurchaseOrderApprovalRule,
    selectPurchaseOrderApprovalRule
} from "../src/app/api/manufacturing/purchase-orders/_domain.ts";

const context = {
    totalPhp: 250_000,
    currencyCode: "USD",
    isImport: true,
    productCategoryIds: [10, 20],
    businessDate: "2026-07-15"
};

const fallback = {
    ruleId: 1,
    priority: -1000,
    minimumTotalPhp: 0,
    maximumTotalPhp: null,
    currencyCode: null,
    importScope: "Any",
    productCategoryId: null,
    requiresFinance: true,
    allowSelfApproval: false,
    effectiveFrom: null,
    effectiveTo: null,
    isActive: true
};

const importRule = {
    ...fallback,
    ruleId: 2,
    priority: 100,
    minimumTotalPhp: 100_000,
    currencyCode: "USD",
    importScope: "Import",
    productCategoryId: 20,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-12-31"
};

assert.equal(matchesPurchaseOrderApprovalRule(importRule, context), true);
assert.equal(matchesPurchaseOrderApprovalRule(importRule, { ...context, isImport: false }), false);
assert.equal(matchesPurchaseOrderApprovalRule(importRule, { ...context, totalPhp: 99_999 }), false);
assert.equal(matchesPurchaseOrderApprovalRule(importRule, { ...context, currencyCode: "PHP" }), false);
assert.equal(matchesPurchaseOrderApprovalRule(importRule, { ...context, productCategoryIds: [10] }), false);
assert.equal(matchesPurchaseOrderApprovalRule(importRule, { ...context, businessDate: "2027-01-01" }), false);
assert.equal(selectPurchaseOrderApprovalRule([fallback, importRule], context)?.ruleId, 2);
assert.equal(selectPurchaseOrderApprovalRule([], context), null);

console.log("Purchase Order Phase 0 domain smoke tests passed.");
