export const PURCHASE_INTENTS = ["MRP_Demand", "Buffer_Stock"] as const;
export type PurchaseIntent = typeof PURCHASE_INTENTS[number];

export const APPROVAL_STAGES = ["Plant", "Finance"] as const;
export type ApprovalStage = typeof APPROVAL_STAGES[number];

export const APPROVAL_ACTIONS = ["Submitted", "PlantApproved", "FinanceApproved", "Rejected", "Resubmitted", "Cancelled"] as const;
export type ApprovalAction = typeof APPROVAL_ACTIONS[number];

export const QA_PARAMETER_TYPES = ["Numeric", "Boolean", "Text"] as const;
export type QaParameterType = typeof QA_PARAMETER_TYPES[number];

export type CurrencyCode = string;
export type QaDisposition = "Passed" | "Partially Accepted" | "Rejected";
export type DiscountKind = "Percentage" | "Fixed";

export interface MoneySummary {
    currencyCode: CurrencyCode;
    exchangeRate: number;
    grossAmount: number;
    discountAmount: number;
    vatAmount: number;
    withholdingAmount: number;
    netAmount: number;
}

export function roundCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface PurchaseOrderMoneyLine {
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    vatPercent: number;
    withholdingPercent: number;
}

export function calculatePurchaseOrderLine(line: PurchaseOrderMoneyLine, exchangeRate: number) {
    const grossForeign = roundCurrency(line.quantity * line.unitPrice);
    const discountForeign = roundCurrency(grossForeign * line.discountPercent / 100);
    const discountedSubtotalForeign = roundCurrency(grossForeign - discountForeign);
    const vatForeign = roundCurrency(discountedSubtotalForeign * line.vatPercent / 100);
    const withholdingForeign = roundCurrency(discountedSubtotalForeign * line.withholdingPercent / 100);
    const netForeign = roundCurrency(discountedSubtotalForeign + vatForeign - withholdingForeign);
    return {
        grossForeign,
        discountForeign,
        vatForeign,
        withholdingForeign,
        netForeign,
        grossPhp: roundCurrency(grossForeign * exchangeRate),
        discountPhp: roundCurrency(discountForeign * exchangeRate),
        vatPhp: roundCurrency(vatForeign * exchangeRate),
        withholdingPhp: roundCurrency(withholdingForeign * exchangeRate),
        netPhp: roundCurrency(netForeign * exchangeRate)
    };
}

export function calculatePurchaseOrderTotals(lines: readonly PurchaseOrderMoneyLine[], exchangeRate: number) {
    const calculatedLines = lines.map(line => calculatePurchaseOrderLine(line, exchangeRate));
    const sum = (field: keyof typeof calculatedLines[number]) => roundCurrency(
        calculatedLines.reduce((total, line) => total + line[field], 0)
    );
    return {
        lines: calculatedLines,
        grossPhp: sum("grossPhp"),
        discountPhp: sum("discountPhp"),
        vatPhp: sum("vatPhp"),
        withholdingPhp: sum("withholdingPhp"),
        netPhp: sum("netPhp"),
        netForeign: sum("netForeign")
    };
}

export interface PurchaseOrderProductPayloadInput extends PurchaseOrderMoneyLine {
    purchaseOrderId: number;
    productId: number;
    exchangeRate: number;
    branchId?: number | null;
    purchaseIntent?: PurchaseIntent;
    jobOrderId?: number | null;
    discountType?: number | null;
    received?: number;
}

export function buildPurchaseOrderProductPayload(
    input: PurchaseOrderProductPayloadInput,
    amount: ReturnType<typeof calculatePurchaseOrderLine>
) {
    const quantity = Number(input.quantity);
    const unitPricePhp = roundCurrency(input.unitPrice * input.exchangeRate);
    const discountedSubtotalPhp = roundCurrency(amount.grossPhp - amount.discountPhp);

    return {
        purchase_order_id: input.purchaseOrderId,
        product_id: input.productId,
        ordered_quantity: quantity,
        unit_price: unitPricePhp,
        approved_price: unitPricePhp,
        discount_type: input.discountType ?? null,
        gross_amount: amount.grossPhp,
        discounted_price: roundCurrency(discountedSubtotalPhp / quantity),
        discounted_amount: amount.discountPhp,
        vat_amount: amount.vatPhp,
        withholding_amount: amount.withholdingPhp,
        net_amount: amount.netPhp,
        total_amount: amount.netPhp,
        branch_id: input.branchId ?? null,
        received: input.received ?? 0,
        purchase_intent: input.purchaseIntent || "Buffer_Stock",
        job_order_id: input.jobOrderId ?? null,
        unit_price_foreign: roundCurrency(input.unitPrice),
        gross_amount_foreign: amount.grossForeign,
        net_amount_foreign: amount.netForeign,
        discount_percent: input.discountPercent,
        vat_percent: input.vatPercent,
        withholding_percent: input.withholdingPercent
    };
}

