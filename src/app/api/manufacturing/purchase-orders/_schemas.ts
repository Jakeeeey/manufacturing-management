import { z } from "zod";

const MODULE_PATHS = {
    procurement: "/mm/incoming-shipments",
    approval: "/mm/approval",
    receiving: "/mm/qa-receiving"
} as const;

const positiveId = z.coerce.number().int().positive();
const nonNegativeMoney = z.coerce.number().finite().nonnegative();
const percentage = z.coerce.number().finite().min(0).max(100);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const purchaseOrderStatusSchema = z.enum([
    "Ordered", "Approved", "Cancelled", "For Pickup", "En Route",
    "Receiving (QA)", "Partially Received", "Received", "Rejected"
]);

export const purchaseOrderListStatusSchema = z.enum([
    "Requested", "Ordered", "Approved", "Cancelled", "For Pickup", "En Route",
    "Receiving (QA)", "Partially Received", "Received", "Rejected"
]);

export const purchaseOrderLineSchema = z.object({
    product_id: positiveId,
    quantity_ordered: z.coerce.number().finite().positive(),
    base_unit_cost_php: nonNegativeMoney,
    discount_percent: z.coerce.number().finite().min(0).max(100).optional(),
    discount_type: positiveId.nullable().optional()
}).passthrough();

export const legacyPurchaseOrderCreateSchema = z.object({
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

export const legacyPurchaseOrderEditSchema = legacyPurchaseOrderCreateSchema.extend({
    shipmentId: positiveId
});

export const purchaseOrderExpectedTotalsSchema = z.object({
    grossPhp: nonNegativeMoney,
    discountPhp: nonNegativeMoney,
    vatPhp: nonNegativeMoney,
    withholdingPhp: nonNegativeMoney,
    netPhp: nonNegativeMoney,
    netForeign: nonNegativeMoney
});

export const purchaseOrderDraftLineSchema = z.object({
    productId: positiveId,
    parentProductId: positiveId,
    purchaseIntent: z.enum(["MRP_Demand", "Buffer_Stock"]),
    jobOrderId: positiveId.nullable(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: nonNegativeMoney,
    discountPercent: percentage.default(0),
    vatPercent: percentage.default(0),
    withholdingPercent: percentage.default(0)
}).superRefine((line, context) => {
    if (line.purchaseIntent === "MRP_Demand" && line.jobOrderId === null) {
        context.addIssue({ code: "custom", path: ["jobOrderId"], message: "MRP demand requires a job order." });
    }
    if (line.purchaseIntent === "Buffer_Stock" && line.jobOrderId !== null) {
        context.addIssue({ code: "custom", path: ["jobOrderId"], message: "Buffer stock cannot be linked to a job order." });
    }
});

export const purchaseOrderCreateSchema = z.object({
    externalReference: z.string().trim().max(255).optional(),
    supplierId: positiveId,
    branchId: positiveId,
    paymentTypeId: positiveId,
    priceType: z.string().trim().min(1).max(50),
    currencyCode: z.enum(["PHP", "USD"]),
    exchangeRate: z.coerce.number().finite().positive(),
    expectedTotals: purchaseOrderExpectedTotalsSchema,
    lines: z.array(purchaseOrderDraftLineSchema).min(1)
}).superRefine((order, context) => {
    if (order.currencyCode === "PHP" && order.exchangeRate !== 1) {
        context.addIssue({ code: "custom", path: ["exchangeRate"], message: "PHP orders must use an exchange rate of 1." });
    }
    const productIds = order.lines.map(line => line.productId);
    if (new Set(productIds).size !== productIds.length) {
        context.addIssue({ code: "custom", path: ["lines"], message: "Duplicate product variants are not allowed." });
    }
});

export const purchaseOrderEditSchema = purchaseOrderCreateSchema.extend({
    workflowRevision: z.coerce.number().int().nonnegative()
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
    status: purchaseOrderListStatusSchema.optional(),
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
