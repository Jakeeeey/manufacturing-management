import assert from "node:assert/strict";
import fs from "node:fs";
import {
    INVENTORY_STATUS,
    isReceivingQueueShipmentStatus,
    RECEIVING_QUEUE_INVENTORY_STATUS_IDS,
    shipmentStatusMatchesFilter
} from "../src/app/api/manufacturing/procurement/_domain.ts";
import { purchaseOrderListQuerySchema } from "../src/app/api/manufacturing/purchase-orders/_schemas.ts";
import { validateReceivingMetadata } from "../src/modules/manufacturing-management/qa-receiving/receiving-metadata.ts";
import {
    applyQaDecision,
    deriveReceivingDisposition,
    ReceivingQuantityError
} from "../src/app/api/manufacturing/qa/_receiving-evaluation.ts";
import { buildMrpAllocationDrafts, buildReceivingRoutes } from "../src/app/api/manufacturing/qa-receiving/_preview-domain.ts";

assert.deepEqual([...RECEIVING_QUEUE_INVENTORY_STATUS_IDS], [
    INVENTORY_STATUS.APPROVED,
    INVENTORY_STATUS.EN_ROUTE,
    INVENTORY_STATUS.PARTIALLY_RECEIVED
]);

for (const status of ["Approved", "En Route", "Receiving (QA)", "Partially Received"]) {
    assert.equal(isReceivingQueueShipmentStatus(status), true, `${status} should be receivable.`);
}
for (const status of ["Requested", "Ordered", "Cancelled", "Received", "Rejected"]) {
    assert.equal(isReceivingQueueShipmentStatus(status), false, `${status} should not open an inspection.`);
}

assert.equal(shipmentStatusMatchesFilter("Receiving (QA)", "Partially Received"), true);
assert.equal(shipmentStatusMatchesFilter("Partially Received", "Receiving (QA)"), true);
assert.equal(shipmentStatusMatchesFilter("En Route", "Approved"), false);

for (const status of ["Approved", "En Route", "Receiving (QA)", "Partially Received", "Received"]) {
    assert.equal(purchaseOrderListQuerySchema.safeParse({ queue: "receiving", status }).success, true);
}
assert.equal(purchaseOrderListQuerySchema.safeParse({ queue: "receiving", status: "Rejected" }).success, false);

const shipmentHelper = fs.readFileSync("src/app/api/manufacturing/procurement/shipments/shipments-helper.ts", "utf8");
assert.match(shipmentHelper, /\.\.\.RECEIVING_QUEUE_INVENTORY_STATUS_IDS/);

const receivingHook = fs.readFileSync("src/modules/manufacturing-management/qa-receiving/hooks/useQAReceiving.ts", "utf8");
assert.doesNotMatch(receivingHook, /purchase-orders\/\$\{shipment\.shipment_id\}\/status/);
assert.doesNotMatch(receivingHook, /Auto transition status to/);

const validRawMaterial = {
    productName: "QA Raw Material",
    isPackaging: false,
    receivedQuantity: 1,
    batchNumber: "BATCH-001",
    lotId: "1",
    manufacturingDate: "2026-07-01",
    expirationDate: "2027-07-01"
};
assert.equal(validateReceivingMetadata("DR-001", "1", [validRawMaterial]), null);
assert.match(validateReceivingMetadata("", "1", [validRawMaterial]) || "", /Ticket \/ DR Number/);
assert.match(validateReceivingMetadata("DR-001", "", [validRawMaterial]) || "", /receiving warehouse branch/);
assert.match(validateReceivingMetadata("DR-001", "1", [{ ...validRawMaterial, batchNumber: "" }]) || "", /Supplier Batch Number/);
assert.match(validateReceivingMetadata("DR-001", "1", [{ ...validRawMaterial, lotId: "" }]) || "", /Storage Lot/);
assert.match(validateReceivingMetadata("DR-001", "1", [{ ...validRawMaterial, manufacturingDate: "" }]) || "", /Manufacturing Date/);
assert.match(validateReceivingMetadata("DR-001", "1", [{ ...validRawMaterial, expirationDate: "" }]) || "", /Expiry Date/);
assert.match(validateReceivingMetadata("DR-001", "1", [{
    ...validRawMaterial,
    manufacturingDate: "2027-07-02",
    expirationDate: "2027-07-01"
}]) || "", /cannot be later/);
assert.equal(validateReceivingMetadata("DR-002", "1", [{
    ...validRawMaterial,
    isPackaging: true,
    manufacturingDate: "",
    expirationDate: ""
}]), null);
assert.equal(validateReceivingMetadata("DR-003", "1", [{
    ...validRawMaterial,
    receivedQuantity: 0,
    batchNumber: "",
    lotId: "",
    manufacturingDate: "",
    expirationDate: ""
}]), null);

