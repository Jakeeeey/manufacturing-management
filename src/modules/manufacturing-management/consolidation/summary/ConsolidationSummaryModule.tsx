"use client";

import { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    Boxes,
    ChartNoAxesCombined,
    CheckCircle2,
    ClipboardList,
    Loader2,
    PackageCheck,
    RefreshCw,
    ScanLine,
    ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { fetchBranches } from "../../invoice-consolidation/services/invoice-consolidation-api";
import type { Branch } from "../../invoice-consolidation/types";

type BatchStatus = "Pending" | "Picking" | "Picked" | "Audited";

interface DashboardSummary {
    status: Record<BatchStatus | "All", number>;
    totalInvoices: number;
    uniqueProducts: number;
    quantities: {
        ordered: number;
        picked: number;
        remaining: number;
        completedShort: number;
        fulfillmentRate: number;
    };
    discrepancyBatches: number;
    topProducts: Array<{
        productId: number;
        productName: string;
        ordered: number;
        picked: number;
        remaining: number;
    }>;
    batches: Array<{
        id: number;
        consolidatorNo: string;
        status: string;
        createdAt: string;
        invoiceCount: number;
        productCount: number;
        ordered: number;
        picked: number;
        remaining: number;
    }>;
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const statusStyles: Record<string, string> = {
    Pending: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Picking: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    Picked: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    Audited: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

function toLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function currentMonthRange() {
    const now = new Date();
    return {
        start: toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: toLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
}

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatNumber(value: number): string {
    return numberFormatter.format(value);
}

function DashboardLoading() {
    return (
        <div className="space-y-5" aria-label="Loading consolidation summary">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {Array.from({ length: 5 }, (_, index) => (
                    <Skeleton key={index} className="h-28 rounded-2xl" />
                ))}
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <Skeleton className="h-72 rounded-2xl" />
                <Skeleton className="h-72 rounded-2xl" />
            </div>
            <Skeleton className="h-80 rounded-2xl" />
        </div>
    );
}

export default function ConsolidationSummaryModule() {
    const initialRange = currentMonthRange();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchId, setBranchId] = useState<number>();
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);
    const [summary, setSummary] = useState<DashboardSummary>();
    const [loadingBranches, setLoadingBranches] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [batchSearch, setBatchSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [pageSize, setPageSize] = useState(10);
    const [page, setPage] = useState(0);

    useEffect(() => {
        let active = true;
        fetchBranches()
            .then((items) => {
                if (!active) return;
                const availableBranches = items || [];
                setBranches(availableBranches);
                setBranchId((current) => current || availableBranches[0]?.id);
            })
            .catch((reason: unknown) => {
                if (active) setError(reason instanceof Error ? reason.message : "Failed to load branches");
            })
            .finally(() => {
                if (active) setLoadingBranches(false);
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!branchId || (startDate && endDate && startDate > endDate)) return;
        const controller = new AbortController();
        const loadSummary = async () => {
            setLoading(true);
            setError("");
            const query = new URLSearchParams({
                branchId: String(branchId),
                startDate,
                endDate,
            });
            try {
                const response = await fetch(
                    `/api/manufacturing/invoice-consolidation/summary/dashboard?${query.toString()}`,
                    { cache: "no-store", signal: controller.signal },
                );
                if (!response.ok) {
                    const body = await response.json().catch(() => null);
                    throw new Error(body?.message || "Failed to load consolidation summary");
                }
                setSummary(await response.json());
            } catch (reason) {
                if (reason instanceof DOMException && reason.name === "AbortError") return;
                setSummary(undefined);
                setError(reason instanceof Error ? reason.message : "Failed to load consolidation summary");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void loadSummary();
        return () => controller.abort();
    }, [branchId, startDate, endDate, refreshKey]);

    const rangeInvalid = Boolean(startDate && endDate && startDate > endDate);
    const fulfillmentWidth = Math.min(Math.max(summary?.quantities.fulfillmentRate || 0, 0), 100);
    const topOrdered = Math.max(...(summary?.topProducts.map((product) => product.ordered) || []), 1);
    const workflow = [
        { label: "All", value: summary?.status.All || 0, icon: ClipboardList, color: "text-foreground" },
        { label: "Pending", value: summary?.status.Pending || 0, icon: Boxes, color: "text-amber-600" },
        { label: "Picking", value: summary?.status.Picking || 0, icon: ScanLine, color: "text-blue-600" },
        { label: "Picked", value: summary?.status.Picked || 0, icon: PackageCheck, color: "text-violet-600" },
        { label: "Audited", value: summary?.status.Audited || 0, icon: ShieldCheck, color: "text-emerald-600" },
    ];
    const filteredBatches = useMemo(() => {
        const query = batchSearch.trim().toLowerCase();
        return (summary?.batches || []).filter((batch) => {
            const matchesStatus = statusFilter === "All" || batch.status === statusFilter;
            const matchesSearch = !query || batch.consolidatorNo.toLowerCase().includes(query);
            return matchesStatus && matchesSearch;
        });
    }, [batchSearch, statusFilter, summary?.batches]);
    const totalPages = Math.max(1, Math.ceil(filteredBatches.length / pageSize));
    const visibleBatches = filteredBatches.slice(page * pageSize, (page + 1) * pageSize);

    useEffect(() => {
        setPage(0);
    }, [batchSearch, branchId, endDate, pageSize, startDate, statusFilter]);

    useEffect(() => {
        if (page >= totalPages) setPage(totalPages - 1);
    }, [page, totalPages]);

    return (
        <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_35%)] p-4 text-foreground md:p-8">
            <div className="mx-auto max-w-[1600px] space-y-6">
                <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
                    <div className="flex flex-col gap-6 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
                        <div className="flex items-center gap-4">
                            <div className="rounded-2xl bg-primary p-3.5 shadow-lg shadow-primary/20">
                                <ChartNoAxesCombined className="h-7 w-7 text-primary-foreground" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">Operations Control</p>
                                <h1 className="text-2xl font-black uppercase italic tracking-tighter md:text-4xl">
                                    Consolidation <span className="text-primary">Summary</span>
                                </h1>
                                <p className="mt-1 text-sm text-muted-foreground">Invoice flow, fulfillment, and completed batch shortages.</p>
                            </div>
                        </div>
                        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[220px_160px_160px_auto]">
                            <label className="space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Branch
                                <select
                                    value={branchId || ""}
                                    onChange={(event) => setBranchId(Number(event.target.value))}
                                    disabled={loadingBranches}
                                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground outline-none transition focus:ring-2 focus:ring-primary/20"
                                >
                                    <option value="" disabled>{loadingBranches ? "Loading branches..." : "Select branch"}</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                From
                                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-xl font-bold" />
                            </label>
                            <label className="space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Through
                                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-xl font-bold" />
                            </label>
                            <Button
                                type="button"
                                onClick={() => setRefreshKey((value) => value + 1)}
                                disabled={!branchId || loading || rangeInvalid}
                                className="h-10 self-end rounded-xl px-4 font-black uppercase tracking-wider"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                                Refresh
                            </Button>
                        </div>
                    </div>
                </section>

                {rangeInvalid && (
                    <Alert variant="destructive">
                        <AlertTriangle />
                        <AlertTitle>Invalid date range</AlertTitle>
                        <AlertDescription>The start date must be on or before the end date.</AlertDescription>
                    </Alert>
                )}
                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle />
                        <AlertTitle>Dashboard unavailable</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {loading && !summary ? (
                    <DashboardLoading />
                ) : !branchId && !loadingBranches ? (
                    <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed text-center text-muted-foreground">
                        <Boxes className="mb-4 h-12 w-12 opacity-40" />
                        <p className="font-black uppercase tracking-widest">No active branches available</p>
                    </div>
                ) : summary && summary.status.All === 0 ? (
                    <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed bg-card/50 text-center text-muted-foreground">
                        <ClipboardList className="mb-4 h-12 w-12 opacity-40" />
                        <p className="font-black uppercase tracking-widest">No consolidation activity</p>
                        <p className="mt-2 text-sm">No batches were created in the selected period.</p>
                    </div>
                ) : summary ? (
                    <>
                        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            {workflow.map((item, index) => {
                                const Icon = item.icon;
                                return (
                                    <div key={item.label} className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                                                <p className="mt-2 text-3xl font-black tabular-nums">{formatNumber(item.value)}</p>
                                            </div>
                                            <Icon className={`h-6 w-6 ${item.color}`} />
                                        </div>
                                        {index > 0 && <div className={`absolute inset-x-0 bottom-0 h-1 ${item.label === "Pending" ? "bg-amber-500" : item.label === "Picking" ? "bg-blue-500" : item.label === "Picked" ? "bg-violet-500" : "bg-emerald-500"}`} />}
                                    </div>
                                );
                            })}
                        </section>

                        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
                                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Quantity Fulfillment</p>
                                        <p className="mt-2 text-5xl font-black tracking-tighter tabular-nums">{formatNumber(summary.quantities.fulfillmentRate)}%</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-right">
                                        <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Invoices</p><p className="text-xl font-black tabular-nums">{formatNumber(summary.totalInvoices)}</p></div>
                                        <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Products</p><p className="text-xl font-black tabular-nums">{formatNumber(summary.uniqueProducts)}</p></div>
                                    </div>
                                </div>
                                <div className="mt-7 h-4 overflow-hidden rounded-full bg-muted shadow-inner">
                                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-primary to-emerald-500 transition-[width] duration-700" style={{ width: `${fulfillmentWidth}%` }} />
                                </div>
                                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {[
                                        ["Ordered", summary.quantities.ordered],
                                        ["Picked", summary.quantities.picked],
                                        ["Remaining", summary.quantities.remaining],
                                        ["Completed short", summary.quantities.completedShort],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-2xl bg-muted/45 p-4">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                                            <p className="mt-1 text-xl font-black tabular-nums">{formatNumber(Number(value))}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className={`mt-5 flex items-center gap-3 rounded-2xl border p-4 ${summary.discrepancyBatches > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                                    {summary.discrepancyBatches > 0 ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                                    <div>
                                        <p className="text-sm font-black">{summary.discrepancyBatches} completed batch{summary.discrepancyBatches === 1 ? "" : "es"} with discrepancies</p>
                                        <p className="text-xs text-muted-foreground">Picked or audited batches with at least one short product line.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
                                <div className="mb-6 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Demand Leaders</p>
                                        <h2 className="mt-1 text-xl font-black uppercase tracking-tight">Top Products</h2>
                                    </div>
                                    <Boxes className="h-6 w-6 text-muted-foreground/50" />
                                </div>
                                <div className="space-y-5">
                                    {summary.topProducts.map((product, index) => (
                                        <div key={product.productId}>
                                            <div className="mb-2 flex items-end justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-black"><span className="mr-2 text-primary/60">0{index + 1}</span>{product.productName}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{formatNumber(product.picked)} picked / {formatNumber(product.remaining)} remaining</p>
                                                </div>
                                                <p className="shrink-0 text-lg font-black tabular-nums">{formatNumber(product.ordered)}</p>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                                <div className="h-full rounded-full bg-primary" style={{ width: `${(product.ordered / topOrdered) * 100}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
                            <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-5 xl:flex-row xl:items-end xl:justify-between md:px-7">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Batch Register</p>
                                    <h2 className="mt-1 text-xl font-black uppercase tracking-tight">All Consolidations</h2>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_150px_110px]">
                                    <Input
                                        value={batchSearch}
                                        onChange={(event) => setBatchSearch(event.target.value)}
                                        placeholder="Filter batch number..."
                                        className="h-10 rounded-xl"
                                    />
                                    <select
                                        value={statusFilter}
                                        onChange={(event) => setStatusFilter(event.target.value)}
                                        className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="All">All statuses</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Picking">Picking</option>
                                        <option value="Picked">Picked</option>
                                        <option value="Audited">Audited</option>
                                    </select>
                                    <select
                                        value={pageSize}
                                        onChange={(event) => setPageSize(Number(event.target.value))}
                                        className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                                        aria-label="Rows per page"
                                    >
                                        <option value={10}>10 rows</option>
                                        <option value={25}>25 rows</option>
                                        <option value={50}>50 rows</option>
                                        <option value={100}>100 rows</option>
                                    </select>
                                </div>
                            </div>
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="pl-5 md:pl-7">Batch</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Invoices</TableHead>
                                        <TableHead className="text-right">Products</TableHead>
                                        <TableHead className="text-right">Ordered</TableHead>
                                        <TableHead className="text-right">Picked</TableHead>
                                        <TableHead className="pr-5 text-right md:pr-7">Remaining</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visibleBatches.map((batch) => (
                                        <TableRow key={batch.id}>
                                            <TableCell className="pl-5 font-black md:pl-7">{batch.consolidatorNo}</TableCell>
                                            <TableCell><span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusStyles[batch.status] || statusStyles.Pending}`}>{batch.status}</span></TableCell>
                                            <TableCell className="text-muted-foreground">{formatDate(batch.createdAt)}</TableCell>
                                            <TableCell className="text-right font-bold tabular-nums">{formatNumber(batch.invoiceCount)}</TableCell>
                                            <TableCell className="text-right font-bold tabular-nums">{formatNumber(batch.productCount)}</TableCell>
                                            <TableCell className="text-right font-bold tabular-nums">{formatNumber(batch.ordered)}</TableCell>
                                            <TableCell className="text-right font-bold tabular-nums">{formatNumber(batch.picked)}</TableCell>
                                            <TableCell className={`pr-5 text-right font-black tabular-nums md:pr-7 ${batch.remaining > 0 ? "text-amber-600" : "text-emerald-600"}`}>{formatNumber(batch.remaining)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {visibleBatches.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-28 text-center text-sm font-bold text-muted-foreground">
                                                No consolidations match the selected filters.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
                                <p className="text-xs font-bold text-muted-foreground">
                                    {filteredBatches.length} result{filteredBatches.length === 1 ? "" : "s"} · Page {page + 1} of {totalPages}
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
                                        Previous
                                    </Button>
                                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </>
                ) : null}
            </div>
        </div>
    );
}
