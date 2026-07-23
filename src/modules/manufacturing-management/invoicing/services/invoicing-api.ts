import { CreateInvoicePayload, CreatedInvoiceResult, InvoicingCandidate, InvoicingFilters, PrintableInvoice, ReceiptType } from "../types";

async function responseJson(response: Response, fallback: string) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || fallback);
    return body;
}

export async function fetchInvoicingCandidates(filters?: Partial<InvoicingFilters>): Promise<InvoicingCandidate[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.customerCode) params.set("customerCode", filters.customerCode);
    if (filters?.branchId) params.set("branchId", filters.branchId);
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.set("dateTo", filters.dateTo);
    const qs = params.toString();
    const body = await responseJson(
        await fetch(`/api/manufacturing/invoicing/candidates${qs ? `?${qs}` : ""}`, { cache: "no-store" }),
        "Failed to load invoicing candidates"
    );
    return body.data || [];
}

export async function createInvoice(payload: CreateInvoicePayload): Promise<CreatedInvoiceResult> {
    return responseJson(await fetch("/api/manufacturing/invoicing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }), "Failed to create invoice");
}

export async function fetchReceiptTypes(): Promise<ReceiptType[]> {
    return responseJson(await fetch("/api/manufacturing/invoicing/receipt-types", { cache: "no-store" }), "Failed to load receipt types");
}

export async function fetchPrintableInvoice(invoiceId: number): Promise<PrintableInvoice> {
    return responseJson(await fetch(`/api/manufacturing/invoicing/${invoiceId}/print-data`, { cache: "no-store" }), "Failed to load printable invoice");
}

export async function archiveInvoiceDocument(invoiceId: number, file: Blob, invoiceNo: string): Promise<void> {
    const form = new FormData();
    form.set("file", file, `${invoiceNo}.pdf`);
    form.set("invoiceNo", invoiceNo);
    await responseJson(await fetch(`/api/manufacturing/invoicing/${invoiceId}/document`, { method: "POST", body: form }), "Failed to archive invoice PDF");
}
