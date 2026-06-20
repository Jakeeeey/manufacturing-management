"use client";

import React, { useState } from "react";
import { useApprovalWorkflows } from "./hooks/useApprovalWorkflows";
import { ThresholdRulesTable } from "./components/ThresholdRulesTable";
import { ApprovalQueueList } from "./components/ApprovalQueueList";
import { Sliders, ClipboardList, ShieldAlert, Sparkles, RefreshCw, BarChart2 } from "lucide-react";

export default function ApprovalWorkflowsModule() {
    const {
        rules,
        requests,
        loading,
        error,
        saveRule,
        deleteRule,
        reviewRequest,
        createSimulatedRequest,
        refresh
    } = useApprovalWorkflows();

    const [activeTab, setActiveTab] = useState<"rules" | "queue">("rules");

    const activeRulesCount = rules.filter((r) => r.is_active).length;
    const pendingRequestsCount = requests.filter((r) => r.status === "pending").length;
    const totalRequestsCount = requests.length;

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto p-1 sm:p-2">
            {/* Header Block */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 p-6 sm:p-8 text-white shadow-lg border border-indigo-900/40">
                {/* Background decorative glow */}
                <div className="absolute -right-10 -top-10 size-40 bg-indigo-500/20 blur-3xl pointer-events-none rounded-full" />
                <div className="absolute -left-10 -bottom-10 size-40 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />

                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            <Sparkles className="size-3" />
                            Revenue Safety & Risk Controls
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                            Approval Threshold Workflows
                        </h1>
                        <p className="text-sm text-indigo-200/80 max-w-2xl leading-relaxed">
                            Configure automatic margin protection policies, alert sales teams of cost violations, and route low-margin orders to designated manager roles for mandatory sign-off.
                        </p>
                    </div>

                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10 shadow-sm shrink-0"
                    >
                        <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                        Sync Registry
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center gap-3">
                    <ShieldAlert className="size-5 shrink-0 text-rose-600" />
                    <div>
                        <span className="font-semibold text-rose-900">Registry Error:</span> {error}
                    </div>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs text-muted-foreground font-medium block">Active Rules Tiers</span>
                        <span className="text-2xl font-bold mt-1 block font-mono">{activeRulesCount}</span>
                    </div>
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <Sliders className="size-5" />
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs text-muted-foreground font-medium block">Pending Approvals</span>
                        <span className="text-2xl font-bold mt-1 block font-mono text-amber-600 dark:text-amber-400">
                            {pendingRequestsCount}
                        </span>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-lg">
                        <ShieldAlert className="size-5" />
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs text-muted-foreground font-medium block">Total Submissions Checked</span>
                        <span className="text-2xl font-bold mt-1 block font-mono">{totalRequestsCount}</span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
                        <ClipboardList className="size-5" />
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-xs text-muted-foreground font-medium block">Protected Margin Limit</span>
                        <span className="text-2xl font-bold mt-1 block font-mono text-emerald-600 dark:text-emerald-400">
                            15.0%
                        </span>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <BarChart2 className="size-5" />
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border/80">
                <button
                    onClick={() => setActiveTab("rules")}
                    className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 ${
                        activeTab === "rules"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <Sliders className="size-4" />
                    Threshold & Rule Policies
                </button>
                <button
                    onClick={() => setActiveTab("queue")}
                    className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 -mb-px flex items-center gap-2 ${
                        activeTab === "queue"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <ClipboardList className="size-4" />
                    Approval Request Queue
                    {pendingRequestsCount > 0 && (
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                            {pendingRequestsCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Dynamic Panel view */}
            <div className="transition-all duration-200">
                {activeTab === "rules" ? (
                    <ThresholdRulesTable
                        rules={rules}
                        onSaveRule={saveRule}
                        onDeleteRule={deleteRule}
                        loading={loading}
                    />
                ) : (
                    <ApprovalQueueList
                        requests={requests}
                        rules={rules}
                        onReviewRequest={reviewRequest}
                        onCreateSimulatedRequest={createSimulatedRequest}
                        loading={loading}
                    />
                )}
            </div>
        </div>
    );
}
