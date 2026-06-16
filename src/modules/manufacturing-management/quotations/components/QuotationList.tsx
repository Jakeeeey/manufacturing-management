import React, { useState } from "react";
import { 
    FileText, Plus, Eye, History, Check, X, ShieldAlert, 
    Folder, Loader2, ArrowRight, TrendingUp, TrendingDown, Layers, Clock 
} from "lucide-react";
import { toast } from "sonner";
import { QuotationHeader, Customer, QuotationSnapshotNode } from "../types";

interface QuotationListProps {
    quotes: QuotationHeader[];
    loadingQuotes: boolean;
    initCreateFlow: () => void;
    loadQuotes: () => void;
    viewQuoteDetails: (quote: QuotationHeader) => void;
    reviseQuotation: (quote: QuotationHeader) => void;
}

export function QuotationList({
    quotes,
    loadingQuotes,
    initCreateFlow,
    loadQuotes,
    viewQuoteDetails,
    reviseQuotation
}: QuotationListProps) {
    const [subTab, setSubTab] = useState<"pipeline" | "sheets" | "rejected">("pipeline");
    const [processingId, setProcessingId] = useState<number | null>(null);

    // SKU History Modal States
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyProjectName, setHistoryProjectName] = useState("");
    const [historyQuotes, setHistoryQuotes] = useState<QuotationHeader[]>([]);
    const [projectSnapshots, setProjectSnapshots] = useState<Record<number, QuotationSnapshotNode[]>>({});

    // Grouping helper: finds the latest quote sheet per project name
    const projectGroups = React.useMemo(() => {
        const groups: Record<string, { latest: QuotationHeader; history: QuotationHeader[] }> = {};
        
        quotes.forEach(q => {
            const key = q.project_name?.trim() || `No Project Name (Quote: ${q.quote_number})`;
            if (!groups[key]) {
                groups[key] = { latest: q, history: [q] };
            } else {
                groups[key].history.push(q);
                // Compare dates or revision suffixes to find the latest
                const currLatest = groups[key].latest;
                const currTime = currLatest.quote_date ? new Date(currLatest.quote_date).getTime() : 0;
                const checkTime = q.quote_date ? new Date(q.quote_date).getTime() : 0;
                if (checkTime > currTime) {
                    groups[key].latest = q;
                }
            }
        });
        return groups;
    }, [quotes]);

    // Active project proposals pipeline: projects where latest version is NOT Rejected and NOT converted to SO
    const activeProjects = React.useMemo(() => {
        return Object.entries(projectGroups)
            .filter(([_, group]) => group.latest.status !== "Rejected" && group.latest.status !== "Converted to SO")
            .map(([name, group]) => ({ projectName: name, ...group }));
    }, [projectGroups]);

    // Rejected projects list
    const rejectedProjects = React.useMemo(() => {
        return Object.entries(projectGroups)
            .filter(([_, group]) => group.latest.status === "Rejected")
            .map(([name, group]) => ({ projectName: name, ...group }));
    }, [projectGroups]);

    const handleApproveProject = (quote: QuotationHeader) => {
        viewQuoteDetails(quote);
        toast.info("Please fill in the required Sales Order details (e.g. PO No., dates) to complete conversion.");
    };

    const handleRejectProject = async (quote: QuotationHeader) => {
        setProcessingId(quote.id);
        try {
            const res = await fetch("/api/manufacturing/finished-goods/quotes", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quoteId: quote.id, status: "Rejected" })
            });
            if (!res.ok) throw new Error("Failed to reject proposal");
            toast.info(`Project proposal ${quote.project_name || quote.quote_number} marked as Rejected.`);
            loadQuotes();
        } catch (e: any) {
            toast.error(e.message || "Failed to reject project");
        } finally {
            setProcessingId(null);
        }
    };

    const handleViewSkuHistory = async (projName: string, historyList: QuotationHeader[]) => {
        setHistoryProjectName(projName);
        setHistoryQuotes(historyList);
        setHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const fetched: Record<number, QuotationSnapshotNode[]> = {};
            await Promise.all(historyList.map(async (q) => {
                const res = await fetch(`/api/manufacturing/finished-goods/quotes/snapshots?quoteId=${q.id}`);
                if (res.ok) {
                    const data = await res.json();
                    fetched[q.id] = data;
                }
            }));
            setProjectSnapshots(fetched);
        } catch (e) {
            toast.error("Failed to load historical snapshots.");
        } finally {
            setHistoryLoading(false);
        }
    };

    // Sorted list of quotation headers in the active project history for column headers
    const sortedHistoryQuotes = React.useMemo(() => {
        return [...historyQuotes].sort((a, b) => {
            const tA = a.quote_date ? new Date(a.quote_date).getTime() : 0;
            const tB = b.quote_date ? new Date(b.quote_date).getTime() : 0;
            return tA - tB;
        });
    }, [historyQuotes]);

    // Calculate SKU history structures inside the modal
    const skuHistoryList = React.useMemo(() => {
        if (!sortedHistoryQuotes.length) return [];

        const skuMap: Record<number, {
            productName: string;
            versions: Record<string, { price: number; cost: number }>;
            rawVersionsList: { price: number; cost: number }[];
        }> = {};

        sortedHistoryQuotes.forEach(q => {
            const snaps = projectSnapshots[q.id] || [];
            snaps.forEach(item => {
                if (item.node_type === "product_quota") {
                    const pId = item.product_id;
                    if (!skuMap[pId]) {
                        skuMap[pId] = {
                            productName: item.node_name,
                            versions: {},
                            rawVersionsList: []
                        };
                    }
                    const verData = {
                        price: Number(item.frozen_total_cost_php || 0),
                        cost: Number(item.frozen_unit_cost_php || 0)
                    };
                    skuMap[pId].versions[q.quote_number] = verData;
                    skuMap[pId].rawVersionsList.push(verData);
                }
            });
        });

        return Object.entries(skuMap).map(([pId, val]) => ({
            productId: Number(pId),
            ...val
        }));
    }, [sortedHistoryQuotes, projectSnapshots]);

    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">Project Quotations & Pipeline</h3>
                    <p className="text-xs text-muted-foreground">Approve won proposals to generate Sales Orders, reject lost projects, and manage pricing sheet revision histories.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={initCreateFlow}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-md"
                    >
                        <Plus className="h-4 w-4" /> Create Customer Quote
                    </button>
                    <button
                        onClick={loadQuotes}
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted text-muted-foreground transition-all"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Sub-navigation tabs */}
            <div className="flex border-b bg-muted/10 shrink-0 rounded-xl overflow-hidden border max-w-lg">
                <button
                    onClick={() => setSubTab("pipeline")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                        subTab === "pipeline"
                            ? "border-primary text-primary bg-background"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                    <Folder className="h-4 w-4" /> Active Projects ({activeProjects.length})
                </button>
                <button
                    onClick={() => setSubTab("sheets")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                        subTab === "sheets"
                            ? "border-primary text-primary bg-background"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                    <FileText className="h-4 w-4" /> All Quotation Sheets ({quotes.length})
                </button>
                <button
                    onClick={() => setSubTab("rejected")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                        subTab === "rejected"
                            ? "border-primary text-primary bg-background"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                    <ShieldAlert className="h-4 w-4" /> Rejected Projects ({rejectedProjects.length})
                </button>
            </div>

            {loadingQuotes ? (
                <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground">
                    <span className="text-xs">Loading quotations...</span>
                </div>
            ) : (
                <div className="overflow-hidden border rounded-xl bg-card shadow-sm">
                    {subTab === "pipeline" && (
                        activeProjects.length === 0 ? (
                            <div className="text-center p-20 max-w-md mx-auto">
                                <Folder className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <h4 className="text-sm font-bold text-foreground mb-1">No Active Project Proposals</h4>
                                <p className="text-xs text-muted-foreground">All draft quotes are approved (SO created) or rejected.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Project Name</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Latest Quotation</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Agreed Price</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Revisions</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Status</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Project Decision</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {activeProjects.map(proj => {
                                            const q = proj.latest;
                                            const custName = (q.customer_id && typeof q.customer_id === "object") 
                                                ? `${(q.customer_id as Customer).customer_name} (${(q.customer_id as Customer).customer_code})`
                                                : `Cust ID: ${q.customer_id}`;
                                            const sellingPrice = Number(q.total_selling_price || 0);

                                            return (
                                                <tr key={proj.projectName} className="hover:bg-muted/30 transition-colors">
                                                    <td className="p-3 font-bold text-primary">{proj.projectName}</td>
                                                    <td className="p-3 font-medium text-foreground">{custName}</td>
                                                    <td className="p-3 font-mono text-muted-foreground font-bold">{q.quote_number}</td>
                                                    <td className="p-3 text-right font-extrabold text-foreground">₱{sellingPrice.toFixed(2)}</td>
                                                    <td className="p-3 text-center text-muted-foreground font-semibold">
                                                        <button 
                                                            onClick={() => handleViewSkuHistory(proj.projectName, proj.history)}
                                                            className="hover:underline text-primary font-bold inline-flex items-center gap-1"
                                                        >
                                                            <Clock className="h-3 w-3" />
                                                            {proj.history.length} sheet(s)
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                                            {q.status || "Draft Proposal"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center flex items-center justify-center gap-2">
                                                        <button
                                                            disabled={processingId !== null}
                                                            onClick={() => handleApproveProject(q)}
                                                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-bold px-2 py-1 rounded-md transition-all shadow-xs"
                                                            title="Approve Project & Release SO"
                                                        >
                                                            <Check className="h-3.5 w-3.5" /> Approve Project
                                                        </button>
                                                        <button
                                                            disabled={processingId !== null}
                                                            onClick={() => handleRejectProject(q)}
                                                            className="inline-flex items-center gap-1 bg-destructive hover:bg-destructive/95 disabled:opacity-50 text-white text-[10px] font-bold px-2 py-1 rounded-md transition-all shadow-xs"
                                                            title="Reject Project Proposal"
                                                        >
                                                            <X className="h-3.5 w-3.5" /> Reject
                                                        </button>
                                                        <button
                                                            onClick={() => viewQuoteDetails(q)}
                                                            className="inline-flex items-center justify-center p-1 rounded-md border hover:bg-muted text-muted-foreground transition-all"
                                                            title="View Sheet Snapshot"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {subTab === "rejected" && (
                        rejectedProjects.length === 0 ? (
                            <div className="text-center p-20 max-w-md mx-auto">
                                <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <h4 className="text-sm font-bold text-foreground mb-1">No Rejected Projects</h4>
                                <p className="text-xs text-muted-foreground">Proposals you mark as Rejected will accumulate in this archival registry.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Project Name</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Last Quote Version</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Selling Total</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Date Updated</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {rejectedProjects.map(proj => {
                                            const q = proj.latest;
                                            const custName = (q.customer_id && typeof q.customer_id === "object") 
                                                ? `${(q.customer_id as Customer).customer_name} (${(q.customer_id as Customer).customer_code})`
                                                : `Cust ID: ${q.customer_id}`;
                                            const sellingPrice = Number(q.total_selling_price || 0);

                                            return (
                                                <tr key={proj.projectName} className="hover:bg-muted/30 transition-colors">
                                                    <td className="p-3 font-bold text-destructive">{proj.projectName}</td>
                                                    <td className="p-3 font-medium text-foreground">{custName}</td>
                                                    <td className="p-3 font-mono text-muted-foreground font-semibold">{q.quote_number}</td>
                                                    <td className="p-3 text-right text-muted-foreground font-semibold">₱{sellingPrice.toFixed(2)}</td>
                                                    <td className="p-3 text-muted-foreground">{q.quote_date ? new Date(q.quote_date).toLocaleDateString() : "—"}</td>
                                                    <td className="p-3 text-center flex items-center justify-center gap-1.5">
                                                        <button 
                                                            onClick={() => handleViewSkuHistory(proj.projectName, proj.history)}
                                                            className="inline-flex items-center justify-center p-1 rounded-md border hover:bg-muted text-primary font-bold transition-all"
                                                            title="View SKU Revisions History"
                                                        >
                                                            <Clock className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => viewQuoteDetails(proj.latest)}
                                                            className="inline-flex items-center justify-center p-1 rounded-md border hover:bg-muted text-muted-foreground transition-all"
                                                            title="View Sheet Breakdown"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}

                    {subTab === "sheets" && (
                        quotes.length === 0 ? (
                            <div className="text-center p-20 max-w-md mx-auto">
                                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <h4 className="text-sm font-bold text-foreground mb-1">No Quotation Sheets Found</h4>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Quote Number</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Project Name</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Production Cost</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Agreed Price</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Estimated GP</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase">Status</th>
                                            <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {quotes.map(q => {
                                            const custName = (q.customer_id && typeof q.customer_id === "object") 
                                                ? `${(q.customer_id as Customer).customer_name} (${(q.customer_id as Customer).customer_code})`
                                                : `Cust ID: ${q.customer_id}`;
                                            const simulatedCost = Number(q.total_simulated_cost || 0);
                                            const sellingPrice = Number(q.total_selling_price || 0);
                                            const gp = sellingPrice - simulatedCost;
                                            const margin = sellingPrice > 0 ? (gp / sellingPrice) * 100 : 0;

                                            return (
                                                <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="p-3 font-bold text-foreground">{q.quote_number}</td>
                                                    <td className="p-3 font-semibold text-primary">{q.project_name || "—"}</td>
                                                    <td className="p-3 font-medium text-foreground">{custName}</td>
                                                    <td className="p-3 text-right text-muted-foreground font-semibold">₱{simulatedCost.toFixed(2)}</td>
                                                    <td className="p-3 text-right font-bold text-foreground">₱{sellingPrice.toFixed(2)}</td>
                                                    <td className={`p-3 text-right font-extrabold ${gp >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                                        ₱{gp.toFixed(2)} ({margin.toFixed(1)}%)
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            q.status === "Converted to SO"
                                                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                                                : q.status === "Rejected"
                                                                ? "bg-destructive/10 text-destructive border border-destructive/20"
                                                                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                                        }`}>
                                                            {q.status || "Draft"}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center flex items-center justify-center gap-1.5 pt-4">
                                                        <button
                                                            onClick={() => viewQuoteDetails(q)}
                                                            className="inline-flex items-center justify-center p-1 rounded-md border hover:bg-muted text-muted-foreground transition-all"
                                                            title="View Snapshot Breakdown"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        {q.status !== "Converted to SO" && (
                                                            <button
                                                                onClick={() => reviseQuotation(q)}
                                                                className="inline-flex items-center justify-center p-1 rounded-md border hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 text-muted-foreground transition-all"
                                                                title="Revise / Create New Version"
                                                            >
                                                                <History className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Modal: Project SKU Pricing Revision History (Excel Grid Format) */}
            {historyModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-card border rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/10">
                            <div>
                                <h3 className="text-base font-bold text-foreground">Project SKU Comparative Pricing Sheet (Excel View)</h3>
                                <p className="text-xs text-muted-foreground">Project Name: <strong className="text-foreground">{historyProjectName}</strong> | Tracked over historical revision periods</p>
                            </div>
                            <button
                                onClick={() => setHistoryModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground text-xs font-semibold rounded-lg border px-3 py-1.5 hover:bg-muted"
                            >
                                Close Grid
                            </button>
                        </div>

                        {/* Excel Spreadsheet Content */}
                        <div className="flex-1 overflow-auto p-6">
                            {historyLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground text-xs">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span>Compiling revision matrix columns...</span>
                                </div>
                            ) : skuHistoryList.length === 0 ? (
                                <div className="text-center py-20 text-xs text-muted-foreground">
                                    No raw material or finished SKU snapshots locked.
                                </div>
                            ) : (
                                <div className="overflow-x-auto border rounded-xl shadow-xs">
                                    <table className="w-full border-collapse text-left text-xs bg-card">
                                        <thead className="bg-muted/70 text-foreground border-b select-none">
                                            {/* Column headers row 1 */}
                                            <tr>
                                                <th rowSpan={2} className="p-3 font-bold border-r uppercase tracking-wider text-[10px] bg-muted/90 sticky left-0 z-20 min-w-[200px]">
                                                    Finished Good SKU
                                                </th>
                                                {sortedHistoryQuotes.map((q) => (
                                                    <th key={q.id} colSpan={2} className="p-2 font-bold text-center border-r border-b font-mono tracking-wider text-[10px]">
                                                        {q.quote_number}
                                                    </th>
                                                ))}
                                                <th colSpan={2} className="p-2 font-bold text-center bg-primary/5 text-primary border-b uppercase tracking-wider text-[10px]">
                                                    Cumulative Delta
                                                </th>
                                            </tr>
                                            {/* Column headers row 2 */}
                                            <tr className="bg-muted/40">
                                                {sortedHistoryQuotes.map((q) => (
                                                    <React.Fragment key={`sub-${q.id}`}>
                                                        <th className="p-2 text-right font-semibold border-r border-b text-[9px] uppercase tracking-wider text-muted-foreground">Price</th>
                                                        <th className="p-2 text-right font-semibold border-r border-b text-[9px] uppercase tracking-wider text-muted-foreground">Cost</th>
                                                    </React.Fragment>
                                                ))}
                                                <th className="p-2 text-right font-bold bg-primary/5 text-primary border-r border-b text-[9px] uppercase tracking-wider">Price Δ</th>
                                                <th className="p-2 text-right font-bold bg-primary/5 text-primary border-b text-[9px] uppercase tracking-wider">Cost Δ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {skuHistoryList.map((sku) => {
                                                // Calculate deltas from first revision to the latest version
                                                const firstVer = sku.rawVersionsList[0];
                                                const latestVer = sku.rawVersionsList[sku.rawVersionsList.length - 1];
                                                
                                                const priceDiff = latestVer.price - firstVer.price;
                                                const costDiff = latestVer.cost - firstVer.cost;
                                                
                                                return (
                                                    <tr key={sku.productId} className="hover:bg-muted/20 transition-colors">
                                                        <td className="p-3 font-bold text-foreground border-r bg-card sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                            {sku.productName}
                                                        </td>
                                                        {sortedHistoryQuotes.map((q) => {
                                                            const verInfo = sku.versions[q.quote_number];
                                                            return verInfo ? (
                                                                <React.Fragment key={`cell-${sku.productId}-${q.id}`}>
                                                                    <td className="p-2 text-right font-bold text-foreground border-r font-mono">
                                                                        ₱{verInfo.price.toFixed(2)}
                                                                    </td>
                                                                    <td className="p-2 text-right text-muted-foreground border-r font-mono">
                                                                        ₱{verInfo.cost.toFixed(2)}
                                                                    </td>
                                                                </React.Fragment>
                                                            ) : (
                                                                <React.Fragment key={`cell-${sku.productId}-${q.id}`}>
                                                                    <td className="p-2 text-center text-muted-foreground/30 border-r font-semibold">—</td>
                                                                    <td className="p-2 text-center text-muted-foreground/30 border-r font-semibold">—</td>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                        {/* Price delta */}
                                                        <td className={`p-2 text-right font-extrabold border-r font-mono bg-primary/5 ${
                                                            priceDiff > 0 ? "text-emerald-600" : priceDiff < 0 ? "text-destructive" : "text-muted-foreground"
                                                        }`}>
                                                            {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(2)}
                                                        </td>
                                                        {/* Cost delta */}
                                                        <td className={`p-2 text-right font-extrabold font-mono bg-primary/5 ${
                                                            costDiff > 0 ? "text-amber-600" : costDiff < 0 ? "text-emerald-600" : "text-muted-foreground"
                                                        }`}>
                                                            {costDiff > 0 ? "+" : ""}{costDiff.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
