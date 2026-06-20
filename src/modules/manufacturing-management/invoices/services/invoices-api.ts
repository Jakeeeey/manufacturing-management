// src/modules/manufacturing-management/invoices/services/invoices-api.ts

import { Invoice, InvoiceLineItem, PendingSalesOrder } from "../types";

async function handleResponse(res: Response, fallbackMessage: string) {
    if (!res.ok) {
        let errMsg = fallbackMessage;
        try {
            const data = await res.json();
            if (data && data.error) errMsg = data.error;
        } catch {}
        throw new Error(errMsg);
    }
    return res.json();
}

/**
 * Fetch all invoices and their associated details mapping.
 */
export async function fetchInvoices(): Promise<{ data: Invoice[]; detailsMap: Record<number, InvoiceLineItem[]> }> {
    const res = await fetch("/api/manufacturing/sales-invoice?limit=250");
    return handleResponse(res, "Failed to load invoices");
}

/**
 * Create a new invoice with its details in Directus.
 */
export async function createInvoice(payload: {
    invoice_no: string;
    invoice_date: string;
    due_date: string;
    customer_id: number;
    sales_order_id?: number | null;
    total_amount: number;
    discount_amount: number;
    vat_amount: number;
    net_amount: number;
    remarks?: string;
    items: { product_id: number; quantity: number; unit_price: number; net_amount: number }[];
}): Promise<{ success: boolean; invoice_id: number; invoice_no: string }> {
    const res = await fetch("/api/manufacturing/sales-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return handleResponse(res, "Failed to create invoice");
}

/**
 * Update an invoice's status and remarks (used for logging payments).
 */
export async function updateInvoiceStatus(
    invoiceId: number, 
    status?: string, 
    remarks?: string,
    payment?: { amount: number; method: string; reference: string }
): Promise<{ success: boolean }> {
    const res = await fetch("/api/manufacturing/sales-invoice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, status, remarks, payment })
    });
    return handleResponse(res, "Failed to update invoice status");
}

/**
 * Fetch Sales Orders that are eligible for invoicing (e.g. status: "For Consolidation" or "Completed")
 */
export async function fetchPendingInvoicesSalesOrders(): Promise<{ data: PendingSalesOrder[]; detailsMap: Record<number, any[]> }> {
    // We can fetch Sales Orders with status "For Consolidation" as they are approved and ready to be billed
    const res = await fetch("/api/manufacturing/sales-order?limit=250");
    const json = await handleResponse(res, "Failed to load pending sales orders");
    
    // Filter only orders that are ready for invoicing ('For Invoicing')
    // (Translating backend schema objects into light PendingSalesOrder list)
    const filteredData = (json.data || []).filter((so: any) => 
        so.order_status === "For Invoicing"
    );
    
    return {
        data: filteredData.map((so: any) => ({
            order_id: Number(so.order_id),
            order_no: so.order_no,
            customer_code: so.customer_code,
            customer_name: so.customer_name || so.customer_code,
            order_date: so.order_date,
            total_amount: Number(so.net_amount || so.total_amount || 0),
            remarks: so.remarks
        })),
        detailsMap: json.detailsMap || {}
    };
}
