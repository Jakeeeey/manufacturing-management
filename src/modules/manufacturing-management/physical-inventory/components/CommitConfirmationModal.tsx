"use client";

import React, { useState } from "react";
import {
    X,
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    Loader2
} from "lucide-react";
import { PhysicalCountSheet } from "../types";
import { calculateCountSheetSummary, formatCurrency, formatDate } from "../utils";

interface CommitConfirmationModalProps {
    isOpen: boolean;
    countSheet?: PhysicalCountSheet | null;
    sheet?: PhysicalCountSheet | null;
    onClose: () => void;
    onConfirmCommit?: (sheetId: string) => void;
    onConfirm?: (sheetId: string) => void;
    isSubmitting?: boolean;
}

export default function CommitConfirmationModal({
    isOpen,
    countSheet,
    sheet,
    onClose,
    onConfirmCommit,
    onConfirm,
    isSubmitting = false
}: CommitConfirmationModalProps) {
    const activeSheet = countSheet || sheet;
    const [acknowledged, setAcknowledged] = useState(false);

    if (!isOpen || !activeSheet) return null;

    const summary = calculateCountSheetSummary(activeSheet.line_items || []);
    const handleConfirm = onConfirm || onConfirmCommit;

    const handleCommitSubmit = () => {
        if (!acknowledged || !handleConfirm) return;
        handleConfirm(activeSheet.id);
    };

    const phNo = activeSheet.ph_no || activeSheet.sheet_no;
    const cutoffDateStr = activeSheet.cutOff_date || activeSheet.cutoff_date;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col my-auto">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-amber-500/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
                            <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">Confirm Inventory Commitment</h3>
                            <p className="text-xs text-muted-foreground">
                                Post variance adjustments to the inventory movements ledger
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5">
                    {/* Metadata Card */}
                    <div className="bg-muted/40 rounded-xl p-4 border border-border grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Sheet Reference</span>
                            <span className="font-mono font-bold text-foreground">#{phNo}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Facility / Branch</span>
                            <span className="font-bold text-foreground">{activeSheet.branch_name}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Stock Classification</span>
                            <span className="font-medium text-foreground">{activeSheet.stock_type}</span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Cutoff Date</span>
                            <span className="font-medium text-foreground">
                                {formatDate(cutoffDateStr)}
                            </span>
                        </div>
                    </div>

                    {/* Variance Breakdown Metrics */}
                    <div className="space-y-2">
                        <span className="text-xs font-bold text-foreground block">Variance & Reconciled Impact</span>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                                <span className="text-[10px] uppercase font-bold tracking-wider block">Surplus Items</span>
                                <span className="text-base font-black mt-0.5 block">+{summary.surplusItemsCount}</span>
                                <span className="text-[10px] font-mono block mt-0.5">+{formatCurrency(summary.surplusVarianceCost)}</span>
                            </div>

                            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
                                <span className="text-[10px] uppercase font-bold tracking-wider block">Deficit Items</span>
                                <span className="text-base font-black mt-0.5 block">-{summary.deficitItemsCount}</span>
                                <span className="text-[10px] font-mono block mt-0.5">-{formatCurrency(Math.abs(summary.deficitVarianceCost))}</span>
                            </div>

                            <div className={`p-3 rounded-xl border ${summary.netVarianceCost >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-rose-500/20 bg-rose-500/10 text-rose-500"}`}>
                                <span className="text-[10px] uppercase font-bold tracking-wider block">Net Ledger Impact</span>
                                <span className="text-base font-black mt-0.5 block">{formatCurrency(summary.netVarianceCost)}</span>
                                <span className="text-[10px] font-mono block mt-0.5">{summary.netVarianceCost >= 0 ? "+Stock Added" : "-Stock Deducted"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Warning Alert */}
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-xs text-amber-500">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <span className="font-bold block">Irreversible Ledger Posting Warning</span>
                            <p className="text-[11px] leading-relaxed text-amber-500/90">
                                Committing this sheet will post permanent transaction rows into <code className="font-mono bg-amber-500/20 px-1 py-0.5 rounded text-amber-400">inventory_movements</code>.
                            </p>
                        </div>
                    </div>

                    {/* Acknowledgment Checkbox */}
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground select-none">
                        <input
                            type="checkbox"
                            checked={acknowledged}
                            onChange={(e) => setAcknowledged(e.target.checked)}
                            disabled={isSubmitting}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span>I confirm and authorize posting these inventory adjustments to the ledger</span>
                    </label>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground font-semibold text-xs rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCommitSubmit}
                        disabled={!acknowledged || isSubmitting}
                        className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-sm transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Posting Ledger Adjustments...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Post Adjustments to Ledger
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
