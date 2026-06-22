import { FinishedGoodsReceiptPayload } from "../types";
import { JobOrder, JobOrderQALog } from "../../planning-engineering/types";

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

export async function fetchJobOrders() {
    const res = await fetch("/api/manufacturing/planning-engineering");
    return handleResponse(res, "Failed to fetch job orders");
}

export async function fetchUsers() {
    const res = await fetch("/api/manufacturing/planning-engineering?action=users");
    return handleResponse(res, "Failed to fetch users");
}

export async function fetchBranches() {
    const res = await fetch("/api/manufacturing/procurement/qa-receiving?action=branches");
    return handleResponse(res, "Failed to fetch branches");
}

export async function fetchProducts() {
    const res = await fetch("/api/manufacturing/finished-goods/products?limit=200");
    return handleResponse(res, "Failed to fetch products");
}

export async function updateJobOrder(joId: string, patch: Partial<JobOrder>) {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joId, patch })
    });
    return handleResponse(res, "Failed to update Job Order");
}

export async function updateTaskAssignments(taskId: number, assignments: { user_id: number; is_team_lead: boolean }[]) {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, assignments })
    });
    return handleResponse(res, "Failed to update task assignments");
}

export async function updateTaskQA(taskId: number, productId: number, branchId: number, qaLog: Partial<JobOrderQALog>) {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, productId, branchId, qaLog })
    });
    return handleResponse(res, "Failed to log QA step verification");
}

export async function updateTaskStatus(taskId: number, status: string, completedAt: string | null) {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            taskId,
            taskPatch: {
                status,
                completed_at: completedAt
            }
        })
    });
    return handleResponse(res, "Failed to update task execution status");
}

export async function createFinishedGoodsReceipt(payload: FinishedGoodsReceiptPayload) {
    const res = await fetch("/api/manufacturing/production/finished-goods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return handleResponse(res, "Failed to submit finished goods receipt");
}

export async function uploadFile(formData: FormData) {
    const res = await fetch("/api/manufacturing/files", {
        method: "POST",
        body: formData
    });
    return handleResponse(res, "Failed to upload file");
}

export async function deleteFile(id: string) {
    const res = await fetch(`/api/manufacturing/files?id=${id}`, {
        method: "DELETE"
    });
    return handleResponse(res, "Failed to delete file");
}
