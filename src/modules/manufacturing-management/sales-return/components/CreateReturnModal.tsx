// src/modules/manufacturing-management/sales-return/components/CreateReturnModal.tsx

import React, { useState, useEffect } from "react";
import { PendingInvoiceForReturn } from "../types";
import { X, Calendar, FileText, CornerDownLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CreateReturnModalProps {
    invoice: PendingInvoiceForReturn;
    invoiceDetails: any[];
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: any) => Promise<boolean>;
}

export default function CreateReturnModal({
    invoice,
    invoiceDetails,
    isOpen,
    onClose,
    onSubmit
}: CreateReturnModalProps) {
    const [returnNo, setReturnNo] = useState("");
    const [returnDate, setReturnDate] = useState("");
    const [remarks, setRemarks] = useState("");
    
    // Returned quantities map
    const [returnedQtys, setReturnedQtys] = useState<Record<number, number>>({});
    const [returnReasons, setReturnReasons] = useState<Record<number, string>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (invoice) {
            const randNo = Math.floor(1000 + Math.random() * 9000);
            setReturnNo(`RET-${invoice.invoice_no.replace("INV-", "") || randNo}`);
            
            const today = new Date().toISOString().split("T")[0];
            setReturnDate(today);
            
            setRemarks(`Returns for Invoice ${invoice.invoice_no}`);
            
            // Default 0 returned quantity
            const qtys: Record<number, number> = {};
            const reasons: Record<number, string> = {};
            invoiceDetails.forEach(item => {
                const prodId = item.product_id?.product_id || item.product_id;
                qtys[prodId] = 0;
                reasons[prodId] = "Defective";
            });
            setReturnedQtys(qtys);
            setReturnReasons(reasons);
        }
    }, [invoice, invoiceDetails]);

    if (!isOpen || !invoice) return null;

    const handleQtyChange = (prodId: number, maxQty: number, val: number) => {
        const parsedVal = Math.max(0, Math.min(maxQty, val));
        setReturnedQtys(prev => ({
            ...prev,
            [prodId]: parsedVal
        }));
    };

    const handleReasonChange = (prodId: number, reason: string) => {
        setReturnReasons(prev => ({
            ...prev,
            [prodId]: reason
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Filter out items that have 0 return quantity
        const itemsToReturn = invoiceDetails
            .map(item => {
                const prodId = item.product_id?.product_id || item.product_id;
                const qty = returnedQtys[prodId] || 0;
                return {
                    product_id: prodId,
                    quantity: qty,
                    unit_price: item.unit_price || item.base_unit_cost_php || 0,
                    reason: returnReasons[prodId] || "Defective"
                };
            })
            .filter(item => item.quantity > 0);

        if (itemsToReturn.length === 0) {
            toast.error("Please enter a return quantity greater than 0 for at least one item.");
            return;
        }

        setSubmitting(true);
        const payload = {
            invoice_id: invoice.invoice_id,
            return_number: returnNo,
            return_date: returnDate,
            customer_id: 1, // Fallback/default customer mapping
            remarks: `${remarks}. Reasons: ${itemsToReturn.map(i => `${i.product_id}: ${i.reason}`).join(", ")}`,
            items: itemsToReturn
        };

        const success = await onSubmit(payload);
        setSubmitting(false);
        if (success) {
            onClose();
        }
    };

    // Calculate total refund/credit value
    const totalRefund = invoiceDetails.reduce((acc, item) => {
        const prodId = item.product_id?.product_id || item.product_id;
        const qty = returnedQtys[prodId] || 0;
        const price = item.unit_price || item.base_unit_cost_php || 0;
        return acc + (qty * price);
    }, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="border bg-card rounded-2xl w-full max-w-3xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h3 className="text-sm font-black text-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <CornerDownLeft className="h-4 w-4 text-primary" />
                            Log Customer Sales Return
                        </h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Invoice: {invoice.invoice_no} ({invoice.customer_name})</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground border-none cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Return Code */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-extrabold uppercase text-muted-foreground">Return Slip Code</label>
                            <input
                                required
                                type="text"
                                value={returnNo}
                                onChange={(e) => setReturnNo(e.target.value)}
                                className="w-full bg-muted/40 border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            />
                        </div>

                        {/* Return Date */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-extrabold uppercase text-muted-foreground">Return Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    required
                                    type="date"
                                    value={returnDate}
                                    onChange={(e) => setReturnDate(e.target.value)}
                                    className="pl-9 w-full bg-muted/40 border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Invoice items return limits table */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="bg-muted/30 px-4 py-2 border-b">
                            <span className="text-[9px] font-extrabold uppercase text-muted-foreground tracking-wider">Select Quantities to Return</span>
                        </div>
                        <div className="divide-y max-h-56 overflow-y-auto">
                            {invoiceDetails.map((item, index) => {
                                const prodId = item.product_id?.product_id || item.product_id;
                                const maxQty = item.quantity || item.ordered_quantity || 1;
                                const currentQty = returnedQtys[prodId] || 0;
                                return (
                                    <div key={index} className="px-4 py-3 grid grid-cols-12 gap-3 items-center text-xs hover:bg-muted/5">
                                        <div className="col-span-5 min-w-0">
                                            <p className="font-bold text-foreground truncate">{item.product_id?.product_name || `Product #${item.product_id}`}</p>
                                            <p className="text-[9px] text-muted-foreground mt-0.5">
                                                Invoiced: {maxQty} | Price: ₱{Number(item.unit_price || 0).toLocaleString()}
                                            </p>
                                        </div>
                                        {/* Qty Input */}
                                        <div className="col-span-3 flex items-center gap-1.5">
                                            <span className="text-[9px] text-muted-foreground shrink-0">Return:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max={maxQty}
                                                value={currentQty}
                                                onChange={(e) => handleQtyChange(prodId, maxQty, parseInt(e.target.value) || 0)}
                                                className="w-full bg-background border border-input rounded-lg px-2 py-1 text-xs text-right outline-none"
                                            />
                                        </div>
                                        {/* Reason selection */}
                                        <div className="col-span-4">
                                            <select
                                                value={returnReasons[prodId] || "Defective"}
                                                onChange={(e) => handleReasonChange(prodId, e.target.value)}
                                                className="w-full bg-background border border-input rounded-lg px-2 py-1 text-xs outline-none"
                                            >
                                                <option value="Defective">Defective</option>
                                                <option value="Damaged Cargo">Damaged Cargo</option>
                                                <option value="Wrong Product SKU">Wrong Product SKU</option>
                                                <option value="Customer Rejection">Customer Rejection</option>
                                            </select>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Calculated credit */}
                    <div className="bg-muted/20 border rounded-xl p-4 flex justify-between items-center text-xs">
                        <span className="text-muted-foreground uppercase tracking-wider font-bold">Total Sales Return Value:</span>
                        <span className="text-primary text-sm font-black">₱{totalRefund.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>

                    {/* Remarks */}
                    <div className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase text-muted-foreground">Log Return Remarks</label>
                        <textarea
                            rows={2}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="State reason for returns log..."
                            className="w-full bg-muted/40 border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-muted/20 flex justify-between items-center shrink-0">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        This will automatically replenish warehouse stock.
                    </span>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-card hover:bg-muted text-muted-foreground border px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={submitting}
                            onClick={handleSubmit}
                            className="bg-primary hover:bg-primary/95 text-primary-foreground border-none px-5 py-2 rounded-xl text-xs font-black shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                        >
                            {submitting ? "Processing..." : "Process Return Slip"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
