import { z } from "zod";

const positiveId = z.coerce.number().int().positive();
const nonNegativeNumber = z.coerce.number().finite().nonnegative();

export const receivingLineSchema = z.object({
    line_id: positiveId,
    product_id: positiveId,
    quantity_received: nonNegativeNumber,
    quantity_accepted: nonNegativeNumber,
    quantity_rejected: nonNegativeNumber,
    batch_no: z.string().trim().min(1),
    lot_id: positiveId,
    expiration_date: z.string().date().nullable(),
    rejection_reason: z.string().trim().nullable(),
    qa_status: z.enum(["Passed", "Partially Accepted", "Rejected"])
});

export const receivingSubmissionSchema = z.object({
    shipmentId: positiveId,
    referenceNumber: z.string().trim().min(1),
    branchId: positiveId,
    branchName: z.string().trim().min(1),
    lineItemUpdates: z.array(receivingLineSchema).min(1)
});

export const directReceivingSubmissionSchema = z.object({
    shipmentData: z.object({ shipment_id: positiveId }).passthrough(),
    branchId: positiveId,
    lineItems: z.array(z.object({
        product_id: positiveId,
        batch_no: z.string().trim().min(1),
        lot_id: positiveId,
        expiry_date: z.string().date().nullable().optional(),
        received_quantity: nonNegativeNumber,
        unit_price: nonNegativeNumber,
        total_amount: nonNegativeNumber,
        qa_status: z.string().trim().nullable().optional(),
        quantity_rejected: nonNegativeNumber.nullable().optional(),
        rejection_reason: z.string().trim().nullable().optional()
    })).min(1)
});

export const expenseAllocationSchema = z.object({
    shipmentId: positiveId,
    status: z.string().trim().min(1),
    expenses: z.array(z.object({
        overhead_id: positiveId,
        expense_type: z.string().trim().default(""),
        amount_php: nonNegativeNumber
    })),
    allocationMethod: z.enum(["Value", "Weight", "Volume", "By Value", "By Weight", "By Volume"]),
    lineItemUpdates: z.array(z.object({
        line_id: positiveId,
        quantity_received: nonNegativeNumber
    })).optional()
});
