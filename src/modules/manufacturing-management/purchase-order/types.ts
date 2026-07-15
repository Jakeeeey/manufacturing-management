export type {
    IncomingShipment as PurchaseOrder,
    ShipmentLineItem as PurchaseOrderLine,
    Supplier,
    RawMaterial,
    LinkedProduct
} from "../procurement/types";

export interface PurchaseOrderListMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PurchaseOrderListResponse<T> {
    data: T[];
    meta: PurchaseOrderListMeta;
}

export interface PurchaseOrderListQuery {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    sort?: "date_encoded" | "purchase_order_no" | "reference" | "total_amount" | "inventory_status";
    direction?: "asc" | "desc";
}

export interface PurchaseOrderCatalog {
    suppliers: Array<{ id: number; supplier_name: string }>;
    branches: Array<{ id: number; branch_name: string; branch_code?: string }>;
    paymentTypes: Array<{ id: number; payment_name?: string; name?: string }>;
    jobOrders: Array<{ job_order_id: number; job_order_no?: string }>;
}

export interface PurchaseOrderDraftPayload {
    externalReference?: string;
    supplierId: number;
    branchId: number;
    paymentTypeId: number;
    priceType: string;
    currencyCode: "PHP" | "USD";
    exchangeRate: number;
    expectedTotals: {
        grossPhp: number;
        discountPhp: number;
        vatPhp: number;
        withholdingPhp: number;
        netPhp: number;
        netForeign: number;
    };
    lines: Array<{
        productId: number;
        parentProductId: number;
        purchaseIntent: "MRP_Demand" | "Buffer_Stock";
        jobOrderId: number | null;
        quantity: number;
        unitPrice: number;
        discountPercent: number;
        vatPercent: number;
        withholdingPercent: number;
    }>;
}
