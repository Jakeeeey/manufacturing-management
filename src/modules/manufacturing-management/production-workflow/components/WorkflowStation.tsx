"use client";

import React from "react";
import { 
    Cpu, 
    Users, 
    CheckCircle, 
    Calendar, 
    Loader2, 
    Sparkles, 
    ShieldCheck, 
    Play, 
    Save, 
    CheckSquare, 
    Check, 
    RotateCcw, 
    Info, 
    UserPlus, 
    Camera 
} from "lucide-react";
import { JobOrder, ActiveAssigningTask } from "../types";

interface UserMin {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_position?: string | null;
}

interface WorkflowRouting {
    routing_id: number;
    operation_name: string;
    sequence_order: number;
    estimated_labor_cost?: number | string;
    estimated_overhead_cost?: number | string;
    duration_hours?: number | string;
    qa_status?: string;
    requires_qa?: boolean;
    requiresQA?: boolean;
    assigned_personnel?: {
        name: string;
        position?: string;
    } | null;
}

interface WorkflowProduct {
    product_id: number;
    product_name: string;
    quantity: number;
    routings?: WorkflowRouting[];
}

interface WorkflowStationProps {
    selectedJO: JobOrder | null;
    selectedDayNum: number | null;
    setSelectedDayNum: (day: number | null) => void;
    handleUpdateJO: (joId: string, payload: Record<string, unknown>) => Promise<unknown>;
    productsList: WorkflowProduct[];
    assigningStepKeys: Record<string, boolean>;
    setActiveAssigningTask: (task: ActiveAssigningTask | null) => void;
    setOperatorSearchText: (text: string) => void;
    users: UserMin[];
    handleToggleOperatorForTask: (jo: JobOrder, productId: number, routingId: number, userId: number, assign: boolean) => Promise<void>;
    handleOpenQADialog: (jo: JobOrder, productId: number, routingId: number, expected: number, taskName: string) => Promise<void>;
    handleVerifyQAForTask: (
        jo: JobOrder,
        productId: number,
        routingId: number,
        qaStatus: "Passed" | "Pending",
        actualQty?: number,
        comments?: string,
        photos?: string[],
        skipQA?: boolean
    ) => Promise<void>;
    allStepsCompleted: boolean;
    handleSubmitFinishedReceipt: (e: React.FormEvent) => Promise<void>;
    yieldQties: Record<number, number>;
    setYieldQties: React.Dispatch<React.SetStateAction<Record<number, number>>>;
    lotNumbers: Record<number, string>;
    setLotNumbers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    expiryDates: Record<number, string>;
    setExpiryDates: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    submittingReceipt: boolean;
    activeJOs: JobOrder[];
    onBackToQueue?: () => void;
}

