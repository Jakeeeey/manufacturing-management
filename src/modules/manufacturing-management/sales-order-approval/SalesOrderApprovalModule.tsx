"use client";

import React from "react";
import { RefreshCw, ShieldAlert, Loader2 } from "lucide-react";
import { useSalesOrderApproval } from "./hooks/useSalesOrderApproval";
import { SalesOrderApprovalTable } from "./components/SalesOrderApprovalTable";
import { SalesOrderApprovalDetailPanel } from "./components/SalesOrderApprovalDetailPanel";

export default function SalesOrderApprovalModule() {
    const {
        salesOrders,
        loading,
        selectedOrder,
        setSelectedOrder,
        orderDetails,
        loadingDetails,
        updatingStatusId,
        currentPage,
        setCurrentPage,
        searchQuery,
        setSearchQuery,
        totalCount,
        totalPages,
        limit,
        viewOrderDetails,
        handleApprove,
        handleReject,
        refreshData
    } = useSalesOrderApproval();

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-amber-500" /> Sales Order Approvals
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Verify committed pricing, project quantities, and payment terms before releasing to floor execution.
                    </p>
                </div>
                <button
                    onClick={refreshData}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted text-muted-foreground transition-all"
                >
                    <RefreshCw className="h-4 w-4" /> Refresh
                </button>
            </div>

            {/* Main Content Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground bg-card rounded-xl border border-dashed shadow-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="text-xs">Loading approval queue...</span>
                        </div>
                    ) : (
                        <SalesOrderApprovalTable
                            salesOrders={salesOrders}
                            updatingStatusId={updatingStatusId}
                            viewOrderDetails={viewOrderDetails}
                            handleApprove={handleApprove}
                            handleReject={handleReject}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            totalCount={totalCount}
                            totalPages={totalPages}
                            limit={limit}
                        />
                    )}
                </div>

                {/* Right sidebar - details view */}
                <div className="space-y-6">
                    <SalesOrderApprovalDetailPanel
                        selectedOrder={selectedOrder}
                        setSelectedOrder={setSelectedOrder}
                        orderDetails={orderDetails}
                        loadingDetails={loadingDetails}
                        updatingStatusId={updatingStatusId}
                        handleApprove={handleApprove}
                        handleReject={handleReject}
                    />
                </div>
            </div>
        </div>
    );
}
