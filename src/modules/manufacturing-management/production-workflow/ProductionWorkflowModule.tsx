/* eslint-disable */
"use client";

import React, { useState } from "react";
import { RefreshCw, ClipboardCheck, Users, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProductionWorkflow } from "./hooks/useProductionWorkflow";
import { ReleasedJobQueue } from "./components/ReleasedJobQueue";
import { JobDetailsHeader } from "./components/JobDetailsHeader";
import { RoutingSequence } from "./components/RoutingSequence";
import OperatorPanel from "./components/OperatorPanel";
import { QAChecklistModal } from "./components/QAChecklistModal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { JobOrderShiftLogModal } from "./components/JobOrderShiftLogModal";

export default function ProductionWorkflowModule() {
    const {
        jobOrders,
        users,
        selectedJobOrderId,
        setSelectedJobOrderId,
        selectedTaskId,
        setSelectedTaskId,
        routeOperators,
        operatorsSummary,
        loadingJobs,
        loadingOperators,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        selectedAssigneeId,
        setSelectedAssigneeId,
        manualHours,
        setManualHours,
        activeManualUserId,
        setActiveManualUserId,
        qaModalOpen,
        setQaModalOpen,
        qaTemplate,
        qaParameters,
        qaValues,
        setQaValues,
        qaInspectorId,
        setQaInspectorId,
        qaYieldQty,
        setQaYieldQty,
        qaComments,
        setQaComments,
        submittingQA,
        selectedJobOrder,
        sortedTasks,
        activeStep,
        selectedTask,
        fetchJobs,
        handleAddOperator,
        handleRemoveOperator,
        handleStartTimer,
        handleStopTimer,
        handleSaveManualHours,
        handleCompleteStepClick,
        handleSubmitQA,
        filteredJobOrders,
        branches,
        selectedBranchFilter,
        setSelectedBranchFilter
    } = useProductionWorkflow();

    const [clockedInCount, setClockedInCount] = React.useState(0);
    const [isShiftLogOpen, setIsShiftLogOpen] = useState(false);
    const isMountedRef = React.useRef(true);

    const fetchClockedIn = React.useCallback(async () => {
        try {
            const res = await fetch("/api/manufacturing/production/route-operators");
            if (res.ok && isMountedRef.current) {
                const json = await res.json();
                const active = (json.data || []).filter((r: any) => r.started_at !== null && r.stopped_at === null);
                setClockedInCount(active.length);
            }
        } catch (err) {
            console.error("Error loading active operators count:", err);
        }
    }, []);

    React.useEffect(() => {
        isMountedRef.current = true;
        fetchClockedIn();
        const interval = setInterval(fetchClockedIn, 10000);
        return () => {
            isMountedRef.current = false;
            clearInterval(interval);
        };
    }, [fetchClockedIn]);

    const activeRuns = React.useMemo(() => {
        return jobOrders.filter((jo) => jo.status === "Proceed" || jo.status === "Ongoing").length;
    }, [jobOrders]);

    const totalRuns = jobOrders.length;

    const completedWorkstations = React.useMemo(() => {
        let count = 0;
        jobOrders.forEach((jo) => {
            const tasks = jo.routing_tasks || jo.routingTasks || [];
            tasks.forEach((t) => {
                if (t.status === "Completed") {
                    count++;
                }
            });
        });
        return count;
    }, [jobOrders]);

    const parentJo = selectedJobOrder?.parentJobOrderId ? jobOrders.find((j) => Number(j.order_id) === Number(selectedJobOrder.parentJobOrderId)) : null;
    const parentJoNo = parentJo?.jo_id || null;

    return (
        <div className="flex flex-col space-y-6 max-w-7xl mx-auto p-1 sm:p-2">
            
            {/* Header Toolbar */}
            <div className="relative overflow-hidden bg-gradient-to-br from-card via-card to-muted/30 p-6 rounded-2xl border shadow-md transition-all duration-300">
                {/* Decorative glow background element */}
                <div className="absolute -right-16 -top-16 w-36 h-36 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative z-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                            <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </div>
                            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                Terminal Live
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                            Shop Floor WIP Execution Terminal
                        </h1>
                        <p className="text-sm text-muted-foreground max-w-xl">
                            Ruggedized touch-friendly terminal for real-time tracking, operator check-ins, and QA checklist gates.
                        </p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                        <Button 
                            variant="outline" 
                            size="default" 
                            onClick={() => {
                                fetchJobs(selectedJobOrderId);
                                fetchClockedIn();
                            }}
                            className="w-full md:w-auto shadow-sm hover:shadow-md transition-all bg-background border-input hover:bg-accent"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" /> Reload Terminal
                        </Button>
                    </div>
                </div>
            </div>

            {/* Live Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Active Runs Card */}
                <div className="flex items-center justify-between p-5 bg-gradient-to-br from-card to-muted/20 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Runs</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-foreground">{activeRuns}</span>
                            <span className="text-xs text-muted-foreground">/ {totalRuns} Job Orders</span>
                        </div>
                    </div>
                    <div className="p-3 bg-primary/10 text-primary rounded-xl">
                        <ClipboardCheck className="h-6 w-6 stroke-1.5" />
                    </div>
                </div>

                {/* Clocked-in Operators Card */}
                <div className="flex items-center justify-between p-5 bg-gradient-to-br from-card to-muted/20 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Clocked-in Operators</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-foreground">{clockedInCount}</span>
                            <span className="text-xs text-muted-foreground">active on floor</span>
                        </div>
                    </div>
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                        <Users className="h-6 w-6 stroke-1.5" />
                    </div>
                </div>

                {/* Completed Workstations Card */}
                <div className="flex items-center justify-between p-5 bg-gradient-to-br from-card to-muted/20 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed Workstations</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-foreground">{completedWorkstations}</span>
                            <span className="text-xs text-muted-foreground">steps completed</span>
                        </div>
                    </div>
                    <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                        <CheckCircle2 className="h-6 w-6 stroke-1.5" />
                    </div>
                </div>
            </div>

            {/* Main Terminal Workspace Layout */}
            <div className="w-full">
                <ReleasedJobQueue
                    filteredJobOrders={filteredJobOrders}
                    jobOrders={jobOrders}
                    selectedJobOrderId={selectedJobOrderId}
                    setSelectedJobOrderId={setSelectedJobOrderId}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    loadingJobs={loadingJobs}
                    branches={branches}
                    selectedBranchFilter={selectedBranchFilter}
                    setSelectedBranchFilter={setSelectedBranchFilter}
                />
            </div>

            {/* Focused Full-Featured Job Order Details Modal */}
            <Dialog 
                open={selectedJobOrderId !== "" && selectedJobOrder !== null} 
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedJobOrderId("");
                        setSelectedTaskId(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-[1200px] w-[95vw] h-[92vh] flex flex-col bg-background border border-border/80 shadow-2xl rounded-2xl p-0 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-6 border-b border-border/50 shrink-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    Job Order Details Terminal
                                </span>
                                <DialogTitle className="font-extrabold text-2xl tracking-tight text-foreground mt-1">
                                    {selectedJobOrder?.order_no || `JO #${selectedJobOrder?.jo_id}`}
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm font-medium">
                                    Product: {selectedJobOrder?.product_name} • Total Quantity: {selectedJobOrder?.quantity.toLocaleString()} pcs
                                </DialogDescription>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pr-12 mr-2">
                                <Button
                                    onClick={() => setIsShiftLogOpen(true)}
                                    className="bg-primary hover:bg-primary/95 text-white font-bold h-10 text-xs px-5 shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all duration-200"
                                >
                                    <ClipboardCheck className="mr-1.5 h-4.5 w-4.5" /> Log Shift / Daily Yield
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Workspace Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-muted/5">
                        {parentJoNo && (
                            <div className="p-3 bg-amber-500/10 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl text-xs font-semibold">
                                Note: This is a sub-assembly Job Order linked to Parent Job Order: {parentJoNo}.
                            </div>
                        )}

                        {/* Sequential Routing Steps Timeline */}
                        <RoutingSequence
                            sortedTasks={sortedTasks}
                            selectedTaskId={selectedTaskId}
                            setSelectedTaskId={setSelectedTaskId}
                            operatorsSummary={operatorsSummary}
                        />

                        {/* Unified Team Allocation List */}
                        <div className="space-y-6">
                            {sortedTasks.map((task) => (
                                <OperatorPanel
                                    key={task.id}
                                    selectedTask={task}
                                    activeStep={activeStep}
                                    selectedJobOrder={selectedJobOrder!}
                                    sortedTasks={sortedTasks}
                                    users={users}
                                    routeOperators={routeOperators.filter((op) => op.task_id === task.id)}
                                    loadingOperators={loadingOperators}
                                    handleAddOperator={handleAddOperator}
                                    handleRemoveOperator={handleRemoveOperator}
                                    handleStartTimer={handleStartTimer}
                                    handleStopTimer={handleStopTimer}
                                    handleSaveManualHours={handleSaveManualHours}
                                    handleCompleteStepClick={handleCompleteStepClick}
                                />
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- JOB ORDER LEVEL SHIFT RUN RECONCILIATION MODAL --- */}
            {selectedJobOrder && (
                <JobOrderShiftLogModal
                    open={isShiftLogOpen}
                    onOpenChange={setIsShiftLogOpen}
                    selectedJobOrder={selectedJobOrder!}
                    sortedTasks={sortedTasks}
                    activeStep={activeStep}
                    users={users}
                    allJobOperators={routeOperators}
                    onSuccess={() => fetchJobs(selectedJobOrderId)}
                />
            )}

            {/* --- QA GATE CHECKLIST MODAL DIALOG --- */}
            <QAChecklistModal
                qaModalOpen={qaModalOpen}
                setQaModalOpen={setQaModalOpen}
                selectedTask={selectedTask}
                selectedJobOrder={selectedJobOrder!}
                users={users}
                routeOperators={routeOperators}
                qaTemplate={qaTemplate}
                qaParameters={qaParameters}
                qaValues={qaValues}
                setQaValues={setQaValues}
                qaInspectorId={qaInspectorId}
                setQaInspectorId={setQaInspectorId}
                qaYieldQty={qaYieldQty}
                setQaYieldQty={setQaYieldQty}
                qaComments={qaComments}
                setQaComments={setQaComments}
                submittingQA={submittingQA}
                handleSubmitQA={handleSubmitQA}
            />

        </div>
    );
}
