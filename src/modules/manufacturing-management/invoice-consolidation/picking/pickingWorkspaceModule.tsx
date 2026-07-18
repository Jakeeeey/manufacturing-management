"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { InvoiceConsolidation, PickingSavePayload } from "../types";
import { fetchConsolidationByNo, savePickedQuantities, completePicking } from "../services/invoice-consolidation-api";
import { usePickingModal } from "./hooks/usePickingModal";
import {
    Package, Minus, Plus, Save, SquarePen, AlertTriangle, Loader2, Keyboard, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PickingWorkspaceModuleProps {
    batchNo: string;
}

export default function PickingWorkspaceModule({ batchNo }: PickingWorkspaceModuleProps) {
    const router = useRouter();
    const [consolidation, setConsolidation] = useState<InvoiceConsolidation | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!batchNo) return;
        setLoading(true);
        fetchConsolidationByNo(batchNo)
            .then(setConsolidation)
            .catch(() => {
                toast.error("Failed to load consolidation");
                router.push("/mm/consolidation/picking");
            })
            .finally(() => setLoading(false));
    }, [batchNo, router]);

    const handleSaveQuantities = useCallback(async (payload: PickingSavePayload): Promise<boolean> => {
        setSubmitting(true);
        try {
            const result = await savePickedQuantities(payload);
            toast.success(result.message || "Quantities saved");
            const fresh = await fetchConsolidationByNo(batchNo);
            setConsolidation(fresh);
            return true;
        } catch (e) {
            const err = e as Error;
            toast.error(err.message || "Failed to save quantities");
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [batchNo]);

    const handleCompletePicking = useCallback(async (batchId: number): Promise<boolean> => {
        setSubmitting(true);
        try {
            const result = await completePicking(batchId);
            toast.success(result.message || "Picking completed");
            router.push("/mm/consolidation/picking");
            return true;
        } catch (e) {
            const err = e as Error;
            toast.error(err.message || "Failed to complete picking");
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [router]);

    const handleClose = useCallback(() => {
        router.push("/mm/consolidation/picking");
    }, [router]);

    const {
        localItems, hasChanges, editingDetailId, editValue,
        showCompleteConfirm, showCloseConfirm, saving,
        totals, shortProducts, validationErrors,
        stockReady, stockChecking, stockError, completionBlocked,
        setEditValue, setShowCompleteConfirm, setShowCloseConfirm,
        increment, decrement, startEdit, commitEdit, cancelEdit,
        handleSave, handleComplete, handleConfirmShortComplete,
    } = usePickingModal(consolidation, submitting, handleSaveQuantities, handleCompletePicking, handleClose);

    const focusNextRow = useCallback((currentDetailId: number) => {
        const allRows = document.querySelectorAll<HTMLElement>('[data-detail-id]');
        const idx = Array.from(allRows).findIndex(
            (el) => Number(el.dataset.detailId) === currentDetailId
        );
        if (idx === -1) return;
        if (idx < allRows.length - 1) {
            allRows[idx + 1]?.focus();
        } else {
            document.getElementById('picking-save-btn')?.focus();
        }
    }, []);

    const focusPrevRow = useCallback((currentDetailId: number) => {
        const allRows = document.querySelectorAll<HTMLElement>('[data-detail-id]');
        const idx = Array.from(allRows).findIndex(
            (el) => Number(el.dataset.detailId) === currentDetailId
        );
        if (idx > 0) {
            allRows[idx - 1]?.focus();
        }
    }, []);

    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [hasChanges]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!consolidation) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Consolidation not found.
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Header */}
            <header className="shrink-0 bg-card border-b px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleClose}
                        className="h-10 w-10 rounded-xl"
                        disabled={saving || submitting}
                        suppressHydrationWarning
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-black uppercase italic tracking-tighter">
                                {consolidation.consolidatorNo}
                            </h1>
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-500">
                                Picking
                            </span>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                            {consolidation.branchName || `Branch #${consolidation.branchId}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-2xl font-black leading-none text-primary">
                            {totals.picked} <span className="text-sm text-muted-foreground/50">/ {totals.ordered}</span>
                        </div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-0.5">Items Picked</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black leading-none text-amber-500">
                            {totals.short}
                        </div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-0.5">Short</p>
                    </div>
                </div>
            </header>

            {/* Progress bar */}
            <div className="h-2 bg-muted shrink-0">
                <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${totals.pct}%` }}
                    transition={{ ease: "circOut", duration: 0.5 }}
                />
            </div>

            {/* Keyboard legend */}
            <div className="shrink-0 flex items-center gap-3 border-b border-border/30 bg-card/40 px-6 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                <kbd className="rounded border border-border/40 bg-background px-1.5 py-0.5 font-mono text-[9px] font-black text-foreground">Tab</kbd>
                <span>Next product</span>
                <span className="text-muted-foreground/30">|</span>
                <kbd className="rounded border border-border/40 bg-background px-1.5 py-0.5 font-mono text-[9px] font-black text-foreground">Shift+Tab</kbd>
                <span>Previous product</span>
                <span className="text-muted-foreground/30">|</span>
                <kbd className="rounded border border-border/40 bg-background px-1.5 py-0.5 font-mono text-[9px] font-black text-foreground">Backspace</kbd>
                <span>Clear input</span>
                <span className="text-muted-foreground/30">|</span>
                <kbd className="rounded border border-border/40 bg-background px-1.5 py-0.5 font-mono text-[9px] font-black text-foreground">Esc</kbd>
                <span>Cancel edit</span>
                {validationErrors.size > 0 && (
                    <>
                        <span className="text-muted-foreground/30">|</span>
                        <span className="text-red-500 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                            Resolve stock discrepancies to complete
                        </span>
                    </>
                )}
                {!stockReady && !stockError && (
                    <>
                        <span className="text-muted-foreground/30">|</span>
                        <span className="flex items-center gap-1 text-blue-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Checking stock
                        </span>
                    </>
                )}
                {stockError && (
                    <>
                        <span className="text-muted-foreground/30">|</span>
                        <span className="flex items-center gap-1 text-red-500">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                            Stock check unavailable
                        </span>
                    </>
                )}
            </div>

            {/* Product list */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            Products ({localItems.length})
                        </h2>
                        <span className={`text-[10px] font-bold ${hasChanges ? "text-amber-500" : "text-muted-foreground"}`}>
                            {hasChanges ? "Unsaved changes" : "All saved"}
                        </span>
                    </div>

                    {localItems.map((item) => {
                        const short = item.orderedQuantity - item.pickedQuantity;
                        const isComplete = item.pickedQuantity >= item.orderedQuantity;
                        const isEditing = editingDetailId === item.detailId;
                        const inputId = `pick-qty-${item.detailId}`;
                        const hasStockError = validationErrors.has(item.detailId);
                        return (
                            <div
                                key={item.detailId}
                                data-detail-id={item.detailId}
                                tabIndex={0}
                                role="button"
                                onFocus={() => startEdit(item)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !isEditing) {
                                        e.preventDefault();
                                        startEdit(item);
                                        setTimeout(() => document.getElementById(inputId)?.focus(), 0);
                                    }
                                }}
                                className={`border rounded-xl p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                                    isEditing ? "ring-2 ring-primary/30" : ""
                                } ${
                                    hasStockError
                                        ? "bg-red-500/5 border-red-500/40"
                                        : isComplete
                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                        : "bg-card border-border hover:border-primary/30"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`text-sm font-bold leading-tight truncate ${isComplete ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                            {item.productName || `Product #${item.productId}`}
                                        </h3>
                                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                            {item.productCode || `ID: ${item.productId}`}
                                        </p>
                                        {hasStockError && (
                                            <p className="text-[9px] font-bold text-red-500 mt-1 flex items-center gap-1">
                                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                                Stock discrepancy
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Ordered</p>
                                            <p className="text-sm font-black text-foreground">{item.orderedQuantity}</p>
                                        </div>

                                        <div className="text-center">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Picked</p>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    tabIndex={-1}
                                                    onClick={() => decrement(item.detailId)}
                                                    disabled={item.pickedQuantity <= 0 || saving || submitting}
                                                    className="h-7 w-7 rounded-md border border-input flex items-center justify-center hover:bg-muted transition-colors cursor-pointer disabled:opacity-30"
                                                    suppressHydrationWarning
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </button>

                                                {isEditing ? (
                                                    <input
                                                        id={inputId}
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Backspace") {
                                                                setEditValue("");
                                                            } else if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                commitEdit();
                                                                focusNextRow(item.detailId);
                                                            } else if (e.key === "Tab" && e.shiftKey) {
                                                                e.preventDefault();
                                                                cancelEdit();
                                                                focusPrevRow(item.detailId);
                                                            } else if (e.key === "Tab") {
                                                                e.preventDefault();
                                                                cancelEdit();
                                                                focusNextRow(item.detailId);
                                                            } else if (e.key === "Escape") {
                                                                cancelEdit();
                                                                (e.currentTarget.closest('[data-detail-id]') as HTMLElement)?.focus();
                                                            }
                                                        }}
                                                        className="w-14 text-center border border-input rounded-md px-1 py-1 text-xs font-bold"
                                                        autoFocus
                                                        suppressHydrationWarning
                                                    />
                                                ) : (
                                                    <span
                                                        className="w-14 inline-block text-center text-sm font-black text-foreground py-1 select-none"
                                                    >
                                                        {item.pickedQuantity}
                                                    </span>
                                                )}

                                                <button
                                                    tabIndex={-1}
                                                    onClick={() => increment(item.detailId)}
                                                    disabled={item.pickedQuantity >= item.orderedQuantity || saving || submitting}
                                                    className="h-7 w-7 rounded-md border border-input flex items-center justify-center hover:bg-muted transition-colors cursor-pointer disabled:opacity-30"
                                                    suppressHydrationWarning
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Short</p>
                                            <p className={`text-sm font-black ${short > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                                                {short}
                                            </p>
                                        </div>

                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                            hasStockError
                                                ? "bg-red-500/10"
                                                : isComplete
                                                ? "bg-emerald-500/10"
                                                : "bg-muted/30"
                                        }`}>
                                            {hasStockError ? (
                                                <span className="text-[8px] font-black text-red-500 leading-none text-center px-0.5">!</span>
                                            ) : isComplete ? (
                                                <Package className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <Keyboard className="h-4 w-4 text-muted-foreground/50" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <footer className="shrink-0 bg-card border-t px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                        Progress: <strong className="text-foreground">{totals.pct.toFixed(0)}%</strong>
                    </span>
                    <span>
                        Short: <strong className={totals.short > 0 ? "text-amber-500" : "text-foreground"}>{totals.short}</strong>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        id="picking-save-btn"
                        variant="outline"
                        onClick={handleSave}
                        disabled={!hasChanges || saving || submitting || editingDetailId != null}
                        className="flex items-center gap-1.5 text-xs font-bold"
                        suppressHydrationWarning
                    >
                        {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        Save
                    </Button>
                    <Button
                        onClick={handleComplete}
                        disabled={saving || submitting || completionBlocked}
                        className="flex items-center gap-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40"
                        suppressHydrationWarning
                    >
                        {saving || stockChecking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <SquarePen className="h-3.5 w-3.5" />
                        )}
                        Complete Picking
                    </Button>
                </div>
            </footer>

            {/* Partial picking confirmation */}
            <AnimatePresence>
                {showCompleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">Complete with Short Items?</h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        {shortProducts.length} product(s) with {totals.short} total missing unit(s) will be marked as short-picked.
                                    </p>
                                </div>
                            </div>
                            <div className="max-h-24 overflow-y-auto space-y-1">
                                {shortProducts.map((sp) => (
                                    <div key={sp.detailId} className="flex items-center justify-between text-[10px] bg-muted/20 rounded px-2 py-1">
                                        <span className="font-medium text-foreground truncate">{sp.productName}</span>
                                        <span className="font-bold text-amber-500 shrink-0 ml-2">
                                            {sp.orderedQuantity - sp.pickedQuantity} short
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowCompleteConfirm(false)}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
                                    suppressHydrationWarning
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmShortComplete}
                                    disabled={saving || completionBlocked}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    suppressHydrationWarning
                                >
                                    Confirm Complete
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Close confirmation */}
            <AnimatePresence>
                {showCloseConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">Unsaved Changes</h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        You have unsaved quantity changes. Save before closing?
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setShowCloseConfirm(false)}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
                                    suppressHydrationWarning
                                >
                                    Continue Editing
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="px-3.5 py-1.5 text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg transition-colors cursor-pointer"
                                    suppressHydrationWarning
                                >
                                    Discard & Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
