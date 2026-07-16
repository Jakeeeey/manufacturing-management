import assert from "node:assert/strict";
import fs from "node:fs";
import {
    derivePurchaseOrderWorkflowStage,
    selectPurchaseOrderApprovalRule
} from "../src/app/api/manufacturing/purchase-orders/_domain.ts";
import {
    canTransitionInventoryStatus,
    INVENTORY_STATUS
} from "../src/app/api/manufacturing/procurement/_domain.ts";
import {
    purchaseOrderApprovalSchema,
    purchaseOrderListQuerySchema
} from "../src/app/api/manufacturing/purchase-orders/_schemas.ts";

assert.equal(derivePurchaseOrderWorkflowStage({ inventoryStatus: 1, approverId: null, financeId: null, requiresFinance: true }), "Plant");
assert.equal(derivePurchaseOrderWorkflowStage({ inventoryStatus: 1, approverId: 10, financeId: null, requiresFinance: true }), "Finance");
assert.equal(derivePurchaseOrderWorkflowStage({ inventoryStatus: 1, approverId: 10, financeId: null, requiresFinance: false }), "Complete");
assert.equal(derivePurchaseOrderWorkflowStage({ inventoryStatus: 3, approverId: 10, financeId: 20, requiresFinance: true }), "Complete");
assert.equal(derivePurchaseOrderWorkflowStage({ inventoryStatus: 13, approverId: null, financeId: null, requiresFinance: true }), "Rejected");

assert.equal(purchaseOrderApprovalSchema.safeParse({ action: "approve", workflowRevision: 0, expectedRuleId: 1 }).success, true);
assert.equal(purchaseOrderApprovalSchema.safeParse({ action: "approve", workflowRevision: -1 }).success, false);
assert.equal(purchaseOrderApprovalSchema.safeParse({ action: "reject", workflowRevision: 1 }).success, false);
assert.equal(purchaseOrderApprovalSchema.safeParse({ action: "reject", workflowRevision: 1, remarks: "Budget declined" }).success, true);

assert.equal(canTransitionInventoryStatus(INVENTORY_STATUS.REJECTED, INVENTORY_STATUS.EN_ROUTE), false);
assert.equal(canTransitionInventoryStatus(INVENTORY_STATUS.REJECTED, INVENTORY_STATUS.PARTIALLY_RECEIVED), false);
assert.equal(canTransitionInventoryStatus(INVENTORY_STATUS.REJECTED, INVENTORY_STATUS.RECEIVED), false);
assert.equal(purchaseOrderListQuerySchema.safeParse({ queue: "receiving", status: "En Route" }).success, true);
assert.equal(purchaseOrderListQuerySchema.safeParse({ queue: "receiving", status: "Receiving (QA)" }).success, true);
assert.equal(purchaseOrderListQuerySchema.safeParse({ queue: "receiving", status: "Received", includeReceived: "true" }).success, true);
assert.equal(purchaseOrderListQuerySchema.safeParse({ queue: "receiving", status: "Rejected" }).success, false);
assert.equal(purchaseOrderListQuerySchema.safeParse({ status: "Rejected" }).success, true);

const baseRule = {
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
const plantOnly = { ...baseRule, ruleId: 2, priority: 100, maximumTotalPhp: 99_999, currencyCode: "PHP", importScope: "Domestic", requiresFinance: false };
assert.equal(selectPurchaseOrderApprovalRule([baseRule, plantOnly], {
    totalPhp: 1_000,
    currencyCode: "PHP",
    isImport: false,
    productCategoryIds: [],
    businessDate: "2026-07-15"
})?.ruleId, 2);
assert.equal(selectPurchaseOrderApprovalRule([baseRule, plantOnly], {
    totalPhp: 1_000,
    currencyCode: "USD",
    isImport: true,
    productCategoryIds: [],
    businessDate: "2026-07-15"
})?.ruleId, 1);

const approvalSource = fs.readFileSync(new URL("../src/app/api/manufacturing/purchase-orders/_approval-service.ts", import.meta.url), "utf8");
assert.match(approvalSource, /workflow_revision:\s*\{ _eq: revision \}/);
assert.match(approvalSource, /Another approval action changed this purchase order/);
assert.match(approvalSource, /purchase_order_approval_history/);
assert.doesNotMatch(approvalSource, /cannot approve or reject a purchase order that you encoded/i);
assert.match(approvalSource, /approval_allow_self_approval: 1/);

console.log("Purchase Order Phase 3 contract smoke tests passed.");
