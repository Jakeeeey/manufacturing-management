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
