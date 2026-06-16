import React from "react";
import { DollarSign, Eye, Check, Loader2 } from "lucide-react";
import { SalesOrder } from "../types";

interface ActiveSalesOrdersTableProps {
    salesOrders: SalesOrder[];
    updatingStatusId: number | null;
    viewOrderDetails: (so: SalesOrder) => void;
    handleApproveOrder: (orderId: number) => void;
}

export function ActiveSalesOrdersTable({
    salesOrders,
    updatingStatusId,
    viewOrderDetails,
    handleApproveOrder
}: ActiveSalesOrdersTableProps) {
    if (salesOrders.length === 0) {
        return (
            <div className="text-center p-12 border rounded-xl bg-card">
                <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">No Sales Orders Logged</h4>
                <p className="text-[11px] text-muted-foreground mt-1">Convert winning quotes from the pipeline to launch Sales Orders.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border rounded-xl bg-card shadow-sm">
            <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-3 font-semibold text-muted-foreground uppercase">Order No</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase">Order Date</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Selling Total</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Status</th>
                        <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {salesOrders.map(so => (
                        <tr key={so.order_id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-bold text-foreground">{so.order_no}</td>
                            <td className="p-3 font-semibold text-foreground">{so.customer_code}</td>
                            <td className="p-3 text-muted-foreground">{so.order_date}</td>
                            <td className="p-3 text-right font-bold text-primary">₱{(Number(so.total_amount) || 0).toFixed(2)}</td>
                            <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    so.order_status === "Draft"
                                        ? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                                        : so.order_status === "For Approval"
                                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                        : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                }`}>
                                    {so.order_status}
                                </span>
                            </td>
                            <td className="p-3 text-center flex items-center justify-center gap-1.5">
                                <button
                                    onClick={() => viewOrderDetails(so)}
                                    className="inline-flex items-center justify-center p-1 rounded-md border hover:bg-muted text-muted-foreground transition-all"
                                    title="View Line Items"
                                >
                                    <Eye className="h-4 w-4" />
                                </button>
                                {so.order_status === "For Approval" && (
                                    <button
                                        disabled={updatingStatusId === so.order_id}
                                        onClick={() => handleApproveOrder(so.order_id)}
                                        className="inline-flex items-center justify-center p-1 rounded-md border border-emerald-200 hover:bg-emerald-50 text-emerald-600 transition-all"
                                        title="Approve Order"
                                    >
                                        {updatingStatusId === so.order_id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Check className="h-4 w-4" />
                                        )}
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
