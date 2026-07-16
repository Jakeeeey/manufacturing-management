import assert from "node:assert/strict";
import { calculatePurchaseOrderTotals } from "../src/app/api/manufacturing/purchase-orders/_domain.ts";
import { purchaseOrderCreateSchema, purchaseOrderListQuerySchema } from "../src/app/api/manufacturing/purchase-orders/_schemas.ts";
import { INVENTORY_STATUS, inventoryStatusToPurchaseOrderStatus, inventoryStatusToShipmentStatus, shipmentStatusToInventoryStatus } from "../src/app/api/manufacturing/procurement/_domain.ts";

const line = {
    productId: 10,
    parentProductId: 10,
    purchaseIntent: "Buffer_Stock",
    jobOrderId: null,
    quantity: 2,
    unitPrice: 100,
    discountPercent: 10,
    vatPercent: 12,
    withholdingPercent: 2
};
const totals = calculatePurchaseOrderTotals([line], 1);
assert.deepEqual(totals, {
    lines: [{
        grossForeign: 200,
        discountForeign: 20,
        vatForeign: 21.6,
        withholdingForeign: 3.6,
        netForeign: 198,
        grossPhp: 200,
        discountPhp: 20,
        vatPhp: 21.6,
        withholdingPhp: 3.6,
        netPhp: 198
    }],
    grossPhp: 200,
    discountPhp: 20,
    vatPhp: 21.6,
    withholdingPhp: 3.6,
    netPhp: 198,
    netForeign: 198
});

const order = {
    supplierId: 1,
    branchId: 1,
    paymentTypeId: 1,
    priceType: "Internal",
    currencyCode: "PHP",
    exchangeRate: 1,
    expectedTotals: {
        grossPhp: 200,
        discountPhp: 20,
        vatPhp: 21.6,
        withholdingPhp: 3.6,
        netPhp: 198,
        netForeign: 198
    },
    lines: [line]
};

assert.equal(purchaseOrderCreateSchema.safeParse(order).success, true);
assert.equal(purchaseOrderCreateSchema.safeParse({ ...order, exchangeRate: 58 }).success, false);
assert.equal(purchaseOrderCreateSchema.safeParse({
    ...order,
    lines: [{ ...line, purchaseIntent: "MRP_Demand", jobOrderId: null }]
}).success, false);
assert.equal(purchaseOrderCreateSchema.safeParse({
    ...order,
    lines: [{ ...line, purchaseIntent: "Buffer_Stock", jobOrderId: 99 }]
}).success, false);
assert.equal(purchaseOrderCreateSchema.safeParse({ ...order, lines: [line, line] }).success, false);
assert.equal(purchaseOrderCreateSchema.safeParse({
    ...order,
    lines: [{ ...line, discountPercent: -1 }]
}).success, false);

assert.equal(inventoryStatusToPurchaseOrderStatus(INVENTORY_STATUS.REQUESTED), "Requested");
assert.equal(inventoryStatusToShipmentStatus(INVENTORY_STATUS.REQUESTED), "Ordered");
assert.equal(shipmentStatusToInventoryStatus("Requested"), INVENTORY_STATUS.REQUESTED);
assert.equal(purchaseOrderListQuerySchema.safeParse({ status: "Requested" }).success, true);
assert.equal(purchaseOrderListQuerySchema.safeParse({ status: "Ordered" }).success, true);

console.log("Purchase Order Phase 2 contract smoke tests passed.");
