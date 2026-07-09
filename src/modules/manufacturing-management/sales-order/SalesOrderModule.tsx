"use client";

import React, { useState } from "react";
import { RefreshCw, Loader2, Plus } from "lucide-react";
import { useSalesOrder } from "./hooks/useSalesOrder";
import { ActiveSalesOrdersTable } from "./components/ActiveSalesOrdersTable";
import { SalesOrderDetailPanel } from "./components/SalesOrderDetailPanel";
import { CreateSalesOrderModal } from "./components/CreateSalesOrderModal";

export default function SalesOrderModule() {
    const {
        salesOrders,
        loading,
        selectedOrder,
        setSelectedOrder,
        orderDetails,
        loadingDetails,
        updatingStatusId,
        savingQuantities,
        viewOrderDetails,
        handleApproveOrder,
        handleUpdateQuantities,
        handleSubmitForApproval,
        handleCreateSalesOrderDirect,
        refreshData,
        currentPage,
        setCurrentPage,
        limit,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        customerCodeFilter,
        setCustomerCodeFilter,
        dateFromFilter,
        setDateFromFilter,
        dateToFilter,
        setDateToFilter,
        totalCount,
        totalPages
    } = useSalesOrder();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 
    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">Sales Order Management</h3>
                    <p className="text-xs text-muted-foreground">Approve won projects, convert quotations 1:1 to Sales Orders, and lock agreed target pricing.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground px-3 py-2 text-xs font-bold shadow-sm cursor-pointer border-none"
                    >
                        <Plus className="h-4 w-4" /> Create Direct SO
                    </button>
                    <button
                        onClick={refreshData}
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted text-muted-foreground transition-all cursor-pointer"
                    >
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </button>
                </div>
            </div>
 
            {/* Main Content Pane */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="text-xs">Loading orders...</span>
                        </div>
                    ) : (
                        <ActiveSalesOrdersTable
                            salesOrders={salesOrders}
                            updatingStatusId={updatingStatusId}
                            viewOrderDetails={viewOrderDetails}
                            handleApproveOrder={handleApproveOrder}
                            currentPage={currentPage}
                            setCurrentPage={setCurrentPage}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            customerCodeFilter={customerCodeFilter}
                            setCustomerCodeFilter={setCustomerCodeFilter}
                            dateFromFilter={dateFromFilter}
                            setDateFromFilter={setDateFromFilter}
                            dateToFilter={dateToFilter}
                            setDateToFilter={setDateToFilter}
                            totalCount={totalCount}
                            totalPages={totalPages}
                            limit={limit}
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

            <CreateSalesOrderModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreateSalesOrderDirect}
            />
        </div>
    );
}
