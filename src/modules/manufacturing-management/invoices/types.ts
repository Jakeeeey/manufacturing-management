// src/modules/manufacturing-management/invoices/types.ts

export interface Customer {
    id: number | string;
    customer_name: string;
    customer_code: string;
    isActive?: boolean;
}

export interface Invoice {
    invoice_id: number;
    invoice_no: string;
    invoice_date: string;
    due_date: string;
    customer_id: number | Customer | null;
    customer_name?: string;
    customer_code?: string;
    customer_address?: string;
    customer_tin?: string;
    sales_order_id?: number | null;
    sales_order_no?: string | null;
    total_amount: number;
    discount_amount: number;
    vat_amount: number;
    net_amount: number;
    status: "Draft" | "Unpaid" | "Paid" | "Partially Paid" | "Overdue" | "Cancelled";
    payment_status?: string;
    remarks?: string;
    created_date?: string;
}

export interface InvoiceLineItem {
    detail_id: number;
    invoice_id: number;
    product_id: {
        product_id: number;
        product_name: string;
        product_code: string;
        uom?: string;
        uom_count?: number;
        brand?: string;
        category?: string;
    };
    quantity: number;
    unit_price: number;
    net_amount: number;
}

export interface InvoicePayment {
    payment_id: number;
    invoice_id: number;
    amount_paid: number;
    payment_date: string;
    payment_method: "Cash" | "Check" | "Bank Transfer" | "Credit Card";
    reference_no: string;
    remarks?: string;
}

export interface PrinterAlignmentSettings {
    topMargin: number;      // in mm
    leftMargin: number;     // in mm
    lineHeight: number;     // in mm
    fontSize: number;       // in pt
    offsets: {
        invoiceDate: { x: number; y: number };
        invoiceNo: { x: number; y: number };
        customerName: { x: number; y: number };
        customerAddress: { x: number; y: number };
        customerTin: { x: number; y: number };
        terms: { x: number; y: number };
        tableStart: { y: number };
        colQty: { x: number };
        colUnit: { x: number };
        colDescription: { x: number };
        colUnitPrice: { x: number };
        colAmount: { x: number };
        totalAmount: { x: number; y: number };
    };
}