assert.equal(deriveReceivingDisposition({ receivedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0 }), "Passed");
assert.equal(deriveReceivingDisposition({ receivedQuantity: 10, acceptedQuantity: 7, rejectedQuantity: 3 }), "Partially Accepted");
assert.equal(deriveReceivingDisposition({ receivedQuantity: 10, acceptedQuantity: 0, rejectedQuantity: 10 }), "Rejected");
assert.equal(deriveReceivingDisposition({ receivedQuantity: 0, acceptedQuantity: 0, rejectedQuantity: 0 }), "Not Received");
assert.throws(() => deriveReceivingDisposition({ receivedQuantity: 10, acceptedQuantity: 8, rejectedQuantity: 1 }), ReceivingQuantityError);
assert.throws(() => deriveReceivingDisposition({ receivedQuantity: -1, acceptedQuantity: 0, rejectedQuantity: 0 }), ReceivingQuantityError);
assert.throws(() => deriveReceivingDisposition({ receivedQuantity: Number.NaN, acceptedQuantity: 0, rejectedQuantity: 0 }), ReceivingQuantityError);

const checklistDecision = (overrides = {}) => ({
    complete: true,
    hasCriticalFailure: false,
    hasNonCriticalFailure: false,
    forceRejected: false,
    requiredQaStatus: null,
    failedCriticalSpecIds: [],
    failedNonCriticalSpecIds: [],
    rejectionReason: null,
    evaluations: [],
    ...overrides
});
assert.deepEqual(applyQaDecision(
    { receivedQuantity: 10, acceptedQuantity: 7, rejectedQuantity: 3 },
    checklistDecision({ hasNonCriticalFailure: true, failedNonCriticalSpecIds: [2] })
), {
    disposition: "Partially Accepted",
    receivedQuantity: 10,
    acceptedQuantity: 7,
    rejectedQuantity: 3,
    forceRejected: false,
    rejectionReason: null
});
assert.deepEqual(applyQaDecision(
    { receivedQuantity: 10, acceptedQuantity: 10, rejectedQuantity: 0 },
    checklistDecision({
        hasCriticalFailure: true,
        forceRejected: true,
        requiredQaStatus: "Rejected",
        failedCriticalSpecIds: [1],
        rejectionReason: "Critical QA failure: Moisture."
    })
), {
    disposition: "Rejected",
    receivedQuantity: 10,
    acceptedQuantity: 0,
    rejectedQuantity: 10,
    forceRejected: true,
    rejectionReason: "Critical QA failure: Moisture."
});

const passedBranch = { id: 181, name: "Bihon Branch", code: "BIH" };
const rejectedBranch = { id: 182, name: "Bihon Bad Branch", code: "BIH-BAD" };
const passedType = { id: 1, name: "Purchase Receiving QA" };
const rejectedType = { id: 14, name: "QA Reject / Bad Order Receipt" };
const routeInput = {
    acceptedQuantity: 7,
    rejectedQuantity: 3,
    createdBy: 84,
    sourceDocumentNo: "DR-001",
    storageLotId: 103,
    storageLotName: "B-SEED-FLOUR",
    supplierBatchNumber: "BATCH-001",
    manufacturingDate: "2026-07-01",
    expiryDate: "2027-07-01",
    remarks: "Mixed inspection",
    rejectionReason: "Three units outside specification",
    allocationDrafts: [],
    unallocatedQuantity: 7
};
const mixedRoutes = buildReceivingRoutes(routeInput, passedBranch, rejectedBranch, passedType, rejectedType);
assert.deepEqual(mixedRoutes.map(route => [route.kind, route.quantity, route.branch.id, route.transactionType.name]), [
    ["Passed", 7, 181, "Purchase Receiving QA"],
    ["Rejected", 3, 182, "QA Reject / Bad Order Receipt"]
]);
assert.equal(mixedRoutes[0].receivingLineId, null);
assert.equal(mixedRoutes[0].inventoryLotId, null);
assert.equal(mixedRoutes[0].movementId, null);
assert.equal(mixedRoutes[0].storageLotName, "B-SEED-FLOUR");
assert.equal(mixedRoutes[0].unallocatedQuantity, 7);
assert.equal(mixedRoutes[1].remarks, "Three units outside specification");
assert.deepEqual(buildReceivingRoutes({ ...routeInput, acceptedQuantity: 10, rejectedQuantity: 0 }, passedBranch, null, passedType, null).map(route => route.kind), ["Passed"]);
assert.deepEqual(buildReceivingRoutes({ ...routeInput, acceptedQuantity: 0, rejectedQuantity: 0 }, passedBranch, null, null, null), []);
assert.throws(
    () => buildReceivingRoutes({ ...routeInput, acceptedQuantity: 0, rejectedQuantity: 10 }, passedBranch, null, null, rejectedType),
    /Rejected inventory routing is not configured/
);

