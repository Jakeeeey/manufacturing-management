/* eslint-disable */
"use client";

import React, { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { usePlanningEngineering } from "./hooks/usePlanningEngineering";
import { NetRequirementsTable } from "./components/NetRequirementsTable";
import { ConsolidationPanel } from "./components/ConsolidationPanel";
import { DemandLinesTable } from "./components/DemandLinesTable";
import { ReleaseJODialog } from "./components/ReleaseJODialog";
import { CreateBufferJODialog } from "./components/CreateBufferJODialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PlanningEngineeringModule() {
    const {
        loadingBranches,
        loadingOrders,
        loadingRequirements,
        releasingJO,
        branches,
        netRequirements,
        selectedBranchId,
        setSelectedBranchId,
        selectedDetailIds,
        isConfirmOpen,
        setIsConfirmOpen,
        targetQuantity,
        setTargetQuantity,
        dueDate,
        setDueDate,
        shiftOption,
        setShiftOption,
        remarks,
        setRemarks,
        joNumber,
        setJoNumber,
        loadInitialData,
        salesOrderLines,
        selectedLines,
        mergeValidation,
        handleSelectAll,
        handleSelectLine,
        handleInitiateRelease,
        handleConfirmRelease,
        assignments,
        setAssignments,
        directAllocating,
        versionStock,
        loadingVersionStock,
        isDirectAllocDialogOpen,
        setIsDirectAllocDialogOpen,
        handleConfirmDirectAllocate
    } = usePlanningEngineering();
    const [isBufferDialogOpen, setIsBufferDialogOpen] = useState(false);

    return (
        <div className="space-y-6 p-1 sm:p-2">
            {/* Header banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border rounded-xl p-6 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Planning & Engineering</h1>
                    <p className="text-sm text-muted-foreground">
                        Harvest sales order demand, run branch-scoped Net Requirements calculations, batch consolidate orders, and explode/release Job Orders.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {/* Branch Dropdown */}
                    {loadingBranches ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            Loading branches...
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Target Branch:</span>
                            <Select
                                value={String(selectedBranchId || "")}
                                onValueChange={(val) => setSelectedBranchId(Number(val))}
                            >
                                <SelectTrigger className="w-[200px] h-9 font-semibold text-sm">
                                    <SelectValue placeholder="Select target branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map((b) => (
                                        <SelectItem key={b.id} value={String(b.id)}>
                                            {b.branch_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <Button variant="default" className="h-9 font-semibold" onClick={() => setIsBufferDialogOpen(true)}>
                        Create Buffer JO
                    </Button>

                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={loadInitialData} title="Reload Data">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Column: Net Requirements (7 cols on large) */}
                <div className="lg:col-span-7 space-y-6">
                    <NetRequirementsTable
                        loadingRequirements={loadingRequirements}
                        netRequirements={netRequirements}
                        selectedBranchId={selectedBranchId}
                        branches={branches}
                    />
                </div>

                {/* Right Column: Demand Harvest & Consolidation (5 cols on large) */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Consolidation Action Panel */}
                    <ConsolidationPanel
                        selectedLines={selectedLines}
                        mergeValidation={mergeValidation}
                        handleInitiateRelease={handleInitiateRelease}
                        versionStock={versionStock}
                        loadingVersionStock={loadingVersionStock}
                        handleInitiateDirectAllocate={() => setIsDirectAllocDialogOpen(true)}
                    />

                    {/* Unfulfilled Demand lines table */}
                    <DemandLinesTable
                        loadingOrders={loadingOrders}
                        salesOrderLines={salesOrderLines}
                        selectedDetailIds={selectedDetailIds}
                        handleSelectAll={handleSelectAll}
                        handleSelectLine={handleSelectLine}
                    />
                </div>
            </div>

            {/* Release Job Order Dialog */}
            <ReleaseJODialog
                isConfirmOpen={isConfirmOpen}
                setIsConfirmOpen={setIsConfirmOpen}
                selectedLines={selectedLines}
                branches={branches}
                selectedBranchId={selectedBranchId}
                joNumber={joNumber}
                setJoNumber={setJoNumber}
                targetQuantity={targetQuantity}
                setTargetQuantity={setTargetQuantity}
                dueDate={dueDate}
                setDueDate={setDueDate}
                shiftOption={shiftOption}
                setShiftOption={setShiftOption}
                remarks={remarks}
                setRemarks={setRemarks}
                releasingJO={releasingJO}
                handleConfirmRelease={handleConfirmRelease}
                assignments={assignments}
                setAssignments={setAssignments}
            />

            {/* Create Buffer Job Order Dialog */}
            <CreateBufferJODialog
                isOpen={isBufferDialogOpen}
                onOpenChange={setIsBufferDialogOpen}
                branches={branches}
                initialBranchId={selectedBranchId}
                onSuccess={loadInitialData}
            />

            {/* Direct Allocation Confirmation Dialog */}
            <AlertDialog open={isDirectAllocDialogOpen} onOpenChange={setIsDirectAllocDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Direct Allocation & Invoice Bypass</AlertDialogTitle>
                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>
                                Are you sure you want to directly allocate inventory for the selected Sales Order lines?
                            </p>
                            <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1 font-medium border text-foreground">
                                <div><strong>Product:</strong> {selectedLines[0]?.product_id?.product_name}</div>
                                <div><strong>Recipe Version:</strong> {selectedLines[0]?.bom_version_name || "Default"}</div>
                                <div><strong>Allocated Quantity:</strong> {selectedLines.reduce((sum, l) => sum + Number(l.ordered_quantity), 0).toLocaleString()}</div>
                                <div><strong>Available Version Stock:</strong> {versionStock?.toLocaleString()}</div>
                            </div>
                            <p className="text-xs">
                                This action will immediately deduct inventory lots using FIFO selection, post negative ledger entries, and transition the Sales Order to &quot;For Invoicing&quot;. This cannot be undone.
                            </p>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={directAllocating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmDirectAllocate();
                            }}
                            disabled={directAllocating}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold"
                        >
                            {directAllocating ? "Allocating..." : "Confirm & Allocate"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
