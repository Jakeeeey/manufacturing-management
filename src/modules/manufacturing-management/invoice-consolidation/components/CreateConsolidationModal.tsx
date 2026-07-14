"use client";

import React, { useState, useMemo } from "react";
import { X, Search, Loader2, CheckSquare, Square, FileText, Building2, Package, ChevronRight, ChevronDown } from "lucide-react";
import { CandidateInvoice, Branch } from "../types";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    branch: Branch;
    candidates: CandidateInvoice[];
    loading: boolean;
    onSubmit: (payload: { branchId: number; invoiceIds: number[] }) => Promise<boolean>;
}

export default function CreateConsolidationModal({ isOpen, onClose, branch, candidates, loading, onSubmit }: Props) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Set<number>>(new Set());
    const [search, setSearch] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const filtered = useMemo(() => {
        if (!search.trim()) return candidates;
        const q = search.toLowerCase();
        return candidates.filter(
            (c) =>
                c.invoiceNo.toLowerCase().includes(q) ||
                c.customerName.toLowerCase().includes(q) ||
                c.customerCode.toLowerCase().includes(q)
        );
    }, [candidates, search]);

    const toggleAll = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map((c) => c.invoiceId)));
        }
    };

    const toggle = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleExpand = (id: number) => {
        const next = new Set(expandedInvoiceIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedInvoiceIds(next);
    };

    const totalSelectedAmount = useMemo(() => {
        return candidates
            .filter((c) => selectedIds.has(c.invoiceId))
            .reduce((sum, c) => sum + (c.netAmount || 0), 0);
    }, [candidates, selectedIds]);

    const aggregatedProducts = useMemo(() => {
        const selected = candidates.filter((c) => selectedIds.has(c.invoiceId));
        // Build per-product version set to detect mixed versions
        const versionSets = new Map<number, Set<string>>();
        const agg = new Map<number, { quantity: number; invoiceCount: Set<number>; productName: string; productCode: string }>();
        for (const inv of selected) {
            for (const p of inv.products) {
                if (!agg.has(p.productId)) {
                    agg.set(p.productId, { quantity: 0, invoiceCount: new Set(), productName: p.productName, productCode: p.productCode });
                }
                if (!versionSets.has(p.productId)) versionSets.set(p.productId, new Set());
                const entry = agg.get(p.productId)!;
                entry.quantity += p.quantity;
                entry.invoiceCount.add(inv.invoiceId);
                versionSets.get(p.productId)!.add(p.versionName || "Unversioned");
            }
        }
        return Array.from(agg.entries()).map(([productId, e]) => ({
            productId,
            productName: e.productName,
            productCode: e.productCode,
            totalQuantity: e.quantity,
            invoiceCount: e.invoiceCount.size,
            versionLabel: versionSets.get(productId)!.size > 1
                ? "Multiple versions"
                : versionSets.get(productId)!.values().next().value || "Not assigned",
        })).sort((a, b) => a.productName.localeCompare(b.productName));
    }, [candidates, selectedIds]);

    const handleSubmit = async () => {
        if (selectedIds.size === 0 || submitting) return;
        setSubmitting(true);
        await onSubmit({ branchId: branch.id, invoiceIds: Array.from(selectedIds) });
        setSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
            <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-background shadow-2xl sm:h-[95vh] sm:max-w-[95vw] sm:rounded-2xl sm:border sm:border-border/60 sm:bg-background/95 lg:max-w-[1440px]">
                <div className="flex shrink-0 items-center justify-between border-b border-border/40 bg-card/30 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
                    <div className="flex items-center gap-2">
                        <FileText className="h-6 w-6 text-primary sm:h-8 sm:w-8" />
                        <h2 className="text-xl font-black uppercase italic tracking-tighter text-foreground sm:text-2xl lg:text-3xl">Consolidation <span className="text-primary">Wizard</span></h2>
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1 ml-2">
                            <Building2 className="h-3 w-3" />
                            {branch.branchName}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer" suppressHydrationWarning>
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                <div className="shrink-0 border-b bg-muted/20 px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search invoices by no, customer..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 w-full bg-background border border-input rounded-lg px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                suppressHydrationWarning
                            />
                        </div>
                        <button
                            onClick={toggleAll}
                            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                            suppressHydrationWarning
                        >
                            {selectedIds.size === filtered.length && filtered.length > 0 ? (
                                <CheckSquare className="h-4 w-4" />
                            ) : (
                                <Square className="h-4 w-4" />
                            )}
                            {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
                        </button>
                        <span className="text-xs text-muted-foreground">
                            {selectedIds.size} of {filtered.length} selected
                        </span>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 custom-scrollbar sm:px-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                            <p className="text-xs text-muted-foreground mt-2">
                                {search ? "No invoices match your search." : "No eligible invoices found for consolidation."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-border/40">
                        <table className="min-w-[720px] w-full text-left border-collapse text-xs">
                            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-xl">
                                <tr className="border-b bg-muted/20">
                                    <th className="p-2.5 w-7"></th>
                                    <th className="p-2.5 w-7"></th>
                                    <th className="p-2.5 font-semibold text-muted-foreground uppercase">Invoice No</th>
                                    <th className="p-2.5 font-semibold text-muted-foreground uppercase">Customer</th>
                                    <th className="p-2.5 font-semibold text-muted-foreground uppercase">Date</th>
                                    <th className="p-2.5 font-semibold text-muted-foreground uppercase text-right">Net Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((inv) => {
                                    const isSelected = selectedIds.has(inv.invoiceId);
                                    const isExpanded = expandedInvoiceIds.has(inv.invoiceId);
                                    return (
                                        <React.Fragment key={inv.invoiceId}>
                                            <tr
                                                onClick={() => toggle(inv.invoiceId)}
                                                className={`cursor-pointer transition-colors ${
                                                    isSelected ? "bg-primary/5" : "hover:bg-muted/10"
                                                }`}
                                            >
                                                <td className="p-2.5" onClick={(e) => { e.stopPropagation(); toggleExpand(inv.invoiceId); }}>
                                                    {isExpanded ? (
                                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" />
                                                    ) : (
                                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" />
                                                    )}
                                                </td>
                                                <td className="p-2.5">
                                                    {isSelected ? (
                                                        <CheckSquare className="h-4 w-4 text-primary" />
                                                    ) : (
                                                        <Square className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </td>
                                                <td className="p-2.5 font-bold text-foreground">{inv.invoiceNo}</td>
                                                <td className="p-2.5 text-muted-foreground">{inv.customerName}</td>
                                                <td className="p-2.5 text-muted-foreground">
                                                    {new Date(inv.invoiceDate).toLocaleDateString()}
                                                </td>
                                                <td className="p-2.5 text-right font-black text-foreground">
                                                    P{Number(inv.netAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-muted/5">
                                                    <td colSpan={6} className="p-0">
                                                        <table className="w-full text-left border-collapse text-[10px]">
                                                            <thead>
                                                                <tr className="border-t border-b bg-muted/10">
                                                                    <th className="px-5 py-1.5 font-semibold text-muted-foreground w-8"></th>
                                                                    <th className="py-1.5 font-semibold text-muted-foreground">Product</th>
                                                                    <th className="py-1.5 font-semibold text-muted-foreground">Code</th>
                                                                    <th className="py-1.5 font-semibold text-muted-foreground text-right">Qty</th>
                                                                    <th className="py-1.5 font-semibold text-muted-foreground">Version</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {inv.products.map((p) => (
                                                                    <tr key={`${inv.invoiceId}-${p.productId}`} className="border-b border-muted/5 last:border-0">
                                                                        <td className="px-5 py-1"></td>
                                                                        <td className="py-1 font-medium text-foreground">{p.productName}</td>
                                                                        <td className="py-1 text-muted-foreground">{p.productCode}</td>
                                                                        <td className="py-1 text-right font-bold text-foreground">{p.quantity}</td>
                                                                        <td className="py-1 text-muted-foreground">
                                                                            {p.versionName ? (
                                                                                <span className="text-[9px] bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded-full">
                                                                                    {p.versionName}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[9px] text-muted-foreground/50 italic">Not assigned</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                    )}

                    {selectedIds.size > 0 && aggregatedProducts.length > 0 && (
                        <div className="mt-4 border rounded-xl bg-muted/10">
                            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                    Consolidated Products Preview — {aggregatedProducts.length} unique product(s)
                                </span>
                            </div>
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b bg-muted/20">
                                        <th className="p-2.5 font-semibold text-muted-foreground">Product</th>
                                        <th className="p-2.5 font-semibold text-muted-foreground">Code</th>
                                        <th className="p-2.5 font-semibold text-muted-foreground text-right">Total Qty</th>
                                        <th className="p-2.5 font-semibold text-muted-foreground text-right">Invoices</th>
                                        <th className="p-2.5 font-semibold text-muted-foreground">Version</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {aggregatedProducts.map((p) => (
                                        <tr key={p.productId} className="hover:bg-muted/10">
                                            <td className="p-2.5 font-medium text-foreground">{p.productName}</td>
                                            <td className="p-2.5 text-muted-foreground">{p.productCode}</td>
                                            <td className="p-2.5 text-right font-bold text-foreground">{p.totalQuantity}</td>
                                            <td className="p-2.5 text-right text-muted-foreground">{p.invoiceCount}</td>
                                            <td className="p-2.5 text-muted-foreground">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                                    p.versionLabel === "Multiple versions"
                                                        ? "bg-amber-500/10 border border-amber-500/20 text-amber-500"
                                                        : "bg-primary/5 border border-primary/10"
                                                }`}>
                                                    {p.versionLabel}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex shrink-0 flex-col items-stretch justify-between gap-3 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:px-6 sm:rounded-b-2xl">
                    <div className="text-xs text-muted-foreground">
                        {selectedIds.size > 0 && (
                            <>
                                <span className="font-semibold text-foreground">{selectedIds.size}</span> invoice(s) selected
                                {" \u2014 "}Total:{" "}
                                <span className="font-black text-foreground">
                                    P{totalSelectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                            suppressHydrationWarning
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={selectedIds.size === 0 || submitting}
                            className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            suppressHydrationWarning
                        >
                            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Create Batch ({selectedIds.size})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
