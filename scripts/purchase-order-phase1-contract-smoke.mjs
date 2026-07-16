import assert from "node:assert/strict";
import {
    modulesForStatus,
    purchaseOrderApprovalSchema,
    legacyPurchaseOrderCreateSchema,
    purchaseOrderListQuerySchema,
    purchaseOrderStatusUpdateSchema
} from "../src/app/api/manufacturing/purchase-orders/_schemas.ts";

const validOrder = {
    shipmentData: {
        reference_number: "QA-PO-PHASE1",
        supplier_id: 1,
        exchange_rate: 58,
        total_foreign_currency: 2,
        total_php_value: 116,
        status: "Ordered",
        date_received: "2026-07-15",
        branch_id: 1,
        payment_type: 1,
        price_type: "Internal"
    },
    lineItems: [{ product_id: 1, quantity_ordered: 2, base_unit_cost_php: 58 }]
};

assert.equal(legacyPurchaseOrderCreateSchema.safeParse(validOrder).success, true);
assert.equal(legacyPurchaseOrderCreateSchema.safeParse({ ...validOrder, lineItems: [] }).success, false);
assert.equal(legacyPurchaseOrderCreateSchema.safeParse({
    ...validOrder,
    lineItems: [{ product_id: 1, quantity_ordered: -1, base_unit_cost_php: 58 }]
}).success, false);

assert.equal(purchaseOrderApprovalSchema.safeParse({ action: "approve" }).success, false);
assert.equal(purchaseOrderApprovalSchema.safeParse({ action: "reject", workflowRevision: 0, remarks: "Invalid cost" }).success, true);
assert.equal(purchaseOrderStatusUpdateSchema.safeParse({ shipmentId: 1, status: "Unknown" }).success, false);

const query = purchaseOrderListQuerySchema.parse({ page: "2", limit: "25", direction: "asc" });
assert.deepEqual({ page: query.page, limit: query.limit, direction: query.direction }, { page: 2, limit: 25, direction: "asc" });
assert.equal(purchaseOrderListQuerySchema.safeParse({ sort: "supplier_name" }).success, false);
assert.equal(modulesForStatus("Received").includes("/mm/qa-receiving"), true);
assert.equal(modulesForStatus("En Route").includes("/mm/approval"), true);

console.log("Purchase Order Phase 1 contract smoke tests passed.");
