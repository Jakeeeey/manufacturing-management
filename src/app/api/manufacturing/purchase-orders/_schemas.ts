import { z } from "zod";

const MODULE_PATHS = {
    procurement: "/mm/incoming-shipments",
    approval: "/mm/approval",
    receiving: "/mm/qa-receiving"
} as const;

const positiveId = z.coerce.number().int().positive();
const nonNegativeMoney = z.coerce.number().finite().nonnegative();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const purchaseOrderStatusSchema = z.enum([
    "Ordered", "Approved", "Cancelled", "For Pickup", "En Route",
    "Receiving (QA)", "Partially Received", "Received", "Rejected"
]);

export const purchaseOrderLineSchema = z.object({
    product_id: positiveId,
    quantity_ordered: z.coerce.number().finite().positive(),
    base_unit_cost_php: nonNegativeMoney,
    discount_percent: z.coerce.number().finite().min(0).max(100).optional(),
    discount_type: positiveId.nullable().optional()
}).passthrough();

export const purchaseOrderCreateSchema = z.object({
    shipmentData: z.object({
        reference_number: z.string().trim().min(1).max(255),
        supplier_id: positiveId,
        exchange_rate: z.coerce.number().finite().positive(),
        total_foreign_currency: nonNegativeMoney,
        total_php_value: nonNegativeMoney,
        status: purchaseOrderStatusSchema.default("Ordered"),
        date_received: dateOnly.nullable().optional(),
        branch_id: positiveId,
        payment_type: positiveId.nullable().optional(),
        price_type: z.string().trim().min(1).max(50).nullable().optional()
    }).passthrough(),
    lineItems: z.array(purchaseOrderLineSchema).min(1)
});

export const purchaseOrderEditSchema = purchaseOrderCreateSchema.extend({
    shipmentId: positiveId
});

export const purchaseOrderStatusUpdateSchema = z.object({
    shipmentId: positiveId,
    status: purchaseOrderStatusSchema,
    lead_time_receiving: dateOnly.nullable().optional()
});

export const purchaseOrderApprovalSchema = z.object({
    shipmentId: positiveId,
    action: z.enum(["approve", "reject"]),
    lead_time_receiving: dateOnly.nullable().optional(),
    approvedPrices: z.record(z.string(), nonNegativeMoney).optional(),
    remarks: z.string().trim().min(1).max(1000).optional()
}).superRefine((value, context) => {
    if (value.action === "approve" && !value.lead_time_receiving) {
        context.addIssue({ code: "custom", path: ["lead_time_receiving"], message: "ETA is required for approval." });
    }
    if (value.action === "reject" && !value.remarks) {
        context.addIssue({ code: "custom", path: ["remarks"], message: "Remarks are required for rejection." });
    }
});

export const purchaseOrderListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(100).default(""),
    status: purchaseOrderStatusSchema.optional(),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
    sort: z.enum(["date_encoded", "purchase_order_no", "reference", "total_amount", "inventory_status"]).default("date_encoded"),
    direction: z.enum(["asc", "desc"]).default("desc")
});

export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;

export function modulesForStatus(status: z.infer<typeof purchaseOrderStatusSchema>) {
    return status === "Receiving (QA)" || status === "Partially Received" || status === "Received" || status === "Rejected"
        ? [MODULE_PATHS.receiving]
        : [MODULE_PATHS.procurement, MODULE_PATHS.approval];
}
