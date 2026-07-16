import type { QaChecklistItemEvaluation } from "../qa/_purchase-specification-domain";
import type { ReceivingDisposition } from "../qa/_receiving-evaluation";

export type ReceivingRouteKind = "Passed" | "Rejected";

export interface ReceivingRouteBranch {
    id: number;
    name: string;
    code: string;
}

export interface ReceivingRouteTransactionType {
    id: number;
    name: string;
}

export interface ReceivingMrpAllocationDraft {
    allocationId: null;
    receivingLineId: null;
    inventoryLotId: null;
    jobOrder: { id: number; number: string };
    jobOrderMaterialId: number;
    quantity: number;
}

export interface ReceivingMrpMaterialRequirement {
    jobOrderMaterialId: number;
    remainingQuantity: number;
}

export interface ReceivingMovementRoute {
    movementId: null;
    kind: ReceivingRouteKind;
    qaStatus: ReceivingRouteKind;
    quantity: number;
    branch: ReceivingRouteBranch;
    transactionType: ReceivingRouteTransactionType;
    receivingLineId: null;
    inventoryLotId: null;
    createdBy: number;
    sourceDocumentNo: string;
    storageLotId: number;
    storageLotName: string;
    supplierBatchNumber: string;
    manufacturingDate: string | null;
    expiryDate: string | null;
    remarks: string | null;
    allocationDrafts: ReceivingMrpAllocationDraft[];
    unallocatedQuantity: number;
}

export interface ReceivingPreviewLineResult {
    lineId: number;
    disposition: ReceivingDisposition;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    forceRejected: boolean;
    rejectionReason: string | null;
    evaluations: QaChecklistItemEvaluation[];
    routes: ReceivingMovementRoute[];
}

export interface ReceivingPreviewResult {
    shipmentId: number;
    receiptNumber: string;
    destinationBranch: ReceivingRouteBranch;
    generatedBy: number;
    lines: ReceivingPreviewLineResult[];
}

interface RouteInput {
    acceptedQuantity: number;
    rejectedQuantity: number;
    createdBy: number;
    sourceDocumentNo: string;
    storageLotId: number;
    storageLotName: string;
    supplierBatchNumber: string;
    manufacturingDate: string | null;
    expiryDate: string | null;
    remarks: string | null;
    rejectionReason: string | null;
    allocationDrafts: ReceivingMrpAllocationDraft[];
    unallocatedQuantity: number;
}

export function buildMrpAllocationDrafts(
    acceptedQuantity: number,
    jobOrder: { id: number; number: string },
    requirements: ReceivingMrpMaterialRequirement[]
): { allocationDrafts: ReceivingMrpAllocationDraft[]; unallocatedQuantity: number } {
    let remainingAccepted = acceptedQuantity;
    const allocationDrafts: ReceivingMrpAllocationDraft[] = [];

    for (const requirement of [...requirements].sort((a, b) => a.jobOrderMaterialId - b.jobOrderMaterialId)) {
        const allocatable = Math.max(0, Number(requirement.remainingQuantity));
        const quantity = Math.min(remainingAccepted, allocatable);
        if (quantity <= 0) continue;
        allocationDrafts.push({
            allocationId: null,
            receivingLineId: null,
            inventoryLotId: null,
            jobOrder,
            jobOrderMaterialId: requirement.jobOrderMaterialId,
            quantity
        });
        remainingAccepted -= quantity;
        if (remainingAccepted <= 0) break;
    }

    return { allocationDrafts, unallocatedQuantity: remainingAccepted };
}

export function buildReceivingRoutes(
    input: RouteInput,
    passedBranch: ReceivingRouteBranch,
    rejectedBranch: ReceivingRouteBranch | null,
    passedTransactionType: ReceivingRouteTransactionType | null,
    rejectedTransactionType: ReceivingRouteTransactionType | null
): ReceivingMovementRoute[] {
    const shared = {
        movementId: null,
        receivingLineId: null,
        inventoryLotId: null,
        createdBy: input.createdBy,
        sourceDocumentNo: input.sourceDocumentNo,
        storageLotId: input.storageLotId,
        storageLotName: input.storageLotName,
        supplierBatchNumber: input.supplierBatchNumber,
        manufacturingDate: input.manufacturingDate,
        expiryDate: input.expiryDate
    } as const;
    const routes: ReceivingMovementRoute[] = [];

    if (input.acceptedQuantity > 0) {
        if (!passedTransactionType) throw new Error("Passed inventory routing is not configured.");
        routes.push({
            ...shared,
            kind: "Passed",
            qaStatus: "Passed",
            quantity: input.acceptedQuantity,
            branch: passedBranch,
            transactionType: passedTransactionType,
            remarks: input.remarks,
            allocationDrafts: input.allocationDrafts,
            unallocatedQuantity: input.unallocatedQuantity
        });
    }
    if (input.rejectedQuantity > 0) {
        if (!rejectedBranch || !rejectedTransactionType) {
            throw new Error("Rejected inventory routing is not configured.");
        }
        routes.push({
            ...shared,
            kind: "Rejected",
            qaStatus: "Rejected",
            quantity: input.rejectedQuantity,
            branch: rejectedBranch,
            transactionType: rejectedTransactionType,
            remarks: input.rejectionReason || input.remarks,
            allocationDrafts: [],
            unallocatedQuantity: 0
        });
    }
    return routes;
}
