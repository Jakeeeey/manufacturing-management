export interface SalesOrder {
    order_id: number;
    order_no: string;
    customer_code: string;
    customer_name?: string;
    order_date: string;
    order_status: string;
    total_amount: number;
    remarks: string;
}

export interface SalesOrderDetail {
    detail_id: number;
    order_id: number;
    product_id: {
        product_id: number;
        product_name: string;
        product_code: string;
        uom?: string;
        uom_count?: number;
        brand?: string;
        category?: string;
    };
    unit_price: number;
    ordered_quantity: number;
    net_amount: number;
}

export interface JobOrder {
    jo_id: string;
    order_id?: number; // Optional if batched
    order_no: string; // List of SO numbers if batched
    product_id: number;
    product_name: string;
    quantity: number;
    due_date: string;
    status: "Draft" | "Shortage" | "Proceed" | "Ongoing" | "Finished" | "On Hold" | "Cancelled";
    is_batched?: boolean;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    bom?: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    components?: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    routings?: any[];
    allocationResults?: {
        component_product_id?: number;
        component_name: string;
        required: number;
        available: number;
        deficit: number;
        batches: { lot_number: string; expiration_date: string; quantity: number }[];
        has_bom?: boolean;
        bom_id?: number;
        base_quantity?: number;
    }[];
    procurementStatus?: "Idle" | "Ordered" | "Approved" | "En Route" | "Received QA";
    branch_id?: number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    assignedPersonnel?: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    products?: any[];
}

