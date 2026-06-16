export interface SalesOrder {
    order_id: number;
    order_no: string;
    customer_code: string;
    order_date: string;
    order_status: string;
    total_amount: number;
    net_amount: number;
    remarks: string;
    created_date: string;
    discount_amount?: number;
}

export interface SalesOrderDetail {
    detail_id: number;
    order_id: number;
    product_id: {
        product_id: number;
        product_name: string;
        product_code: string;
        price_per_unit: number;
    };
    unit_price: number;
    ordered_quantity: number;
    net_amount: number;
}

export interface QuotationHeader {
    id: number;
    quote_number: string;
    customer_id: {
        customer_name: string;
        customer_code: string;
    } | null;
    total_selling_price: number;
    total_simulated_cost: number;
    quote_date: string;
    status: string;
    remarks: string;
}
