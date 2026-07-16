import { z } from "zod";

export const RECEIVING_COMMIT_CONTRACT_VERSION = "v1" as const;
export const RECEIVING_POSTING_ENABLED = true;

const quantity = z.number().finite().nonnegative();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const receivingCommitLineSchema = z.object({
    lineId: z.number().int().positive(),
    productId: z.number().int().positive(),
    receivedQuantity: quantity,
    acceptedQuantity: quantity,
    rejectedQuantity: quantity,
    storageLotId: z.number().int().positive().nullable(),
    supplierBatchNumber: z.string().max(50),
    manufacturingDate: optionalDate,
    expiryDate: optionalDate,
    remarks: z.string().max(255).nullable(),
    isPackaging: z.boolean(),
    readings: z.array(z.object({
        specId: z.number().int().positive(),
        actualReading: z.string()
    }))
});

export const receivingPreviewRequestSchema = z.object({
    shipmentId: z.number().int().positive(),
    receiptNumber: z.string().trim().min(1).max(50),
    destinationBranchId: z.number().int().positive(),
    lines: z.array(receivingCommitLineSchema).min(1)
});

export const receivingCommitRequestSchema = receivingPreviewRequestSchema.extend({
    contractVersion: z.literal(RECEIVING_COMMIT_CONTRACT_VERSION),
    workflowRevision: z.number().int().nonnegative()
});

export interface FinalReceivingMovement {
    movementId: number;
    lineId: number;
    kind: "Passed" | "Rejected";
    receivingLineId: number;
    inventoryLotId: number;
    productId: number;
    storageLotId: number;
    branchId: number;
    transactionTypeId: number;
    sourceDocumentNo: string;
    quantity: number;
}

export interface FinalReceivingRecord {
    receivingRecordId: number;
    lineId: number;
    shipmentId: number;
    productId: number;
    receiptNumber: string;
    branchId: number;
    storageLotId: number;
    batchNumber: string;
    receivedQuantity: number;
    rejectedQuantity: number;
    unitPrice: number;
    finalLandedUnitCost: number;
    qaStatus: string;
    expirationDate: string | null;
    receivedDate: string | null;
    inventoryLotIds: number[];
}

export interface ReceivingCommitResult {
    contractVersion: typeof RECEIVING_COMMIT_CONTRACT_VERSION;
    mode: "compatibility";
    commitReference: string;
    idempotentReplay: boolean;
    shipmentId: number;
    status: "Received" | "Rejected";
    workflowRevision: number;
    receivingRecordIds: number[];
    inventoryLotIds: number[];
    receiptNumbers: string[];
    receivingRecords: FinalReceivingRecord[];
    movements: FinalReceivingMovement[];
}

export type ReceivingCommitRequest = z.infer<typeof receivingCommitRequestSchema>;
export type ReceivingPreviewRequest = z.infer<typeof receivingPreviewRequestSchema>;
