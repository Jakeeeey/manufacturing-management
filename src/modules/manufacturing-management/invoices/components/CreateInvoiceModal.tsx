// src/modules/manufacturing-management/invoices/components/CreateInvoiceModal.tsx

import React, { useState, useEffect } from "react";
import { PendingSalesOrder, InvoiceLineItem } from "../types";
import { X, Calendar, DollarSign, FileText, Percent, AlertCircle } from "lucide-react";

interface CreateInvoiceModalProps {
    order: PendingSalesOrder;
    orderDetails: any[];
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: any) => Promise<boolean>;
    existingInvoiceNos: string[];
}

export default function CreateInvoiceModal({
    order,
    orderDetails,
    isOpen,
    onClose,
    onSubmit,
    existingInvoiceNos
}: CreateInvoiceModalProps) {
    const [invoiceNo, setInvoiceNo] = useState("");
    const [invoiceDate, setInvoiceDate] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [discountAmount, setDiscountAmount] = useState(0);
    const [remarks, setRemarks] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const isDuplicate = existingInvoiceNos.some(
        (no) => no.trim().toLowerCase() === invoiceNo.trim().toLowerCase()
    );

    // Default pre-fill values when order changes
    useEffect(() => {
        if (order) {
            const randNo = Math.floor(1000 + Math.random() * 9000);
            setInvoiceNo(`INV-${order.order_no.replace("SO-", "") || randNo}`);
            
            const today = new Date().toISOString().split("T")[0];
            setInvoiceDate(today);

            // Default 30 days due date
            const thirtyDays = new Date();
            thirtyDays.setDate(thirtyDays.getDate() + 30);
            setDueDate(thirtyDays.toISOString().split("T")[0]);
            
            setDiscountAmount(0);
            setRemarks(`Billing for Sales Order ${order.order_no}`);
        }
    }, [order]);

    if (!isOpen || !order) return null;

    const subtotal = orderDetails.reduce((acc, item) => acc + Number(item.net_amount || 0), 0);
    const vatRate = 0.12; // 12% VAT standard
    const calculatedVat = subtotal * vatRate;
    const finalAmount = subtotal + calculatedVat - discountAmount;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoiceNo.trim()) return;

        if (isDuplicate) {
            alert("This Invoice Reference Number is already in use. Please enter a unique invoice number.");
            return;
        }

        setSubmitting(true);
        const payload = {
            invoice_no: invoiceNo,
            invoice_date: new Date(invoiceDate).toISOString(),
            due_date: new Date(dueDate).toISOString(),
            customer_id: 1, // Fallback/default customer ID or resolved ID
            customer_code: order.customer_code,
            sales_order_id: order.order_id,
            total_amount: subtotal,
            discount_amount: discountAmount,
            vat_amount: calculatedVat,
            net_amount: finalAmount,
            remarks: remarks,
            items: orderDetails.map((item) => ({
                product_id: item.product_id?.product_id || item.product_id,
                quantity: item.ordered_quantity,
                unit_price: item.unit_price,
                net_amount: item.net_amount
            }))
        };

        const success = await onSubmit(payload);
        setSubmitting(false);
        if (success) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="border bg-card rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h3 className="text-sm font-black text-foreground uppercase tracking-wide">Generate Sales Invoice</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Billing reference: {order.order_no} ({order.customer_name})</p>
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
                        {/* Invoice Number */}
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Invoice Reference Number</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    required
                                    type="text"
                                    value={invoiceNo}
                                    onChange={(e) => setInvoiceNo(e.target.value)}
                                    placeholder="INV-XXXX"
                                    className={`pl-9 w-full bg-background border rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none ${
                                        isDuplicate 
                                            ? "border-rose-500 focus:border-rose-500 text-rose-500" 
                                            : "border-input focus:border-primary text-foreground"
                                    }`}
                                />
                            </div>
                            {isDuplicate && (
                                <p className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    This Invoice Reference Number is already in use. Please enter a unique number.
                                </p>
                            )}
                        </div>

                        {/* Dates */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Invoice Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    required
                                    type="date"
                                    value={invoiceDate}
                                    onChange={(e) => setInvoiceDate(e.target.value)}
                                    className="pl-9 w-full bg-muted/40 border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Payment Due Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    required
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="pl-9 w-full bg-muted/40 border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Order Details Preview */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="bg-muted/30 px-4 py-2 border-b">
                            <span className="text-[9px] font-extrabold uppercase text-muted-foreground tracking-wider">Order Items Summary</span>
                        </div>
                        <div className="divide-y max-h-40 overflow-y-auto">
                            {orderDetails.map((item, index) => (
                                <div key={index} className="px-4 py-2 flex items-center justify-between text-xs">
                                    <div className="min-w-0">
                                        <p className="font-bold text-foreground truncate">{item.product_id?.product_name || `Product #${item.product_id}`}</p>
                                        <p className="text-[9px] text-muted-foreground mt-0.5">
                                            Code: {item.product_id?.product_code || "N/A"} | UOM: {item.product_id?.uom || "PCS"}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black text-foreground">{item.ordered_quantity} × ₱{Number(item.unit_price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                        <p className="text-[9px] text-emerald-600 font-bold mt-0.5">₱{Number(item.net_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calculations */}
                    <div className="bg-muted/20 border rounded-xl p-4 space-y-2.5">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Subtotal Gross:</span>
                            <span className="font-bold">₱{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">VAT (12%):</span>
                            <span className="font-bold">₱{calculatedVat.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between text-xs items-center">
                            <span className="text-muted-foreground flex items-center gap-1">
                                Discount Override:
                                <Percent className="h-3 w-3 text-muted-foreground/60" />
                            </span>
                            <input
                                type="number"
                                min="0"
                                value={discountAmount}
                                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                                className="w-24 text-right bg-background border border-input rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                        <div className="border-t pt-2.5 flex justify-between text-sm font-black">
                            <span className="text-foreground uppercase tracking-wider">Total Net Amount:</span>
                            <span className="text-primary text-base font-black">₱{finalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold uppercase text-muted-foreground">Remarks / Invoice Comments</label>
                        <textarea
                            rows={2}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Add invoice billing details or delivery reference notes..."
                            className="w-full bg-muted/40 border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                        />
                    </div>
                </form>

                {/* Footer buttons */}
                <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between gap-3">
                    <span className="text-[9px] text-muted-foreground flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        This will mark the Sales Order as For Loading.
                    </span>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-card hover:bg-muted text-muted-foreground border px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            disabled={submitting || isDuplicate}
                            type="submit"
                            onClick={handleSubmit}
                            className="bg-primary hover:bg-primary/95 text-primary-foreground border-none px-5 py-2 rounded-xl text-xs font-black shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
                        >
                            {submitting ? "Saving..." : "Confirm & Save Invoice"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
