export const PURCHASE_INTENTS = ["MRP_Demand", "Buffer_Stock"] as const;
export type PurchaseIntent = typeof PURCHASE_INTENTS[number];

export const APPROVAL_STAGES = ["Plant", "Finance"] as const;
export type ApprovalStage = typeof APPROVAL_STAGES[number];

export const APPROVAL_ACTIONS = ["Submitted", "PlantApproved", "FinanceApproved", "Rejected", "Cancelled"] as const;
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
