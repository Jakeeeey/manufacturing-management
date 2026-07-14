import { z } from "zod";

const positiveId = z.number().int().positive();
const money = z.number().finite().nonnegative();

function isValidIsoDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

const optionalDate = z.string().refine(isValidIsoDate, "Expected a valid YYYY-MM-DD date").nullish();
const optionalId = positiveId.nullish();

const directItemSchema = z.object({
    product_id: positiveId,
    quantity: z.number().finite().positive(),
    unit_price: money
}).strict();

export const salesOrderPostSchema = z.object({
    quotationId: positiveId.optional(),
    customerId: positiveId.optional(),
    poNo: z.string().trim().min(1, "PO number is required"),
    items: z.array(directItemSchema).min(1).optional(),
    dueDate: optionalDate,
    deliveryDate: optionalDate,
    paymentTerms: optionalId,
    remarks: z.string().nullish(),
    discountAmount: money.default(0),
    salesmanId: optionalId,
    supplierId: optionalId,
    branchId: optionalId
}).strict().superRefine((value, context) => {
    if (value.quotationId) {
        if (value.customerId !== undefined || value.items !== undefined) {
            context.addIssue({
                code: "custom",
                message: "customerId and items are not accepted when converting a quotation"
            });
        }
        return;
    }

    if (!value.customerId) {
        context.addIssue({ code: "custom", path: ["customerId"], message: "Customer is required" });
    }
    if (!value.items?.length) {
        context.addIssue({ code: "custom", path: ["items"], message: "At least one item is required" });
        return;
    }

    const productIds = value.items.map((item) => item.product_id);
    if (new Set(productIds).size !== productIds.length) {
        context.addIssue({ code: "custom", path: ["items"], message: "Duplicate products are not allowed" });
    }

    const subtotal = value.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    if (value.discountAmount > subtotal) {
        context.addIssue({
            code: "custom",
            path: ["discountAmount"],
            message: "Discount cannot exceed the order subtotal"
        });
    }
});

const quantityPatchSchema = z.object({
    orderId: positiveId,
    details: z.array(z.object({
        detail_id: positiveId,
        ordered_quantity: z.number().finite().positive()
    }).strict()).min(1),
    orderStatus: z.never().optional()
}).strict().superRefine((value, context) => {
    const detailIds = value.details.map((detail) => detail.detail_id);
    if (new Set(detailIds).size !== detailIds.length) {
        context.addIssue({ code: "custom", path: ["details"], message: "Duplicate detail IDs are not allowed" });
    }
});

const statusPatchSchema = z.object({
    orderId: positiveId,
    orderStatus: z.enum(["Draft", "Pending", "For Approval", "For Consolidation"]),
    details: z.never().optional()
}).strict();

export const salesOrderPatchSchema = z.union([quantityPatchSchema, statusPatchSchema]);

export type SalesOrderPostInput = z.infer<typeof salesOrderPostSchema>;
export type SalesOrderPatchInput = z.infer<typeof salesOrderPatchSchema>;

export function validationIssues(error: z.ZodError) {
    return error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
    }));
}