const mrpAllocation = buildMrpAllocationDrafts(10, { id: 91, number: "JO-0091" }, [
    { jobOrderMaterialId: 22, remainingQuantity: 3 },
    { jobOrderMaterialId: 11, remainingQuantity: 4 },
    { jobOrderMaterialId: 33, remainingQuantity: 0 }
]);
assert.deepEqual(mrpAllocation.allocationDrafts.map(draft => [draft.jobOrderMaterialId, draft.quantity]), [[11, 4], [22, 3]]);
assert.equal(mrpAllocation.unallocatedQuantity, 3);
assert.equal(mrpAllocation.allocationDrafts[0].allocationId, null);
assert.equal(mrpAllocation.allocationDrafts[0].receivingLineId, null);
assert.equal(mrpAllocation.allocationDrafts[0].inventoryLotId, null);
assert.deepEqual(
    buildMrpAllocationDrafts(2, { id: 91, number: "JO-0091" }, [{ jobOrderMaterialId: 11, remainingQuantity: 4 }]),
    {
        allocationDrafts: [{
            allocationId: null,
            receivingLineId: null,
            inventoryLotId: null,
            jobOrder: { id: 91, number: "JO-0091" },
            jobOrderMaterialId: 11,
            quantity: 2
        }],
        unallocatedQuantity: 0
    }
);
assert.deepEqual(buildMrpAllocationDrafts(5, { id: 91, number: "JO-0091" }, []), { allocationDrafts: [], unallocatedQuantity: 5 });

const inspectionForm = fs.readFileSync("src/modules/manufacturing-management/qa-receiving/components/ShipmentInspectionForm.tsx", "utf8");
assert.match(inspectionForm, /Receiving Ticket \/ DR Number/);
assert.match(inspectionForm, /Manufacturing Date/);
assert.match(inspectionForm, /Rejected Quantity/);
assert.match(inspectionForm, /Server Disposition/);
assert.match(inspectionForm, /required={receivedVal > 0 && !row\.isPackaging}/);
assert.match(receivingHook, /setReceiptNumber\(""\)/);
assert.match(receivingHook, /previewReceivingQa/);
assert.doesNotMatch(receivingHook, /submitInspection/);

const previewRoute = fs.readFileSync("src/app/api/manufacturing/qa-receiving/preview/route.ts", "utf8");
assert.match(previewRoute, /PURCHASE_ORDER_MODULE_PATHS\.receiving/);
assert.match(previewRoute, /fetchProductQaSpecifications/);
assert.match(previewRoute, /bad_stock_branch_id/);
assert.match(previewRoute, /Purchase Receiving QA/);
assert.match(previewRoute, /QA Reject \/ Bad Order Receipt/);
assert.match(previewRoute, /Line \$\{line\.lineId\} does not belong to this purchase order/);
assert.match(previewRoute, /Product mismatch for line/);
assert.match(previewRoute, /purchase_intent,job_order_id/);
assert.match(previewRoute, /manufacturing_job_order_materials/);
assert.match(previewRoute, /buildMrpAllocationDrafts/);
assert.match(previewRoute, /MRP-demand line/);
assert.match(previewRoute, /let unallocatedQuantity = 0/);
assert.doesNotMatch(previewRoute, /method:\s*["'](?:POST|PATCH|DELETE)["']/);
assert.match(inspectionForm, /Server inventory routes/);
assert.match(inspectionForm, /Preview QA & Routes/);

const movementModal = fs.readFileSync("src/modules/manufacturing-management/qa-receiving/components/MovementPayloadModal.tsx", "utf8");
assert.match(movementModal, /Ledger Movement Verification/);
assert.match(movementModal, /Assigned on confirmation/);
assert.match(movementModal, /I verified these read-only movement and allocation drafts/);
assert.match(movementModal, /Acknowledge Preview/);
assert.doesNotMatch(movementModal, /fetch\(|commitReceiving|inventory_movements/);
assert.match(receivingHook, /setReceivingPreview\(preview\)/);
assert.match(receivingHook, /setPreviewOpen\(true\)/);
const submitBlock = receivingHook.slice(receivingHook.indexOf("const handleSubmitInspection"), receivingHook.indexOf("const acknowledgePreview"));
const previewCatch = submitBlock.slice(submitBlock.lastIndexOf("catch"));
assert.doesNotMatch(previewCatch, /setInspectionRows|setReceiptNumber|setSelectedBranchId|setQaReadings|setReceivingPreview\(null\)/);

console.log("Purchase-order Phase 5 checkpoints 1-12 contract smoke passed.");
