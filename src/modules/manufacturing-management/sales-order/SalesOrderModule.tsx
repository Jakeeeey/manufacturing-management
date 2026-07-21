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
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md border border-slate-800 dark:border-slate-700">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Order Operations</span>
                        <h1 className="text-2xl font-black tracking-tight">Sales Order Management</h1>
                        <p className="text-xs text-slate-300">Convert won quotations, approve target price locks, and launch raw materials reservations.</p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 text-xs font-black shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:-translate-y-0.5 cursor-pointer border-none"
                        >
                            <Plus className="h-4 w-4 stroke-[3]" /> Create Direct SO
                        </button>
                        <button
                            onClick={refreshData}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 px-4 py-2.5 text-xs font-bold text-slate-200 transition-all hover:-translate-y-0.5 cursor-pointer"
                        >
                            <RefreshCw className="h-4 w-4" /> Refresh
                        </button>
                    </div>
                </div>
                {/* Decorative glowing blobs */}
                <div className="absolute right-0 top-0 -mt-8 -mr-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="absolute left-1/3 bottom-0 -mb-8 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
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
