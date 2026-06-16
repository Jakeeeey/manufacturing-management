import { SalesOrder, SalesOrderDetail, JobOrder } from "../types";

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

export async function explodeBOM(productId: number): Promise<{ bom: any; components: any[]; routings: any[] }> {
    const res = await fetch(`/api/manufacturing/planning-engineering?productId=${productId}`);
    return handleResponse(res, "Failed to explode product recipe");
}

export async function fetchQAStockBatches(productId: number): Promise<any[]> {
    const res = await fetch(`/api/manufacturing/procurement/qa-receiving?productId=${productId}`);
    return handleResponse(res, "Failed to fetch stock batches");
}

export async function getJobOrders(): Promise<JobOrder[]> {
    const res = await fetch("/api/manufacturing/planning-engineering");
    return handleResponse(res, "Failed to fetch job orders");
}

export async function addJobOrder(jo: JobOrder, salesOrderIds?: number[]): Promise<any> {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jo, salesOrderIds })
    });
    return handleResponse(res, "Failed to create job order");
}

export async function modifyJobOrder(joId: string, patch: Partial<JobOrder>): Promise<any> {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joId, patch })
    });
    return handleResponse(res, "Failed to update job order");
}

export async function removeJobOrder(joId: string): Promise<boolean> {
    const res = await fetch(`/api/manufacturing/planning-engineering?joId=${encodeURIComponent(joId)}`, {
        method: "DELETE"
    });
    const result = await handleResponse(res, "Failed to delete job order");
    return result.success;
}
