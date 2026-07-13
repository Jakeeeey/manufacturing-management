export interface Branch {
    id: number;
    branch_name: string;
    branch_code?: string;
    isActive?: boolean | number;
}

export interface ProductIdInfo {
    product_id: number;
    product_name: string;
    product_code: string;
    uom?: string;
    uom_count?: number;
    brand?: string;
    category?: string;
    parent_id?: number | null;
}

export interface SalesOrderDetail {
    detail_id: number;
    order_id: number;
    product_id: ProductIdInfo;
    unit_price: number;
    ordered_quantity: number;
    net_amount: number;
    bom_version_id?: number | null;
    bom_version_name?: string | null;
    order_no?: string;       // joined client-side from sales order parent
    customer_name?: string;  // joined client-side from sales order parent
}

export interface SalesOrder {
    order_id: number;
    order_no: string;
    po_no?: string;
    customer_code: string;
    customer_name?: string;
    order_date: string;
    order_status: string;
    total_amount: number;
    net_amount: number;
    remarks: string;
    created_date: string;
    branch_id?: number | null;
}

export interface NetRequirementItem {
    product_id: number;
    product_name: string;
    product_code: string;
    gross_demand: number;
    on_hand: number;
    safety_stock: number;
    net_shortfall: number;
    is_sub_assembly?: boolean;
}
