import React from "react";
import { ClipboardList, Play, CheckSquare, Square } from "lucide-react";
import { SalesOrder, SalesOrderDetail } from "../types";

interface ReleasedSalesOrdersTableProps {
    salesOrders: SalesOrder[];
    handleSelectSO: (so: SalesOrder) => void;
    soDetailsMap: Record<number, SalesOrderDetail[]>;
    selectedIds: number[];
    onToggleOrder: (orderId: number) => void;
    onToggleAll: () => void;
}

export function ReleasedSalesOrdersTable({
    salesOrders,
    handleSelectSO,
    soDetailsMap,
    selectedIds,
    onToggleOrder,
    onToggleAll
}: ReleasedSalesOrdersTableProps) {
    if (salesOrders.length === 0) {
        return (
            <div className="text-center p-12 border rounded-xl bg-card">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">No Released Orders Found</h4>
                <p className="text-[11px] text-muted-foreground mt-1">Released and approved Sales Orders appear here for Operations scheduling.</p>
            </div>
        );
    }

    const allSelected = salesOrders.length > 0 && salesOrders.every(so => selectedIds.includes(so.order_id));

    return (
        <div className="overflow-visible border rounded-xl bg-card shadow-sm">
            <table className="w-full border-collapse text-left text-xs table-fixed">
                <thead className="bg-muted/50 border-b text-muted-foreground">
                    <tr>
                        <th className="p-3 w-16 text-center font-semibold uppercase">
                            <button
                                type="button"
                                onClick={onToggleAll}
                                title="Toggle Select All on Page"
                                className="inline-flex items-center justify-center p-1 hover:bg-muted rounded-md text-primary bg-transparent border-none cursor-pointer"
                            >
                                {allSelected ? (
                                    <CheckSquare className="h-4.5 w-4.5 text-primary fill-primary/10" />
                                ) : (
                                    <Square className="h-4.5 w-4.5 text-muted-foreground/50" />
                                )}
                            </button>
                        </th>
                        <th className="p-3 w-1/3 font-semibold uppercase">Order No</th>
                        <th className="p-3 w-1/3 font-semibold uppercase">Customer</th>
                        <th className="p-3 w-28 font-semibold uppercase text-center">Schedule</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {salesOrders.map(so => {
                        const details = soDetailsMap[so.order_id] || [];
                        const isChecked = selectedIds.includes(so.order_id);

                        return (
                            <tr key={so.order_id} className={`hover:bg-muted/30 transition-colors group relative ${isChecked ? 'bg-primary/5' : ''}`}>
                                <td className="p-3 text-center">
                                    <button
                                        type="button"
                                        onClick={() => onToggleOrder(so.order_id)}
                                        className="inline-flex items-center justify-center p-1 hover:bg-muted rounded-md text-primary bg-transparent border-none cursor-pointer"
                                    >
                                        {isChecked ? (
                                            <CheckSquare className="h-4.5 w-4.5 text-primary fill-primary/10" />
                                        ) : (
                                            <Square className="h-4.5 w-4.5 text-muted-foreground/50" />
                                        )}
                                    </button>
                                </td>
                                <td className="p-3 font-bold text-foreground relative overflow-visible">
                                    <span className="cursor-help border-b border-dotted border-muted-foreground/50 pb-0.5">
                                        {so.order_no}
                                    </span>
                                    
                                    {/* Hover Card Popup */}
                                    <div className="hidden group-hover:block absolute left-3/4 top-1/2 -translate-y-1/2 ml-4 z-50 bg-card border rounded-xl shadow-2xl p-4 w-72 pointer-events-none text-left animate-in fade-in slide-in-from-left-2 duration-150">
                                        <div className="flex justify-between items-center border-b pb-1.5 mb-2.5">
                                            <span className="font-extrabold text-[10px] text-primary uppercase tracking-wider">Line Items ({details.length})</span>
                                            <span className="text-[9px] text-muted-foreground font-bold">{so.order_no}</span>
                                        </div>
                                        {details.length === 0 ? (
                                            <span className="text-[10px] text-muted-foreground block py-1">No items or loading details...</span>
                                        ) : (
                                            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                                                {details.map(d => (
                                                    <div key={d.detail_id} className="text-[11px] border-b border-muted last:border-0 pb-2 last:pb-0">
                                                        <span className="font-extrabold text-foreground block text-xs leading-tight">
                                                            {d.product_id?.product_name || `Product #${d.product_id}`}
                                                        </span>
                                                        <div className="flex flex-wrap gap-x-1.5 text-[9px] text-muted-foreground font-semibold mt-0.5">
                                                            <span>Brand: <strong className="text-foreground">{d.product_id?.brand || "N/A"}</strong></span>
                                                            <span>•</span>
                                                            <span>Category: <strong className="text-foreground">{d.product_id?.category || "N/A"}</strong></span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-muted-foreground font-bold mt-1">
                                                            <span>SKU: {d.product_id?.product_code || "N/A"} (Count: {d.product_id?.uom_count || 1})</span>
                                                            <span className="text-primary font-extrabold">Qty: {d.ordered_quantity} {d.product_id?.uom || "PCS"}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-3 font-semibold text-foreground">{so.customer_name || so.customer_code}</td>
                                <td className="p-3 text-center">
                                    <button
                                        onClick={() => handleSelectSO(so)}
                                        className="inline-flex items-center gap-1 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer border-none"
                                    >
                                        Schedule JO
                                        <Play className="h-3 w-3" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