export interface PurchaseOrderDiscount {
    kind: DiscountKind;
    value: number;
}

export interface QaQuantityDisposition {
    received: number;
    accepted: number;
    rejected: number;
    disposition: QaDisposition;
}

export const PURCHASE_RECEIVING_MOVEMENT = {
    typeName: "Purchase Receiving QA",
    direction: "IN",
    originTable: "purchase_order_receiving"
} as const;

export const PURCHASE_REJECTION_MOVEMENT = {
    typeName: "QA Reject / Bad Order Receipt",
    direction: "IN",
    originTable: "purchase_order_receiving"
} as const;

export interface PurchaseOrderApprovalRule {
    ruleId: number;
    priority: number;
    minimumTotalPhp: number;
    maximumTotalPhp: number | null;
    currencyCode: string | null;
    importScope: "Any" | "Domestic" | "Import";
    productCategoryId: number | null;
    requiresFinance: boolean;
    allowSelfApproval: boolean;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    isActive: boolean;
}

export interface PurchaseOrderApprovalContext {
    totalPhp: number;
    currencyCode: string;
    isImport: boolean;
    productCategoryIds: readonly number[];
    businessDate: string;
}

export type PurchaseOrderWorkflowStage = "Plant" | "Finance" | "Complete" | "Rejected";

export interface PurchaseOrderWorkflowState {
    inventoryStatus: number;
    approverId: number | null;
    financeId: number | null;
    requiresFinance: boolean;
}

export function pendingPurchaseOrderApprovalStages(state: PurchaseOrderWorkflowState): Array<"Plant" | "Finance"> {
    if (state.inventoryStatus !== 1 && state.inventoryStatus !== 3) return [];
    const stages: Array<"Plant" | "Finance"> = [];
    if (state.inventoryStatus === 1 && !state.approverId) stages.push("Plant");
    if (state.requiresFinance && !state.financeId) stages.push("Finance");
    return stages;
}

export function derivePurchaseOrderWorkflowStage(state: PurchaseOrderWorkflowState): PurchaseOrderWorkflowStage {
    if (state.inventoryStatus === 13) return "Rejected";
    const pendingStages = pendingPurchaseOrderApprovalStages(state);
    return pendingStages[0] || "Complete";
}

function dateOnly(value: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error("Approval dates must use YYYY-MM-DD format.");
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function matchesPurchaseOrderApprovalRule(
    rule: PurchaseOrderApprovalRule,
    context: PurchaseOrderApprovalContext
): boolean {
    if (!rule.isActive || !Number.isFinite(context.totalPhp) || context.totalPhp < 0) return false;
    if (context.totalPhp < rule.minimumTotalPhp) return false;
    if (rule.maximumTotalPhp !== null && context.totalPhp > rule.maximumTotalPhp) return false;

    const ruleCurrency = rule.currencyCode?.trim().toUpperCase();
    if (ruleCurrency && ruleCurrency !== context.currencyCode.trim().toUpperCase()) return false;
    if (rule.importScope === "Import" && !context.isImport) return false;
    if (rule.importScope === "Domestic" && context.isImport) return false;
    if (rule.productCategoryId !== null && !context.productCategoryIds.includes(rule.productCategoryId)) return false;

    const businessDate = dateOnly(context.businessDate);
    if (rule.effectiveFrom && businessDate < dateOnly(rule.effectiveFrom)) return false;
    if (rule.effectiveTo && businessDate > dateOnly(rule.effectiveTo)) return false;
    return true;
}

export function selectPurchaseOrderApprovalRule(
    rules: readonly PurchaseOrderApprovalRule[],
    context: PurchaseOrderApprovalContext
): PurchaseOrderApprovalRule | null {
    const matches = rules.filter(rule => matchesPurchaseOrderApprovalRule(rule, context));
    matches.sort((left, right) =>
        right.priority - left.priority
        || right.minimumTotalPhp - left.minimumTotalPhp
        || left.ruleId - right.ruleId
    );
    return matches[0] || null;
}
