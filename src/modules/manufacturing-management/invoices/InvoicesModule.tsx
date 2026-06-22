// src/modules/manufacturing-management/invoices/InvoicesModule.tsx

"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useInvoices } from "./hooks/useInvoices";
import CreateInvoiceModal from "./components/CreateInvoiceModal";
import InvoiceDetailModal from "./components/InvoiceDetailModal";
import PrinterAlignmentPanel from "./components/PrinterAlignmentPanel";
import { 
    Receipt, 
    FileText, 
    Settings, 
    Loader2, 
    Search, 
    SlidersHorizontal, 
    ArrowRight,
    TrendingUp,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { Invoice, PendingSalesOrder } from "./types";

export default function InvoicesModule() {
    const {
        invoices,
        detailsMap,
        pendingOrders,
        pendingDetailsMap,
        loading,
        loadingDetails,
        loadInvoiceDetails,
        alignment,
        saveAlignmentSettings,
        resetAlignmentSettings,
        handleCreateInvoice,
        handleRecordPayment,
        handleCancelInvoice
    } = useInvoices();

    const [activeTab, setActiveTab] = useState<"registry" | "pipeline" | "calibration">("registry");
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    // Modal states
    const [selectedOrder, setSelectedOrder] = useState<PendingSalesOrder | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    // Auto-fetch details on demand when selectedInvoice is opened
    useEffect(() => {
        if (selectedInvoice) {
            loadInvoiceDetails(Number(selectedInvoice.invoice_id));
        }
    }, [selectedInvoice, loadInvoiceDetails]);

    // Compute financial summaries
    const metrics = useMemo(() => {
        let total = 0;
        let collected = 0;
        let outstanding = 0;
        let overdue = 0;

        invoices.forEach((inv) => {
            const net = Number(inv.net_amount || 0);
            total += net;
            if (inv.status === "Paid") {
                collected += net;
            } else if (inv.status === "Partially Paid") {
                // For simplicity, assume half is collected/partially paid if no explicit amount is stored
                collected += net * 0.5;
                outstanding += net * 0.5;
            } else if (inv.status === "Overdue") {
                overdue += net;
                outstanding += net;
            } else {
                outstanding += net;
            }
        });

        return { total, collected, outstanding, overdue };
    }, [invoices]);

    // Filter Invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter((inv) => {
            const matchesSearch = 
                (inv.invoice_no || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (inv.customer_name && inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (inv.sales_order_no && inv.sales_order_no.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const matchesStatus = statusFilter === "All" || inv.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [invoices, searchQuery, statusFilter]);

    // Filter Pending Sales Orders
    const filteredPendingOrders = useMemo(() => {
        return pendingOrders.filter((order) => {
            return (
                (order.order_no || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (order.customer_name && order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        });
    }, [pendingOrders, searchQuery]);

    return (
        <div className="flex flex-col min-h-0 min-w-0 flex-1 space-y-4 no-print">
            {/* Top Cards Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                        <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Total Billing Issued</span>
                        <h4 className="text-base font-black text-foreground mt-0.5">
                            ₱{metrics.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h4>
                    </div>
                </div>

                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                        <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Payments Collected</span>
                        <h4 className="text-base font-black text-foreground mt-0.5">
                            ₱{metrics.collected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h4>
                    </div>
                </div>

                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Accounts Receivable</span>
                        <h4 className="text-base font-black text-foreground mt-0.5">
                            ₱{metrics.outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h4>
                    </div>
                </div>

                <div className="border bg-card rounded-xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block">Overdue Collections</span>
                        <h4 className="text-base font-black text-rose-600 mt-0.5">
                            ₱{metrics.overdue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h4>
                    </div>
                </div>
            </div>

            {/* Tab Navigation header */}
            <div className="flex border-b bg-muted/10 shrink-0 rounded-xl overflow-hidden border">
                {[
                    { id: "registry", label: "Sales Invoices Registry", icon: Receipt },
                    { id: "pipeline", label: "Sales Orders Pipeline", icon: FileText },
                    { id: "calibration", label: "Continuous Form Calibrator", icon: Settings }
                ].map((t) => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => {
                                setActiveTab(t.id as "registry" | "pipeline" | "calibration");
                                setSearchQuery("");
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3.5 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                                isActive 
                                    ? "border-primary text-primary bg-background" 
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Search Filters Row (Hidden in settings tab) */}
            {activeTab !== "calibration" && (
                <div className="flex flex-col sm:flex-row gap-3 items-center shrink-0">
                    {/* Search query */}
                    <div className="relative w-full sm:flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={activeTab === "registry" ? "Search by Invoice No, Customer, or SO..." : "Search pending Sales Orders..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 w-full bg-card border border-input rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                    </div>

                    {/* Status Filter for Registry */}
                    {activeTab === "registry" && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-card border border-input rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none w-full sm:w-40"
                            >
                                <option value="All">All Invoices</option>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Paid">Paid</option>
                                <option value="Partially Paid">Partially Paid</option>
                                <option value="Overdue">Overdue</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* Main Tab Content Wrapper */}
            <div className="flex-1 min-h-0 relative bg-background border rounded-xl p-4 md:p-6 shadow-sm flex flex-col">
                {loading ? (
                    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : null}

                {/* TAB 1: Invoices Registry */}
                {activeTab === "registry" && (
                    <div className="flex-1 overflow-auto min-h-0">
                        {filteredInvoices.length === 0 ? (
                            <div className="text-center py-12">
                                <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                                <h5 className="font-bold text-foreground text-xs uppercase tracking-wide mt-2">No Invoices Found</h5>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    {searchQuery ? "No records matched your search query." : "Convert approved Sales Orders to launch invoices."}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b bg-muted/20">
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">Invoice No</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">Invoice Date</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">Due Date</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">SO Reference</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Amount</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Status</th>
                                        <th className="p-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredInvoices.map((inv) => (
                                        <tr key={inv.invoice_id} className="hover:bg-muted/10 transition-colors">
                                            <td className="p-3 font-bold text-foreground">{inv.invoice_no}</td>
                                            <td className="p-3 text-muted-foreground">{inv.customer_name || "N/A"}</td>
                                            <td className="p-3 text-muted-foreground">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                            <td className="p-3 text-muted-foreground">{new Date(inv.due_date).toLocaleDateString()}</td>
                                            <td className="p-3 text-primary font-medium">{inv.sales_order_no || "Manual"}</td>
                                            <td className="p-3 text-right font-black text-foreground">
                                                ₱{Number(inv.net_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span 
                                                    className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                                        inv.status === "Paid" 
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                                                            : inv.status === "Partially Paid"
                                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                                            : inv.status === "Cancelled"
                                                            ? "bg-slate-500/10 border-slate-500/20 text-slate-500"
                                                            : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                                                    }`}
                                                >
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => setSelectedInvoice(inv)}
                                                    className="bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* TAB 2: Sales Order Pipeline */}
                {activeTab === "pipeline" && (
                    <div className="flex-1 overflow-auto min-h-0">
                        {filteredPendingOrders.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                                <h5 className="font-bold text-foreground text-xs uppercase tracking-wide mt-2">No Pending Orders</h5>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    All approved Sales Orders are fully invoiced.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b bg-muted/20">
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">Order No</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">Order Date</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Net Amount</th>
                                        <th className="p-3 font-semibold text-muted-foreground uppercase">Remarks</th>
                                        <th className="p-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredPendingOrders.map((order) => (
                                        <tr key={order.order_id} className="hover:bg-muted/10 transition-colors">
                                            <td className="p-3 font-bold text-foreground">{order.order_no}</td>
                                            <td className="p-3 text-muted-foreground">{order.customer_name}</td>
                                            <td className="p-3 text-muted-foreground">{new Date(order.order_date).toLocaleDateString()}</td>
                                            <td className="p-3 text-right font-black text-foreground">
                                                ₱{Number(order.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-3 text-muted-foreground truncate max-w-xs">{order.remarks || "No remarks"}</td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-none px-3.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 mx-auto"
                                                >
                                                    Invoice Order
                                                    <ArrowRight className="h-3 w-3" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* TAB 3: Continuous Form Calibration */}
                {activeTab === "calibration" && (
                    <PrinterAlignmentPanel
                        alignment={alignment}
                        onSave={saveAlignmentSettings}
                        onReset={resetAlignmentSettings}
                    />
                )}
            </div>

            {/* Create Invoice Modal Integration */}
            {selectedOrder && (
                <CreateInvoiceModal
                    isOpen={!!selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    order={selectedOrder}
                    orderDetails={pendingDetailsMap[selectedOrder.order_id] || []}
                    onSubmit={handleCreateInvoice}
                    existingInvoiceNos={invoices.map((inv) => inv.invoice_no)}
                />
            )}

            {/* Invoice Detail Modal Integration */}
            {selectedInvoice && (
                <InvoiceDetailModal
                    isOpen={!!selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    invoice={selectedInvoice}
                    invoiceDetails={detailsMap[Number(selectedInvoice.invoice_id)] || []}
                    onRecordPayment={handleRecordPayment}
                    onCancelInvoice={handleCancelInvoice}
                    alignment={alignment}
                    loadingDetails={loadingDetails[Number(selectedInvoice.invoice_id)] || false}
                />
            )}
        </div>
    );
}
