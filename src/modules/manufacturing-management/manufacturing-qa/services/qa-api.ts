// src/modules/manufacturing-management/manufacturing-qa/services/qa-api.ts

import { JobOrder, QALogEntry } from "../types";

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
 * Fetch all Job Orders for QA auditing.
 */
export async function fetchJobOrders(): Promise<JobOrder[]> {
    const res = await fetch("/api/manufacturing/planning-engineering");
    return handleResponse(res, "Failed to load job orders for QA");
}

/**
 * Fetch QA inspection history logs.
 */
export async function fetchQALogsHistory(): Promise<QALogEntry[]> {
    const res = await fetch("/api/manufacturing/planning-engineering?action=qa-logs");
    return handleResponse(res, "Failed to load QA logs history");
}

/**
 * Submit QA Inspection log for a routing task.
 */
export async function submitQARoutingTaskVerification(
    taskId: number,
    productId: number,
    branchId: number,
    expectedQty: number,
    actualQty: number,
    comments: string,
    photos: string[],
    completedBy?: number | null
): Promise<unknown> {
    // 1. Submit the QA Log entry
    const logRes = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            taskId,
            productId,
            branchId,
            qaLog: {
                expected_quantity: expectedQty,
                actual_quantity: actualQty,
                qa_status: "Passed",
                comments,
                photos
            }
        })
    });
    await handleResponse(logRes, "Failed to record QA log");

    // 2. Mark the routing task as Completed with timestamps and user references
    const taskRes = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            taskId,
            taskPatch: {
                status: "Completed",
                completed_at: new Date().toISOString(),
                completed_by: completedBy || null
            }
        })
    });
    return handleResponse(taskRes, "Failed to complete routing task status");
}

/**
 * Update routing task fields directly (e.g. status and started_at).
 */
export async function updateRoutingTask(
    taskId: number,
    taskPatch: {
        status: string;
        started_at?: string | null;
        completed_at?: string | null;
        completed_by?: number | null;
    }
): Promise<unknown> {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            taskId,
            taskPatch
        })
    });
    return handleResponse(res, "Failed to update routing task");
}

/**
 * Release finished goods to warehouse inventory and transition Job Order & Sales Order statuses.
 */
export async function releaseFinishedGoodsReceipt(payload: {
    joId: string;
    productId: number;
    productName: string;
    quantityProduced: number;
    branchId: number;
    lotNumber: string;
    expirationDate: string;
    unitCost: number;
    componentsConsumed: unknown[];
}): Promise<unknown> {
    const res = await fetch("/api/manufacturing/production/finished-goods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return handleResponse(res, "Failed to release finished goods receipt");
}

/**
 * Update the Job Order status (e.g. to Finished or Cancelled) directly.
 */
export async function updateJobOrderStatus(joId: string, status: string): Promise<unknown> {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            joId,
            patch: { status }
        })
    });
    return handleResponse(res, "Failed to update job order status");
}
