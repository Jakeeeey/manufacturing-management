"use client";

import React, { useMemo, useEffect, useCallback } from "react";
import { useInvoiceConsolidation } from "./hooks/useInvoiceConsolidation";
import CreateConsolidationModal from "./components/CreateConsolidationModal";
import {
    Package,
    ClipboardCheck,
    Plus,
    Loader2,
    Search,
    SlidersHorizontal,
    Play,
    SquarePen,
    CheckCircle,
    RotateCcw,
    AlertTriangle,
} from "lucide-react";

type ConfirmAction = "revert" | "audit" | "start-picking" | null;

export default function InvoiceConsolidationModule() {
    const {
        consolidations,
        summary,
        candidates,
        branches,
        loading,
        submitting,
        page,
        totalPages,
        statusFilter,
        searchQuery,
        selectedConsolidation,
        showCreateModal,
        branchId,
        setPage,
        setStatusFilter,
        setSearchQuery,
        setBranchId,
        setSelectedConsolidation,
        setShowCreateModal,
        handleCreate,
        handleAudit,
        handleRevert,
        handleStartPicking,
        handleCompletePicking,
        handleSaveQuantities,
        loadCandidates,
    } = useInvoiceConsolidation();

    const [expandedId, setExpandedId] = React.useState<number | null>(null);
    const [editingDetailId, setEditingDetailId] = React.useState<number | null>(null);
    const [editQuantity, setEditQuantity] = React.useState<number>(0);
    const [confirmAction, setConfirmAction] = React.useState<{ type: ConfirmAction; batchId: number } | null>(null);

    useEffect(() => {
        if (showCreateModal) {
            loadCandidates(branchId);
        }
    }, [showCreateModal, loadCandidates, branchId]);

    const filteredConsolidations = useMemo(() => {
        return consolidations.filter((c) => {
            const matchesSearch =
                !searchQuery ||
                c.consolidatorNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.invoices?.some(
                    (inv) =>
                        inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase())
                );
            const matchesStatus = statusFilter === "All" || c.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [consolidations, searchQuery, statusFilter]);

    const toggleExpand = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setExpandedId(expandedId === id ? null : id);
    };

    const handleRowClick = (c: typeof consolidations[number]) => {
        setEditingDetailId(null);
        setSelectedConsolidation(c);
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
        { label: "Pending", value: summary.Pending, color: "bg-amber-500/10 border-amber-500/20 text-amber-500", icon: <Package className="h-5 w-5" /> },
        { label: "Picking", value: summary.Picking, color: "bg-blue-500/10 border-blue-500/20 text-blue-500", icon: <Play className="h-5 w-5" /> },
        { label: "Picked", value: summary.Picked, color: "bg-purple-500/10 border-purple-500/20 text-purple-500", icon: <SquarePen className="h-5 w-5" /> },
        { label: "Audited", value: summary.Audited, color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500", icon: <ClipboardCheck className="h-5 w-5" /> },
    ];

    const confirmLabels: Record<string, { title: string; description: string }> = {
        audit: { title: "Audit this batch?", description: "This will mark the batch as audited and dispatch all linked invoices." },
        revert: { title: "Revert this batch?", description: "This will reset the batch to Pending status and undispatch all linked invoices." },
        "start-picking": { title: "Start picking this batch?", description: "This will move the batch to Picking status so quantities can be recorded." },
    };

    return (
        <div className="flex flex-col min-h-0 min-w-0 flex-1 space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 shrink-0">
                {summaryCards.map((card) => (
                    <div key={card.label} className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                        <div className={`p-2.5 rounded-xl ${card.color}`}>{card.icon}</div>
                        <div>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase block">{card.label}</span>
                            <h4 className="text-base font-black text-foreground mt-0.5">{card.value}</h4>
                        </div>
                    </div>
                ))}
                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-500">
                        <SlidersHorizontal className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Total</span>
                        <h4 className="text-base font-black text-foreground mt-0.5">{summary.All}</h4>
                    </div>
                </div>
            </div>

            {/* Actions & Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-center shrink-0">
                <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by consolidator no or invoice no..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-full bg-card border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        suppressHydrationWarning
                    />
                </div>
                <select
                    value={branchId ?? ""}
                    onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
                    className="bg-card border border-input rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none w-full sm:w-40"
                    suppressHydrationWarning
                >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.branchName}</option>
                    ))}
                </select>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-card border border-input rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none w-full sm:w-32"
                        suppressHydrationWarning
                    >
                        <option value="All">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Picking">Picking</option>
                        <option value="Picked">Picked</option>
                        <option value="Audited">Audited</option>
                    </select>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    suppressHydrationWarning
                >
                    <Plus className="h-3.5 w-3.5" />
                    New Consolidation
                </button>
            </div>

            {/* Confirmation Dialog */}
            {(() => {
                const ca = confirmAction;
                if (!ca) return null;
                const info = confirmLabels[ca.type as Exclude<ConfirmAction, null>];
                return (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">{info.title}</h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{info.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
                                    suppressHydrationWarning
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeConfirmed}
                                    disabled={submitting}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    suppressHydrationWarning
                                >
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Main Table */}
            <div className="flex-1 min-h-0 relative bg-background border rounded-xl p-4 md:p-6 shadow-sm flex flex-col">
                {loading && (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-40 flex items-center justify-center rounded-xl">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {filteredConsolidations.length === 0 && !loading ? (
                    <div className="text-center py-12">
                        <Package className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                        <h5 className="font-bold text-foreground text-xs uppercase tracking-wide mt-2">
                            No Consolidation Batches
                        </h5>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Click &quot;New Consolidation&quot; to create an invoice consolidation batch.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto min-h-0">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
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
                                {filteredConsolidations.map((c) => (
                                    <React.Fragment key={c.id}>
                                        <tr
                                            onClick={() => handleRowClick(c)}
                                            onKeyDown={(e) => handleRowKeyDown(e, c)}
                                            tabIndex={0}
                                            className="hover:bg-muted/10 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30"
                                        >
                                            <td className="p-3 font-bold text-foreground">{c.consolidatorNo}</td>
                                            <td className="p-3 text-muted-foreground">{c.branchName || `Branch #${c.branchId}`}</td>
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
                {totalPages > 1 && (
                    <div className="shrink-0 flex items-center justify-between pt-4 border-t mt-4">
                        <span className="text-[10px] text-muted-foreground">
                            Page {page + 1} of {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border hover:bg-muted transition-colors cursor-pointer disabled:opacity-30"
                                suppressHydrationWarning
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                                disabled={page >= totalPages - 1}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg border hover:bg-muted transition-colors cursor-pointer disabled:opacity-30"
                                suppressHydrationWarning
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedConsolidation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                            <h2 className="text-sm font-bold text-foreground">{selectedConsolidation.consolidatorNo}</h2>
                            <button
                                onClick={() => setSelectedConsolidation(null)}
                                className="p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                                suppressHydrationWarning
                            >
                                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-muted-foreground block">Status</span>
                                    <span className="font-bold text-foreground">{getStatusBadge(selectedConsolidation.status)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Branch</span>
                                    <span className="font-bold text-foreground">{selectedConsolidation.branchName}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Created</span>
                                    <span className="font-bold text-foreground">{selectedConsolidation.createdAt ? new Date(selectedConsolidation.createdAt).toLocaleString() : "—"}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Checked By</span>
                                    <span className="font-bold text-foreground">{selectedConsolidation.checkedBy ? `User #${selectedConsolidation.checkedBy}` : "Not yet"}</span>
                                </div>
                            </div>

                            {selectedConsolidation.details && selectedConsolidation.details.length > 0 && (
                                <div>
                                    <span className="text-xs text-muted-foreground font-semibold uppercase block mb-2">
                                        Products ({selectedConsolidation.details.length})
                                    </span>
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b bg-muted/20">
                                                <th className="p-2 font-semibold text-muted-foreground">Product</th>
                                                <th className="p-2 font-semibold text-muted-foreground text-right">Ordered Qty</th>
                                                <th className="p-2 font-semibold text-muted-foreground text-right">Picked Qty</th>
                                                {selectedConsolidation.status === "Picking" && (
                                                    <th className="p-2 font-semibold text-muted-foreground text-right">Update</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {selectedConsolidation.details.map((d) => (
                                                <tr key={d.id}>
                                                    <td className="p-2 font-medium text-foreground">
                                                        {d.productName || d.productCode || `Product #${d.productId}`}
                                                    </td>
                                                    <td className="p-2 text-right font-bold text-foreground">{d.orderedQuantity}</td>
                                                    <td className="p-2 text-right font-bold text-foreground">{d.pickedQuantity}</td>
                                                    {selectedConsolidation.status === "Picking" && (
                                                        <td className="p-2 text-right">
                                                            {editingDetailId === d.id ? (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        value={editQuantity}
                                                                        onChange={(e) => setEditQuantity(Math.max(0, Number(e.target.value)))}
                                                                        className="w-16 border border-input rounded px-1.5 py-0.5 text-xs text-right"
                                                                        suppressHydrationWarning
                                                                    />
                                                                    <button
                                                                        onClick={async () => {
                                                                            const ok = await handleSaveQuantities({
                                                                                batchId: selectedConsolidation.id,
                                                                                quantities: [{ detailId: d.id, pickedQuantity: editQuantity }],
                                                                            });
                                                                            if (ok) {
                                                                                setEditingDetailId(null);
                                                                                setEditQuantity(0);
                                                                            }
                                                                        }}
                                                                        disabled={submitting}
                                                                        className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer"
                                                                        suppressHydrationWarning
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingDetailId(null)}
                                                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                                                                        suppressHydrationWarning
                                                                    >
                                                                        X
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { setEditingDetailId(d.id); setEditQuantity(d.pickedQuantity); }}
                                                                    className="text-primary font-semibold hover:underline cursor-pointer text-[10px]"
                                                                    suppressHydrationWarning
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div>
                                <span className="text-xs text-muted-foreground font-semibold uppercase block mb-2">
                                    Invoices ({selectedConsolidation.invoices?.length || 0})
                                </span>
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b bg-muted/20">
                                            <th className="p-2 font-semibold text-muted-foreground">Invoice No</th>
                                            <th className="p-2 font-semibold text-muted-foreground text-right">Invoice ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {selectedConsolidation.invoices?.map((inv) => (
                                            <tr key={inv.id}>
                                                <td className="p-2 font-medium text-foreground">{inv.invoiceNo}</td>
                                                <td className="p-2 text-right text-muted-foreground">#{inv.invoiceId}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between rounded-b-2xl">
                            <div className="flex items-center gap-2">
                                {selectedConsolidation.status === "Pending" && (
                                    <button
                                        onClick={() => setConfirmAction({ type: "start-picking", batchId: selectedConsolidation.id })}
                                        disabled={submitting}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                        suppressHydrationWarning
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                        Start Picking
                                    </button>
                                )}
                                {selectedConsolidation.status === "Picking" && (
                                    <button
                                        onClick={() => handleCompletePicking(selectedConsolidation.id)}
                                        disabled={submitting}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                        suppressHydrationWarning
                                    >
                                        <SquarePen className="h-3.5 w-3.5" />
                                        Complete Picking
                                    </button>
                                )}
                                {selectedConsolidation.status === "Picked" && (
                                    <button
                                        onClick={() => setConfirmAction({ type: "audit", batchId: selectedConsolidation.id })}
                                        disabled={submitting}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                        suppressHydrationWarning
                                    >
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Audit
                                    </button>
                                )}
                                {selectedConsolidation.status === "Audited" && (
                                    <button
                                        onClick={() => setConfirmAction({ type: "revert", batchId: selectedConsolidation.id })}
                                        disabled={submitting}
                                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                        suppressHydrationWarning
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Revert to Pending
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedConsolidation(null)}
                                className="px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
                                suppressHydrationWarning
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            <CreateConsolidationModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                candidates={candidates}
                loading={loading}
                onSubmit={handleCreate}
            />
        </div>
    );
}
