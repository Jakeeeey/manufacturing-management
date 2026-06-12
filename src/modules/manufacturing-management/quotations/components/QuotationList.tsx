import React from "react";
import { FileText, Plus, Eye, History } from "lucide-react";
import { QuotationHeader, Customer } from "../types";

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
    return (
        <>
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">Quotations & Pricing Sheets</h3>
                    <p className="text-xs text-muted-foreground">Audit historic customer agreements, price types, and customize client quotations.</p>
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

            {loadingQuotes ? (
                <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground">
                    <span className="text-xs">Loading quotations...</span>
                </div>
            ) : quotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 text-center border rounded-xl bg-muted/10 max-w-md mx-auto">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <h4 className="text-sm font-bold text-foreground mb-1">No Quotations Found</h4>
                    <p className="text-xs text-muted-foreground">
                        Click **Create Customer Quote** to set up a target pricing agreement with custom customer overrides.
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden border rounded-xl bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Quote Number</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Production Cost</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Agreed Price</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Estimated GP</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Quote Date</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {quotes.map((q) => {
                                    const custName = (q.customer_id && typeof q.customer_id === "object") 
                                        ? `${(q.customer_id as Customer).customer_name} (${(q.customer_id as Customer).customer_code})`
                                        : `Cust ID: ${q.customer_id}`;
                                    const simulatedCost = Number(q.total_simulated_cost || 0);
                                    const sellingPrice = Number(q.total_selling_price || 0);
                                    const gp = sellingPrice - simulatedCost;
                                    const margin = sellingPrice > 0 ? (gp / sellingPrice) * 100 : 0;
                                    const dateStr = q.quote_date ? new Date(q.quote_date).toLocaleDateString("en-US", {
                                        year: "numeric", month: "short", day: "numeric"
                                    }) : "N/A";

                                    return (
                                        <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3 font-bold text-foreground">{q.quote_number}</td>
                                            <td className="p-3 font-medium text-foreground">{custName}</td>
                                            <td className="p-3 text-right text-muted-foreground font-semibold">₱{simulatedCost.toFixed(2)}</td>
                                            <td className="p-3 text-right font-bold text-foreground">₱{sellingPrice.toFixed(2)}</td>
                                            <td className={`p-3 text-right font-extrabold ${gp >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                                ₱{gp.toFixed(2)} ({margin.toFixed(1)}%)
                                            </td>
                                            <td className="p-3 text-muted-foreground">{dateStr}</td>
                                            <td className="p-3 text-center flex items-center justify-center gap-1.5 pt-4">
                                                <button
                                                    onClick={() => viewQuoteDetails(q)}
                                                    className="inline-flex items-center justify-center p-1 rounded-md border hover:bg-muted text-muted-foreground transition-all"
                                                    title="View Snapshot Breakdown"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => reviseQuotation(q)}
                                                    className="inline-flex items-center justify-center p-1 rounded-md border hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 text-muted-foreground transition-all"
                                                    title="Revise / Create New Version"
                                                >
                                                    <History className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
