import React from "react";
import {Customer, QuotationHeader, QuotationSnapshotNode} from "../types";

interface QuotationDetailModalProps {
    isDetailModalOpen: boolean;
    selectedQuote: QuotationHeader | null;
    snapshots: QuotationSnapshotNode[];
    loadingSnapshots: boolean;
    setIsDetailModalOpen: (open: boolean) => void;
    reviseQuotation: (quote: QuotationHeader) => void;
}

export function QuotationDetailModal({
    isDetailModalOpen,
    selectedQuote,
    snapshots,
    loadingSnapshots,
    setIsDetailModalOpen,
    reviseQuotation
}: QuotationDetailModalProps) {
    if (!isDetailModalOpen || !selectedQuote) return null;

    const simulatedCost = Number(selectedQuote.total_simulated_cost || 0);
    const sellingPrice = Number(selectedQuote.total_selling_price || 0);
    const netMargin = sellingPrice - simulatedCost;
    const marginPct = sellingPrice > 0 ? (netMargin / sellingPrice) * 100 : 0;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-card border rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/10">
                    <div>
                        <h3 className="text-base font-bold text-foreground">Quote Snapshot Detail</h3>
                        <p className="text-xs text-muted-foreground">Quote Number: <strong className="text-foreground">{selectedQuote.quote_number}</strong></p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                reviseQuotation(selectedQuote);
                                setIsDetailModalOpen(false);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors shadow-xs"
                        >
                            Revise Quote
                        </button>
                        <button
                            onClick={() => setIsDetailModalOpen(false)}
                            className="text-muted-foreground hover:text-foreground text-xs font-semibold rounded-lg border px-3 py-1.5 hover:bg-muted"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b bg-card">
                    <div className="rounded-lg border bg-muted/5 p-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Customer Account</span>
                        <span className="text-xs font-bold text-foreground block truncate">
                            {(selectedQuote.customer_id && typeof selectedQuote.customer_id === "object") 
                                ? `${(selectedQuote.customer_id as Customer).customer_name} (${(selectedQuote.customer_id as Customer).customer_code})`
                                : `Cust ID: ${selectedQuote.customer_id}`}
                        </span>
                    </div>
                    <div className="rounded-lg border bg-muted/5 p-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Production Cost (Total)</span>
                        <span className="text-xs font-bold text-foreground block">
                            ₱{simulatedCost.toFixed(2)}
                        </span>
                    </div>
                    <div className="rounded-lg border bg-muted/5 p-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Agreed Quote Price</span>
                        <span className="text-xs font-bold text-primary block">
                            ₱{sellingPrice.toFixed(2)}
                        </span>
                    </div>
                    <div className="rounded-lg border bg-muted/5 p-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Estimated Net Margin</span>
                        <span className={`text-xs font-bold block ${netMargin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            ₱{netMargin.toFixed(2)} ({marginPct.toFixed(1)}%)
                        </span>
                    </div>
                </div>

                {/* Snapshot Contents */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loadingSnapshots ? (
                        <div className="flex justify-center items-center py-20 text-muted-foreground text-xs">
                            Loading snapshot cost sheets...
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Material costs list */}
                            <div>
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Frozen Quotation Product Rules</span>
                                <div className="border rounded-lg overflow-hidden bg-card">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead className="bg-muted/40 border-b">
                                            <tr>
                                                <th className="p-2.5 font-semibold text-muted-foreground">Product Name</th>
                                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Quantity</th>
                                                <th className="p-2.5 font-semibold text-muted-foreground">UOM</th>
                                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Frozen Base Cost</th>
                                                <th className="p-2.5 font-semibold text-muted-foreground text-right">Agreed Target Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {snapshots.map(item => {
                                                const unitCost = Number(item.frozen_unit_cost_php || 0);
                                                const totalCost = Number(item.frozen_total_cost_php || 0);
                                                return (
                                                    <tr key={item.id} className="hover:bg-muted/10">
                                                        <td className="p-2.5 font-medium text-foreground">{item.node_name}</td>
                                                        <td className="p-2.5 text-right font-medium">{item.quantity}</td>
                                                        <td className="p-2.5 text-muted-foreground">{item.uom}</td>
                                                        <td className="p-2.5 text-right font-semibold text-muted-foreground">₱{unitCost.toFixed(2)}</td>
                                                        <td className="p-2.5 text-right font-bold text-primary">₱{totalCost.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                            {snapshots.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="p-4 text-center text-muted-foreground">No frozen item records found in snapshot.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Remarks section */}
                            {selectedQuote.remarks && (
                                <div className="rounded-lg border bg-muted/5 p-4 space-y-1">
                                    <span className="text-xs font-bold text-muted-foreground uppercase block">Quotation Remarks / Notes</span>
                                    <p className="text-xs text-foreground italic">&quot;{selectedQuote.remarks}&quot;</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
