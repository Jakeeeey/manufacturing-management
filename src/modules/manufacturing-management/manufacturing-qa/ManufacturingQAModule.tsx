"use client";

import React, { useMemo } from "react";
import { Search, RotateCw, ShieldCheck, History, AlertTriangle, PackageCheck } from "lucide-react";
import { useManufacturingQA } from "./hooks/useManufacturingQA";
import { QAOverviewDashboard } from "./components/QAOverviewDashboard";
import { ActiveJOAuditTable } from "./components/ActiveJOAuditTable";
import { QALogHistoryTable } from "./components/QALogHistoryTable";
import { JobOrderQAAuditModal } from "./components/JobOrderQAAuditModal";
import { ReleasedBatchesTable } from "./components/ReleasedBatchesTable";

export default function ManufacturingQAModule({ userId }: { userId?: number }) {
    const {
        activeTab,
        setActiveTab,
        loading,
        searchQuery,
        setSearchQuery,
        selectedJO,
        setSelectedJO,
        isAuditModalOpen,
        setIsAuditModalOpen,
        submittingAudit,
        releasingGoods,
        catalogProducts,
        branches,
        filteredJobOrders,
        filteredHistory,
        completedBatches,
        handleOpenAudit,
        handleVerifyQATask,
        handleStartRoutingTask,
        handleReleaseGoods,
        refresh
    } = useManufacturingQA(userId);

    // Dynamically calculate high deviation alerts across active Job Orders
    const deviationAlerts = useMemo(() => {
        const alerts: { joId: string; productName: string; deviationRate: number; scrapCount: number }[] = [];

        // Check each filtered active job order for QA history deviations
        filteredJobOrders.forEach(jo => {
            const relatedLogs = filteredHistory.filter(log => log.jo_id === jo.jo_id);
            if (relatedLogs.length === 0) return;

            let totalExp = 0;
            let totalDev = 0;
            relatedLogs.forEach(log => {
                totalExp += log.expected_quantity;
                totalDev += log.deviation_quantity;
            });

            const deviationRate = totalExp > 0 ? (totalDev / totalExp) * 100 : 0;
            if (deviationRate >= 10.0) {
                alerts.push({
                    joId: jo.jo_id,
                    productName: jo.product_name,
                    deviationRate,
                    scrapCount: totalDev
                });
            }
        });

        return alerts;
    }, [filteredJobOrders, filteredHistory]);

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">Manufacturing Quality Control & QA Inspection</h3>
                    <p className="text-xs text-muted-foreground font-medium">
                        Audit active Job Orders, record stage-by-stage QA checklists, track yield scrap deviations, and authorize inventory release.
                    </p>
                </div>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card hover:bg-muted border text-muted-foreground hover:text-foreground text-xs font-bold transition-all shadow-xs"
                >
                    <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Sync Data
                </button>
            </div>

            {/* Severity Alerts Banner */}
            {deviationAlerts.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-rose-500 text-xs font-extrabold uppercase tracking-wider">
                        <AlertTriangle className="h-4 w-4" />
                        Critical Yield Deviation Alert
                    </div>
                    <div className="space-y-1.5">
                        {deviationAlerts.map(alert => (
                            <p key={alert.joId} className="text-[11px] text-muted-foreground font-semibold">
                                Job Order <span className="text-foreground font-black">{alert.joId}</span> ({alert.productName}) has logged a scrap yield loss of <span className="text-rose-500 font-extrabold">{alert.deviationRate.toFixed(1)}%</span> ({alert.scrapCount} items). Audit correction is recommended.
                            </p>
                        ))}
                    </div>
                </div>
            )}

            {/* QA KPIs & Analytics Dashboard Widget */}
            <QAOverviewDashboard
                qaHistory={filteredHistory}
                activeJOs={filteredJobOrders}
                catalogProducts={catalogProducts}
            />

            {/* Navigation Tabs, Search, & Filtering */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
                <div className="flex bg-muted/10 shrink-0 rounded-xl overflow-hidden border max-w-lg">
                    <button
                        disabled={loading}
                        onClick={() => setActiveTab("pending")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-[1px] disabled:opacity-50 disabled:cursor-wait ${
                            activeTab === "pending"
                                ? "border-primary text-primary bg-background shadow-xs"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                    >
                        <ShieldCheck className="h-4 w-4" /> Active QA Queue
                    </button>
                    <button
                        disabled={loading}
                        onClick={() => setActiveTab("history")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-[1px] disabled:opacity-50 disabled:cursor-wait ${
                            activeTab === "history"
                                ? "border-primary text-primary bg-background shadow-xs"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                    >
                        <History className="h-4 w-4" /> Checklist Logs
                    </button>
                    <button
                        disabled={loading}
                        onClick={() => setActiveTab("released")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-[1px] disabled:opacity-50 disabled:cursor-wait ${
                            activeTab === "released"
                                ? "border-primary text-primary bg-background shadow-xs"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                    >
                        <PackageCheck className="h-4 w-4" /> Released Batches
                    </button>
                </div>

                {/* Search query input */}
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={
                            activeTab === "pending"
                                ? "Search active JOs..."
                                : activeTab === "history"
                                ? "Search historic logs..."
                                : "Search released batches..."
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-card border rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-1 focus:ring-primary font-semibold text-foreground text-xs"
                    />
                </div>
            </div>

            {/* Core Datatable Views with Loading/Skeleton Placeholder States */}
            {loading ? (
                <div className="space-y-4 py-12 text-center">
                    <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground font-semibold">Syncing inspector ledger queue...</p>
                </div>
            ) : activeTab === "pending" ? (
                <ActiveJOAuditTable
                    jobOrders={filteredJobOrders}
                    branches={branches}
                    handleOpenAudit={handleOpenAudit}
                />
            ) : activeTab === "history" ? (
                <QALogHistoryTable 
                    qaHistory={filteredHistory} 
                />
            ) : (
                <ReleasedBatchesTable
                    completedBatches={completedBatches}
                />
            )}

            {/* Checklist Inspection & Release Modal Dialog */}
            <JobOrderQAAuditModal
                isOpen={isAuditModalOpen}
                onClose={() => {
                    setIsAuditModalOpen(false);
                    setSelectedJO(null);
                }}
                jo={selectedJO}
                qaHistory={filteredHistory}
                submittingAudit={submittingAudit}
                releasingGoods={releasingGoods}
                handleVerifyQATask={handleVerifyQATask}
                handleStartRoutingTask={handleStartRoutingTask}
                handleReleaseGoods={handleReleaseGoods}
            />
        </div>
    );
}
