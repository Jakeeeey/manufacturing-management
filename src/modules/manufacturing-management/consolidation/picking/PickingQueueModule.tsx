"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, ScanLine, SquarePen, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { InvoiceConsolidation, Branch } from "../../invoice-consolidation/types";
import { fetchConsolidations, fetchBranches } from "../../invoice-consolidation/services/invoice-consolidation-api";

export default function PickingQueueModule() {
    const router = useRouter();
    const [batches, setBatches] = useState<InvoiceConsolidation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(undefined);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(searchQuery), 400);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        fetchBranches().then((data) => {
            setBranches(data || []);
        }).catch(() => {});
    }, []);

    const loadBatches = useCallback(async () => {
        if (!selectedBranchId) return;
        setLoading(true);
        try {
            const res = await fetchConsolidations({
                branchId: selectedBranchId,
                page: 0,
                size: 50,
                status: "Picking",
                search: debouncedSearch,
            });
            setBatches(res.content || []);
        } catch {
            console.error("Failed to load picking batches");
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, debouncedSearch]);

    useEffect(() => {
        loadBatches();
    }, [loadBatches]);

    const handleBatchClick = (batch: InvoiceConsolidation) => {
        router.push(`/mm/consolidation/picking/${encodeURIComponent(batch.consolidatorNo)}`);
    };

    const progressPct = (batch: InvoiceConsolidation) => {
        const ordered = batch.details?.reduce((s, d) => s + d.orderedQuantity, 0) || 0;
        const picked = batch.details?.reduce((s, d) => s + d.pickedQuantity, 0) || 0;
        return ordered > 0 ? (picked / ordered) * 100 : 0;
    };

    const pickedTotal = (batch: InvoiceConsolidation) => batch.details?.reduce((s, d) => s + d.pickedQuantity, 0) || 0;
    const orderedTotal = (batch: InvoiceConsolidation) => batch.details?.reduce((s, d) => s + d.orderedQuantity, 0) || 0;

    return (
        <div className="min-h-0 flex-1 flex flex-col bg-background text-foreground">
            <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-sm px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between md:items-center gap-6">
                <div className="flex items-center gap-4 md:gap-5 shrink-0">
                    <div className="p-3 md:p-4 bg-primary rounded-2xl shadow-lg shadow-primary/20 shrink-0">
                        <SquarePen className="h-7 w-7 md:h-8 md:w-8 text-primary-foreground stroke-[2.5px]" />
                    </div>
                    <div className="space-y-0.5 shrink-0">
                        <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase italic leading-none whitespace-nowrap">
                            Floor <span className="text-primary">Picking</span>
                        </h2>
                        <div className="mt-1 md:mt-0">
                            <select
                                value={selectedBranchId || ""}
                                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                                className="bg-card border border-input rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                suppressHydrationWarning
                            >
                                <option value="" disabled>Select Branch...</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.branchName}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="relative w-full md:w-[400px] group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10 opacity-60" />
                    <Input
                        placeholder="Search Batch Number..."
                        className="relative pl-12 bg-muted/30 border-border/60 h-14 shadow-inner font-black placeholder:font-bold text-base md:text-lg rounded-2xl focus-visible:ring-primary/20 z-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8">
                <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <AnimatePresence mode="popLayout">
                        {!selectedBranchId ? (
                            <motion.div key="empty-branch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-32 flex flex-col items-center justify-center text-muted-foreground/40">
                                <Building2 className="w-20 h-20 mb-4" />
                                <h3 className="font-black uppercase tracking-widest text-lg">Select Branch</h3>
                            </motion.div>
                        ) : loading ? (
                            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-32 flex flex-col items-center justify-center text-primary">
                                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                                <h3 className="font-black uppercase tracking-widest text-sm">Loading Batches...</h3>
                            </motion.div>
                        ) : batches.length === 0 ? (
                            <motion.div key="empty-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-32 flex flex-col items-center justify-center text-muted-foreground/40">
                                <ScanLine className="w-20 h-20 mb-4" />
                                <h3 className="font-black uppercase tracking-widest text-lg">No Picking Batches</h3>
                                <p className="text-xs font-medium text-muted-foreground/60 mt-2">Batches in Picking status will appear here.</p>
                            </motion.div>
                        ) : (
                            batches.map((batch) => {
                                const pct = progressPct(batch);
                                const picked = pickedTotal(batch);
                                const ordered = orderedTotal(batch);
                                return (
                                    <motion.div
                                        key={batch.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        onClick={() => handleBatchClick(batch)}
                                        className="bg-card border border-border/60 hover:border-primary/40 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-black uppercase tracking-tight truncate">
                                                    {batch.consolidatorNo}
                                                </h3>
                                                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                                                    {batch.branchName || `Branch #${batch.branchId}`}
                                                </p>
                                            </div>
                                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-blue-500/10 border-blue-500/20 text-blue-500 shrink-0 ml-2">
                                                Picking
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progress</span>
                                                <span className="text-xs font-black tabular-nums">{picked}/{ordered}</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-primary rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ ease: "circOut", duration: 0.8 }}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-muted-foreground">
                                                {batch.invoices?.length || 0} invoice(s)
                                            </span>
                                            <span className="text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                                Open &rarr;
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
