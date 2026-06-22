// src/modules/manufacturing-management/sales-return/components/ReturnDetailModal.tsx

import React from "react";
import { SalesReturn, SalesReturnDetail } from "../types";
import { X, Calendar, FileText, CornerDownLeft, Info, RefreshCw } from "lucide-react";

interface ReturnDetailModalProps {
    returnItem: SalesReturn | null;
    details: SalesReturnDetail[];
    isOpen: boolean;
    onClose: () => void;
}

export default function ReturnDetailModal({
    returnItem,
    details,
    isOpen,
    onClose
}: ReturnDetailModalProps) {
    if (!isOpen || !returnItem) return null;

    // Calculate total return value
    const totalReturnValue = details.reduce((acc, item) => acc + (item.net_amount || 0), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            {/* Main Modal Panel */}
            <div className="border bg-card rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                                <CornerDownLeft className="h-4 w-4 text-primary" />
                                Sales Return Slip Details
                            </h3>
                            <span className="text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border bg-primary/10 border-primary/20 text-primary">
                                Processed
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Slip No: {returnItem.return_number}</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground border-none cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/20 border rounded-xl p-4">
                        <div>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Customer</span>
                            <span className="text-xs font-black text-foreground mt-0.5 block truncate">
                                {returnItem.customer_name || `Customer #${returnItem.customer_id}`}
                            </span>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Return Date</span>
                            <span className="text-xs font-bold text-foreground mt-0.5 block flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {new Date(returnItem.return_date).toLocaleDateString()}
                            </span>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Created Date</span>
                            <span className="text-xs font-bold text-foreground mt-0.5 block">
                                {returnItem.created_at ? new Date(returnItem.created_at).toLocaleDateString() : "N/A"}
                            </span>
                        </div>
                        <div>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Ref Invoice ID</span>
                            <span className="text-xs font-bold text-primary mt-0.5 block flex items-center gap-1">
                                <FileText className="h-3 w-3 text-primary/70" />
                                #{returnItem.invoice_id}
                            </span>
                        </div>
                    </div>

                    {/* Return list table */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="bg-muted/30 px-4 py-2 border-b">
                            <span className="text-[9px] font-extrabold uppercase text-muted-foreground tracking-wider">Returned Products</span>
                        </div>
                        <div className="divide-y max-h-56 overflow-y-auto">
                            {details.length === 0 ? (
                                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                                    No items found for this return slip.
                                </div>
                            ) : (
                                details.map((item, index) => (
                                    <div key={index} className="px-4 py-3 flex items-center justify-between text-xs hover:bg-muted/5">
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground truncate">{item.product?.product_name || `Product #${item.product_id}`}</p>
                                            <p className="text-[9px] text-muted-foreground mt-0.5">
                                                SKU: {item.product?.product_code || "N/A"} | UOM: {item.product?.uom || "PCS"}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-black text-foreground">
                                                {item.quantity} returned @ ₱{Number(item.unit_price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </p>
                                            <p className="text-[10px] text-primary font-black mt-0.5">
                                                Credit: ₱{Number(item.net_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Credit summary panel */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex justify-between items-center text-xs">
                        <span className="text-muted-foreground uppercase tracking-wider font-bold">Total Credit Reclaimed:</span>
                        <span className="text-primary text-sm font-black">₱{totalReturnValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>

                    {/* Remarks/Reasons */}
                    {returnItem.remarks && (
                        <div className="space-y-1.5">
                            <span className="text-[9px] font-extrabold uppercase text-muted-foreground tracking-wide">Remarks & Explanations</span>
                            <div className="bg-muted/30 border rounded-xl p-4 text-xs text-muted-foreground flex gap-2">
                                <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <p className="leading-relaxed whitespace-pre-wrap">{returnItem.remarks}</p>
                            </div>
                        </div>
                    )}

                    {/* Stock replenish notification */}
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>This return slip successfully restored the returned quantity of products back to stock. The warehouse inventory levels have been replenished and the related Sales Order was updated.</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-muted/20 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-card hover:bg-muted text-muted-foreground border px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
}
