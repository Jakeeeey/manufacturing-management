"use client";

import React from "react";
import Link from "next/link";
import { ListOrdered, Cpu, Merge, Loader2, Search, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { usePlanningEngineering } from "./hooks/usePlanningEngineering";
import { ReleasedSalesOrdersTable } from "./components/ReleasedSalesOrdersTable";
import { BatchConsolidationTable } from "./components/BatchConsolidationTable";
import { JobOrdersList } from "./components/JobOrdersList";
import { PlanningSidebarForm } from "./components/PlanningSidebarForm";
import { ManpowerWorkloadAnalysis } from "./components/ManpowerWorkloadAnalysis";

export default function PlanningEngineeringModule() {
    const [joViewMode, setJoViewMode] = React.useState<"list" | "manpower">("list");
    const {
        activeTab,
        setActiveTab,
        salesOrderViewMode,
        setSalesOrderViewMode,
        salesOrders,
        soDetailsMap,
        loadingSO,
        selectedSO,
        setSelectedSO,
        soDetails,
        selectedBatchCandidate,
        setSelectedBatchCandidate,
        filteredJobOrders,
        checkingInventoryId,
        procurementLoadingId,
        selectedDetailId,
        joNumber,
        setJoNumber,
        dueDate,
        setDueDate,
        joQty,
        setJoQty,
        consolidationCandidates,
        branches,
        selectedBranchId,
        setSelectedBranchId,
        filterBranchId,
        setFilterBranchId,
        page,
        setPage,
        totalPages,
        searchQuery,
        setSearchQuery,
        selectedIds,
        setSelectedIds,
        handleSelectSO,
        handleSelectBatchCandidate,
        handleDetailChange,
        handleCreateJobOrder,
        handleRunFIFOInventoryCheck,
        handleTriggerProcurement,
        handleProgressProcurement,
        handleDeleteJO,
        handleCreatePrerequisiteJobOrder,
        products,
        users,
        suppliers,
        isStandaloneMode,
        setIsStandaloneMode,
        selectedStandaloneProduct,
        setSelectedStandaloneProduct,
        handleAssignPersonnel,
        selectedProductsList,
        setSelectedProductsList,
        productVersions,
        loadVersionsForProduct,
        modifyJobOrder
    } = usePlanningEngineering();

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center justify-between border-b pb-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">Operations Planning & BOM Engine</h3>
                    <p className="text-xs text-muted-foreground">Manage the active production queue, validate FIFO material availability, sum routing hours, and batch consolidate orders.</p>
                </div>
                <Link 
                    href="/mm/production-workflow"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-bold transition-all"
                >
                    <Play className="h-4 w-4" />
                    Go to Production Workflow
                </Link>
            </div>

            {/* Navigation Tabs & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
                <div className="flex bg-muted/10 shrink-0 rounded-xl overflow-hidden border max-w-md">
                    <button
                        onClick={() => setActiveTab("sales-orders")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                            activeTab === "sales-orders"
                                ? "border-primary text-primary bg-background"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                    >
                        <ListOrdered className="h-4 w-4" /> Released Sales Orders
                    </button>
                    <button
                        onClick={() => setActiveTab("job-orders")}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all -mb-[1px] ${
                            activeTab === "job-orders"
                                ? "border-primary text-primary bg-background"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                    >
                        <Cpu className="h-4 w-4" /> Floor Job Orders
                    </button>
                </div>

                {activeTab === "sales-orders" && (
                    <div className="flex rounded-lg border bg-muted/10 p-0.5 max-w-xs text-xs font-bold">
                        <button
                            onClick={() => setSalesOrderViewMode("single")}
                            className={`px-3 py-1 rounded-md transition-colors ${
                                salesOrderViewMode === "single"
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Single Order 1:1
                        </button>
                        <button
                            onClick={() => setSalesOrderViewMode("consolidated")}
                            className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                                salesOrderViewMode === "consolidated"
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Merge className="h-3.5 w-3.5" />
                            Batch Consolidation
                        </button>
                    </div>
                )}

                {activeTab === "job-orders" && (
                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex rounded-lg border bg-muted/10 p-0.5 text-xs font-bold mr-2">
                            <button
                                onClick={() => setJoViewMode("list")}
                                className={`px-3 py-1 rounded-md transition-colors ${
                                    joViewMode === "list"
                                        ? "bg-background text-foreground shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Job Orders List
                            </button>
                            <button
                                onClick={() => setJoViewMode("manpower")}
                                className={`px-3 py-1 rounded-md transition-colors ${
                                    joViewMode === "manpower"
                                        ? "bg-background text-foreground shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Manpower Workload
                            </button>
                        </div>
                        <span className="font-bold text-muted-foreground">Filter Branch:</span>
                        <select
                            value={filterBranchId}
                            onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : "")}
                            className="rounded-lg border bg-background px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary font-bold text-foreground text-xs"
                        >
                            <option value="">All Branches</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.branch_name} ({b.branch_code})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Main view grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === "sales-orders" && (
                        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 border rounded-xl shadow-xs">
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search Order No / Customer..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full pl-9 pr-4 py-1.5 border rounded-lg bg-background text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold">
                                <span>Page {page} of {totalPages}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === "sales-orders" ? (
                        loadingSO ? (
                            <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-xs">Loading consolidation queue...</span>
                            </div>
                        ) : salesOrderViewMode === "single" ? (
                            <ReleasedSalesOrdersTable
                                salesOrders={salesOrders}
                                handleSelectSO={handleSelectSO}
                                soDetailsMap={soDetailsMap}
                            />
                        ) : (
                            <BatchConsolidationTable
                                salesOrders={salesOrders}
                                soDetailsMap={soDetailsMap}
                                branches={branches}
                                selectedBranchId={selectedBranchId}
                                setSelectedBranchId={setSelectedBranchId}
                                selectedIds={selectedIds}
                                setSelectedIds={setSelectedIds}
                                onBatchCreated={() => {
                                    setActiveTab("job-orders");
                                }}
                            />
                        )
                    ) : joViewMode === "manpower" ? (
                        <ManpowerWorkloadAnalysis 
                            jobOrders={filteredJobOrders}
                            users={users}
                        />
                    ) : (
                        /* Job Orders list tab */
                        <JobOrdersList
                            jobOrders={filteredJobOrders}
                            checkingInventoryId={checkingInventoryId}
                            procurementLoadingId={procurementLoadingId}
                            handleRunFIFOInventoryCheck={handleRunFIFOInventoryCheck}
                            handleTriggerProcurement={handleTriggerProcurement}
                            handleProgressProcurement={handleProgressProcurement}
                            handleDeleteJO={handleDeleteJO}
                            branches={branches}
                            handleCreatePrerequisiteJobOrder={handleCreatePrerequisiteJobOrder}
                            users={users}
                            suppliers={suppliers}
                            products={products}
                            handleAssignPersonnel={handleAssignPersonnel}
                            modifyJobOrder={modifyJobOrder}
                        />
                    )}

                    {activeTab === "sales-orders" && totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-lg bg-card text-foreground hover:bg-muted/30 disabled:opacity-50 transition-colors cursor-pointer text-xs font-semibold"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" /> Previous
                            </button>
                            <span className="text-xs font-extrabold text-foreground px-2">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-lg bg-card text-foreground hover:bg-muted/30 disabled:opacity-50 transition-colors cursor-pointer text-xs font-semibold"
                            >
                                Next <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Right sidebar scheduling form */}
                <div className="space-y-6">
                    <PlanningSidebarForm
                        selectedSO={selectedSO}
                        setSelectedSO={setSelectedSO}
                        selectedBatchCandidate={selectedBatchCandidate}
                        setSelectedBatchCandidate={setSelectedBatchCandidate}
                        soDetails={soDetails}
                        selectedDetailId={selectedDetailId}
                        handleDetailChange={handleDetailChange}
                        joNumber={joNumber}
                        setJoNumber={setJoNumber}
                        joQty={joQty}
                        setJoQty={setJoQty}
                        dueDate={dueDate}
                        setDueDate={setDueDate}
                        handleCreateJobOrder={handleCreateJobOrder}
                        branches={branches}
                        selectedBranchId={selectedBranchId}
                        setSelectedBranchId={setSelectedBranchId}
                        isStandaloneMode={isStandaloneMode}
                        setIsStandaloneMode={setIsStandaloneMode}
                        products={products}
                        selectedStandaloneProduct={selectedStandaloneProduct}
                        setSelectedStandaloneProduct={setSelectedStandaloneProduct}
                        selectedProductsList={selectedProductsList}
                        setSelectedProductsList={setSelectedProductsList}
                        productVersions={productVersions}
                        loadVersionsForProduct={loadVersionsForProduct}
                    />
                </div>
            </div>
        </div>
    );
}
