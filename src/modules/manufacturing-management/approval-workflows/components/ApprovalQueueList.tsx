"use client";

import React, { useState } from "react";
import { ApprovalRequest, ThresholdRule } from "../types";
import {
    CheckCircle2,
    XCircle,
    Clock,
    FileCheck,
    MessageSquare,
    Search,
    RefreshCw,
    Plus,
    X,
    UserCheck
} from "lucide-react";

interface ApprovalQueueListProps {
    requests: ApprovalRequest[];
    rules: ThresholdRule[];
    onReviewRequest: (id: number, status: "approved" | "rejected", comments: string, reviewer: string) => Promise<boolean>;
    onCreateSimulatedRequest: (clientName: string, margin: number, code: string, requester: string) => Promise<boolean>;
    loading: boolean;
}

export function ApprovalQueueList({
    requests,
    rules,
    onReviewRequest,
    onCreateSimulatedRequest,
    loading
}: ApprovalQueueListProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
    const [reviewingRequest, setReviewingRequest] = useState<ApprovalRequest | null>(null);
    const [reviewComments, setReviewComments] = useState("");
    const [reviewerRole, setReviewerRole] = useState("Finance Manager");
    const [showSimulationModal, setShowSimulationModal] = useState(false);

    // Simulation Form State
    const [simClient, setSimClient] = useState("San Fernando Wholesalers");
    const [simMargin, setSimMargin] = useState("11.5");
    const [simCode, setSimCode] = useState("SO-2026-005");
    const [simRequester, setSimRequester] = useState("Jane Sales");

    const filteredRequests = requests.filter((r) => {
        const matchesSearch =
            r.sales_order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.requested_by.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesTab = activeTab === "pending" ? r.status === "pending" : r.status !== "pending";

        return matchesSearch && matchesTab;
    });

    const handleOpenReview = (req: ApprovalRequest) => {
        setReviewingRequest(req);
        setReviewComments("");

        // Auto-match reviewer role based on rule triggers if possible
        const triggeredRule = rules
            .filter((rule) => rule.is_active && req.current_margin < rule.min_margin)
            .sort((a, b) => b.min_margin - a.min_margin)[0];

        if (triggeredRule) {
            setReviewerRole(triggeredRule.role_required);
        } else {
            setReviewerRole("Finance Manager");
        }
    };

    const handleReviewSubmit = async (status: "approved" | "rejected") => {
        if (!reviewingRequest) return;
        if (!reviewComments.trim()) {
            alert("Please provide review notes or comments.");
            return;
        }

        const success = await onReviewRequest(
            reviewingRequest.id,
            status,
            reviewComments,
            `${reviewerRole} (System Audit)`
        );

        if (success) {
            setReviewingRequest(null);
        }
    };

    const handleCreateSimulationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const marginNum = parseFloat(simMargin);
        if (isNaN(marginNum) || marginNum < 0 || marginNum > 100) {
            alert("Please enter a valid margin.");
            return;
        }

        const success = await onCreateSimulatedRequest(
            simClient,
            marginNum,
            simCode,
            simRequester
        );

        if (success) {
            setShowSimulationModal(false);
            // Set random code for next simulation
            setSimCode(`SO-2026-${Math.floor(Math.random() * 900) + 100}`);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {/* Search field */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Search code, client, or sales agent..."
                    />
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={() => setShowSimulationModal(true)}
                        className="px-4 h-9 border border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                        <Plus className="size-4" />
                        Simulate Margin Trigger
                    </button>

                    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
                        <button
                            onClick={() => setActiveTab("pending")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                activeTab === "pending"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Pending Review ({requests.filter(r => r.status === "pending").length})
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                activeTab === "history"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Audit Log ({requests.filter(r => r.status !== "pending").length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Queue List */}
            {filteredRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-card/40 p-12 text-center text-muted-foreground text-sm">
                    No approval requests found matching your filters.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredRequests.map((req) => (
                        <div
                            key={req.id}
                            className={`rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md ${
                                req.status === "approved"
                                    ? "border-emerald-200 bg-emerald-50/10 dark:bg-emerald-950/5"
                                    : req.status === "rejected"
                                    ? "border-rose-200 bg-rose-50/10 dark:bg-rose-950/5"
                                    : "border-border"
                            }`}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-muted rounded">
                                            {req.sales_order_code}
                                        </span>
                                        <h4 className="font-semibold text-sm">{req.client_name}</h4>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                                        <span>
                                            Agent: <strong className="text-foreground font-medium">{req.requested_by}</strong>
                                        </span>
                                        <span>•</span>
                                        <span>
                                            Requested: <strong className="text-foreground font-medium">{new Date(req.requested_at).toLocaleDateString()}</strong>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center gap-4 shrink-0">
                                    {/* Margin Indicator */}
                                    <div className="text-left md:text-right">
                                        <span className="text-xs text-muted-foreground block">Gross Margin</span>
                                        <span className="font-bold text-sm text-rose-600 dark:text-rose-400">
                                            {req.current_margin}%
                                        </span>
                                    </div>

                                    {/* Status Indicator / Actions */}
                                    <div className="flex items-center gap-3">
                                        {req.status === "pending" ? (
                                            <>
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400">
                                                    <Clock className="size-3.5" />
                                                    Pending Review
                                                </span>
                                                <button
                                                    onClick={() => handleOpenReview(req)}
                                                    className="px-3 h-8 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                                                >
                                                    <UserCheck className="size-3.5" />
                                                    Review
                                                </button>
                                            </>
                                        ) : req.status === "approved" ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400">
                                                <CheckCircle2 className="size-3.5" />
                                                Approved
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400">
                                                <XCircle className="size-3.5" />
                                                Rejected
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Approval/Rejection Metadata */}
                            {req.status !== "pending" && (
                                <div className="mt-4 pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <FileCheck className="size-4 text-primary shrink-0" />
                                        <span>
                                            Reviewed by: <strong className="text-foreground font-medium">{req.reviewed_by}</strong> on {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : "-"}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <MessageSquare className="size-4 text-primary shrink-0 mt-0.5" />
                                        <span>
                                            Notes: <strong className="text-foreground font-medium italic">&quot;{req.comments || "No comments"}&quot;</strong>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Review Sidebar Overlay / Slide-over modal */}
            {reviewingRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-lg bg-card border rounded-xl shadow-lg overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-5 border-b flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-base">Review Margin Deviation Request</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Assess gross margin pricing variance for order {reviewingRequest.sales_order_code}.
                                </p>
                            </div>
                            <button
                                onClick={() => setReviewingRequest(null)}
                                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Request Info Summary */}
                            <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3.5 rounded-lg border text-xs">
                                <div>
                                    <span className="text-muted-foreground block">Client:</span>
                                    <span className="font-semibold text-foreground">{reviewingRequest.client_name}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Sales order:</span>
                                    <span className="font-mono font-semibold text-foreground">{reviewingRequest.sales_order_code}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Order Gross Margin:</span>
                                    <span className="font-bold text-rose-600 dark:text-rose-400">{reviewingRequest.current_margin}%</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Requesting Agent:</span>
                                    <span className="font-semibold text-foreground">{reviewingRequest.requested_by}</span>
                                </div>
                            </div>

                            {/* Action Review Form */}
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Simulating Reviewer Role
                                </label>
                                <select
                                    value={reviewerRole}
                                    onChange={(e) => setReviewerRole(e.target.value)}
                                    className="w-full h-10 px-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="Finance Manager">Finance Manager</option>
                                    <option value="Sales Director">Sales Director</option>
                                    <option value="Director">Director</option>
                                    <option value="System Admin">System Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Review Decision Comments & Remarks
                                </label>
                                <textarea
                                    required
                                    value={reviewComments}
                                    onChange={(e) => setReviewComments(e.target.value)}
                                    rows={4}
                                    className="w-full p-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="Explain the approval justification or rejection criteria..."
                                />
                            </div>

                            <div className="border-t pt-4 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setReviewingRequest(null)}
                                    className="px-4 h-10 border rounded-lg text-xs font-medium hover:bg-muted"
                                >
                                    Cancel
                                </button>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleReviewSubmit("rejected")}
                                        disabled={loading}
                                        className="px-4 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1"
                                    >
                                        <XCircle className="size-4" />
                                        Reject & Cancel SO
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleReviewSubmit("approved")}
                                        disabled={loading}
                                        className="px-4 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1"
                                    >
                                        <CheckCircle2 className="size-4" />
                                        Approve & Release
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Simulation Trigger Creator Modal */}
            {showSimulationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-md bg-card border rounded-xl shadow-lg overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-5 border-b flex items-center justify-between">
                            <h3 className="font-semibold text-base">Simulate Gross Margin Warning Trigger</h3>
                            <button
                                onClick={() => setShowSimulationModal(false)}
                                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSimulationSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Sales Order Code
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={simCode}
                                    onChange={(e) => setSimCode(e.target.value)}
                                    className="w-full h-10 px-3 border rounded-lg bg-background text-sm focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Client / Customer
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={simClient}
                                    onChange={(e) => setSimClient(e.target.value)}
                                    className="w-full h-10 px-3 border rounded-lg bg-background text-sm focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Simulated Order Margin (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        value={simMargin}
                                        onChange={(e) => setSimMargin(e.target.value)}
                                        className="w-full h-10 px-3 pr-10 border rounded-lg bg-background text-sm focus:outline-none"
                                    />
                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
                                        %
                                    </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                    Margins below active rules triggers will route approval queues.
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Submitting Sales Agent
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={simRequester}
                                    onChange={(e) => setSimRequester(e.target.value)}
                                    className="w-full h-10 px-3 border rounded-lg bg-background text-sm focus:outline-none"
                                />
                            </div>

                            <div className="border-t pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowSimulationModal(false)}
                                    className="px-4 h-9 border rounded-lg text-xs font-medium hover:bg-muted"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow flex items-center justify-center gap-1"
                                >
                                    {loading ? <RefreshCw className="size-3.5 animate-spin mr-1" /> : null}
                                    Trigger Workflow
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
