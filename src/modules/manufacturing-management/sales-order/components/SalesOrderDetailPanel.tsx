// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useState, useEffect } from "react";
import { 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    Loader2, ShieldCheck, Save, Send, Building2, 
    FileText, CreditCard, Calendar, Plus, Minus, AlertCircle 
} from "lucide-react";
import { SalesOrder, SalesOrderDetail } from "../types";

interface SalesOrderDetailPanelProps {
    selectedOrder: SalesOrder | null;
    setSelectedOrder: (order: SalesOrder | null) => void;
    orderDetails: SalesOrderDetail[];
    loadingDetails: boolean;
    updatingStatusId: number | null;
    savingQuantities?: boolean;
    handleApproveOrder: (orderId: number) => void;
    handleUpdateQuantities: (orderId: number, details: { detail_id: number; ordered_quantity: number }[]) => void;
    handleSubmitForApproval: (orderId: number) => void;
}

export function SalesOrderDetailPanel({
    selectedOrder,
    setSelectedOrder,
    orderDetails,
    loadingDetails,
    updatingStatusId,
    savingQuantities = false,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    handleApproveOrder,
    handleUpdateQuantities,
    handleSubmitForApproval
}: SalesOrderDetailPanelProps) {
    const [editableQuantities, setEditableQuantities] = useState<Record<number, number>>({});
    const [prevOrderDetails, setPrevOrderDetails] = useState<unknown[]>([]);

    if (orderDetails !== prevOrderDetails) {
        setPrevOrderDetails(orderDetails);
        if (orderDetails.length > 0) {
            const initialQtys: Record<number, number> = {};
            orderDetails.forEach(item => {
                initialQtys[item.detail_id] = item.ordered_quantity;
            });
            setEditableQuantities(initialQtys);
        } else {
            setEditableQuantities({});
        }
    }

    if (!selectedOrder) {
        return (
            <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs bg-card/50">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                Select an active Sales Order to view committed price locks, line items, and schedule details.
            </div>
        );
    }

    // Determine if any quantities have been edited
    const hasChanges = orderDetails.some(item => {
        const currentVal = editableQuantities[item.detail_id];
        const normalizedVal = currentVal === 0 ? 1 : (currentVal ?? item.ordered_quantity);
        return normalizedVal !== item.ordered_quantity;
    });

    // Compute live pricing sums for immediate feedback
    const grossSum = orderDetails.reduce((acc, item) => {
        const qty = editableQuantities[item.detail_id] !== undefined 
            ? editableQuantities[item.detail_id] 
            : item.ordered_quantity;
        return acc + (item.unit_price * (qty === 0 ? 1 : qty));
    }, 0);
    const discount = Number(selectedOrder.discount_amount || 0);
    const netSum = Math.max(0, grossSum - discount);

    const decrementQty = (detailId: number, currentVal: number) => {
        setEditableQuantities(prev => ({
            ...prev,
            [detailId]: Math.max(1, (currentVal === 0 ? 1 : currentVal) - 1)
        }));
    };

    const incrementQty = (detailId: number, currentVal: number) => {
        setEditableQuantities(prev => ({
            ...prev,
            [detailId]: (currentVal === 0 ? 1 : currentVal) + 1
        }));
    };

    const isEditable = selectedOrder.order_status === "Draft" || selectedOrder.order_status === "Pending";

    return (
        <div className="border rounded-xl bg-card p-5 shadow-sm space-y-5">
            {/* Header info */}
            <div className="flex justify-between items-start border-b pb-3.5">
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                            {selectedOrder.order_no}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            selectedOrder.order_status === "Draft"
                                ? "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                                : selectedOrder.order_status === "Pending"
                                ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                : selectedOrder.order_status === "For Approval"
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        }`}>
                            {selectedOrder.order_status}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Sales Order Details & Scope</p>
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
                            &ldquo;{selectedOrder.remarks}&rdquo;
                        </p>
                    </div>
                )}
            </div>

            {/* Line items section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">
                        Agreement Line Items
                    </h5>
                    {hasChanges && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Unsaved Changes
                        </span>
                    )}
                </div>

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
                            
                            const rawQty = editableQuantities[item.detail_id];
                            const currentQty = rawQty !== undefined ? rawQty : item.ordered_quantity;
                            const resolvedQty = currentQty === 0 ? 1 : currentQty;
                            const totalCost = item.unit_price * resolvedQty;
                            const isChanged = resolvedQty !== item.ordered_quantity;

                            return (
                                <div 
                                    key={item.detail_id} 
                                    className={`border rounded-xl p-3 bg-muted/5 flex flex-col justify-between gap-2.5 transition-all ${
                                        isChanged ? "border-amber-500/30 bg-amber-500/[0.02] shadow-xs" : "hover:bg-muted/10"
                                    }`}
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
                                        <div className="flex items-center gap-2">
                                            {isChanged && (
                                                <span className="text-[9px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold font-mono">
                                                    Was {item.ordered_quantity}
                                                </span>
                                            )}
                                            {isEditable ? (
                                                <div className="flex items-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => decrementQty(item.detail_id, currentQty)}
                                                        className="h-6 w-6 rounded-l border bg-background hover:bg-muted text-foreground flex items-center justify-center transition-all font-bold cursor-pointer"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={currentQty === 0 ? "" : currentQty}
                                                        onChange={e => {
                                                            const rawVal = e.target.value;
                                                            const parsed = parseInt(rawVal);
                                                            setEditableQuantities(prev => ({
                                                                ...prev,
                                                                [item.detail_id]: rawVal === "" ? 0 : (isNaN(parsed) ? 1 : parsed)
                                                            }));
                                                        }}
                                                        onBlur={() => {
                                                            if (currentQty < 1) {
                                                                setEditableQuantities(prev => ({
                                                                    ...prev,
                                                                    [item.detail_id]: 1
                                                                }));
                                                            }
                                                        }}
                                                        className="w-12 h-6 text-center border-y bg-background text-foreground text-xs font-mono font-bold focus:ring-0 focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => incrementQty(item.detail_id, currentQty)}
                                                        className="h-6 w-6 rounded-r border border-l-0 bg-background hover:bg-muted text-foreground flex items-center justify-center transition-all font-bold cursor-pointer"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-black text-foreground font-mono">
                                                    {item.ordered_quantity} <span className="text-[10px] text-muted-foreground font-normal">{uom}</span>
                                                </span>
                                            )}
                                        </div>
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
            <div className="space-y-2 pt-1">
                {hasChanges && (
                    <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2 text-[11px] font-semibold leading-relaxed">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                        <span>You have unsaved quantity changes. Press &quot;Allocate Inventory&quot; below to commit them.</span>
                    </div>
                )}

                {isEditable && (
                    <div className="space-y-2">
                        <button
                            disabled={savingQuantities || orderDetails.length === 0 || !hasChanges}
                            onClick={() => {
                                const detailsPayload = orderDetails.map(item => ({
                                    detail_id: item.detail_id,
                                    ordered_quantity: editableQuantities[item.detail_id] ?? item.ordered_quantity
                                }));
                                handleUpdateQuantities(selectedOrder.order_id, detailsPayload);
                            }}
                            className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer ${
                                hasChanges 
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600"
                                    : "border border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-400"
                            }`}
                            title="Transitioning to Pending will allocate items..."
                        >
                            {savingQuantities ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            Allocate Inventory
                        </button>
                        <button
                            disabled={updatingStatusId === selectedOrder.order_id || orderDetails.length === 0 || hasChanges}
                            onClick={() => handleSubmitForApproval(selectedOrder.order_id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/95 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all disabled:opacity-50 cursor-pointer"
                            title={hasChanges ? "Please save quantity edits before submitting for approval" : ""}
                        >
                            {updatingStatusId === selectedOrder.order_id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Send className="h-3.5 w-3.5" />
                            )}
                            Submit for Approval
                        </button>
                    </div>
                )}


            </div>
        </div>
    );
}
