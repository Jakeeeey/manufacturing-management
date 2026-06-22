"use client";

import React from "react";
import { X, ShieldCheck, Printer } from "lucide-react";

interface CompletedReceiptItem {
    joId: string;
    branchId: number | string;
    productName: string;
    lotNumber: string;
    expirationDate: string;
    quantityProduced: number;
    unitCost: number;
}

interface FinishedGoodsReceiptModalProps {
    completedReceipt: CompletedReceiptItem[] | null;
    onClose: () => void;
    onPrint: (receipts: CompletedReceiptItem[]) => void;
}

export function FinishedGoodsReceiptModal({
    completedReceipt,
    onClose,
    onPrint
}: FinishedGoodsReceiptModalProps) {
    if (!completedReceipt) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                {/* Header */}
                <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-500" />
                        <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Production Completed</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-850 border-none bg-transparent cursor-pointer"
                    >
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>

                {/* Body Summary (Multi-Product view) */}
                <div className="p-6 space-y-4 text-xs text-foreground">
                    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 text-center space-y-1">
                        <span className="text-[10px] text-emerald-500 font-extrabold uppercase tracking-widest block">POSTED TO STOCK LEDGER</span>
                        <span className="text-base font-black text-white">{completedReceipt.length} Products Stocked Successfully</span>
                        <span className="text-[10px] text-muted-foreground block font-mono">Job Order Ref: {completedReceipt[0]?.joId} • Destination Branch: {completedReceipt[0]?.branchId}</span>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto border border-slate-800 rounded-xl p-3 bg-slate-955/30 divide-y divide-slate-800/50">
                        {completedReceipt.map((receipt, idx) => (
                            <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                                <div className="space-y-0.5">
                                    <span className="font-bold block text-foreground truncate max-w-[280px]">{receipt.productName}</span>
                                    <span className="text-[9px] text-muted-foreground font-semibold">Lot: {receipt.lotNumber} • Exp: {receipt.expirationDate}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-emerald-500 font-extrabold block text-xs">{receipt.quantityProduced.toLocaleString()} PCS</span>
                                    <span className="text-[9px] text-muted-foreground/60 font-semibold">₱{receipt.unitCost.toFixed(2)}/u</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Options */}
                <div className="border-t border-slate-800 px-6 py-4 flex gap-3 bg-slate-950/20">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground rounded-xl hover:bg-slate-800 border border-slate-800 bg-transparent transition-all cursor-pointer"
                    >
                        Close Window
                    </button>
                    <button
                        onClick={() => onPrint(completedReceipt)}
                        className="flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl border-none transition-all cursor-pointer shadow-md shadow-emerald-950/30"
                    >
                        <Printer className="h-4 w-4" />
                        Print Receipt / Ticket
                    </button>
                </div>
            </div>
        </div>
    );
}
