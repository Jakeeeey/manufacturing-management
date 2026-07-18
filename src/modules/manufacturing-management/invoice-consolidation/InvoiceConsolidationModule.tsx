"use client";

import React, { useEffect, useCallback } from "react";
import { useInvoiceConsolidation } from "./hooks/useInvoiceConsolidation";
import CreateConsolidationModal from "./components/CreateConsolidationModal";
import ConsolidationDetailSheet from "./components/ConsolidationDetailSheet";
import {
    Package,
    ClipboardCheck,
    Plus,
    Loader2,
    Search,

    Play,
    SquarePen,
    AlertTriangle,
    Building2,
    Layers,
    ListOrdered,
    ArrowUpRight,
    RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmAction = "revert" | "audit" | "start-picking" | null;

export default function InvoiceConsolidationModule() {
    const {
        consolidations,
        summary,
        candidates,
        branches,
        selectedBranch,
        loading,
        submitting,
        page,
        totalPages,
        statusFilter,
        searchQuery,
        branchId,
        selectedConsolidation,
        showCreateModal,
        setPage,
        setStatusFilter,
        setSearchQuery,
        handleBranchChange,
        setSelectedConsolidation,
        setShowCreateModal,
        handleCreate,
        handleAudit,
        handleRevert,
        handleStartPicking,
        loadCandidates,
        openDetail,
    } = useInvoiceConsolidation();

    const [expandedId, setExpandedId] = React.useState<number | null>(null);
    const [confirmAction, setConfirmAction] = React.useState<{ type: ConfirmAction; batchId: number } | null>(null);

    useEffect(() => {
        if (showCreateModal && branchId) {
            loadCandidates(branchId);
        }
    }, [showCreateModal, loadCandidates, branchId]);

    const toggleExpand = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setExpandedId(expandedId === id ? null : id);
    };

    const handleRowClick = (c: typeof consolidations[number]) => {
        openDetail(c);
    };

    const handleRowKeyDown = (e: React.KeyboardEvent, c: typeof consolidations[number]) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleRowClick(c);
        }
    };

    const executeConfirmed = useCallback(async () => {
        if (!confirmAction) return;
        const { type, batchId } = confirmAction;
        setConfirmAction(null);
        if (type === "audit") {
            await handleAudit(batchId);
        } else if (type === "revert") {
            await handleRevert(batchId);
        } else if (type === "start-picking") {
            await handleStartPicking(batchId);
        }
    }, [confirmAction, handleAudit, handleRevert, handleStartPicking]);

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            Pending: "bg-amber-500/10 border-amber-500/20 text-amber-500",
            Picking: "bg-blue-500/10 border-blue-500/20 text-blue-500",
            Picked: "bg-purple-500/10 border-purple-500/20 text-purple-500",
            Audited: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
        };
        return (
            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${styles[status] || styles.Pending}`}>
                {status}
            </span>
        );
    };

    const summaryCards = [
        { label: "All", value: summary.All, color: "text-zinc-400", icon: <ListOrdered className="h-4 w-4" /> },
        { label: "Pending", value: summary.Pending, color: "bg-amber-500/10 border-amber-500/20 text-amber-500", icon: <Package className="h-5 w-5" /> },
        { label: "Picking", value: summary.Picking, color: "bg-blue-500/10 border-blue-500/20 text-blue-500", icon: <Play className="h-5 w-5" /> },
        { label: "Picked", value: summary.Picked, color: "bg-purple-500/10 border-purple-500/20 text-purple-500", icon: <SquarePen className="h-5 w-5" /> },
        { label: "Audited", value: summary.Audited, color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500", icon: <ClipboardCheck className="h-5 w-5" /> },
    ];

    const dashboardHeader = (
        <div className="sticky top-0 z-30 flex flex-col gap-4 border-b border-border/40 bg-background/90 py-2 backdrop-blur-md xl:flex-row xl:items-center xl:justify-between xl:border-transparent sm:py-4">
            <div className="flex w-full shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5 xl:w-auto">
                <div className="hidden rotate-3 rounded-2xl bg-primary p-3 shadow-xl shadow-primary/20 sm:flex">
                    <Layers className="h-6 w-6 text-primary-foreground stroke-[2.5px] lg:h-8 lg:w-8" />
                </div>
                <div className="w-full space-y-2 sm:w-auto sm:space-y-0.5">
                    <h2 className="flex items-center gap-2 whitespace-nowrap text-2xl font-black uppercase italic leading-none tracking-tighter sm:text-3xl md:text-4xl">
                        <Layers className="h-5 w-5 text-primary stroke-[3px] sm:hidden" />
                        Invoice <span className="text-primary">Consolidation</span>
                    </h2>
                    <SearchableSelect
                        value={selectedBranch ? String(selectedBranch.id) : ""}
                        onValueChange={(value) => {
                            const branch = branches.find((item) => item.id === Number(value));
                            handleBranchChange(branch ?? null);
                        }}
                        options={branches.map((branch) => ({
                            value: String(branch.id),
                            label: `${branch.branchName} (${branch.branchCode})`,
                        }))}
                        placeholder="Search and select branch..."
                        className="h-11 w-full border-border/40 bg-card/40 text-sm font-bold shadow-inner backdrop-blur-md sm:w-[260px]"
                    />
                </div>
            </div>

            <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center xl:w-auto">
                <div className="group relative w-full sm:w-64 md:w-72">
                    <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/30 to-blue-500/30 opacity-0 blur transition duration-500 group-focus-within:opacity-100" />
                    <Search className="absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-50" />
                    <input
                        type="text"
                        placeholder="Find batch or invoice..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={!selectedBranch}
                        className="relative z-10 h-10 w-full rounded-xl border border-border/40 bg-card/50 pl-10 pr-3 text-xs font-bold shadow-inner outline-none backdrop-blur-sm placeholder:font-medium focus:ring-2 focus:ring-primary/20 disabled:opacity-50 sm:h-12 sm:text-sm"
                        suppressHydrationWarning
                    />
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    disabled={!selectedBranch}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-95 disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:px-8 sm:text-xs"
                    suppressHydrationWarning
                >
                    <Plus className="h-4 w-4 stroke-[3.5px]" />
                    Generate Batch
                </button>
            </div>
        </div>
    );

    const statusOverview = (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {summaryCards.map((card) => {
                const active = statusFilter === card.label;
                return (
                    <button
                        key={card.label}
                        type="button"
                        onClick={() => {
                            setStatusFilter(card.label);
                            setPage(0);
                        }}
                        disabled={!selectedBranch}
                        className={cn(
                            "group relative overflow-hidden rounded-xl border-none p-3 text-left transition-all duration-500 sm:rounded-2xl sm:p-4",
                            active
                                ? "scale-[1.02] bg-card shadow-[0_15px_30px_-10px_rgba(0,0,0,0.3)] ring-1 ring-primary/40"
                                : "bg-card/40 backdrop-blur-sm hover:bg-card/60",
                            !selectedBranch && "pointer-events-none opacity-60"
                        )}
                        suppressHydrationWarning
                    >
                        {active && <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary to-transparent" />}
                        <div className="flex items-center justify-between">
                            <div className={cn("rounded-lg bg-muted/50 p-2 transition-transform group-hover:rotate-12", active && "rotate-6 bg-primary text-primary-foreground", !active && card.color)}>
                                {card.icon}
                            </div>
                            {active && <ArrowUpRight className="h-3 w-3 text-primary" />}
                        </div>
                        <p className={cn("mt-3 text-[9px] font-black uppercase tracking-[0.2em]", active ? "text-primary" : "text-muted-foreground/50")}>{card.label}</p>
                        <div className="flex items-baseline gap-1">
                            <strong className="text-2xl font-black tracking-tighter tabular-nums">{selectedBranch ? card.value : 0}</strong>
                            <span className="hidden text-[8px] font-bold uppercase text-muted-foreground/40 sm:inline">Batches</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );

    const confirmLabels: Record<string, { title: string; description: string }> = {
        audit: { title: "Audit this batch?", description: "This will mark the batch as audited and dispatch all linked invoices." },
        revert: { title: "Revert this batch?", description: "This will reset the batch to Pending status and undispatch all linked invoices." },
        "start-picking": { title: "Start picking this batch?", description: "This will move the batch to Picking status so quantities can be recorded." },
    };

    if (!selectedBranch) {
        return (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-6 bg-background p-1 pb-20 text-foreground sm:p-4 md:space-y-8 md:p-6">
                {dashboardHeader}
                <div className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-xl border border-border/30 bg-card/20 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.1)] backdrop-blur-sm sm:rounded-[2rem]">
                    <div className="flex flex-1 flex-col items-center justify-center px-4 py-32 text-center">
                        <Building2 className="mb-4 h-12 w-12 animate-bounce text-muted-foreground" />
                        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">Select Branch to Stream Data</p>
                    </div>
                </div>

                {selectedBranch && (
                    <CreateConsolidationModal
                        key={`create-modal-${showCreateModal}`}
                        isOpen={showCreateModal}
                        onClose={() => setShowCreateModal(false)}
                        branch={selectedBranch}
                        candidates={candidates}
                        loading={loading}
                        onSubmit={handleCreate}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col space-y-6 bg-background p-1 pb-20 text-foreground sm:p-4 md:space-y-8 md:p-6">
            {dashboardHeader}
            {statusOverview}

            {/* Confirmation Dialog */}
            <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <AlertDialogTitle className="text-sm font-bold">{confirmAction ? confirmLabels[confirmAction.type as Exclude<ConfirmAction, null>]?.title : ""}</AlertDialogTitle>
                                <AlertDialogDescription className="text-[11px] mt-0.5">{confirmAction ? confirmLabels[confirmAction.type as Exclude<ConfirmAction, null>]?.description : ""}</AlertDialogDescription>
                            </div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction disabled={submitting} onClick={executeConfirmed}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Main Table */}
            <div className="relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-xl border border-border/30 bg-card/20 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.1)] backdrop-blur-sm sm:rounded-[2rem] sm:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)]">
                {loading && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-background/70 backdrop-blur-sm">
                        <div className="rounded-3xl border border-border/50 bg-card p-5 shadow-2xl"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground"><RefreshCw className="h-3 w-3 animate-spin" /> Syncing Consolidations</div>
                    </div>
                )}

                {consolidations.length === 0 && !loading ? (
                    <div className="text-center py-12">
                        <Package className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                        <h5 className="font-bold text-foreground text-xs uppercase tracking-wide mt-2">
                            No Consolidation Batches
                        </h5>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Click &quot;New Consolidation&quot; to create an invoice consolidation batch for <strong>{selectedBranch.branchName}</strong>.
                        </p>
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
                        <table className="min-w-[760px] w-full border-collapse text-left text-xs">
                            <thead className="sticky top-0 z-10 border-b border-border/50 bg-muted/50 backdrop-blur-xl">
                                <tr className="border-b bg-muted/20">
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Consolidator No</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Branch</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Invoices</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Total Amount</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Created</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {consolidations.map((c) => (
                                    <React.Fragment key={c.id}>
                                        <tr
                                            onClick={() => handleRowClick(c)}
                                            onKeyDown={(e) => handleRowKeyDown(e, c)}
                                            tabIndex={0}
                                            className="group cursor-pointer border-border/30 transition-all hover:bg-primary/[0.02] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30"
                                        >
                                             <td className="p-3"><span className="rounded bg-muted/50 px-2 py-1 font-mono font-black tracking-tight text-foreground/90">{c.consolidatorNo}</span></td>
                                            <td className="p-3 text-muted-foreground">{c.branchName || selectedBranch.branchName}</td>
                                            <td className="p-3 text-muted-foreground">
                                                <button
                                                    onClick={(e) => toggleExpand(e, c.id)}
                                                    className="text-primary font-semibold hover:underline cursor-pointer"
                                                    suppressHydrationWarning
                                                >
                                                    {c.invoices?.length || 0} invoice(s)
                                                </button>
                                            </td>
                                            <td className="p-3 text-right font-black text-foreground">
                                                P{Number(c.totalSalesOrderAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-3 text-muted-foreground">
                                                {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}
                                            </td>
                                            <td className="p-3 text-center">{getStatusBadge(c.status)}</td>
                                        </tr>
                                        {expandedId === c.id && (
                                            <tr className="bg-muted/5">
                                                <td colSpan={6} className="p-0">
                                                    <table className="w-full text-left border-collapse text-[10px]">
                                                        <thead>
                                                            <tr className="border-t border-b bg-muted/10">
                                                                <th className="p-2 pl-12 font-semibold text-muted-foreground uppercase">Invoice No</th>
                                                                <th className="p-2 font-semibold text-muted-foreground uppercase">Invoice ID</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {c.invoices?.map((inv) => (
                                                                <tr key={inv.id} className="border-b border-muted/5">
                                                                    <td className="p-2 pl-12 font-medium text-foreground">{inv.invoiceNo}</td>
                                                                    <td className="p-2 text-muted-foreground">#{inv.invoiceId}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div className="flex shrink-0 flex-col items-center justify-between gap-4 border-t border-border/50 bg-muted/30 px-4 py-4 backdrop-blur-md sm:flex-row sm:px-8">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Page {page + 1} of {Math.max(1, totalPages)} <span className="mx-2 opacity-20">|</span> {summary.All} Total Entries
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-background disabled:opacity-30"
                                suppressHydrationWarning
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                                disabled={page >= totalPages - 1}
                                className="rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-background disabled:opacity-30"
                                suppressHydrationWarning
                            >
                                Next
                            </button>
                        </div>
                    </div>
            </div>

            <ConsolidationDetailSheet
                consolidation={selectedConsolidation}
                submitting={submitting}
                onClose={() => setSelectedConsolidation(null)}
                onRequestAction={(type, batchId) => setConfirmAction({ type, batchId })}
            />

            {/* Create Modal */}
            {selectedBranch && (
                <CreateConsolidationModal
                    key={`create-modal-${showCreateModal}`}
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    branch={selectedBranch}
                    candidates={candidates}
                    loading={loading}
                    onSubmit={handleCreate}
                />
            )}

        </div>
    );
}
