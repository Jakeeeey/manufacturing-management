import React from "react";
import { 
    Loader2, ShieldCheck, X, Building2, 
    FileText, CreditCard, Calendar 
} from "lucide-react";
import { SalesOrder, SalesOrderDetail } from "../../sales-order/types";

interface SalesOrderApprovalDetailPanelProps {
    selectedOrder: SalesOrder | null;
    setSelectedOrder: (order: SalesOrder | null) => void;
    orderDetails: SalesOrderDetail[];
    loadingDetails: boolean;
    updatingStatusId: number | null;
    handleApprove: (orderId: number) => void;
    handleReject: (orderId: number) => void;
}

export function SalesOrderApprovalDetailPanel({
    selectedOrder,
    setSelectedOrder,
    orderDetails,
    loadingDetails,
    updatingStatusId,
    handleApprove,
    handleReject
}: SalesOrderApprovalDetailPanelProps) {
    if (!selectedOrder) {
        return (
            <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs bg-card/50">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                Select a pending Sales Order from the list to review committed prices, items, and terms.
            </div>
        );
    }

    // Compute pricing sums
    const grossSum = orderDetails.reduce((acc, item) => acc + (item.unit_price * item.ordered_quantity), 0);
    const discount = Number(selectedOrder.discount_amount || 0);
    const netSum = Math.max(0, grossSum - discount);

    return (
        <div className="border rounded-xl bg-card p-5 shadow-sm space-y-5">
            {/* Header info */}
            <div className="flex justify-between items-start border-b pb-3.5">
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                            {selectedOrder.order_no}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Pending Approval
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Review Sales Order Pricing & Scope</p>
                </div>
                <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-muted-foreground hover:text-foreground text-xs font-bold px-2 py-1 rounded-md hover:bg-muted transition-all"
                >
                    Close
                </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-4 rounded-xl border border-border">
                <div className="space-y-0.5 col-span-2">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Customer</span>
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        {selectedOrder.customer_name ? (
                            <span>
                                {selectedOrder.customer_name}{" "}
                                <span className="text-[10px] font-mono text-muted-foreground font-normal">({selectedOrder.customer_code})</span>
                            </span>
                        ) : (
                            selectedOrder.customer_code
                        )}
                    </span>
                </div>
                
                <div className="space-y-0.5">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">PO Number</span>
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedOrder.po_no || <span className="text-muted-foreground italic text-[11px]">N/A</span>}
                    </span>
                </div>

                <div className="space-y-0.5">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Payment Terms</span>
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedOrder.payment_term_name ? (
                            <span>
                                {selectedOrder.payment_term_name}
                                {selectedOrder.payment_term_days !== undefined && selectedOrder.payment_term_days !== null && (
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                        {" "}({selectedOrder.payment_term_days} Days)
                                    </span>
                                )}
                            </span>
                        ) : (
                            selectedOrder.payment_terms ? `${selectedOrder.payment_terms} Days` : "COD / Net 0"
                        )}
                    </span>
                </div>

                <div className="space-y-0.5">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Order Date</span>
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                    </span>
                </div>

                <div className="space-y-0.5">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Delivery Date</span>
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : <span className="text-muted-foreground italic text-[11px]">N/A</span>}
                    </span>
                </div>

                {selectedOrder.remarks && (
                    <div className="space-y-0.5 col-span-2 pt-2.5 border-t border-dashed mt-1">
                        <span className="text-muted-foreground block text-[10px] font-bold uppercase tracking-wider">Remarks / Notes</span>
                        <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                            "{selectedOrder.remarks}"
                        </p>
                    </div>
                )}
            </div>

            {/* Line items section */}
            <div className="space-y-3">
                <h5 className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">
                    Agreement Line Items
                </h5>

                {loadingDetails ? (
                    <div className="flex flex-col items-center justify-center p-8 gap-1.5 border border-dashed rounded-xl bg-card">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-[10px] text-muted-foreground">Fetching agreement items...</span>
                    </div>
                ) : orderDetails.length === 0 ? (
                    <div className="text-center p-6 border border-dashed rounded-xl bg-card text-xs text-muted-foreground">
                        No items logged in detail.
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {orderDetails.map(item => {
                            const pId = item.product_id;
                            const name = pId?.product_name || `Product #${item.product_id}`;
                            const code = pId?.product_code || `CODE-${item.product_id}`;
                            const brand = pId?.brand || "N/A";
                            const category = pId?.category || "N/A";
                            const uom = pId?.uom || "PCS";
                            const totalCost = item.unit_price * item.ordered_quantity;

                            return (
                                <div 
                                    key={item.detail_id} 
                                    className="border rounded-xl p-3 bg-muted/5 flex flex-col justify-between gap-2.5 hover:bg-muted/10 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-1.5">
                                        <div className="space-y-1">
                                            <div className="text-xs font-bold text-foreground leading-snug">{name}</div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[9px] font-mono bg-muted border px-1.5 py-0.2 rounded text-muted-foreground uppercase font-semibold">
                                                    {code}
                                                </span>
                                                {brand !== "N/A" && (
                                                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold">
                                                        {brand}
                                                    </span>
                                                )}
                                                {category !== "N/A" && (
                                                    <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground font-semibold">
                                                        {category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-black text-primary font-mono">
                                                ₱{totalCost.toFixed(2)}
                                            </div>
                                            <div className="text-[9px] text-muted-foreground font-medium mt-0.5">
                                                ₱{item.unit_price.toFixed(2)} / {uom}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-dashed">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                            Quantity
                                        </span>
                                        <span className="text-xs font-black text-foreground font-mono">
                                            {item.ordered_quantity} <span className="text-[10px] text-muted-foreground font-normal">{uom}</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Financial Breakdown card */}
            <div className="bg-muted/30 border rounded-xl p-4 space-y-2.5 shadow-inner">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-semibold">Subtotal Gross</span>
                    <span className="font-bold text-foreground font-mono">
                        ₱{grossSum.toFixed(2)}
                    </span>
                </div>
                {selectedOrder.discount_amount ? (
                    <div className="flex justify-between items-center text-xs text-rose-600 dark:text-rose-400">
                        <span className="font-semibold">Discount</span>
                        <span className="font-bold font-mono">
                            - ₱{discount.toFixed(2)}
                        </span>
                    </div>
                ) : null}
                <div className="border-t border-dashed my-2 pt-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Net Amount Locked
                    </span>
                    <span className="text-sm font-black text-primary font-mono bg-primary/5 px-2.5 py-1 rounded border border-primary/25">
                        ₱{netSum.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-1">
                <button
                    disabled={updatingStatusId === selectedOrder.order_id}
                    onClick={() => handleApprove(selectedOrder.order_id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                    {updatingStatusId === selectedOrder.order_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <ShieldCheck className="h-4 w-4" />
                    )}
                    Approve & Release to Floor
                </button>
                <button
                    disabled={updatingStatusId === selectedOrder.order_id}
                    onClick={() => handleReject(selectedOrder.order_id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 dark:border-rose-950 dark:hover:bg-rose-950/20 py-2.5 text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                    {updatingStatusId === selectedOrder.order_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <X className="h-4 w-4" />
                    )}
                    Reject & Return to Draft
                </button>
            </div>
        </div>
    );
}
