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
        <div className="border border-slate-200/80 rounded-2xl bg-card p-6 shadow-sm space-y-6 border-t-2 border-t-amber-600">
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                            {selectedOrder.order_no}
                        </h4>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider bg-amber-50 text-amber-705 border border-amber-200/60 whitespace-nowrap">
                            Pending Approval
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Review Sales Order Pricing & Scope</p>
                </div>
                <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer border-none bg-transparent"
                >
                    Close
                </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3.5 bg-slate-50/50 p-4.5 rounded-xl border border-slate-200/60 text-xs">
                <div className="space-y-1 col-span-2">
                    <span className="text-slate-400 block text-[9.5px] font-bold uppercase tracking-wider">Customer</span>
                    <span className="font-extrabold text-slate-800 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-amber-500" />
                        {selectedOrder.customer_name ? (
                            <span>
                                {selectedOrder.customer_name}{" "}
                                <span className="text-[9.5px] font-mono text-slate-400 font-normal">({selectedOrder.customer_code})</span>
                            </span>
                        ) : (
                            selectedOrder.customer_code
                        )}
                    </span>
                </div>
                
                <div className="space-y-1">
                    <span className="text-slate-400 block text-[9.5px] font-bold uppercase tracking-wider">PO Number</span>
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        {selectedOrder.po_no || <span className="text-slate-400 italic font-normal">N/A</span>}
                    </span>
                </div>

                <div className="space-y-1">
                    <span className="text-slate-400 block text-[9.5px] font-bold uppercase tracking-wider">Payment Terms</span>
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-slate-400" />
                        {selectedOrder.payment_term_name ? (
                            <span className="truncate">
                                {selectedOrder.payment_term_name}
                                {selectedOrder.payment_term_days !== undefined && selectedOrder.payment_term_days !== null && (
                                    <span className="text-[9.5px] text-slate-400 font-normal">
                                        {" "}({selectedOrder.payment_term_days}d)
                                    </span>
                                )}
                            </span>
                        ) : (
                            selectedOrder.payment_terms ? `${selectedOrder.payment_terms} Days` : "COD"
                        )}
                    </span>
                </div>

                <div className="space-y-1">
                    <span className="text-slate-400 block text-[9.5px] font-bold uppercase tracking-wider">Order Date</span>
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                    </span>
                </div>

                <div className="space-y-1">
                    <span className="text-slate-400 block text-[9.5px] font-bold uppercase tracking-wider">Delivery Date</span>
                    <span className="font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : <span className="text-slate-400 italic font-normal">N/A</span>}
                    </span>
                </div>

                {selectedOrder.remarks && (
                    <div className="space-y-1 col-span-2 pt-3 border-t border-slate-200/60 border-dashed mt-1.5">
                        <span className="text-slate-400 block text-[9.5px] font-bold uppercase tracking-wider">Remarks / Notes</span>
                        <p className="text-[11px] text-slate-500 leading-relaxed italic">
                            &ldquo;{selectedOrder.remarks}&rdquo;
                        </p>
                    </div>
                )}
            </div>

            {/* Line items section */}
            <div className="space-y-3.5">
                <h5 className="text-[9.5px] font-extrabold uppercase text-slate-400 tracking-wider">
                    Agreement Line Items
                </h5>

                {loadingDetails ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-2 border border-dashed rounded-xl bg-slate-50/50">
                        <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                        <span className="text-[10px] text-muted-foreground font-semibold">Fetching agreement items...</span>
                    </div>
                ) : orderDetails.length === 0 ? (
                    <div className="text-center p-8 border border-dashed rounded-xl bg-slate-50/50 text-xs text-muted-foreground italic">
                        No items logged in detail.
                    </div>
                ) : (
                    <div className="space-y-3">
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
                                    className="border border-slate-200/80 rounded-xl p-4 bg-white flex flex-col justify-between gap-3 hover:border-slate-350 hover:shadow-xs transition-all duration-200"
                                >
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="space-y-1.5">
                                            <div className="text-xs font-bold text-slate-800 leading-snug">{name}</div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[9px] font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-slate-600 uppercase font-semibold">
                                                    {code}
                                                </span>
                                                {brand !== "N/A" && (
                                                    <span className="text-[9px] bg-indigo-500/10 text-indigo-650 px-1.5 py-0.2 rounded font-semibold">
                                                        {brand}
                                                    </span>
                                                )}
                                                {category !== "N/A" && (
                                                    <span className="text-[9px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-500 font-semibold">
                                                        {category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs font-black text-slate-900 font-mono">
                                                ₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                                                ₱{item.unit_price.toFixed(2)} / {uom}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 border-dashed">
                                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider">
                                            Quantity
                                        </span>
                                        <span className="text-xs font-extrabold text-slate-850 font-mono">
                                            {item.ordered_quantity} <span className="text-[10px] text-slate-400 font-normal">{uom}</span>
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Financial Breakdown card */}
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4.5 space-y-3 shadow-md relative overflow-hidden">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Subtotal Gross</span>
                    <span className="font-bold font-mono">
                        ₱{grossSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>
                {selectedOrder.discount_amount ? (
                    <div className="flex justify-between items-center text-xs text-rose-400">
                        <span className="font-medium">Discount Code</span>
                        <span className="font-bold font-mono">
                            - ₱{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                ) : null}
                <div className="border-t border-slate-800 my-2 pt-3 flex justify-between items-center">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                        Net Amount Locked
                    </span>
                    <span className="text-sm font-black text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        ₱{netSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>
                {/* Visual decoration inside the breakdown card */}
                <div className="absolute right-0 bottom-0 -mb-6 -mr-6 w-16 h-16 bg-emerald-500/5 rounded-full blur-lg"></div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5 pt-1">
                <button
                    disabled={updatingStatusId === selectedOrder.order_id}
                    onClick={() => handleApprove(selectedOrder.order_id)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-xs font-black text-white shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/25 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 border-none"
                >
                    {updatingStatusId === selectedOrder.order_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <ShieldCheck className="h-4 w-4 stroke-[3]" />
                    )}
                    Approve & Release to Floor
                </button>
                <button
                    disabled={updatingStatusId === selectedOrder.order_id}
                    onClick={() => handleReject(selectedOrder.order_id)}
                    className="w-full inline-flex items-center justify-semibold gap-2 rounded-xl border border-rose-250 bg-white hover:bg-rose-50/50 text-rose-700 py-3 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                    {updatingStatusId === selectedOrder.order_id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-rose-700" />
                    ) : (
                        <X className="h-4 w-4 stroke-[3]" />
                    )}
                    Reject & Return to Draft
                </button>
            </div>
        </div>
    );
}
