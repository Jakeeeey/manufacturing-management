"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
    Box,
    Building2,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Clock,
    FileText,
    Layers,
    PackageCheck,
    Play,
    Printer,
    RotateCcw,
    Search,
    ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InvoiceConsolidation } from "../types";
import { generateConsolidationPDF } from "../utils/ConsolidationSummaryPrint";

type DetailAction = "revert" | "audit" | "start-picking";

interface Props {
    consolidation: InvoiceConsolidation | null;
    submitting: boolean;
    onClose: () => void;
    onRequestAction: (type: DetailAction, batchId: number) => void;
}

async function handlePrint(c: InvoiceConsolidation) {
    await generateConsolidationPDF({
        consolidatorNo: c.consolidatorNo,
        branchName: c.branchName,
        status: c.status,
        createdAt: c.createdAt,
        details: c.details.map((d) => ({
            productName: d.productName,
            productCode: d.productCode,
            productId: d.productId,
            orderedQuantity: d.orderedQuantity,
            pickedQuantity: d.pickedQuantity,
            appliedQuantity: d.appliedQuantity,
        })),
        invoices: c.invoices.map((inv) => ({
            invoiceNo: inv.invoiceNo,
            invoiceId: inv.invoiceId,
        })),
    });
}

export default function ConsolidationDetailSheet({ consolidation, submitting, onClose, onRequestAction }: Props) {
    const [search, setSearch] = useState("");
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);

    const filteredDetails = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return consolidation?.details ?? [];
        return (consolidation?.details ?? []).filter((detail) =>
            detail.productName.toLowerCase().includes(query) ||
            detail.productCode.toLowerCase().includes(query) ||
            String(detail.productId).includes(query)
        );
    }, [consolidation?.details, search]);

    if (!consolidation) return null;

    const totalOrdered = consolidation.details.reduce((sum, detail) => sum + detail.orderedQuantity, 0);
    const totalPicked = consolidation.details.reduce((sum, detail) => sum + detail.pickedQuantity, 0);
    const totalShort = Math.max(0, totalOrdered - totalPicked);
    const progress = totalOrdered > 0 ? (totalPicked / totalOrdered) * 100 : 0;

    return (
        <Sheet open onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="flex w-full flex-col overflow-hidden rounded-l-[2rem] bg-background p-0 sm:max-w-2xl">
                <div className="shrink-0 border-b border-border/50 bg-muted/10 p-5 lg:p-6">
                    <SheetHeader className="space-y-3 text-left">
                        <div className="flex items-start justify-between gap-3 pr-6">
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="border-none bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">Vertex Terminal</Badge>
                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">
                                        <Building2 className="mr-1 h-2.5 w-2.5" />
                                        {consolidation.branchName}
                                    </Badge>
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {new Date(consolidation.createdAt).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                                <SheetTitle className="truncate font-mono text-2xl font-black uppercase italic leading-none tracking-tighter text-foreground sm:text-3xl">
                                    {consolidation.consolidatorNo}
                                </SheetTitle>
                            </div>
                            <StatusBadge status={consolidation.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <MiniStat label="Products" value={consolidation.details.length} icon={<Box className="text-blue-500" />} />
                            <MiniStat label="Invoices" value={consolidation.invoices.length} icon={<FileText className="text-purple-500" />} />
                            <MiniStat label="Short" value={totalShort} icon={<Layers className="text-amber-500" />} />
                            <MiniStat label="Done" value={`${progress.toFixed(0)}%`} icon={<CheckCircle className="text-emerald-500" />} />
                        </div>
                    </SheetHeader>
                </div>

                <Tabs defaultValue="products" className="flex min-h-0 flex-1 flex-col">
                    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/40 bg-card/30 px-5 py-3 backdrop-blur-md">
                        <TabsList className="h-9 rounded-xl border border-border/20 bg-muted/30 p-1">
                            <TabsTrigger value="products" className="px-4 text-[10px] font-black uppercase tracking-widest">Picking List</TabsTrigger>
                            <TabsTrigger value="invoices" className="px-4 text-[10px] font-black uppercase tracking-widest">Invoices</TabsTrigger>
                        </TabsList>
                        <div className="relative max-w-[180px] flex-1">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter product..." className="h-8 rounded-lg border-none bg-muted/20 pl-8 text-[11px] font-bold" />
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                        <TabsContent value="products" className="m-0 space-y-2 p-5">
                            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/20 bg-background/95 py-2 backdrop-blur-sm">
                                <div className="rounded-md bg-primary/10 p-1"><PackageCheck className="h-3.5 w-3.5 text-primary" /></div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Consolidated Products</h3>
                            </div>
                            {filteredDetails.map((detail) => {
                                const itemProgress = detail.orderedQuantity > 0 ? (detail.pickedQuantity / detail.orderedQuantity) * 100 : 0;
                                const shortage = detail.pickedQuantity < detail.orderedQuantity && consolidation.status !== "Pending";
                                return (
                                    <div key={detail.id} className={`group relative flex items-center justify-between gap-4 overflow-hidden rounded-xl border px-4 py-3 ${shortage ? "border-amber-500/30 bg-amber-500/5" : "border-border/40 bg-card/40"}`}>
                                        {shortage && <div className="absolute inset-y-0 left-0 w-1 bg-amber-500" />}
                                        <div className="min-w-0 flex-1">
                                            <h4 className="truncate text-[11px] font-black uppercase tracking-tight text-foreground/90">{detail.productName}</h4>
                                            <div className="mt-1 flex gap-3 font-mono text-[9px] font-bold uppercase text-muted-foreground/60">
                                                <span className="rounded bg-muted/50 px-1.5 py-0.5">ID: {detail.productId}</span>
                                                {detail.productCode && <span>{detail.productCode}</span>}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right font-mono">
                                            <span className={itemProgress >= 100 ? "text-sm font-black text-emerald-500" : "text-sm font-black text-amber-500"}>{detail.pickedQuantity}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground"> / {detail.orderedQuantity}</span>
                                            <p className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-muted-foreground/50">Pieces</p>
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-muted/40"><div className={itemProgress >= 100 ? "h-full bg-emerald-500" : "h-full bg-amber-500"} style={{ width: `${Math.min(100, itemProgress)}%` }} /></div>
                                    </div>
                                );
                            })}
                        </TabsContent>

                        <TabsContent value="invoices" className="m-0 space-y-2 p-5">
                            {consolidation.invoices.map((invoice) => {
                                const expanded = expandedInvoiceId === invoice.id;
                                return (
                                    <div key={invoice.id} className="overflow-hidden rounded-xl border border-border/40 bg-card/40">
                                        <button type="button" onClick={() => setExpandedInvoiceId(expanded ? null : invoice.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                                            <div className="min-w-0"><p className="truncate font-mono text-xs font-black">{invoice.invoiceNo}</p><p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Invoice ID #{invoice.invoiceId}</p></div>
                                            <div className="flex items-center gap-2"><Badge variant="outline" className="text-[9px]">{invoice.products?.length ?? 0} Products</Badge>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
                                        </button>
                                        {expanded && <div className="space-y-2 border-t border-border/30 bg-muted/10 p-3">{invoice.products?.map((product) => <div key={product.productId} className="flex items-center justify-between gap-3 rounded-lg bg-background/60 px-3 py-2 text-[10px]"><div className="min-w-0"><p className="truncate font-bold">{product.productName}</p><p className="font-mono text-muted-foreground">{product.productCode || `ID ${product.productId}`}</p></div><div className="text-right"><p className="font-black">{product.quantity} pcs</p><p className="text-[9px] text-muted-foreground">{product.versionName || "Not assigned"}</p></div></div>)}</div>}
                                    </div>
                                );
                            })}
                        </TabsContent>
                    </div>
                </Tabs>

                <div className="z-30 flex shrink-0 items-center gap-3 border-t border-border/50 bg-card/50 p-6">
                    <Button variant="outline" className="h-12 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0" onClick={onClose}>Close</Button>
                    <Button variant="outline" onClick={() => handlePrint(consolidation)} className="h-12 w-12 shrink-0 rounded-xl p-0" title="Print Summary"><Printer className="h-4 w-4" /></Button>
                    {consolidation.status === "Pending" && <Button disabled={submitting} onClick={() => onRequestAction("start-picking", consolidation.id)} className="h-12 flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest"><Play className="mr-2 h-4 w-4" />Initialize Picking</Button>}
                    {consolidation.status === "Picking" && <Button asChild className="h-12 flex-1 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700"><Link href={`/mm/consolidation/picking/${encodeURIComponent(consolidation.consolidatorNo)}`}><Play className="mr-2 h-4 w-4" />Picking Active</Link></Button>}
                    {consolidation.status === "Picked" && <Button disabled={submitting} onClick={() => onRequestAction("audit", consolidation.id)} className="h-12 flex-1 rounded-xl bg-emerald-600 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700"><ShieldCheck className="mr-2 h-4 w-4" />Verify Batch</Button>}
                    {consolidation.status === "Audited" && <Button disabled={submitting} onClick={() => onRequestAction("revert", consolidation.id)} className="h-12 flex-1 rounded-xl bg-amber-500 text-[10px] font-black uppercase tracking-widest hover:bg-amber-600"><RotateCcw className="mr-2 h-4 w-4" />Revert Pending</Button>}
                </div>
            </SheetContent>
        </Sheet>
    );
}

function MiniStat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
    return <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-background/50 px-2.5 py-1.5 shadow-sm"><span className="flex h-3.5 w-3.5 items-center justify-center">{icon}</span><strong className="text-xs">{value}</strong><span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground">{label}</span></div>;
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = { Pending: "bg-amber-500/10 text-amber-600", Picking: "bg-blue-500/10 text-blue-600", Picked: "bg-emerald-500/10 text-emerald-600", Audited: "bg-purple-500/10 text-purple-600" };
    return <Badge className={`border-none px-2 py-1 text-[9px] font-black uppercase tracking-widest ${styles[status] ?? ""}`}>{status}</Badge>;
}
