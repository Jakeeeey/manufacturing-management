"use client";

import React from "react";
import { RefreshCw, DollarSign, FileText, Loader2 } from "lucide-react";
import { useSalesOrder } from "./hooks/useSalesOrder";
import { ActiveSalesOrdersTable } from "./components/ActiveSalesOrdersTable";
import { QuotationPipelineTable } from "./components/QuotationPipelineTable";
import { SalesOrderDetailPanel } from "./components/SalesOrderDetailPanel";

export default function SalesOrderModule() {
    const {
        activeTab,
        setActiveTab,
        salesOrders,
        quotes,
        loading,
        selectedOrder,
        setSelectedOrder,
        orderDetails,
        loadingDetails,
        convertingId,
        updatingStatusId,
        savingQuantities,
        viewOrderDetails,
        handleApproveOrder,
        handleConvertQuote,
        handleUpdateQuantities,
        handleSubmitForApproval,
        refreshData
    } = useSalesOrder();
 
    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">Sales Order Management</h3>
                    <p className="text-xs text-muted-foreground">Approve won projects, convert quotations 1:1 to Sales Orders, and lock agreed target pricing.</p>
                </div>
                <button
                    onClick={refreshData}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted text-muted-foreground transition-all"
                >
                    <RefreshCw className="h-4 w-4" /> Refresh
                </button>
            </div>
 
            {/* Navigation Tabs */}
            <div className="flex border-b bg-muted/10 shrink-0 rounded-xl overflow-hidden border max-w-md">
                <button
                    onClick={() => setActiveTab("sales-orders")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                        activeTab === "sales-orders"
                            ? "border-primary text-primary bg-background"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                    <DollarSign className="h-4 w-4" /> Active Sales Orders
                </button>
                <button
                    onClick={() => setActiveTab("quote-pipeline")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                        activeTab === "quote-pipeline"
                            ? "border-primary text-primary bg-background"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                >
                    <FileText className="h-4 w-4" /> Quotation Pipeline
                </button>
            </div>
 
            {/* Main Content Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="text-xs">Loading orders...</span>
                        </div>
                    ) : activeTab === "sales-orders" ? (
                        <ActiveSalesOrdersTable
                            salesOrders={salesOrders}
                            updatingStatusId={updatingStatusId}
                            viewOrderDetails={viewOrderDetails}
                            handleApproveOrder={handleApproveOrder}
                        />
                    ) : (
                        <QuotationPipelineTable
                            quotes={quotes}
                            convertingId={convertingId}
                            handleConvertQuote={handleConvertQuote}
                        />
                    )}
                </div>
 
                {/* Right sidebar - details view */}
                <div className="space-y-6">
                    <SalesOrderDetailPanel
                        selectedOrder={selectedOrder}
                        setSelectedOrder={setSelectedOrder}
                        orderDetails={orderDetails}
                        loadingDetails={loadingDetails}
                        updatingStatusId={updatingStatusId}
                        savingQuantities={savingQuantities}
                        handleApproveOrder={handleApproveOrder}
                        handleUpdateQuantities={handleUpdateQuantities}
                        handleSubmitForApproval={handleSubmitForApproval}
                    />
                </div>
            </div>
        </div>
    );
}
