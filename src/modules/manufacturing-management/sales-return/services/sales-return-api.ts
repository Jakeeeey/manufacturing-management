// src/modules/manufacturing-management/sales-return/services/sales-return-api.ts

import { SalesReturn, SalesReturnDetail, PendingInvoiceForReturn } from "../types";

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

export async function fetchSalesReturns(): Promise<SalesReturn[]> {
    const res = await fetch("/api/manufacturing/sales-return");
    return handleResponse(res, "Failed to load sales returns");
}

export async function fetchSalesReturnDetails(returnId: string): Promise<SalesReturnDetail[]> {
    const res = await fetch(`/api/manufacturing/sales-return?returnId=${encodeURIComponent(returnId)}`);
    return handleResponse(res, "Failed to load sales return details");
}

export async function createSalesReturn(payload: {
    invoice_id: number;
    return_number?: string;
    return_date: string;
    customer_id?: number | null;
    remarks?: string;
    branch_id?: number;
    items: { product_id: number; quantity: number; unit_price: number }[];
}): Promise<{ success: boolean; return_id: number; return_number: string }> {
    const res = await fetch("/api/manufacturing/sales-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return handleResponse(res, "Failed to create sales return");
}

export async function fetchInvoicesForReturn(): Promise<{ data: PendingInvoiceForReturn[]; detailsMap: Record<number, any[]> }> {
    const res = await fetch("/api/manufacturing/sales-invoice?limit=250");
    const json = await handleResponse(res, "Failed to load invoices for returns mapping");
    
    const allInvoices = json.data || [];
    const detailsMap = json.detailsMap || {};

    return {
        data: allInvoices.map((inv: any) => ({
            invoice_id: Number(inv.order_id), // maps invoice_id
            invoice_no: inv.document_no || inv.invoice_no,
            invoice_date: inv.date || inv.created_date,
            customer_name: inv.customer_name || `Customer #${inv.customer_id}`,
            customer_code: inv.customer_code || "GEN",
            net_amount: Number(inv.net_amount || 0)
        })),
        detailsMap
    };
}
