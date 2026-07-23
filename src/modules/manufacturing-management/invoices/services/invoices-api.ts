// src/modules/manufacturing-management/invoices/services/invoices-api.ts

import { Invoice, InvoiceLineItem } from "../types";

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
