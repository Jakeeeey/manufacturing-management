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

export interface ReceivingMovementRoute {
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
    supplierBatchNumber: string;
    manufacturingDate: string | null;
    expiryDate: string | null;
    remarks: string | null;
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

interface RouteInput {
    acceptedQuantity: number;
    rejectedQuantity: number;
    createdBy: number;
    sourceDocumentNo: string;
    storageLotId: number;
    supplierBatchNumber: string;
    manufacturingDate: string | null;
    expiryDate: string | null;
    remarks: string | null;
    rejectionReason: string | null;
}

export function buildReceivingRoutes(
    input: RouteInput,
    passedBranch: ReceivingRouteBranch,
    rejectedBranch: ReceivingRouteBranch | null,
    passedTransactionType: ReceivingRouteTransactionType | null,
    rejectedTransactionType: ReceivingRouteTransactionType | null
): ReceivingMovementRoute[] {
    const shared = {
        receivingLineId: null,
        inventoryLotId: null,
        createdBy: input.createdBy,
        sourceDocumentNo: input.sourceDocumentNo,
        storageLotId: input.storageLotId,
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
            remarks: input.remarks
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
            remarks: input.rejectionReason || input.remarks
        });
    }
    return routes;
}
