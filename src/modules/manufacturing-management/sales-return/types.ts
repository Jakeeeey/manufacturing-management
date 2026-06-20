// src/modules/manufacturing-management/sales-return/types.ts

export interface SalesReturn {
    return_id: number;
    return_number: string;
    return_date: string;
    customer_id: number | null;
    customer_name?: string;
    invoice_id: number;
    created_at?: string;
    remarks?: string;
}

export interface SalesReturnDetail {
    id: number;
    return_no: string;
    product_id: number;
    quantity: number;
    unit_price: number;
    net_amount: number;
    product?: {
        product_id: number;
        product_name: string;
        product_code: string;
        uom: string;
    } | null;
}

export interface PendingInvoiceForReturn {
    invoice_id: number;
    invoice_no: string;
    invoice_date: string;
    customer_name: string;
    customer_code: string;
    net_amount: number;
}
