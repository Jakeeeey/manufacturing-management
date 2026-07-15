"use client";

import { Fragment, useState } from "react";
import {
    AlertCircle,
    Boxes,
    Building2,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    CircleDashed,
    Loader2,
    PackageCheck,
    RefreshCw,
    RotateCcw,
    Search,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useManufacturingInvoicing, type ReservationStatusFilter } from "./hooks/useManufacturingInvoicing";
import type { InvoiceReservationDetail, InvoiceReservationStatus, InvoiceReservationSummary } from "./types";

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const statusStyles: Record<InvoiceReservationStatus, string> = {
    Unallocated: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    Partial: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Reserved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

function formatQuantity(value: number) {
    return numberFormatter.format(Number(value) || 0);
}

function formatDate(value: string | null) {
    if (!value) return "Not dated";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function StatusBadge({ status }: { status: InvoiceReservationStatus }) {
    return <Badge variant="outline" className={cn("font-bold", statusStyles[status])}>{status}</Badge>;
}

function DetailLines({ details }: { details: InvoiceReservationDetail[] }) {
    if (details.length === 0) {
        return <p className="p-5 text-center text-xs text-muted-foreground">No invoice details were returned.</p>;
    }

    return (
        <div className="space-y-3 p-3 sm:p-4">
            {details.map((detail) => (
                <div key={detail.detailId} className="overflow-hidden rounded-xl border border-border/60 bg-background/70">
                    <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,110px)] sm:items-center">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{detail.productName}</p>
                            <p className="text-[11px] font-medium text-muted-foreground">{detail.productCode}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:contents">
                            <Quantity label="Required" value={detail.requiredQuantity} />
                            <Quantity label="Reserved" value={detail.reservedQuantity} tone="success" />
                            <Quantity label="Shortage" value={detail.shortageQuantity} tone={detail.shortageQuantity > 0 ? "danger" : "default"} />
                        </div>
                    </div>
                    <div className="border-t border-border/50 bg-muted/20 px-3 py-2">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Lot allocations</p>
                        {detail.allocations.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No lots reserved for this line.</p>
                        ) : (
                            <div className="grid gap-2 lg:grid-cols-2">
                                {detail.allocations.map((allocation) => (
                                    <div key={allocation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                                        <div>
                                            <p className="font-bold">{allocation.lotName || `Lot ${allocation.inventoryLotId}`}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                Batch {allocation.batchNo || "N/A"} / Expires {formatDate(allocation.expiryDate)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black tabular-nums">{formatQuantity(allocation.quantity)}</p>
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground">{allocation.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function Quantity({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "danger" }) {
    return (
        <div className="sm:text-right">
            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={cn(
                "text-sm font-black tabular-nums",
                tone === "success" && "text-emerald-600 dark:text-emerald-400",
                tone === "danger" && "text-rose-600 dark:text-rose-400",
            )}>
                {formatQuantity(value)}
            </p>
        </div>
    );
}

export default function ManufacturingInvoicingModule() {
    const {
        branches,
        selectedBranchId,
        filteredInvoices,
        search,
        statusFilter,
        summary,
        loadingBranches,
        loading,
        error,
        submitting,
        setSearch,
        setStatusFilter,
        changeBranch,
        runAction,
        refresh,
    } = useManufacturingInvoicing();
    const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);

    const summaryCards: Array<{
        status: ReservationStatusFilter;
        value: number;
        icon: typeof Boxes;
        color: string;
    }> = [
        { status: "All", value: summary.All, icon: Boxes, color: "text-primary" },
        { status: "Unallocated", value: summary.Unallocated, icon: CircleDashed, color: "text-rose-600" },
        { status: "Partial", value: summary.Partial, icon: AlertCircle, color: "text-amber-600" },
        { status: "Reserved", value: summary.Reserved, icon: CheckCircle2, color: "text-emerald-600" },
    ];

    function toggleInvoice(invoiceId: number) {
        setExpandedInvoiceId((current) => current === invoiceId ? null : invoiceId);
    }

    function actionButtons(invoice: InvoiceReservationSummary) {
        const isAllocating = submitting?.invoiceId === invoice.invoiceId && submitting.action === "allocate";
        const isReleasing = submitting?.invoiceId === invoice.invoiceId && submitting.action === "release";

        return (
            <div className="flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                {invoice.status !== "Reserved" && (
                    <Button
                        size="sm"
                        onClick={() => void runAction(invoice.invoiceId, "allocate")}
                        disabled={submitting !== null}
                    >
                        {isAllocating ? <Loader2 className="animate-spin" /> : <PackageCheck />}
                        {invoice.status === "Partial" ? "Retry" : "Allocate"}
                    </Button>
                )}
                {invoice.status !== "Unallocated" && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void runAction(invoice.invoiceId, "release")}
                        disabled={submitting !== null}
                    >
                        {isReleasing ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                        Release
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_34%)] p-3 text-foreground sm:p-5 lg:p-8">
            <div className="mx-auto max-w-[1600px] space-y-5">
                <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm sm:rounded-3xl">
                    <div className="flex flex-col gap-5 p-4 sm:p-6 xl:flex-row xl:items-end xl:justify-between">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <SidebarTrigger className="shrink-0" />
                            <div className="hidden rounded-2xl bg-primary p-3.5 shadow-lg shadow-primary/20 sm:block">
                                <PackageCheck className="h-7 w-7 text-primary-foreground" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">Inventory Reservations</p>
                                <h1 className="text-2xl font-black uppercase italic tracking-tighter sm:text-4xl">
                                    Manufacturing <span className="text-primary">Invoicing</span>
                                </h1>
                                <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                                    Reserve invoice quantities against inventory lots before consolidation and picking.
                                </p>
                            </div>
                        </div>
                        <div className="grid w-full gap-3 sm:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] xl:w-auto">
                            <div className="space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                <span>Branch <span className="text-destructive">*</span></span>
                                <SearchableSelect
                                    value={selectedBranchId ? String(selectedBranchId) : ""}
                                    onValueChange={(value) => changeBranch(value ? Number(value) : null)}
                                    disabled={loadingBranches}
                                    options={branches.map((branch) => ({
                                        value: String(branch.id),
                                        label: `${branch.branchName} (${branch.branchCode})`,
                                    }))}
                                    placeholder={loadingBranches ? "Loading branches..." : "Search and select branch..."}
                                    className="h-10 rounded-xl bg-background text-sm font-bold normal-case tracking-normal"
                                />
                            </div>
                            <label className="space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Search
                                <span className="relative block">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Invoice or customer"
                                        disabled={!selectedBranchId}
                                        className="h-10 rounded-xl pl-9 normal-case tracking-normal"
                                    />
                                </span>
                            </label>
                            <Button
                                variant="outline"
                                className="self-end rounded-xl"
                                onClick={refresh}
                                disabled={!selectedBranchId || loading}
                                aria-label="Refresh invoice reservations"
                            >
                                <RefreshCw className={cn(loading && "animate-spin")} />
                                <span className="sm:hidden">Refresh</span>
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {summaryCards.map(({ status, value, icon: Icon, color }) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            disabled={!selectedBranchId}
                            className={cn(
                                "rounded-2xl border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 sm:p-4",
                                statusFilter === status && "border-primary/50 ring-2 ring-primary/10",
                                !selectedBranchId && "cursor-not-allowed opacity-50",
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <Icon className={cn("h-5 w-5", color)} />
                                <span className="text-2xl font-black tabular-nums">{selectedBranchId ? value : 0}</span>
                            </div>
                            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{status}</p>
                        </button>
                    ))}
                </section>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle />
                        <AlertTitle>Unable to load invoicing</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {!selectedBranchId ? (
                    <Card className="border-dashed bg-card/60 py-0">
                        <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                            <Building2 className="mb-4 h-11 w-11 text-muted-foreground/50" />
                            <h2 className="text-sm font-black uppercase tracking-widest">Branch selection required</h2>
                            <p className="mt-2 max-w-md text-xs text-muted-foreground">Choose a branch to load invoice reservation requirements.</p>
                        </CardContent>
                    </Card>
                ) : loading ? (
                    <div className="space-y-3" aria-label="Loading invoice reservations">
                        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <Card className="border-dashed bg-card/60 py-0">
                        <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                            <Boxes className="mb-4 h-10 w-10 text-muted-foreground/40" />
                            <h2 className="text-sm font-black uppercase tracking-widest">No invoice reservations</h2>
                            <p className="mt-2 text-xs text-muted-foreground">No invoices match the selected branch, search, and status.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/40">
                                        <TableHead className="w-12" />
                                        <TableHead>Invoice</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>Reserved quantity</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInvoices.map((invoice) => {
                                        const expanded = expandedInvoiceId === invoice.invoiceId;
                                        return (
                                            <Fragment key={invoice.invoiceId}>
                                                <TableRow className="cursor-pointer" onClick={() => toggleInvoice(invoice.invoiceId)}>
                                                    <TableCell>{expanded ? <ChevronDown /> : <ChevronRight />}</TableCell>
                                                    <TableCell>
                                                        <p className="font-mono text-sm font-black">{invoice.invoiceNo}</p>
                                                        <p className="text-[11px] text-muted-foreground">{formatDate(invoice.invoiceDate)}</p>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{invoice.customerName}</TableCell>
                                                    <TableCell className="tabular-nums">{invoice.fullyReservedDetails} / {invoice.totalDetails}</TableCell>
                                                    <TableCell className="font-bold tabular-nums">
                                                        {formatQuantity(invoice.reservedQuantity)} / {formatQuantity(invoice.requiredQuantity)}
                                                    </TableCell>
                                                    <TableCell><StatusBadge status={invoice.status} /></TableCell>
                                                    <TableCell>{actionButtons(invoice)}</TableCell>
                                                </TableRow>
                                                {expanded && (
                                                    <TableRow className="bg-muted/15 hover:bg-muted/15">
                                                        <TableCell colSpan={7} className="p-0"><DetailLines details={invoice.details} /></TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="divide-y md:hidden">
                            {filteredInvoices.map((invoice) => {
                                const expanded = expandedInvoiceId === invoice.invoiceId;
                                return (
                                    <div key={invoice.invoiceId}>
                                        <button type="button" className="w-full p-4 text-left" onClick={() => toggleInvoice(invoice.invoiceId)}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-mono text-sm font-black">{invoice.invoiceNo}</p>
                                                    <p className="truncate text-xs font-medium">{invoice.customerName}</p>
                                                    <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(invoice.invoiceDate)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <StatusBadge status={invoice.status} />
                                                    {expanded ? <ChevronDown /> : <ChevronRight />}
                                                </div>
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/35 p-3">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Details reserved</p>
                                                    <p className="text-sm font-black tabular-nums">{invoice.fullyReservedDetails} / {invoice.totalDetails}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Quantity reserved</p>
                                                    <p className="text-sm font-black tabular-nums">{formatQuantity(invoice.reservedQuantity)} / {formatQuantity(invoice.requiredQuantity)}</p>
                                                </div>
                                            </div>
                                        </button>
                                        <div className="px-4 pb-4">{actionButtons(invoice)}</div>
                                        {expanded && <div className="border-t bg-muted/15"><DetailLines details={invoice.details} /></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
