"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    CheckCircle2, AlertTriangle, ArrowLeft, Loader2, ClipboardCheck,
    ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { InvoiceConsolidation } from "../../invoice-consolidation/types";
import {
    fetchConsolidationByNo,
    auditBatch,
} from "../../invoice-consolidation/services/invoice-consolidation-api";

interface AuditWorkspaceModuleProps {
    batchNo: string;
}

export default function AuditWorkspaceModule({ batchNo }: AuditWorkspaceModuleProps) {
    const router = useRouter();
    const [consolidation, setConsolidation] = useState<InvoiceConsolidation | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [auditStatus, setAuditStatus] = useState<Record<number, boolean>>({});
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (!batchNo) return;
        setLoading(true);
        fetchConsolidationByNo(batchNo)
            .then(setConsolidation)
            .catch(() => {
                toast.error("Failed to load batch");
                router.push("/mm/consolidation/auditing");
            })
            .finally(() => setLoading(false));
    }, [batchNo, router]);

    const handleToggleAudit = useCallback((detailId: number) => {
        setAuditStatus((prev) => {
            if (prev[detailId]) {
                const next = { ...prev };
                delete next[detailId];
                return next;
            }
            return { ...prev, [detailId]: true };
        });
    }, []);

    const details = consolidation?.details || [];
    const auditedCount = Object.keys(auditStatus).length;
    const totalItems = details.length;
    const progressPercent = totalItems > 0 ? (auditedCount / totalItems) * 100 : 0;
    const isComplete = auditedCount === totalItems && totalItems > 0;

    const handleFinalize = async () => {
        if (!consolidation) return;
        setSubmitting(true);
        try {
            const result = await auditBatch({ batchId: consolidation.id });
            toast.success(result.message || "Batch audited successfully");
            router.push("/mm/consolidation/auditing");
        } catch (e) {
            const err = e as Error;
            toast.error(err.message || "Failed to audit batch");
        } finally {
            setSubmitting(false);
            setShowConfirm(false);
        }
    };

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
                Batch not found.
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <header className="shrink-0 bg-card border-b px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push("/mm/consolidation/auditing")}
                        className="h-10 w-10 rounded-xl"
                        disabled={submitting}
                        suppressHydrationWarning
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-black uppercase italic tracking-tighter">
                                {consolidation.consolidatorNo}
                            </h1>
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 font-black tracking-widest text-[9px]">
                                Picked
                            </Badge>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                            {consolidation.branchName || `Branch #${consolidation.branchId}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-2xl font-black leading-none text-blue-500">
                            {auditedCount} <span className="text-sm text-muted-foreground/50">/ {totalItems}</span>
                        </div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-0.5">Audited SKUs</p>
                    </div>
                </div>
            </header>

            <div className="h-2 bg-muted shrink-0">
                <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ ease: "circOut", duration: 0.5 }}
                />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto space-y-3">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                            Products to Verify ({totalItems})
                        </h2>
                        <span className="text-[10px] font-bold text-muted-foreground">
                            {isComplete ? "All verified" : `${totalItems - auditedCount} remaining`}
                        </span>
                    </div>

                    {details.map((d) => {
                        const isAudited = !!auditStatus[d.id];
                        const short = d.orderedQuantity - d.pickedQuantity;
                        return (
                            <div
                                key={d.id}
                                onClick={() => handleToggleAudit(d.id)}
                                className={`border rounded-xl p-4 transition-all cursor-pointer ${
                                    isAudited
                                        ? "bg-emerald-500/5 border-emerald-500/30"
                                        : "bg-card border-border hover:border-blue-500/30 hover:shadow-sm"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`text-sm font-bold leading-tight truncate ${isAudited ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                            {d.productName || `Product #${d.productId}`}
                                        </h3>
                                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                            {d.productCode || `ID: ${d.productId}`}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-5 shrink-0">
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Ordered</p>
                                            <p className="text-sm font-black text-foreground">{d.orderedQuantity}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Picked</p>
                                            <p className="text-sm font-black text-foreground">{d.pickedQuantity}</p>
                                        </div>
                                        {short > 0 && (
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase">Short</p>
                                                <p className="text-sm font-black text-amber-500">{short}</p>
                                            </div>
                                        )}
                                        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                                            isAudited ? "bg-emerald-500/10" : "bg-muted/30"
                                        }`}>
                                            {isAudited ? (
                                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                            ) : (
                                                <ClipboardCheck className="h-5 w-5 text-muted-foreground/50" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <footer className="shrink-0 bg-card border-t px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                        Verified: <strong className={isComplete ? "text-emerald-500" : "text-foreground"}>{auditedCount}/{totalItems}</strong>
                    </span>
                    {!isComplete && totalItems > 0 && (
                        <span className="text-muted-foreground/60">
                            Click items to mark as verified
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => router.push("/mm/consolidation/auditing")}
                        disabled={submitting}
                        className="text-xs font-bold"
                        suppressHydrationWarning
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => setShowConfirm(true)}
                        disabled={!isComplete || submitting}
                        className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                        suppressHydrationWarning
                    >
                        {submitting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ShieldCheck className="h-3.5 w-3.5" />
                        )}
                        Finalize Audit
                    </Button>
                </div>
            </footer>

            {showConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Finalize Audit?</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {consolidation.consolidatorNo} will be marked as Audited and all linked invoices will be dispatched.
                                </p>
                            </div>
                        </div>
                        {details.some((d) => d.orderedQuantity > d.pickedQuantity) && (
                            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-medium text-amber-600">
                                    Some products have shortages. These will be applied with the picked quantity.
                                </p>
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-3.5 py-1.5 text-xs font-bold bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer"
                                suppressHydrationWarning
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFinalize}
                                disabled={submitting}
                                className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                suppressHydrationWarning
                            >
                                {submitting ? "Processing..." : "Confirm Audit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
