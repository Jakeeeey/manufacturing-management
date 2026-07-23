/* eslint-disable */
import { JobOrder, User, RouteOperatorRecord } from "../types";

export async function fetchJobOrders(): Promise<JobOrder[]> {
    const res = await fetch("/api/manufacturing/planning-engineering");
    if (!res.ok) throw new Error("Failed to load job orders");
    return res.json();
}

export async function fetchUsersList(): Promise<User[]> {
    const res = await fetch("/api/manufacturing/planning-engineering?action=users");
    if (!res.ok) throw new Error("Failed to load operators list");
    return res.json();
}

export interface RouteOperatorsResponse {
    data: RouteOperatorRecord[];
    summary: {
        total_hours: number;
        total_labor_cost: number;
    };
}

export async function fetchRouteOperators(taskId: number): Promise<RouteOperatorsResponse> {
    const res = await fetch(`/api/manufacturing/production/route-operators?taskId=${taskId}`);
    if (!res.ok) throw new Error("Failed to load operators logs");
    return res.json();
}

export interface RouteOperatorPayload {
    action: string;
    taskId: number;
    userId: number;
    joId?: string;
    routingId?: number;
    actualHours?: number;
    hourlyRate?: number;
}

export async function manageRouteOperator(payload: RouteOperatorPayload): Promise<any> {
    const res = await fetch("/api/manufacturing/production/route-operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to manage operator.");
    }
    return res.json();
}

export interface PatchTaskPayload {
    taskId: number;
    taskPatch: {
        status?: string;
        completed_at?: string | null;
        actual_run_hours: number;
    };
}

export async function patchRoutingTask(payload: PatchTaskPayload): Promise<void> {
    const res = await fetch("/api/manufacturing/planning-engineering", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to update task.");
}

export async function fetchQATemplate(taskName: string, productId: number): Promise<any> {
    const res = await fetch(
        `/api/manufacturing/qa?action=matching-template&taskName=${encodeURIComponent(taskName)}&productId=${productId}`
    );
    if (!res.ok) throw new Error("Failed to load QA Checklist template.");
    return res.json();
}

export interface QAVerificationPayload {
    action: "verify";
    joId: string;
    taskId: number;
    taskName: string;
    productName: string;
    expectedQty: number;
    actualQty: number;
    verifications: Array<{
        parameter_id: number;
        test_name: string;
        value: string | number | boolean;
        min_value: number | null;
        max_value: number | null;
        target_value: string | null;
        is_failed: boolean;
        is_critical: boolean;
    }>;
    comments: string;
    userId: number | null;
}

export async function submitQAVerification(payload: QAVerificationPayload): Promise<any> {
    const res = await fetch("/api/manufacturing/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to process QA verification.");
    }
    return res.json();
}

export interface ShiftRunLogPayload {
    taskId: number;
    joId: string | number;
    shiftName: string;
    yieldQty: number;
    inspectorId: number | null;
    qaStatus: "Passed" | "QA Hold" | "Pending";
    qaParameters?: Array<{
        parameter_id: number;
        test_name: string;
        value: string | number | boolean;
        is_failed: boolean;
        remarks?: string;
    }>;
    materialsConsumed?: Array<{
        product_id: number;
        actual_qty: number;
    }>;
    batchNo?: string;
    expiryDate?: string;
    manufacturingDate?: string;
    targetLotId?: number;
}

export async function submitShiftRunLog(payload: ShiftRunLogPayload): Promise<any> {
    const res = await fetch("/api/manufacturing/production/shift-run-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit shift run log.");
    }
    return res.json();
}
