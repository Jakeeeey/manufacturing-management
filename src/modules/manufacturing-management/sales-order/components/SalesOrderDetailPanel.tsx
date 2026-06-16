import React, { useState, useEffect } from "react";
import { Loader2, ShieldCheck, Save, Send } from "lucide-react";
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
    handleApproveOrder,
    handleUpdateQuantities,
    handleSubmitForApproval
}: SalesOrderDetailPanelProps) {
    const [editableQuantities, setEditableQuantities] = useState<Record<number, number>>({});

    const [prevOrderDetails, setPrevOrderDetails] = useState<SalesOrderDetail[]>(orderDetails);
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
            <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs">
                Select an active Sales Order to view committed price locks and versions.
            </div>
        );
    }

    return (
        <div className="border rounded-xl bg-card p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
                <div>
                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">SO Details Panel</h4>
                    <p className="text-[10px] text-muted-foreground">Order: {selectedOrder.order_no}</p>
                </div>
                <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-muted-foreground hover:text-foreground text-xs font-semibold"
                >
                    Close
                </button>
            </div>

            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px] border bg-muted/10 p-3 rounded-lg">
                    <div>
                        <span className="text-muted-foreground block font-bold uppercase text-[9px]">Customer Code</span>
                        <span className="font-bold text-foreground">{selectedOrder.customer_code}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground block font-bold uppercase text-[9px]">Order Status</span>
                        <span className="font-bold text-primary">{selectedOrder.order_status}</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t mt-2">
                        <span className="text-muted-foreground block font-bold uppercase text-[9px]">Total Target Amount</span>
                        <span className="font-extrabold text-primary text-sm">₱{Number(selectedOrder.total_amount).toFixed(2)}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <h5 className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider">Agreement Line Items</h5>
                    {loadingDetails ? (
                        <div className="flex justify-center p-6">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                    ) : orderDetails.length === 0 ? (
                        <div className="text-center p-4 text-xs text-muted-foreground">No items logged in detail.</div>
                    ) : (
                        <div className="space-y-2">
                            {orderDetails.map(item => {
                                const name = item.product_id?.product_name || `Product ID: ${item.product_id}`;
                                const currentQty = editableQuantities[item.detail_id] !== undefined 
                                    ? editableQuantities[item.detail_id] 
                                    : item.ordered_quantity;
                                const totalCost = item.unit_price * currentQty;

                                return (
                                    <div key={item.detail_id} className="border rounded-lg p-2.5 bg-muted/5 flex items-start justify-between">
                                        <div className="space-y-0.5 flex-1 mr-2">
                                            <span className="text-xs font-bold text-foreground block">{name}</span>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                Qty: 
                                                {(selectedOrder.order_status === "Draft" || selectedOrder.order_status === "Pending") ? (
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={editableQuantities[item.detail_id] ?? ""}
                                                        onChange={e => setEditableQuantities(prev => ({ 
                                                            ...prev, 
                                                            [item.detail_id]: Math.max(1, parseInt(e.target.value) || 1) 
                                                        }))}
                                                        className="w-16 rounded border border-slate-700 bg-slate-900/50 text-white text-center text-[10px] py-0.5 px-1 inline-block mx-1 font-mono focus:ring-1 focus:ring-primary outline-none"
                                                    />
                                                ) : (
                                                    <strong className="text-foreground">{item.ordered_quantity}</strong>
                                                )}
                                                @ ₱{item.unit_price.toFixed(2)}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-primary">₱{totalCost.toFixed(2)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {(selectedOrder.order_status === "Draft" || selectedOrder.order_status === "Pending") && (
                    <div className="space-y-2 pt-2">
                        <button
                            disabled={savingQuantities || orderDetails.length === 0}
                            onClick={() => {
                                const detailsPayload = orderDetails.map(item => ({
                                    detail_id: item.detail_id,
                                    ordered_quantity: editableQuantities[item.detail_id] ?? item.ordered_quantity
                                }));
                                handleUpdateQuantities(selectedOrder.order_id, detailsPayload);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-800 py-2 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50"
                        >
                            {savingQuantities ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            Save Quantities
                        </button>
                        <button
                            disabled={updatingStatusId === selectedOrder.order_id || orderDetails.length === 0}
                            onClick={() => handleSubmitForApproval(selectedOrder.order_id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/95 py-2 text-xs font-bold text-primary-foreground shadow-md transition-all disabled:opacity-50"
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

                {selectedOrder.order_status === "For Approval" && (
                    <button
                        disabled={updatingStatusId === selectedOrder.order_id}
                        onClick={() => handleApproveOrder(selectedOrder.order_id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-bold text-white shadow-md transition-all"
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Approve & Release to Floor
                    </button>
                )}
            </div>
        </div>
    );
}
