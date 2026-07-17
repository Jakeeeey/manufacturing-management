import { z } from "zod";
import { validateReceivingQuantities } from "../qa/_receiving-evaluation";
import { receivingLotAllocationError, rejectedLotAllocationError } from "./_lot-allocation";

export const RECEIVING_COMMIT_CONTRACT_VERSION = "v1" as const;
export const RECEIVING_POSTING_ENABLED = true;

export function receiptNumberForLine(receiptNumber: string, lineId: number): string {
    const suffix = `-${lineId}`;
    return `${receiptNumber.slice(0, Math.max(1, 50 - suffix.length))}${suffix}`;
}

const quantity = z.number().finite().nonnegative();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const acceptedLotAllocation = z.object({
    storageLotId: z.number().int().positive(),
    quantity
});
const rejectedLotAllocation = z.object({
    storageLotId: z.number().int().positive(),
    quantity
});

export const receivingCommitLineSchema = z.object({
    lineId: z.number().int().positive(),
    productId: z.number().int().positive(),
    receivedQuantity: quantity,
    acceptedQuantity: quantity,
    rejectedQuantity: quantity,
    storageLotId: z.number().int().positive().nullable(),
    acceptedLotAllocations: z.array(acceptedLotAllocation).default([]),
    rejectedLotAllocations: z.array(rejectedLotAllocation).default([]),
    supplierBatchNumber: z.string().max(50),
    manufacturingDate: optionalDate,
    expiryDate: optionalDate,
    remarks: z.string().max(255).nullable(),
    isPackaging: z.boolean(),
    readings: z.array(z.object({
        specId: z.number().int().positive(),
        actualReading: z.string()
    }))
}).superRefine((line, context) => {
    const message = validateReceivingQuantities(line);
    if (message) context.addIssue({ code: z.ZodIssueCode.custom, path: ["receivedQuantity"], message });
    const allocationMessage = receivingLotAllocationError(
        line.acceptedQuantity,
        line.acceptedLotAllocations,
        line.storageLotId
    );
    if (allocationMessage) context.addIssue({ code: z.ZodIssueCode.custom, path: ["acceptedLotAllocations"], message: allocationMessage });
    const rejectedAllocationMessage = rejectedLotAllocationError(
        line.rejectedQuantity,
        line.rejectedLotAllocations,
        line.storageLotId
    );
    if (rejectedAllocationMessage) context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectedLotAllocations"], message: rejectedAllocationMessage });
});

export const receivingPreviewRequestSchema = z.object({
    shipmentId: z.number().int().positive(),
    receiptNumber: z.string().trim().min(1).max(50),
    receiptMode: z.enum(["full", "partial"]).default("full"),
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
    status: "Partially Received" | "Received" | "Rejected";
    workflowRevision: number;
    receivingRecordIds: number[];
    inventoryLotIds: number[];
    receiptNumbers: string[];
    receivingRecords: FinalReceivingRecord[];
    movements: FinalReceivingMovement[];
}

export type ReceivingCommitRequest = z.infer<typeof receivingCommitRequestSchema>;
export type ReceivingPreviewRequest = z.infer<typeof receivingPreviewRequestSchema>;