export function WorkflowStation({
    selectedJO,
    selectedDayNum,
    setSelectedDayNum,
    handleUpdateJO,
    productsList,
    assigningStepKeys,
    setActiveAssigningTask,
    setOperatorSearchText,
    users,
    handleToggleOperatorForTask,
    handleOpenQADialog,
    handleVerifyQAForTask,
    allStepsCompleted,
    handleSubmitFinishedReceipt,
    yieldQties,
    setYieldQties,
    lotNumbers,
    setLotNumbers,
    expiryDates,
    setExpiryDates,
    submittingReceipt,
    activeJOs,
    onBackToQueue
}: WorkflowStationProps) {
    const [filterStatus, setFilterStatus] = React.useState<"All" | "Pending" | "Ongoing" | "Completed">("All");

    const activeDay = React.useMemo(() => {
        if (!selectedJO || !selectedJO.dailyBreakdown) return null;
        const ongoing = selectedJO.dailyBreakdown.find((d) => d.status === "Ongoing");
        if (ongoing) return ongoing.day;
        const pending = selectedJO.dailyBreakdown.find((d) => d.status === "Pending" || !d.status);
        if (pending) return pending.day;
        return null;
    }, [selectedJO]);

    const filteredDays = React.useMemo(() => {
        if (!selectedJO || !selectedJO.dailyBreakdown) return [];
        if (filterStatus === "All") return selectedJO.dailyBreakdown;
        return selectedJO.dailyBreakdown.filter((day) => {
            const status = day.status || "Pending";
            if (filterStatus === "Pending") return status === "Pending";
            if (filterStatus === "Ongoing") return status === "Ongoing";
            if (filterStatus === "Completed") return status === "Completed";
            return true;
        });
    }, [selectedJO, filterStatus]);

    if (!selectedJO) {
        return (
            <div className="flex flex-col items-center justify-center border border-slate-800 rounded-2xl bg-card p-12 text-center space-y-6 shadow-sm min-h-[50dvh]">
                <div className="p-4 bg-primary/10 rounded-full text-primary animate-pulse">
                    <Cpu className="h-10 w-10 sm:h-12 sm:w-12" />
                </div>
                <div className="max-w-md space-y-2">
                    <h4 className="text-sm font-extrabold text-foreground tracking-wide uppercase">Shop Floor Operator Console</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Select a Job Order from the active queue to view daily schedules, assign operators, and log completed production steps.
                    </p>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-3 gap-4 w-full max-w-sm pt-4 border-t border-slate-800/80">
                    <div className="text-center">
                        <span className="block text-lg font-black text-emerald-500">
                            {activeJOs.filter(j => j.status === "Proceed").length}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold">Ready</span>
                    </div>
                    <div className="text-center border-x border-slate-800">
                        <span className="block text-lg font-black text-sky-500">
                            {activeJOs.filter(j => j.status === "Ongoing").length}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold">Ongoing</span>
                    </div>
                    <div className="text-center">
                        <span className="block text-lg font-black text-amber-500">
                            {activeJOs.filter(j => j.status === "On Hold").length}
                        </span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold">Paused</span>
                    </div>
                </div>
            </div>
        );
    }

    const isDayCompleted = selectedDayNum !== null && selectedJO
        ? selectedJO.dailyBreakdown?.find((d) => d.day === selectedDayNum)?.status === "Completed"
        : false;

    return (
        <div className="border border-slate-800 rounded-2xl bg-card p-6 shadow-sm space-y-6 max-h-[82dvh] overflow-y-auto pr-2">
            
            {/* Mobile Back Button */}
            {onBackToQueue && (
                <button
                    type="button"
                    onClick={onBackToQueue}
                    className="lg:hidden inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-black bg-slate-900/60 hover:bg-slate-850 px-3.5 py-2.5 rounded-xl border border-slate-800 active:scale-95 transition-all w-full sm:w-auto justify-center cursor-pointer"
                >
                    ← Back to Production Queue
                </button>
            )}

            {/* Card Header & Start Production Toggle */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-black px-2.5 py-0.5 rounded-lg font-mono">
                            {selectedJO.jo_id}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                            Ref SO: #{selectedJO.order_no || "N/A"}
                        </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-foreground tracking-tight">
                        {selectedJO.product_name}
                    </h3>
                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-semibold">
                        <span className="text-foreground font-bold">{selectedJO.quantity.toLocaleString()} PCS Total Target</span>
                        <span>Branch ID: {selectedJO.branch_id}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {selectedJO.status === "Proceed" && (
                        <button
                            onClick={() => handleUpdateJO(selectedJO.jo_id, { status: "Ongoing" })}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-md border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Play className="h-3.5 w-3.5 fill-white" /> Start Production Run
                        </button>
                    )}

                    {selectedJO.status === "Ongoing" && (
                        <button
                            onClick={() => handleUpdateJO(selectedJO.jo_id, { status: "On Hold" })}
                            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-md border-none cursor-pointer transition-all"
                        >
                            Pause Workflow
                        </button>
                    )}

                    {selectedJO.status === "On Hold" && (
                        <button
                            onClick={() => handleUpdateJO(selectedJO.jo_id, { status: "Ongoing" })}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-md border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Play className="h-3.5 w-3.5 fill-white" /> Resume Production
                        </button>
                    )}
                </div>
            </div>

            {/* Job Order Routing steps timeline */}
            <div className="space-y-6">
                {/* Guided Process Guide Card */}
                <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3.5">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                        <Sparkles className="h-5 w-5 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-xs font-extrabold text-foreground tracking-wide uppercase">Shop Floor Process Guide</h4>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            This production run is split into daily targets. Tap a day button in the schedule below, review/assign operators, and complete the checklist steps in sequence. Steps requiring QA will prompt you to enter actual yields and take a photo of the completed step.
                        </p>
                    </div>
                </div>

                {selectedJO.dailyBreakdown && selectedJO.dailyBreakdown.length > 0 && (
                    <div className="bg-slate-950/20 border border-slate-800/80 rounded-2xl p-4.5 space-y-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-primary" />
                                Daily Runs Schedule
                            </span>
                            {selectedDayNum !== null ? (
                                <span className="self-start inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                                    Selected: Day {selectedDayNum} ({selectedJO.dailyBreakdown.find((d) => d.day === selectedDayNum)?.date || "N/A"})
                                </span>
                            ) : (
                                <span className="self-start inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                                    Selected: Overview (Whole JO)
                                </span>
                            )}
                        </div>

                        {/* Interactive Filtering and Jump Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-2 rounded-xl border border-slate-800/80">
                            <div className="flex flex-wrap gap-1">
                                {(["All", "Pending", "Ongoing", "Completed"] as const).map((status) => {
                                    const count = status === "All" 
                                        ? selectedJO.dailyBreakdown?.length 
                                        : selectedJO.dailyBreakdown?.filter((d) => (d.status || "Pending") === status).length;
                                    return (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setFilterStatus(status)}
                                            className={`px-2.5 py-1.5 rounded-lg text-[9.5px] font-bold transition-all border cursor-pointer ${
                                                filterStatus === status
                                                    ? "bg-slate-100 border-white text-slate-950 shadow-sm"
                                                    : "bg-slate-900/60 border-slate-800 text-muted-foreground hover:text-foreground hover:bg-slate-850"
                                            }`}
                                        >
                                            {status} ({count || 0})
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedDayNum(null)}
                                    className={`px-3 py-1.5 rounded-lg text-[9.5px] font-bold transition-all border cursor-pointer ${
                                        selectedDayNum === null
                                            ? "bg-primary border-primary text-primary-foreground shadow-md font-black"
                                            : "bg-slate-900/60 border-slate-800 text-muted-foreground hover:text-foreground hover:bg-slate-850"
                                    }`}
                                >
                                    Summary Mode
                                </button>
                                {activeDay !== null && activeDay !== selectedDayNum && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDayNum(activeDay)}
                                        className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[9.5px] font-black px-3 py-1.5 rounded-lg transition-all border-none cursor-pointer shadow-md"
                                    >
                                        🎯 Jump to Active (Day {activeDay})
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Scroll-Constrained Grid Container */}
                        <div className="max-h-[230px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                            {filteredDays.length === 0 ? (
                                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-slate-800/80 rounded-xl">
                                    No day schedules match the &quot;{filterStatus}&quot; filter status.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {filteredDays.map((day) => {
                                        const isSelected = selectedDayNum === day.day;
                                        let statusStyle = "border-slate-800 text-muted-foreground bg-slate-900/40 hover:bg-slate-850";
                                        let statusLabel = "Pending";
                                        let statusIcon = "⏳";
                                        
                                        if (day.status === "Completed") {
                                            statusStyle = isSelected 
                                                ? "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-[1.02]" 
                                                : "border-emerald-500/35 text-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10";
                                            statusLabel = "Completed";
                                            statusIcon = "✅";
                                        } else if (day.status === "Ongoing") {
                                            statusStyle = isSelected 
                                                ? "bg-amber-500 border-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 scale-[1.02]" 
                                                : "border-amber-500/35 text-amber-500 bg-amber-500/5 hover:bg-amber-500/10";
                                            statusLabel = "In Progress";
                                            statusIcon = "⚡";
                                        } else if (isSelected) {
                                            statusStyle = "bg-slate-100 border-white text-slate-950 shadow-xl scale-[1.02]";
                                        }

                                        return (
                                            <button
                                                key={day.day}
                                                type="button"
                                                onClick={() => setSelectedDayNum(day.day)}
                                                className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all border cursor-pointer flex flex-col items-center justify-center gap-0.5 ${statusStyle}`}
                                            >
                                                <span className="uppercase text-[8px] tracking-widest opacity-75">
                                                    Day {day.day}
                                                </span>
                                                <span className="font-extrabold text-[11px] mt-0.5">
                                                    Target: {day.quantity.toLocaleString()}
                                                </span>
                                                {day.status === "Completed" && (() => {
                                                    const actual = day.actual_yield ?? day.quantity;
                                                    const target = day.quantity;
                                                    const difference = actual - target;
                                                    const hasDiscrepancy = difference !== 0;
                                                    
                                                    let badgeStyle = isSelected ? "text-emerald-100" : "text-emerald-500";
                                                    let diffBadge = null;
                                                    
                                                    if (hasDiscrepancy) {
                                                        if (difference < 0) {
                                                            badgeStyle = isSelected ? "text-rose-200" : "text-rose-500";
                                                            diffBadge = (
                                                                <span className={`text-[8.5px] font-extrabold px-1 rounded bg-rose-500/10 border border-rose-500/20 ${isSelected ? "text-rose-100 border-rose-400/30" : ""}`}>
                                                                    {difference.toLocaleString()} pcs
                                                                </span>
                                                            );
                                                        } else {
                                                            badgeStyle = isSelected ? "text-sky-200" : "text-sky-500";
                                                            diffBadge = (
                                                                <span className={`text-[8.5px] font-extrabold px-1 rounded bg-sky-500/10 border border-sky-500/20 ${isSelected ? "text-sky-100 border-sky-400/30" : ""}`}>
                                                                    +{difference.toLocaleString()} pcs
                                                                </span>
                                                            );
                                                        }
                                                    }
                                                    
                                                    return (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className={`text-[10px] font-black ${badgeStyle}`}>
                                                                Yielded: {actual.toLocaleString()}
                                                            </span>
                                                            {diffBadge}
                                                        </div>
                                                    );
                                                })()}
                                                <span className="text-[8px] font-extrabold uppercase tracking-wide flex items-center gap-1 mt-1 opacity-90">
                                                    {statusIcon} {statusLabel}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Daily Target Progress Bar */}
                        {(() => {
                            if (selectedDayNum === null) return null;
                            const dayObj = selectedJO.dailyBreakdown?.find((d) => d.day === selectedDayNum);
                            const totalSteps = selectedJO.routings?.length || 1;
                            const completedStepsCount = dayObj?.completed_steps?.length || 0;
                            const percent = Math.min(100, Math.round((completedStepsCount / totalSteps) * 100));
                            
                            return (
                                <div className="border border-slate-800/80 rounded-2xl p-4 bg-slate-950/20 space-y-2.5 shadow-sm">
                                    <div className="flex justify-between items-center text-xs font-bold text-foreground">
                                        <span className="tracking-wide text-slate-300">Today&apos;s Route Steps Completed</span>
                                        <span className="text-emerald-500 font-extrabold">{percent}% ({completedStepsCount} / {totalSteps} Steps)</span>
                                    </div>
                                    <div className="h-3.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out" 
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Step Sequence Operations */}
                <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground block flex items-center gap-1.5 border-b border-slate-850 pb-2">
                        <CheckSquare className="h-4.5 w-4.5 text-emerald-500" />
                        Operations Checklist (Daily Steps)
                    </h4>

                    {productsList.map((p, pIdx) => {
                        const routings = p.routings;
                        if (!routings || routings.length === 0) return null;
                        const currentQty = selectedDayNum
                            ? (selectedJO.dailyBreakdown?.find((d) => d.day === selectedDayNum)?.quantity || p.quantity)
                            : p.quantity;

                        return (
                            <div key={pIdx} className="space-y-5">
                                {/* Routing Title Banner */}
                                <div className="flex items-center gap-2 border-b border-slate-850 pb-1.5">
                                    <span className="text-xs font-extrabold uppercase text-primary tracking-wider">
                                        {p.product_name || selectedJO.product_name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold">
                                        ({currentQty.toLocaleString()} Units target output)
                                    </span>
                                </div>

                                {/* Vertical Timeline Track */}
                                <div className="relative pl-7 sm:pl-10 border-l-2 border-slate-800 ml-4 sm:ml-5 space-y-8 py-2">
                                    {routings.map((rout, rIdx) => {
                                        const labor = Number(rout.estimated_labor_cost) || 0;
                                        const overhead = Number(rout.estimated_overhead_cost) || 0;
                                        const stepHours = (Number(rout.duration_hours) || 0) * Number(currentQty);
                                        const stepManpower = Math.max(1, Math.ceil(stepHours / 8));
                                        
                                        const relTask = selectedJO.routing_tasks?.find(t => Number(t.routing_id) === Number(rout.routing_id));
                                        const taskQAStatus = relTask ? (relTask.status === "Completed" ? "Passed" : "Pending") : (rout.qa_status || "Pending");
                                        const isStepLoading = !!assigningStepKeys[`${selectedJO.jo_id}-${p.product_id}-${rout.routing_id}`];

                                        const dayObj = selectedDayNum
                                            ? selectedJO.dailyBreakdown?.find((d) => d.day === selectedDayNum)
                                            : null;
                                        
                                        const isCompleted = selectedDayNum
                                            ? (dayObj?.completed_steps?.includes(Number(rout.routing_id)) || false)
                                            : (taskQAStatus === "Passed");

                                        // QA Logs details
                                        const latestQaLog = relTask?.qa_logs?.[relTask.qa_logs.length - 1];
                                        const dayQaLog = dayObj?.qa_logs?.[String(rout.routing_id)];
                                        const qaPhotos = selectedDayNum
                                            ? (Array.isArray(dayQaLog?.photos) ? dayQaLog.photos : [])
                                            : (Array.isArray(latestQaLog?.photos) ? latestQaLog.photos : []);
                                        const qaComments = selectedDayNum ? dayQaLog?.comments : latestQaLog?.comments;
                                        const actualYield = selectedDayNum ? dayQaLog?.actual_quantity : latestQaLog?.actual_quantity;

                                        // Timeline Badge Status Styles
                                        let nodeStyle = "border-slate-700 text-slate-500 bg-slate-900";
                                        let nodeIcon = <span className="text-[10px] sm:text-xs font-black">{rout.sequence_order}</span>;
                                        
                                        if (isCompleted) {
                                            nodeStyle = "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20";
                                            nodeIcon = <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3px]" />;
                                        } else if (selectedJO.status === "Ongoing") {
                                            const isPreviousCompleted = rIdx === 0 || (
                                                selectedDayNum
                                                    ? (dayObj?.completed_steps?.includes(Number(routings[rIdx - 1].routing_id)) || false)
                                                    : (routings[rIdx - 1].qa_status === "Passed" || (selectedJO.routing_tasks?.find(t => Number(t.routing_id) === Number(routings[rIdx - 1].routing_id))?.status === "Completed"))
                                            );
                                            
                                            if (isPreviousCompleted) {
                                                nodeStyle = "border-primary text-primary bg-primary/10 shadow-md shadow-primary/10 animate-pulse ring-4 ring-primary/5";
                                                nodeIcon = <Play className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-primary" />;
                                            }
                                        }

                                        return (
                                            <div key={rout.routing_id} className="relative group">
                                                
                                                {/* Left Absolute Circle Node */}
                                                <div className={`absolute -left-[41px] sm:-left-[57px] top-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center z-10 transition-all duration-300 ${nodeStyle}`}>
                                                    {nodeIcon}
                                                </div>

                                                {/* Step Details Card */}
                                                <div className={`w-full border rounded-2xl p-4.5 sm:p-5 shadow-sm transition-all duration-300 space-y-4 ${
                                                    isCompleted 
                                                        ? "bg-emerald-955/5 border-emerald-500/20 hover:border-emerald-500/30" 
                                                        : "bg-slate-900/20 border-slate-800 hover:border-slate-705"
                                                }`}>
                                                    {/* Header Info */}
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="space-y-1">
                                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                                                isCompleted
                                                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                                    : "bg-slate-950 border-slate-800 text-muted-foreground"
                                                                }`}>
                                                                Step {rout.sequence_order} • OP {rout.routing_id}
                                                            </span>
                                                            <h3 className="font-extrabold text-foreground text-sm tracking-tight pt-1">
                                                                {rout.operation_name}
                                                            </h3>
                                                        </div>

                                                        <span className="text-[10px] text-muted-foreground font-bold shrink-0 bg-slate-950/40 px-2 py-1 rounded border border-slate-800">
                                                            {stepHours.toFixed(1)} hrs total
                                                        </span>
                                                    </div>

                                                    {/* Labor/OH/Capacity Stats */}
                                                    <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-955/40 border border-slate-800 rounded-xl text-[10px] text-muted-foreground font-semibold">
                                                        <div>
                                                            <span className="block text-[8px] font-bold text-muted-foreground/60 uppercase">Labor Cost</span>
                                                            <span className="text-foreground font-bold">₱{labor.toFixed(2)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[8px] font-bold text-muted-foreground/60 uppercase">Overhead Cost</span>
                                                            <span className="text-foreground font-bold">₱{overhead.toFixed(2)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[8px] font-bold text-muted-foreground/60 uppercase">Workers Needed</span>
                                                            <span className="text-primary font-bold">{stepManpower} Operator{stepManpower !== 1 ? "s" : ""}</span>
                                                        </div>
                                                    </div>

                                                    {/* Personnel Assign Section */}
                                                    {["Proceed", "Ongoing", "On Hold"].includes(selectedJO.status) && !isDayCompleted ? (
                                                        <div className="space-y-2 pt-1">
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1.5">
                                                                    <Users className="h-3.5 w-3.5 text-primary" />
                                                                    Assigned Personnel:
                                                                    {isStepLoading && <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />}
                                                                </span>
                                                                
                                                                <button
                                                                    type="button"
                                                                    disabled={isStepLoading}
                                                                    onClick={() => {
                                                                        setOperatorSearchText("");
                                                                        setActiveAssigningTask({
                                                                            jo: selectedJO,
                                                                            productId: p.product_id,
                                                                            routingId: rout.routing_id,
                                                                            operationName: rout.operation_name
                                                                        });
                                                                    }}
                                                                    className="bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-[10px] text-foreground font-bold disabled:opacity-50 cursor-pointer transition-all active:scale-[0.98] inline-flex items-center gap-1 hover:border-primary/50"
                                                                >
                                                                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                                                                    <span>Assign Operator</span>
                                                                </button>
                                                            </div>

                                                            <div className="flex flex-wrap gap-1.5">
                                                                {relTask?.assignments && relTask.assignments.length > 0 ? (
                                                                    relTask.assignments.map((ass) => {
                                                                        const u = users.find((x) => Number(x.user_id) === Number(ass.user_id));
                                                                        if (!u) return null;
                                                                        return (
                                                                            <span key={ass.user_id} className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 font-extrabold border border-emerald-500/25 text-[10px] px-2.5 py-1 rounded-xl">
                                                                                {u.user_fname} {u.user_lname}
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={isStepLoading}
                                                                                    onClick={() => handleToggleOperatorForTask(selectedJO, p.product_id, rout.routing_id, u.user_id, false)}
                                                                                    className="text-emerald-400 hover:text-destructive hover:scale-110 ml-1 font-bold focus:outline-none cursor-pointer border-none bg-transparent disabled:opacity-50 transition-all text-[11px]"
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            </span>
                                                                        );
                                                                    })
                                                                ) : rout.assigned_personnel ? (
                                                                    <span className="bg-emerald-500/10 text-emerald-400 font-extrabold border border-emerald-500/25 text-[10px] px-2.5 py-1 rounded-xl">
                                                                        {rout.assigned_personnel.name} ({rout.assigned_personnel.position})
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] italic text-muted-foreground/35">No personnel assigned to this step yet.</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] pt-1 text-muted-foreground font-semibold">
                                                            <span>Assigned Personnel:</span>
                                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                                {relTask?.assignments && relTask.assignments.length > 0 ? (
                                                                    relTask.assignments.map((ass) => {
                                                                        const u = users.find((x) => Number(x.user_id) === Number(ass.user_id));
                                                                        if (!u) return null;
                                                                        return (
                                                                            <span key={ass.user_id} className="bg-slate-800 text-foreground border border-slate-705 text-[10px] px-2.5 py-0.5 rounded-xl font-bold">
                                                                                {u.user_fname} {u.user_lname} ({u.user_position || "Operator"})
                                                                            </span>
                                                                        );
                                                                    })
                                                                ) : rout.assigned_personnel ? (
                                                                    <span className="bg-slate-800 text-foreground border border-slate-705 text-[10px] px-2.5 py-0.5 rounded-xl font-bold">
                                                                        {rout.assigned_personnel.name} ({rout.assigned_personnel.position})
                                                                    </span>
                                                                ) : (
                                                                    <span className="italic text-muted-foreground/50">None</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Completed Logs Panel inside card */}
                                                    {isCompleted && (dayQaLog || latestQaLog) && (
                                                        <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2.5 text-[10px] text-muted-foreground font-semibold">
                                                            <div className="flex justify-between items-center font-bold text-slate-300">
                                                                <span className="flex items-center gap-1">
                                                                    Actual Yield: <strong className="text-emerald-500 font-extrabold text-xs">{actualYield ?? currentQty}</strong> / {currentQty} PCS
                                                                </span>
                                                                {(() => {
                                                                    const recordedDateStr = dayQaLog?.completed_at || latestQaLog?.recorded_at;
                                                                    return recordedDateStr ? (
                                                                        <span className="text-muted-foreground text-[9px] font-medium">
                                                                            Recorded: {new Date(recordedDateStr).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                                                        </span>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                            
                                                            {qaComments && (
                                                                <div className="text-slate-400 italic border-l-2 border-emerald-500/50 pl-2 py-0.5 leading-normal">
                                                                    &quot;{qaComments}&quot;
                                                                </div>
                                                            )}
                                                            
                                                            {qaPhotos.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <span className="text-[8px] font-bold uppercase text-muted-foreground/60 block">Logged Images ({qaPhotos.length})</span>
                                                                    <div className="flex gap-2 overflow-x-auto pt-1 pb-1 scrollbar-thin">
                                                                        {qaPhotos.map((photoId: string) => (
                                                                            <div key={photoId} className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 relative group/thumb">
                                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                <img
                                                                                    src={`${process.env.NEXT_PUBLIC_DIRECTUS_URL || "http://vtc:8074"}/assets/${photoId}`}
                                                                                    alt="QA visual audit attachment"
                                                                                    className="w-full h-full object-cover cursor-zoom-in hover:scale-105 transition-transform"
                                                                                    onClick={() => window.open(`${process.env.NEXT_PUBLIC_DIRECTUS_URL || "http://vtc:8074"}/assets/${photoId}`, '_blank')}
                                                                                />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Action triggers */}
                                                    {selectedJO.status === "Ongoing" && !isDayCompleted && (
                                                        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                            <div className="flex items-center gap-1.5 text-[10px]">
                                                                <span className="font-bold text-muted-foreground uppercase">Status:</span>
                                                                {isCompleted ? (
                                                                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2.5 py-0.5 rounded-lg border border-emerald-500/25 uppercase">
                                                                        <CheckCircle className="h-3 w-3" /> QA Approved
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-2.5 py-0.5 rounded-lg border border-amber-500/25 uppercase tracking-wide animate-pulse">
                                                                        Pending Operator
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                {!isCompleted ? (
                                                                    (() => {
                                                                        const stepRequiresQA = 
                                                                            !!relTask?.requires_qa || 
                                                                            !!rout.requires_qa || 
                                                                            !!rout.requiresQA;
                                                                        if (stepRequiresQA) {
                                                                            return (
                                                                                <button
                                                                                    onClick={() => handleOpenQADialog(selectedJO, p.product_id, rout.routing_id, Number(currentQty), rout.operation_name)}
                                                                                    className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl shadow-md border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                                                                >
                                                                                    <Camera className="h-4 w-4" /> Verify QA & Complete
                                                                                </button>
                                                                            );
                                                                        } else {
                                                                            return (
                                                                                <button
                                                                                    onClick={() => handleVerifyQAForTask(selectedJO, p.product_id, rout.routing_id, "Passed", undefined, undefined, undefined, true)}
                                                                                    className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-black px-4 py-2.5 rounded-xl shadow-md border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                                                                >
                                                                                    <CheckCircle className="h-4 w-4" /> Tap to Complete Step
                                                                                </button>
                                                                            );
                                                                        }
                                                                    })()
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleVerifyQAForTask(selectedJO, p.product_id, rout.routing_id, "Pending")}
                                                                        className="w-full sm:w-auto bg-slate-955 hover:bg-slate-900 text-muted-foreground hover:text-foreground text-[10px] font-bold px-3 py-1.5 rounded-xl border border-slate-800 cursor-pointer flex items-center justify-center gap-1 transition-all"
                                                                    >
                                                                        <RotateCcw className="h-3.5 w-3.5" /> Undo Step
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(selectedJO.status !== "Ongoing" || isDayCompleted) && (
                                                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px]">
                                                            <span className="font-bold text-muted-foreground uppercase">Status:</span>
                                                            {isCompleted ? (
                                                                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 font-extrabold px-2.5 py-0.5 rounded-lg border border-emerald-500/25 uppercase">
                                                                    <CheckCircle className="h-3 w-3" /> Done
                                                                </span>
                                                            ) : (
                                                                <span className="bg-slate-805 text-muted-foreground font-extrabold px-2.5 py-0.5 rounded-lg border border-slate-700 uppercase">
                                                                    Waiting
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Post Production Stocking Form */}
            <div className="pt-4">
                {isDayCompleted || selectedJO.status === "Finished" ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-emerald-950/10">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0 font-mono">
                                <CheckCircle className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
                                    {selectedDayNum ? `Day ${selectedDayNum}` : "Job Order"} Production Yield Completed
                                </h4>
                                <p className="text-[11px] text-emerald-400 font-semibold">
                                    {selectedDayNum 
                                        ? `This day&apos;s target of ${selectedJO.dailyBreakdown?.find((d) => d.day === selectedDayNum)?.quantity.toLocaleString()} PCS has been completed and finalized.`
                                        : `The complete Job Order target of ${selectedJO.quantity.toLocaleString()} PCS has been completed and finalized.`
                                    }
                                </p>
                                {(() => {
                                    if (selectedDayNum) {
                                        const dayObj = selectedJO.dailyBreakdown?.find((d) => d.day === selectedDayNum);
                                        if (dayObj) {
                                            const target = dayObj.quantity;
                                            const actual = dayObj.actual_yield ?? target;
                                            const difference = actual - target;
                                            if (difference !== 0) {
                                                return (
                                                    <div className="mt-2 p-3 rounded-xl border bg-slate-950/80 border-slate-800 text-[10px] space-y-1">
                                                        <span className="font-extrabold uppercase tracking-wider block text-slate-400 text-[8.5px]">
                                                            Run Yield Audit Discrepancy
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-slate-300 font-semibold">Expected Target: <strong>{target.toLocaleString()}</strong> pcs</span>
                                                            <span className="text-slate-500 font-bold">•</span>
                                                            <span className="text-slate-300 font-semibold">Actual Yielded: <strong>{actual.toLocaleString()}</strong> pcs</span>
                                                            <span className="text-slate-500 font-bold">•</span>
                                                            <span className={`font-black ${difference < 0 ? "text-rose-400 bg-rose-500/10 border border-rose-500/20" : "text-sky-400 bg-sky-500/10 border border-sky-500/20"} px-1.5 py-0.5 rounded`}>
                                                                {difference < 0 ? `Deficit of ${Math.abs(difference).toLocaleString()}` : `Surplus of ${difference.toLocaleString()}`} pcs
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        }
                                    }
                                    return null;
                                })()}
                                <p className="text-[10px] text-muted-foreground leading-normal pt-1">
                                    Inventory ledger and finished goods receipt transactions have been posted. Further yields and checklist alterations are disabled to preserve audit compliance.
                                </p>
                            </div>
                        </div>
                        <span className="shrink-0 bg-emerald-500 text-slate-950 text-xs font-black px-3.5 py-1.5 rounded-xl uppercase tracking-wider flex items-center gap-1.5 shadow-md font-mono">
                            Stocked & Closed
                        </span>
                    </div>
                ) : !allStepsCompleted ? (
                    <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl text-xs text-muted-foreground italic flex items-center gap-3">
                        <Info className="h-5 w-5 text-amber-500 shrink-0" />
                        <span>Completing all routing operations checklist steps for {selectedDayNum ? `Day ${selectedDayNum}` : "this Job Order"} will unlock the final Finished Goods Stocking Panel.</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmitFinishedReceipt} className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/30 rounded-2xl p-6 space-y-5 shadow-xl shadow-emerald-950/10">
                        <div className="border-b border-emerald-500/20 pb-3 flex items-start gap-3">
                            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                                <ShieldCheck className="h-6 w-6 animate-bounce" />
                            </div>
                            <div>
                                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
                                    Post Finished Goods & Complete Run
                                </h4>
                                <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                                    Excellent work! All routing checklists are 100% complete. Review quantities below to finalize inventory stocking.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {productsList.map((p) => {
                                const prodId = Number(p.product_id);
                                const targetQty = selectedDayNum !== null && selectedJO.dailyBreakdown
                                    ? (selectedJO.dailyBreakdown.find((d) => d.day === selectedDayNum)?.quantity || p.quantity)
                                    : p.quantity;
                                return (
                                    <div key={prodId} className="border border-slate-800 bg-slate-950/65 p-4 rounded-xl space-y-4">
                                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                            <span className="text-xs font-black text-foreground">{p.product_name}</span>
                                            <span className="text-[9px] text-muted-foreground bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg font-mono">Product ID: #{prodId}</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                            <div className="space-y-1.5">
                                                <label className="text-muted-foreground font-black block uppercase text-[9px] tracking-wide flex justify-between items-center">
                                                    <span>Final Stock Yield Qty (PCS)</span>
                                                    <span className="text-primary font-bold text-[9px] lowercase bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md font-mono shrink-0">
                                                        expected: {targetQty.toLocaleString()} pcs
                                                    </span>
                                                </label>
                                                <input 
                                                    type="number"
                                                    value={yieldQties[prodId] || 0}
                                                    onChange={e => setYieldQties(prev => ({ ...prev, [prodId]: Math.max(1, Number(e.target.value)) }))}
                                                    required
                                                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-foreground font-bold focus:ring-1 focus:ring-primary outline-none focus:border-primary"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-muted-foreground font-black block uppercase text-[9px] tracking-wide">Lot Tracking Batch Number</label>
                                                <input 
                                                    type="text"
                                                    value={lotNumbers[prodId] || ""}
                                                    onChange={e => setLotNumbers(prev => ({ ...prev, [prodId]: e.target.value }))}
                                                    required
                                                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-foreground font-bold focus:ring-1 focus:ring-primary outline-none focus:border-primary"
                                                />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-muted-foreground font-black block uppercase text-[9px] tracking-wide">Computed Shelf Expiry Date</label>
                                                <input 
                                                    type="date"
                                                    value={expiryDates[prodId] || ""}
                                                    onChange={e => setExpiryDates(prev => ({ ...prev, [prodId]: e.target.value }))}
                                                    required
                                                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-foreground font-bold focus:ring-1 focus:ring-primary outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="submit"
                            disabled={submittingReceipt}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] py-3 text-xs font-black text-white shadow-lg shadow-emerald-950/20 border-none transition-all cursor-pointer"
                        >
                            {submittingReceipt ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Updating Inventory Ledger & Generating Receipts...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Confirm Production Complete & Stock All Items
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
