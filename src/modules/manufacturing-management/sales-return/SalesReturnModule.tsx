// src/modules/manufacturing-management/sales-return/SalesReturnModule.tsx

"use client";

import React, { useState } from "react";
import { useSalesReturn } from "./hooks/useSalesReturn";
import { PendingInvoiceForReturn, SalesReturn } from "./types";
import CreateReturnModal from "./components/CreateReturnModal";
import ReturnDetailModal from "./components/ReturnDetailModal";
import { 
    RotateCcw, 
    Receipt, 
    Search, 
    Calendar, 
    DollarSign, 
    FileText, 
    AlertCircle, 
    Filter,
    ArrowUpDown,
    CornerDownLeft,
    ChevronRight,
    RefreshCw
} from "lucide-react";

export default function SalesReturnModule() {
    const {
        returns,
        detailsMap,
        invoices,
        invoicesDetailsMap,
        loading,
        handleCreateReturn,
        refresh
    } = useSalesReturn();

    // Tab state: "history" or "eligible"
    const [activeTab, setActiveTab] = useState<"history" | "eligible">("history");

    // Modal states
    const [selectedInvoice, setSelectedInvoice] = useState<PendingInvoiceForReturn | null>(null);
    const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);

    // Search and filters
    const [returnSearch, setReturnSearch] = useState("");
    const [invoiceSearch, setInvoiceSearch] = useState("");

    // Calculate total returns value across all returns
    const totalCreditReclaimed = returns.reduce((sum, ret) => {
        const details = detailsMap[ret.return_number] || [];
        const retValue = details.reduce((acc, d) => acc + (d.net_amount || 0), 0);
        return sum + retValue;
    }, 0);

    // Filtered returns
    const filteredReturns = returns.filter(ret => {
        const searchLower = returnSearch.toLowerCase();
        const returnNoMatches = ret.return_number.toLowerCase().includes(searchLower);
        const customerMatches = (ret.customer_name || "").toLowerCase().includes(searchLower);
        const remarksMatches = (ret.remarks || "").toLowerCase().includes(searchLower);
        return returnNoMatches || customerMatches || remarksMatches;
    });

    // Filtered eligible invoices
    const filteredInvoices = invoices.filter(inv => {
        const searchLower = invoiceSearch.toLowerCase();
        const invoiceNoMatches = inv.invoice_no.toLowerCase().includes(searchLower);
        const customerMatches = (inv.customer_name || "").toLowerCase().includes(searchLower);
        return invoiceNoMatches || customerMatches;
    });

    return (
        <div className="space-y-6">
            {/* Header section with Stats */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-primary animate-spin-slow" />
                        Customer Sales Returns
                    </h1>
                    <p className="text-xs text-muted-foreground">Manage customer return slips, credit notes, and automated inventory restocking.</p>
                </div>
                <button
                    onClick={refresh}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Sync Data
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Stat 1: Total Return Actions */}
                <div className="border bg-card hover:bg-muted/10 transition-all rounded-2xl p-4 flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-[9px] font-extrabold uppercase text-muted-foreground tracking-wider block">Processed Returns</span>
                        <span className="text-2xl font-black text-foreground block">{returns.length}</span>
                        <span className="text-[10px] text-muted-foreground block">Items added back to warehouse</span>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <RotateCcw className="h-6 w-6 text-primary" />
                    </div>
                </div>

                {/* Stat 2: Total Refund Claims */}
                <div className="border bg-card hover:bg-muted/10 transition-all rounded-2xl p-4 flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-[9px] font-extrabold uppercase text-muted-foreground tracking-wider block">Credit Reclaimed</span>
                        <span className="text-2xl font-black text-foreground block">
                            ₱{totalCreditReclaimed.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">Restored to AR ledger</span>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                        <DollarSign className="h-6 w-6 text-emerald-500" />
                    </div>
                </div>

                {/* Stat 3: Pending Invoices Queue */}
                <div className="border bg-card hover:bg-muted/10 transition-all rounded-2xl p-4 flex items-center justify-between">
                    <div className="space-y-1">
                        <span className="text-[9px] font-extrabold uppercase text-muted-foreground tracking-wider block">Invoices Pipeline</span>
                        <span className="text-2xl font-black text-foreground block">{invoices.length}</span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-bold">Eligible for returns logs</span>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-2xl">
                        <Receipt className="h-6 w-6 text-amber-500" />
                    </div>
                </div>
            </div>

            {/* Main Tabs and Content Area */}
            <div className="border bg-card rounded-2xl overflow-hidden flex flex-col min-h-[480px]">
                {/* Tabs bar */}
                <div className="flex border-b bg-muted/10 px-4 pt-3 gap-2 shrink-0">
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === "history"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Return Slips Registry
                    </button>
                    <button
                        onClick={() => setActiveTab("eligible")}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                            activeTab === "eligible"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Eligible Sales Invoices
                    </button>
                </div>

                {/* Search / Filter Area */}
                <div className="p-4 border-b bg-muted/5 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
                    {activeTab === "history" ? (
                        <>
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search returns list..."
                                    value={returnSearch}
                                    onChange={(e) => setReturnSearch(e.target.value)}
                                    className="pl-9 w-full bg-muted/30 border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <span className="text-[10px] text-muted-foreground">Showing {filteredReturns.length} processed return slips</span>
                        </>
                    ) : (
                        <>
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search invoices list..."
                                    value={invoiceSearch}
                                    onChange={(e) => setInvoiceSearch(e.target.value)}
                                    className="pl-9 w-full bg-muted/30 border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>
                            <span className="text-[10px] text-muted-foreground">Showing {filteredInvoices.length} billing reference invoices</span>
                        </>
                    )}
                </div>

                {/* Table / Content list wrapper */}
                <div className="flex-1 overflow-x-auto min-h-0">
                    {loading ? (
                        <div className="h-64 flex flex-col justify-center items-center gap-2 text-muted-foreground">
                            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-xs font-bold">Loading module registry...</span>
                        </div>
                    ) : activeTab === "history" ? (
                        /* Returns Registry Grid */
                        filteredReturns.length === 0 ? (
                            <div className="h-64 flex flex-col justify-center items-center text-muted-foreground text-center p-4">
                                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-xs font-black uppercase text-foreground">No Sales Returns Logged</p>
                                <p className="text-[10px] max-w-xs mt-1">Processed customer return transactions will appear here with detail breakdown logs.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-muted/10 border-b text-[9px] font-extrabold uppercase text-muted-foreground select-none">
                                        <th className="px-6 py-3">Slip Number</th>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Customer</th>
                                        <th className="px-6 py-3">Ref Invoice</th>
                                        <th className="px-6 py-3 text-right">Items</th>
                                        <th className="px-6 py-3 text-right">Return Value</th>
                                        <th className="px-6 py-3">Remarks</th>
                                        <th className="px-6 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredReturns.map((ret) => {
                                        const items = detailsMap[ret.return_number] || [];
                                        const retValue = items.reduce((acc, d) => acc + (d.net_amount || 0), 0);
                                        return (
                                            <tr 
                                                key={ret.return_id} 
                                                className="hover:bg-muted/5 group transition-colors cursor-pointer"
                                                onClick={() => setSelectedReturn(ret)}
                                            >
                                                <td className="px-6 py-3.5 font-black text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                                                    <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {ret.return_number}
                                                </td>
                                                <td className="px-6 py-3.5 text-muted-foreground">
                                                    {new Date(ret.return_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-3.5 font-bold text-foreground">
                                                    {ret.customer_name || `Customer #${ret.customer_id}`}
                                                </td>
                                                <td className="px-6 py-3.5 text-primary font-bold">
                                                    #{ret.invoice_id}
                                                </td>
                                                <td className="px-6 py-3.5 text-right font-bold">
                                                    {items.length} sku(s)
                                                </td>
                                                <td className="px-6 py-3.5 text-right font-black text-foreground">
                                                    ₱{retValue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-6 py-3.5 text-muted-foreground max-w-xs truncate">
                                                    {ret.remarks || "-"}
                                                </td>
                                                <td className="px-6 py-3.5 text-right">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedReturn(ret);
                                                        }}
                                                        className="px-3 py-1 rounded-lg border hover:bg-muted text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                                                    >
                                                        Details
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )
                    ) : (
                        /* Eligible Invoices Grid */
                        filteredInvoices.length === 0 ? (
                            <div className="h-64 flex flex-col justify-center items-center text-muted-foreground text-center p-4">
                                <Receipt className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-xs font-black uppercase text-foreground">No Billing References Found</p>
                                <p className="text-[10px] max-w-xs mt-1">There are no pending active invoices available for return logging.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-muted/10 border-b text-[9px] font-extrabold uppercase text-muted-foreground select-none">
                                        <th className="px-6 py-3">Invoice Number</th>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Customer Code</th>
                                        <th className="px-6 py-3">Customer Name</th>
                                        <th className="px-6 py-3 text-right">Invoiced Amount</th>
                                        <th className="px-6 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredInvoices.map((inv) => (
                                        <tr key={inv.invoice_id} className="hover:bg-muted/5 transition-colors">
                                            <td className="px-6 py-3.5 font-bold text-foreground">
                                                {inv.invoice_no}
                                            </td>
                                            <td className="px-6 py-3.5 text-muted-foreground">
                                                {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "N/A"}
                                            </td>
                                            <td className="px-6 py-3.5 text-muted-foreground font-mono">
                                                {inv.customer_code}
                                            </td>
                                            <td className="px-6 py-3.5 font-bold text-foreground">
                                                {inv.customer_name}
                                            </td>
                                            <td className="px-6 py-3.5 text-right font-black text-emerald-600">
                                                ₱{inv.net_amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="px-6 py-3.5 text-right">
                                                <button
                                                    onClick={() => setSelectedInvoice(inv)}
                                                    className="inline-flex items-center gap-1 bg-primary hover:bg-primary/95 text-primary-foreground border-none px-3.5 py-1.5 rounded-lg text-[10px] font-black shadow transition-all hover:shadow-md cursor-pointer"
                                                >
                                                    <RotateCcw className="h-3 w-3" />
                                                    Process Return
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}
                </div>
            </div>

            {/* Modals Integration */}
            {selectedInvoice && (
                <CreateReturnModal
                    invoice={selectedInvoice}
                    invoiceDetails={invoicesDetailsMap[selectedInvoice.invoice_id] || []}
                    isOpen={!!selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    onSubmit={handleCreateReturn}
                />
            )}

            {selectedReturn && (
                <ReturnDetailModal
                    returnItem={selectedReturn}
                    details={detailsMap[selectedReturn.return_number] || []}
                    isOpen={!!selectedReturn}
                    onClose={() => setSelectedReturn(null)}
                />
            )}
        </div>
    );
}
