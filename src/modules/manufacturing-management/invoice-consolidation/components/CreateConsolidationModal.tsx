"use client";

import React, { useState, useMemo } from "react";
import { X, Search, Loader2, CheckSquare, Square, FileText } from "lucide-react";
import { CandidateInvoice } from "../types";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    candidates: CandidateInvoice[];
    loading: boolean;
    onSubmit: (payload: { branchId: number; invoiceIds: number[] }) => Promise<boolean>;
}

export default function CreateConsolidationModal({ isOpen, onClose, candidates, loading, onSubmit }: Props) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
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

    const totalSelectedAmount = useMemo(() => {
        return candidates
            .filter((c) => selectedIds.has(c.invoiceId))
            .reduce((sum, c) => sum + (c.netAmount || 0), 0);
    }, [candidates, selectedIds]);

    const handleSubmit = async () => {
        if (selectedIds.size === 0 || submitting) return;
        setSubmitting(true);
        const branchId = candidates.find((c) => selectedIds.has(c.invoiceId))?.branchId;
        if (!branchId) {
            setSubmitting(false);
            return;
        }
        await onSubmit({ branchId, invoiceIds: Array.from(selectedIds) });
        setSubmitting(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        <h2 className="text-sm font-bold text-foreground">Create Invoice Consolidation Batch</h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer" suppressHydrationWarning>
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                <div className="px-6 py-3 border-b bg-muted/20 shrink-0">
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

                <div className="flex-1 overflow-y-auto min-h-0 px-6 py-3">
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
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b bg-muted/20">
                                    <th className="p-2.5 w-8"></th>
                                    <th className="p-2.5 font-semibold text-muted-foreground uppercase">Invoice No</th>
                                    <th className="p-2.5 font-semibold text-muted-foreground uppercase">Customer</th>
                                    <th className="p-2.5 font-semibold text-muted-foreground uppercase">Date</th>
                                    <th className="p-2.5 font-semibold text-muted-foreground uppercase text-right">Net Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((inv) => {
                                    const isSelected = selectedIds.has(inv.invoiceId);
                                    return (
                                        <tr
                                            key={inv.invoiceId}
                                            onClick={() => toggle(inv.invoiceId)}
                                            className={`cursor-pointer transition-colors ${
                                                isSelected ? "bg-primary/5" : "hover:bg-muted/10"
                                            }`}
                                        >
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
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-muted/20 shrink-0 flex items-center justify-between rounded-b-2xl">
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
                    <div className="flex items-center gap-2">
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
