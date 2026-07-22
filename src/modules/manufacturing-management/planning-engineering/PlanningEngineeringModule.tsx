/* eslint-disable */
"use client";

import React, { useState } from "react";
import { Loader2, RefreshCw, ClipboardList, Layers, Database } from "lucide-react";
import { toast } from "sonner";
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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        allocationProgress,
        allocationStatus,
        versionStock,
        loadingVersionStock,
        isDirectAllocDialogOpen,
        setIsDirectAllocDialogOpen,
        handleConfirmDirectAllocate,
        unreleasedJobs,
        loadingJobs,
        releasingDraftId,
        handleReleaseDraftFromPlanning
    } = usePlanningEngineering();
    const [isBufferDialogOpen, setIsBufferDialogOpen] = useState(false);

    const [selectedUnreleasedJo, setSelectedUnreleasedJo] = useState<any | null>(null);
    const [joMaterials, setJoMaterials] = useState<any[]>([]);
    const [loadingMaterials, setLoadingMaterials] = useState(false);

    const [confirmReserveData, setConfirmReserveData] = useState<{
        joId: string;
        materialId: number;
        productId: number;
        receivingId: number;
        qty: number;
        lotNo: string;
        productName: string;
        isSubAssembly?: boolean;
    } | null>(null);

    const [reservingLot, setReservingLot] = useState(false);

    const [confirmUnreserveData, setConfirmUnreserveData] = useState<{
        joId: string;
        materialId: number;
        reservationId: number;
        qty: number;
        lotNo: string;
        productName: string;
        isSubAssembly?: boolean;
    } | null>(null);

    const handleOpenDetails = async (jo: any, silent = false) => {
        setSelectedUnreleasedJo(jo);
        if (!silent) setLoadingMaterials(true);
        try {
            const res = await fetch(`/api/manufacturing/planning-engineering?action=job-materials&joId=${jo.order_id}`);
            if (res.ok) {
                const data = await res.json();
                setJoMaterials(data);
            }
        } catch (err) {
            console.error("Failed to load materials for unreleased JO details modal:", err);
        } finally {
            if (!silent) setLoadingMaterials(false);
        }
    };

    const handleConfirmReserveAction = async () => {
        if (!confirmReserveData) return;
        const { joId, materialId, productId, receivingId, qty, lotNo, isSubAssembly } = confirmReserveData;
        setReservingLot(true);
        try {
            const res = await fetch("/api/manufacturing/planning-engineering", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "reserve-lot",
                    joId,
                    materialId,
                    productId,
                    receivingId,
                    qty,
                    isSubAssembly
                })
            });
            const data = await res.json();
            if (!res.ok || data.success === false) {
                throw new Error(data.error || "Failed to reserve lot.");
            }
            toast.success(`Successfully reserved ${qty.toLocaleString()} units from ${lotNo}!`);
            if (selectedUnreleasedJo) {
                await handleOpenDetails(selectedUnreleasedJo, true);
            }
            setConfirmReserveData(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to reserve lot.");
        } finally {
            setReservingLot(false);
        }
    };

    const handleConfirmUnreserveAction = async () => {
        if (!confirmUnreserveData) return;
        const { joId, materialId, reservationId, qty, lotNo, isSubAssembly } = confirmUnreserveData;
        setReservingLot(true);
        try {
            const res = await fetch("/api/manufacturing/planning-engineering", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "unreserve-lot",
                    joId,
                    materialId,
                    reservationId,
                    isSubAssembly
                })
            });
            const data = await res.json();
            if (!res.ok || data.success === false) {
                throw new Error(data.error || "Failed to unreserve lot.");
            }
            toast.success(`Successfully removed reservation of ${qty.toLocaleString()} units from ${lotNo}!`);
            if (selectedUnreleasedJo) {
                await handleOpenDetails(selectedUnreleasedJo, true);
            }
            setConfirmUnreserveData(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to unreserve lot.");
        } finally {
            setReservingLot(false);
        }
    };

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

                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => loadInitialData()} title="Reload Data">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Tabs-based Layout Dashboard */}
            <Tabs defaultValue="demand" className="w-full space-y-6">
                <TabsList className="grid grid-cols-3 max-w-[600px] h-10 bg-muted/60 p-1 border rounded-lg">
                    <TabsTrigger value="demand" className="flex items-center gap-2 font-semibold text-sm">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        Demand Harvesting
                    </TabsTrigger>
                    <TabsTrigger value="inventory" className="flex items-center gap-2 font-semibold text-sm">
                        <Database className="h-4 w-4 text-primary" />
                        Net Requirements
                    </TabsTrigger>
                    <TabsTrigger value="queue" className="flex items-center gap-2 font-semibold text-sm">
                        <Layers className="h-4 w-4 text-primary" />
                        Job Orders Queue
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: Demand Harvesting & Consolidation */}
                <TabsContent value="demand" className="space-y-6 outline-none">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left Column: Demand Lines Table (8 cols for maximum width) */}
                        <div className="lg:col-span-8">
                            <DemandLinesTable
                                loadingOrders={loadingOrders}
                                salesOrderLines={salesOrderLines}
                                selectedDetailIds={selectedDetailIds}
                                handleSelectLine={handleSelectLine}
                            />
                        </div>
                        {/* Right Column: Consolidation Action Panel (4 cols) */}
                        <div className="lg:col-span-4">
                            <ConsolidationPanel
                                selectedLines={selectedLines}
                                mergeValidation={mergeValidation}
                                handleInitiateRelease={handleInitiateRelease}
                                versionStock={versionStock}
                                loadingVersionStock={loadingVersionStock}
                                handleInitiateDirectAllocate={() => setIsDirectAllocDialogOpen(true)}
                            />
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 2: Net Requirements */}
                <TabsContent value="inventory" className="space-y-6 outline-none">
                    <div className="bg-card border rounded-xl shadow-sm">
                        <NetRequirementsTable
                            loadingRequirements={loadingRequirements}
                            netRequirements={netRequirements}
                            selectedBranchId={selectedBranchId}
                            branches={branches}
                        />
                    </div>
                </TabsContent>

                {/* TAB 3: Job Orders Queue */}
                <TabsContent value="queue" className="space-y-6 outline-none">
                    <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="space-y-1">
                                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                    <Layers className="h-5 w-5 text-primary" />
                                    Unreleased Job Orders Queue
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Monitor Draft or Planned Job Orders waiting for raw material stock replenishment or crew planning.
                                </p>
                            </div>
                            {loadingJobs && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    Updating queue...
                                </div>
                            )}
                        </div>

                        {unreleasedJobs.length === 0 ? (
                            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                                No unreleased (Draft or Planned) job orders found in this branch.
                            </div>
                        ) : (
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full text-sm text-left text-muted-foreground border-collapse">
                                    <thead className="text-xs uppercase bg-muted/40 font-bold border-b text-foreground">
                                        <tr>
                                            <th className="px-4 py-3">Job Order ID</th>
                                            <th className="px-4 py-3">Product Name</th>
                                            <th className="px-4 py-3 text-right">Target Qty</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Remarks / Constraints</th>
                                            <th className="px-4 py-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-foreground/90">
                                        {unreleasedJobs.map((jo: any) => (
                                            <tr key={jo.jo_id} className="hover:bg-muted/10">
                                                <td className="px-4 py-3 font-semibold text-primary">{jo.jo_id}</td>
                                                <td className="px-4 py-3 font-medium">{jo.product_name}</td>
                                                <td className="px-4 py-3 text-right font-semibold">{jo.quantity?.toLocaleString()} pcs</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                        jo.status === "Draft" 
                                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                                    }`}>
                                                        {jo.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs max-w-xs truncate text-muted-foreground" title={jo.remarks || ""}>
                                                    {jo.remarks || "No planning constraints logged."}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleOpenDetails(jo)}
                                                        className="border-primary/30 hover:border-primary text-primary hover:bg-primary/5 font-bold h-8 text-xs px-3 transition-all duration-200"
                                                    >
                                                        Manage / View Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

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
                        <AlertDialogDescription asChild>
                            {directAllocating ? (
                                <div className="space-y-4 py-4 text-foreground">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-primary">
                                        <span className="animate-pulse">{allocationStatus}</span>
                                        <span>{allocationProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden border">
                                        <div 
                                            className="h-full bg-green-500 rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${allocationProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground animate-pulse text-center">
                                        Processing inventory movement deductions and sales order status updates...
                                    </p>
                                </div>
                            ) : (
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
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {!directAllocating && (
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleConfirmDirectAllocate();
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold"
                            >
                                Confirm & Allocate
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    )}
                </AlertDialogContent>
            </AlertDialog>

            {/* Unreleased JO Details Modal */}
            <Dialog 
                open={selectedUnreleasedJo !== null} 
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedUnreleasedJo(null);
                        setJoMaterials([]);
                    }
                }}
            >
                <DialogContent className="sm:max-w-[1250px] max-h-[92vh] flex flex-col bg-background border border-border/80 shadow-2xl rounded-2xl p-0 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 border-b border-border/50 shrink-0">
                        <div className="flex justify-between items-center gap-4 pr-6">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                    Planning & Allocation Details
                                </span>
                                <DialogTitle className="font-extrabold text-xl tracking-tight text-foreground mt-2">
                                    {selectedUnreleasedJo?.jo_id}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-1">
                                    Product: <span className="font-bold text-foreground">{selectedUnreleasedJo?.product_name}</span> • Quantity: <span className="font-bold text-foreground">{selectedUnreleasedJo?.quantity?.toLocaleString()} pcs</span>
                                </DialogDescription>
                            </div>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                selectedUnreleasedJo?.status === "Draft" 
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}>
                                {selectedUnreleasedJo?.status}
                            </span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-muted/5">
                        <div className="bg-card border rounded-xl p-4 space-y-2 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div><span className="text-muted-foreground">Planning Remarks:</span> <span className="font-medium ml-1">{selectedUnreleasedJo?.remarks || "None"}</span></div>
                                <div><span className="text-muted-foreground">Shift Option:</span> <span className="font-medium ml-1">{selectedUnreleasedJo?.shiftOption || "8"} hours</span></div>
                                <div>
                                    <span className="text-muted-foreground">Estimated Duration:</span> 
                                    <span className="font-medium ml-1">
                                        {(() => {
                                            const setup = selectedUnreleasedJo?.routing_tasks?.reduce((sum: number, t: any) => sum + Number(t.planned_setup_hours || 0), 0) || 0;
                                            const run = selectedUnreleasedJo?.routing_tasks?.reduce((sum: number, t: any) => sum + Number(t.planned_run_hours || 0), 0) || 0;
                                            const total = setup + run;
                                            if (total === 0) return "Not estimated";
                                            const days = (total / Number(selectedUnreleasedJo?.shiftOption || 8)).toFixed(1);
                                            return `${total.toFixed(1)} hrs (~${days} Days)`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">BOM Materials Allocation Worksheet</h4>
                            
                            {loadingMaterials ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-sm text-muted-foreground font-medium">Resolving raw material reservations...</span>
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                                    <table className="w-full text-sm text-left text-muted-foreground border-collapse">
                                        <thead className="text-xs uppercase bg-muted/40 font-bold border-b text-foreground">
                                            <tr>
                                                <th className="px-4 py-3">Raw Material</th>
                                                <th className="px-4 py-3 text-right">Required</th>
                                                <th className="px-4 py-3 text-right">Reserved</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Candidate Lots & Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y text-foreground/90">
                                            {joMaterials.map((mat) => {
                                                 const needed = Number(mat.allocated_quantity || 0);
                                                 const reserved = Number(mat.reserved_quantity || 0);
                                                 const shortfall = needed - reserved;
                                                 const isMet = shortfall <= 0;

                                                 const totalAvailSubStock = mat.is_sub_assembly 
                                                     ? (mat.candidate_lots || []).reduce((acc: number, c: any) => acc + Number(c.available || 0), 0)
                                                     : 0;

                                                 return (
                                                     <tr key={mat.id || mat.jo_material_id} className="hover:bg-muted/5 align-top">
                                                         <td className="px-4 py-4 font-semibold text-foreground">
                                                             <div className="flex flex-col">
                                                                 <span>{mat.product_name}</span>
                                                                 {mat.is_sub_assembly && (
                                                                     <span className="text-[9px] uppercase font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md w-max mt-1">
                                                                         Sub-Assembly Byproduct
                                                                     </span>
                                                                 )}
                                                             </div>
                                                         </td>
                                                         <td className="px-4 py-4 text-right font-semibold">
                                                             {needed.toLocaleString()} {mat.unit_shortcut}
                                                         </td>
                                                         <td className="px-4 py-4 text-right font-semibold text-primary">
                                                             {reserved.toLocaleString()} {mat.unit_shortcut}
                                                         </td>
                                                         <td className="px-4 py-4">
                                                             {isMet ? (
                                                                 <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-md">
                                                                     ✓ Fully Reserved
                                                                 </span>
                                                             ) : (
                                                                 <div className="flex flex-col items-start gap-1.5">
                                                                     <span className="inline-flex items-center text-xs font-bold text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-md">
                                                                         ⚠ Shortfall: {shortfall.toLocaleString()}
                                                                     </span>
                                                                     {mat.is_sub_assembly ? (
                                                                         totalAvailSubStock > 0 ? (
                                                                             <Button
                                                                                 size="xs"
                                                                                 onClick={() => setConfirmReserveData({
                                                                                     joId: selectedUnreleasedJo.order_id,
                                                                                     materialId: mat.jo_material_id || mat.id,
                                                                                     productId: mat.product_id,
                                                                                     receivingId: 0,
                                                                                     qty: Math.min(shortfall, totalAvailSubStock),
                                                                                     lotNo: "Manufacturing Stock",
                                                                                     productName: mat.product_name,
                                                                                     isSubAssembly: true
                                                                                 })}
                                                                                 className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-6 text-[10px] px-2 rounded-md"
                                                                             >
                                                                                 Allocate Stock
                                                                             </Button>
                                                                         ) : (
                                                                             <Button
                                                                                 size="xs"
                                                                                 variant="outline"
                                                                                 onClick={() => {
                                                                                     setSelectedUnreleasedJo(null);
                                                                                     setJoMaterials([]);
                                                                                     window.location.href = "/mm/planning-engineering";
                                                                                 }}
                                                                                 className="text-xs text-primary border-primary/20 hover:bg-primary/5 font-semibold h-6 text-[10px] px-2 rounded-md"
                                                                             >
                                                                                 Queue Sub-Assembly JO
                                                                             </Button>
                                                                         )
                                                                     ) : (
                                                                         <Button
                                                                             size="sm"
                                                                             variant="link"
                                                                             onClick={() => {
                                                                                 setSelectedUnreleasedJo(null);
                                                                                 setJoMaterials([]);
                                                                                 window.location.href = "/mm/raw-materials";
                                                                             }}
                                                                             className="text-xs text-primary font-semibold hover:underline h-auto p-0"
                                                                         >
                                                                             Order Stock
                                                                         </Button>
                                                                     )}
                                                                 </div>
                                                             )}
                                                         </td>
                                                         <td className="px-4 py-4">
                                                             {(!mat.candidate_lots || mat.candidate_lots.length === 0) ? (
                                                                 <div className="text-xs text-amber-600 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 font-medium flex items-center justify-between gap-3">
                                                                     <span>{mat.is_sub_assembly ? "No completed manufacturing lots found." : "No Passed lots found in this branch."}</span>
                                                                     {!mat.is_sub_assembly && (
                                                                         <Button
                                                                             size="xs"
                                                                             onClick={() => {
                                                                                 setSelectedUnreleasedJo(null);
                                                                                 setJoMaterials([]);
                                                                                 window.location.href = "/mm/incoming-shipments";
                                                                             }}
                                                                             className="bg-amber-600 hover:bg-amber-500 text-white font-bold h-7 text-[10px] px-2.5 rounded-md shadow-sm shrink-0"
                                                                         >
                                                                             Log Receipt
                                                                         </Button>
                                                                     )}
                                                                 </div>
                                                             ) : (
                                                                 <div className="space-y-2 max-w-md">
                                                                     {mat.is_sub_assembly && reserved > 0 && (
                                                                         <div className="flex justify-end">
                                                                             <Button
                                                                                 size="xs"
                                                                                 variant="ghost"
                                                                                 onClick={() => setConfirmUnreserveData({
                                                                                     joId: selectedUnreleasedJo.order_id,
                                                                                     materialId: mat.jo_material_id || mat.id,
                                                                                     reservationId: 0,
                                                                                     qty: reserved,
                                                                                     lotNo: "Manufacturing Stock",
                                                                                     productName: mat.product_name,
                                                                                     isSubAssembly: true
                                                                                 })}
                                                                                 className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold h-6 px-2 text-[10px] transition-all"
                                                                             >
                                                                                 Clear Allocations
                                                                             </Button>
                                                                         </div>
                                                                     )}
                                                                     
                                                                     {mat.candidate_lots.map((lot: any) => {
                                                                         const isReserved = !!lot.reservation_id;
                                                                         
                                                                         return (
                                                                             <div key={lot.receipt_id} className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-4 ${
                                                                                 isReserved 
                                                                                     ? "border-emerald-600/30 bg-emerald-500/5" 
                                                                                     : "border-border bg-muted/10 hover:border-primary/20 transition-all"
                                                                             }`}>
                                                                                 <div>
                                                                                     <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                                                         {lot.lot_no}
                                                                                         {isReserved && mat.is_sub_assembly && (
                                                                                             <span className="text-[9px] font-extrabold uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">
                                                                                                 Allocated: {lot.reserved_qty_for_this_lot?.toLocaleString()}
                                                                                             </span>
                                                                                         )}
                                                                                     </div>
                                                                                     <div className="text-[10px] text-muted-foreground mt-0.5">Source: {lot.receipt_no}</div>
                                                                                 </div>
                                                                                 <div className="flex items-center gap-2 shrink-0">
                                                                                     <span className={`font-mono font-bold ${isReserved ? "text-emerald-600" : "text-foreground"}`}>
                                                                                         {lot.available.toLocaleString()} available
                                                                                     </span>
                                                                                     {!mat.is_sub_assembly && (
                                                                                         isReserved ? (
                                                                                             <Button
                                                                                                 size="xs"
                                                                                                 variant="ghost"
                                                                                                 onClick={() => setConfirmUnreserveData({ joId: selectedUnreleasedJo.order_id, materialId: mat.jo_material_id || mat.id, reservationId: lot.reservation_id, qty: lot.reserved_qty_for_this_lot, lotNo: lot.lot_no, productName: mat.product_name })}
                                                                                                 className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold h-6 px-2 text-[10px] transition-all"
                                                                                             >
                                                                                                 Unreserve
                                                                                             </Button>
                                                                                         ) : (
                                                                                             shortfall > 0 && lot.available > 0 && (
                                                                                                 <Button
                                                                                                     size="xs"
                                                                                                     onClick={() => setConfirmReserveData({ joId: selectedUnreleasedJo.order_id, materialId: mat.jo_material_id || mat.id, productId: mat.product_id, receivingId: lot.receipt_id, qty: Math.min(shortfall, lot.available), lotNo: lot.lot_no, productName: mat.product_name })}
                                                                                                     className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-6 px-2.5 text-[10px] shadow-sm rounded-md transition-all"
                                                                                                 >
                                                                                                     Reserve
                                                                                                 </Button>
                                                                                             )
                                                                                         )
                                                                                     )}
                                                                                 </div>
                                                                             </div>
                                                                         );
                                                                     })}
                                                                 </div>
                                                             )}
                                                         </td>
                                                     </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-muted/20 border-t shrink-0 flex justify-between items-center gap-3">
                        <Button 
                            variant="outline" 
                            className="font-bold h-10 px-5 text-xs" 
                            onClick={() => {
                                setSelectedUnreleasedJo(null);
                                setJoMaterials([]);
                            }}
                        >
                            Close Details
                        </Button>
                        <Button
                            onClick={async () => {
                                const id = selectedUnreleasedJo.order_id;
                                setSelectedUnreleasedJo(null);
                                setJoMaterials([]);
                                await handleReleaseDraftFromPlanning(id);
                            }}
                            disabled={releasingDraftId === selectedUnreleasedJo?.order_id || loadingMaterials}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-5 text-xs shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-200"
                        >
                            {releasingDraftId === selectedUnreleasedJo?.order_id ? "Releasing..." : "Release to Shop Floor"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Custom Reserve Confirmation Dialog */}
            <AlertDialog open={confirmReserveData !== null} onOpenChange={(open) => { if (!open && !reservingLot) setConfirmReserveData(null); }}>
                <AlertDialogContent className="rounded-2xl max-w-md border border-border shadow-2xl p-6 bg-background">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
                            Confirm Material Reservation
                        </AlertDialogTitle>
                        <div className="space-y-4 pt-2 text-sm text-muted-foreground">
                            <p>
                                Are you sure you want to reserve stock from this lot for the production run?
                            </p>
                            <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl space-y-1.5 font-medium text-foreground">
                                <div><span className="text-muted-foreground">Material:</span> <span className="font-bold">{confirmReserveData?.productName}</span></div>
                                <div><span className="text-muted-foreground">Lot Number:</span> <span className="font-mono font-bold">{confirmReserveData?.lotNo}</span></div>
                                <div><span className="text-muted-foreground">Qty to Reserve:</span> <span className="font-extrabold text-emerald-600">{confirmReserveData?.qty?.toLocaleString()} units</span></div>
                            </div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6 flex gap-3">
                        <AlertDialogCancel disabled={reservingLot} className="font-bold h-10 px-5 rounded-lg border-border">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmReserveAction();
                            }}
                            disabled={reservingLot}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-5 rounded-lg shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {reservingLot ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Reserving...
                                </>
                            ) : (
                                "Confirm Reservation"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Custom Unreserve Confirmation Dialog */}
            <AlertDialog open={confirmUnreserveData !== null} onOpenChange={(open) => { if (!open && !reservingLot) setConfirmUnreserveData(null); }}>
                <AlertDialogContent className="rounded-2xl max-w-md border border-border shadow-2xl p-6 bg-background">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-extrabold text-foreground flex items-center gap-2">
                            Remove Reservation
                        </AlertDialogTitle>
                        <div className="space-y-4 pt-2 text-sm text-muted-foreground">
                            <p className="text-red-500/80">
                                Warning: Unreserving this lot will make the allocated quantity available to other planning Job Orders.
                            </p>
                            <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-xl space-y-1.5 font-medium text-foreground">
                                <div><span className="text-muted-foreground">Material:</span> <span className="font-bold">{confirmUnreserveData?.productName}</span></div>
                                <div><span className="text-muted-foreground">Lot Number:</span> <span className="font-mono font-bold">{confirmUnreserveData?.lotNo}</span></div>
                                <div><span className="text-muted-foreground">Qty to Free:</span> <span className="font-extrabold text-red-600">{confirmUnreserveData?.qty?.toLocaleString()} units</span></div>
                            </div>
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-6 flex gap-3">
                        <AlertDialogCancel disabled={reservingLot} className="font-bold h-10 px-5 rounded-lg border-border">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmUnreserveAction();
                            }}
                            disabled={reservingLot}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold h-10 px-5 rounded-lg shadow-md shadow-red-500/10 hover:shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {reservingLot ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Unreserving...
                                </>
                            ) : (
                                "Confirm Unreserve"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
