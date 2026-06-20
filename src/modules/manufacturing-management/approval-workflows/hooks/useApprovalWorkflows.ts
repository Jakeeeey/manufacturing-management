import { useState, useEffect } from "react";
import { ThresholdRule, ApprovalRequest } from "../types";

export function useApprovalWorkflows() {
    const [rules, setRules] = useState<ThresholdRule[]>([]);
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/manufacturing/approval-workflows", { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch approval workflow data");
            const data = await res.json();
            setRules(data.rules || []);
            setRequests(data.requests || []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load workflow data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const saveRule = async (rule: Partial<ThresholdRule>) => {
        setLoading(true);
        try {
            const res = await fetch("/api/manufacturing/approval-workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "rule", data: rule })
            });
            if (!res.ok) throw new Error("Failed to save rule");
            const data = await res.json();
            if (data.db) {
                setRules(data.db.rules || []);
                setRequests(data.db.requests || []);
            } else {
                await fetchData();
            }
            return true;
        } catch (err) {
            console.error(err);
            setError("Failed to save rule");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteRule = async (id: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/manufacturing/approval-workflows?type=rule&id=${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete rule");
            const data = await res.json();
            if (data.db) {
                setRules(data.db.rules || []);
                setRequests(data.db.requests || []);
            } else {
                await fetchData();
            }
            return true;
        } catch (err) {
            console.error(err);
            setError("Failed to delete rule");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const reviewRequest = async (id: number, status: "approved" | "rejected", comments: string, reviewer: string) => {
        setLoading(true);
        try {
            const updatePayload: Partial<ApprovalRequest> = {
                id,
                status,
                comments,
                reviewed_by: reviewer,
                reviewed_at: new Date().toISOString()
            };
            const res = await fetch("/api/manufacturing/approval-workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "request", data: updatePayload })
            });
            if (!res.ok) throw new Error("Failed to review request");
            const data = await res.json();
            if (data.db) {
                setRules(data.db.rules || []);
                setRequests(data.db.requests || []);
            } else {
                await fetchData();
            }
            return true;
        } catch (err) {
            console.error(err);
            setError("Failed to process approval review");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const createSimulatedRequest = async (clientName: string, margin: number, code: string, requester: string) => {
        setLoading(true);
        try {
            const newReq: Partial<ApprovalRequest> = {
                sales_order_id: Math.floor(Math.random() * 1000) + 200,
                sales_order_code: code,
                client_name: clientName,
                current_margin: margin,
                status: "pending",
                requested_by: requester
            };
            const res = await fetch("/api/manufacturing/approval-workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "request", data: newReq })
            });
            if (!res.ok) throw new Error("Failed to create simulated request");
            const data = await res.json();
            if (data.db) {
                setRules(data.db.rules || []);
                setRequests(data.db.requests || []);
            } else {
                await fetchData();
            }
            return true;
        } catch (err) {
            console.error(err);
            setError("Failed to create simulated request");
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        rules,
        requests,
        loading,
        error,
        saveRule,
        deleteRule,
        reviewRequest,
        createSimulatedRequest,
        refresh: fetchData
    };
}
