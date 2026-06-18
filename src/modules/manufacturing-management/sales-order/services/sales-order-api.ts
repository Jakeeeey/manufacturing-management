import { SalesOrder, SalesOrderDetail, QuotationHeader } from "../types";

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

export async function fetchSalesOrders(params: { page?: number; limit?: number; search?: string; status?: string; selectedIds?: number[]; excludeHasJo?: boolean } = {}): Promise<{ data: SalesOrder[]; detailsMap: Record<number, SalesOrderDetail[]>; meta: { totalCount: number; totalPages: number; page: number; limit: number } }> {
    const query = new URLSearchParams();
    if (params.page) query.append("page", String(params.page));
    if (params.limit) query.append("limit", String(params.limit));
    if (params.search) query.append("search", params.search);
    if (params.status) query.append("status", params.status);
    if (params.excludeHasJo) query.append("excludeHasJo", "true");
    if (params.selectedIds && params.selectedIds.length > 0) {
        query.append("selectedIds", params.selectedIds.join(","));
    }
    const res = await fetch(`/api/manufacturing/sales-order?${query.toString()}`);
    return handleResponse(res, "Failed to load sales orders");
}

export async function fetchSalesOrderDetails(orderId: number): Promise<SalesOrderDetail[]> {
    const res = await fetch(`/api/manufacturing/sales-order?orderId=${orderId}`);
    return handleResponse(res, "Failed to load order details");
}

export async function updateSalesOrderStatus(orderId: number, orderStatus: string): Promise<any> {
    const res = await fetch("/api/manufacturing/sales-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, orderStatus })
    });
    return handleResponse(res, "Failed to update Sales Order status");
}

export async function updateSalesOrderDetails(orderId: number, details: { detail_id: number; ordered_quantity: number }[]): Promise<any> {
    const res = await fetch("/api/manufacturing/sales-order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, details })
    });
    return handleResponse(res, "Failed to update Sales Order quantities");
}

export async function approveSalesOrder(orderId: number): Promise<any> {
    return updateSalesOrderStatus(orderId, "For Consolidation");
}

export async function convertQuotationToSalesOrder(quotationId: number): Promise<any> {
    const res = await fetch("/api/manufacturing/sales-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId })
    });
    return handleResponse(res, "Failed to convert quotation");
}

export async function fetchQuotationPipeline(): Promise<QuotationHeader[]> {
    const res = await fetch("/api/manufacturing/finished-goods/quotes");
    return handleResponse(res, "Failed to load quotations");
}
