"use client";

import React from "react";
import Link from "next/link";
import { ListOrdered, Cpu, Loader2, Search, ChevronLeft, ChevronRight, Play, X, Plus } from "lucide-react";
import { usePlanningEngineering } from "./hooks/usePlanningEngineering";
import { BatchConsolidationTable } from "./components/BatchConsolidationTable";
import { JobOrdersList } from "./components/JobOrdersList";
import { PlanningSidebarForm } from "./components/PlanningSidebarForm";
import { ManpowerWorkloadAnalysis } from "./components/ManpowerWorkloadAnalysis";

export default function PlanningEngineeringModule() {
    const [joViewMode, setJoViewMode] = React.useState<"list" | "manpower">("list");
    const [statusFilter, setStatusFilter] = React.useState<"all" | "ongoing" | "finished">("all");
    const {
        activeTab,
        setActiveTab,
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
        selectedBomVersionId,
        setSelectedBomVersionId,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
        handleSelectSO,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        handleUpdateProductCapacity,
        selectedProductsList,
        setSelectedProductsList,
        productVersions,
        loadVersionsForProduct,
        modifyJobOrder,
        shiftOption,
        setShiftOption
    } = usePlanningEngineering();

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">Operations Planning & BOM Engine</h3>
                    <p className="text-xs text-muted-foreground">Manage the active production queue, validate FIFO material availability, sum routing hours, and batch consolidate orders.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setIsStandaloneMode(true);
                            setDueDate("");
                            setJoNumber(`JO-FORECAST-${Math.floor(1000 + Math.random() * 9000)}`);
                            setSelectedSO(null);
                            setSelectedBatchCandidate(null);
                            setSelectedProductsList([]);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all cursor-pointer border-none shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Create Standalone JO
                    </button>
                    <Link 
                        href="/mm/production-workflow"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-xs font-bold transition-all"
                    >
                        <Play className="h-4 w-4" />
                        Go to Production Workflow
                    </Link>
                </div>
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

            {/* Main view container */}
            <div className="w-full space-y-6">
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
                    </div>
                )}

                {activeTab === "sales-orders" ? (
                    loadingSO ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-2 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="text-xs">Loading consolidation queue...</span>
                        </div>
                    ) : (
                        <BatchConsolidationTable
                            salesOrders={salesOrders}
                            soDetailsMap={soDetailsMap}
                            branches={branches}
                            selectedBranchId={selectedBranchId}
                            setSelectedBranchId={setSelectedBranchId}
                            onBatchCreated={() => {
                                setActiveTab("job-orders");
                            }}
                            selectedIds={selectedIds}
                            setSelectedIds={setSelectedIds}
                            products={products}
                        />
                    )
                ) : joViewMode === "manpower" ? (
                    <ManpowerWorkloadAnalysis 
                        jobOrders={filteredJobOrders}
                        users={users}
                    />
                 ) : (
                    /* Job Orders list tab */
                    (() => {
                        const displayedJobOrders = filteredJobOrders.filter(jo => {
                            // Status filter
                            const matchesStatus = statusFilter === "all" 
                                ? true 
                                : statusFilter === "finished" 
                                ? jo.status === "Finished" 
                                : jo.status !== "Finished" && jo.status !== "Cancelled";

                            if (!matchesStatus) return false;

                            // Search query filter (by JO ID, Product Name, or Ref SO / Order No)
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            const matchesJoId = jo.jo_id?.toLowerCase().includes(query);
                            const matchesProductName = jo.product_name?.toLowerCase().includes(query);
                            const matchesOrderNo = jo.order_no?.toLowerCase().includes(query);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const matchesProductsList = jo.products?.some((p: any) => 
                                p.product_name?.toLowerCase().includes(query)
                            );

                            return matchesJoId || matchesProductName || matchesOrderNo || matchesProductsList;
                        });

                        return (
                            <div className="space-y-4">
                                {/* Filter and Search Bar Toolbar */}
                                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-card p-3 border rounded-2xl shadow-xs">
                                    {/* Status Filter Buttons */}
                                    <div className="flex bg-slate-100 dark:bg-slate-900/50 shrink-0 rounded-xl overflow-hidden border w-full sm:max-w-xs select-none">
                                        <button
                                            onClick={() => setStatusFilter("all")}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all ${
                                                statusFilter === "all"
                                                    ? "bg-background text-foreground shadow-xs"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                            }`}
                                        >
                                            All ({filteredJobOrders.length})
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter("ongoing")}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all ${
                                                statusFilter === "ongoing"
                                                    ? "bg-background text-foreground shadow-xs"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                            }`}
                                        >
                                            Ongoing ({filteredJobOrders.filter(jo => jo.status !== "Finished" && jo.status !== "Cancelled").length})
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter("finished")}
                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all ${
                                                statusFilter === "finished"
                                                    ? "bg-background text-foreground shadow-xs"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                            }`}
                                        >
                                            Finished ({filteredJobOrders.filter(jo => jo.status === "Finished").length})
                                        </button>
                                    </div>

                                    {/* Search Input Bar */}
                                    <div className="relative w-full sm:max-w-xs">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search by JO ID, SKU, SO Ref..."
                                            className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-background text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        />
                                        {searchQuery && (
                                            <button 
                                                onClick={() => setSearchQuery("")}
                                                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer text-xs border-none bg-transparent hover:scale-110 transition-transform"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {displayedJobOrders.length === 0 ? (
                                    <div className="text-center p-12 border rounded-xl bg-card">
                                        <Cpu className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                                        <h4 className="text-xs font-bold text-foreground">No {statusFilter} Job Orders found</h4>
                                        <p className="text-[11px] text-muted-foreground mt-1">There are no job orders matching the selected status filter.</p>
                                    </div>
                                ) : (
                                    <JobOrdersList
                                        jobOrders={displayedJobOrders}
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
                                        modifyJobOrder={modifyJobOrder}
                                    />
                                )}
                            </div>
                        );
                    })()
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

            {/* Scheduling Pop-up Modal */}
            {(selectedSO || selectedBatchCandidate || isStandaloneMode) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-300">
                    <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/10">
                            <div>
                                <h4 className="text-sm font-black text-foreground">Schedule Production Job Order</h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Configure yield quantities, BOM formulas, and operations routing.</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setSelectedSO(null);
                                    setSelectedBatchCandidate(null);
                                    setIsStandaloneMode(false);
                                    setSelectedProductsList([]);
                                }} 
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-lg text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
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
                                shiftOption={shiftOption}
                                setShiftOption={setShiftOption}
                                handleUpdateProductCapacity={handleUpdateProductCapacity}
                                selectedBomVersionId={selectedBomVersionId}
                                setSelectedBomVersionId={setSelectedBomVersionId}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
