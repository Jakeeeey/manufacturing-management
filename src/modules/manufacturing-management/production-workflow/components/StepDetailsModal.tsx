"use client";

import React from "react";
import { 
    X, 
    Users, 
    Copy, 
    Loader2, 
    CheckCircle, 
    Camera, 
    RotateCcw, 
    UserPlus 
} from "lucide-react";
import { JobOrder, ActiveAssigningTask } from "../types";

interface UserMin {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_position?: string | null;
}

interface StepDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedJO: JobOrder | null;
    selectedDayNum: number | null;
    productId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    routing: any;
    users: UserMin[];
    assigningStepKeys: Record<string, boolean>;
    setActiveAssigningTask: (task: ActiveAssigningTask | null) => void;
    setOperatorSearchText: (text: string) => void;
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
    duplicatingStepId: number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleDuplicateTask: (productId: number, step: any) => Promise<void>;
    currentQty: number;
    isDayCompleted: boolean;
}

export function StepDetailsModal({
    isOpen,
    onClose,
    selectedJO,
    selectedDayNum,
    productId,
    routing,
    users,
    assigningStepKeys,
    setActiveAssigningTask,
    setOperatorSearchText,
    handleToggleOperatorForTask,
    handleOpenQADialog,
    handleVerifyQAForTask,
    duplicatingStepId,
    handleDuplicateTask,
    currentQty,
    isDayCompleted
}: StepDetailsModalProps) {
    if (!isOpen || !selectedJO || !routing) return null;

    const labor = Number(routing.estimated_labor_cost) || 0;
    const overhead = Number(routing.estimated_overhead_cost) || 0;
    const stepHours = (Number(routing.duration_hours) || 0) * Number(currentQty);
    const stepManpower = Math.max(1, Math.ceil(stepHours / 8));

    const relTask = selectedJO.routing_tasks?.find(t => Number(t.routing_id) === Number(routing.routing_id));
    const taskQAStatus = relTask ? (relTask.status === "Completed" ? "Passed" : "Pending") : (routing.qa_status || "Pending");
    const isStepLoading = !!assigningStepKeys[`${selectedJO.jo_id}-${productId}-${routing.routing_id}`];

    const dayObj = selectedDayNum
        ? selectedJO.dailyBreakdown?.find((d) => d.day === selectedDayNum)
        : null;

    const isCompleted = selectedDayNum
        ? (dayObj?.completed_steps?.includes(Number(routing.routing_id)) || false)
        : (taskQAStatus === "Passed");

    // QA Logs details
    const latestQaLog = relTask?.qa_logs?.[relTask.qa_logs.length - 1];
    const dayQaLog = dayObj?.qa_logs?.[String(routing.routing_id)];
    const qaPhotos = selectedDayNum
        ? (Array.isArray(dayQaLog?.photos) ? dayQaLog.photos : [])
        : (Array.isArray(latestQaLog?.photos) ? latestQaLog.photos : []);
    const qaComments = selectedDayNum ? dayQaLog?.comments : latestQaLog?.comments;
    const actualYield = selectedDayNum ? dayQaLog?.actual_quantity : latestQaLog?.actual_quantity;

    const stepRequiresQA = !!relTask?.requires_qa || !!routing.requires_qa || !!routing.requiresQA;
    const hasAssigned = (relTask?.assignments?.length ?? 0) > 0;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden p-4 sm:p-6 space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in duration-200 text-slate-800 dark:text-slate-100">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
                    <div className="space-y-1">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                            isCompleted
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-muted-foreground"
                            }`}>
                            Step {routing.sequence_order} • OP {routing.routing_id}
                        </span>
                        <h3 className="font-extrabold text-foreground text-base tracking-tight pt-1">
                            {routing.operation_name}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {["Proceed", "Ongoing", "On Hold"].includes(selectedJO.status) && !isDayCompleted && (
                            <button
                                type="button"
                                title="Duplicate Task"
                                disabled={duplicatingStepId === routing.routing_id}
                                onClick={async () => {
                                    await handleDuplicateTask(productId, routing);
                                }}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground hover:text-white transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-55 cursor-pointer"
                            >
                                {duplicatingStepId === routing.routing_id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-muted-foreground hover:text-white transition-colors border-none bg-transparent cursor-pointer p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                    {/* Labor/OH/Capacity Stats */}
                    <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-100 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-muted-foreground font-semibold">
                        <div>
                            <span className="block text-[8px] font-black text-muted-foreground/60 uppercase">Labor Cost</span>
                            <span className="text-foreground font-bold text-xs">₱{labor.toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="block text-[8px] font-black text-muted-foreground/60 uppercase">OH (Factory Overhead)</span>
                            <span className="text-foreground font-bold text-xs">₱{overhead.toFixed(2)}</span>
                        </div>
                        <div>
                            <span className="block text-[8px] font-black text-muted-foreground/60 uppercase">Workers Needed</span>
                            <span className="text-primary font-bold text-xs">{stepManpower} Operator{stepManpower !== 1 ? "s" : ""}</span>
                        </div>
                    </div>

                    {/* Personnel Assign Section */}
                    {["Proceed", "Ongoing", "On Hold"].includes(selectedJO.status) && !isDayCompleted ? (
                        <div className="space-y-3 p-3 bg-slate-955/20 border border-slate-200 dark:border-slate-850 rounded-xl">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1.5">
                                    <Users className="h-4 w-4 text-primary" />
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
                                            productId: productId,
                                            routingId: routing.routing_id,
                                            operationName: routing.operation_name
                                        });
                                    }}
                                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[10px] text-foreground dark:text-slate-100 font-bold disabled:opacity-50 cursor-pointer transition-all active:scale-[0.98] inline-flex items-center gap-1 hover:border-primary/50"
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
                                                    onClick={() => handleToggleOperatorForTask(selectedJO, productId, routing.routing_id, u.user_id, false)}
                                                    className="text-emerald-400 hover:text-destructive hover:scale-110 ml-1 font-bold focus:outline-none cursor-pointer border-none bg-transparent disabled:opacity-50 transition-all text-[11px]"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        );
                                    })
                                ) : routing.assigned_personnel ? (
                                    <span className="bg-emerald-500/10 text-emerald-400 font-extrabold border border-emerald-500/25 text-[10px] px-2.5 py-1 rounded-xl">
                                        {routing.assigned_personnel.name} ({routing.assigned_personnel.position})
                                    </span>
                                ) : (
                                    <span className="text-[10px] italic text-muted-foreground/35">No personnel assigned to this step yet.</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-[10px] p-3 bg-slate-955/20 border border-slate-200 dark:border-slate-850 rounded-xl font-semibold space-y-1">
                            <span className="text-muted-foreground uppercase font-black text-[9px] block">Assigned Personnel</span>
                            <div className="flex flex-wrap gap-1.5">
                                {relTask?.assignments && relTask.assignments.length > 0 ? (
                                    relTask.assignments.map((ass) => {
                                        const u = users.find((x) => Number(x.user_id) === Number(ass.user_id));
                                        if (!u) return null;
                                        return (
                                            <span key={ass.user_id} className="bg-slate-100 dark:bg-slate-800 text-foreground border border-slate-705 text-[10px] px-2.5 py-0.5 rounded-xl font-bold">
                                                {u.user_fname} {u.user_lname} ({u.user_position || "Operator"})
                                            </span>
                                        );
                                    })
                                ) : routing.assigned_personnel ? (
                                    <span className="bg-slate-100 dark:bg-slate-800 text-foreground border border-slate-705 text-[10px] px-2.5 py-0.5 rounded-xl font-bold">
                                        {routing.assigned_personnel.name} ({routing.assigned_personnel.position})
                                    </span>
                                ) : (
                                    <span className="italic text-muted-foreground/50">None</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Completed Logs Panel inside card */}
                    {isCompleted && (dayQaLog || latestQaLog) && (
                        <div className="p-3.5 bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 text-[11px] text-muted-foreground font-semibold font-mono">
                            <div className="flex justify-between items-center font-bold text-slate-600 dark:text-slate-300">
                                <span className="flex items-center gap-1 font-sans">
                                    Actual Yield: <strong className="text-emerald-500 font-extrabold text-sm">{actualYield ?? currentQty}</strong> / {currentQty} PCS
                                </span>
                                {(() => {
                                    const recordedDateStr = dayQaLog?.completed_at || latestQaLog?.recorded_at;
                                    return recordedDateStr ? (
                                        <span className="text-muted-foreground text-[9.5px] font-medium font-sans">
                                            Recorded: {new Date(recordedDateStr).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                    ) : null;
                                })()}
                            </div>
                            
                            {qaComments && (
                                <div className="text-slate-400 italic border-l-2 border-emerald-500/50 pl-2 py-0.5 leading-normal font-sans">
                                    &quot;{qaComments}&quot;
                                </div>
                            )}
                            
                            {qaPhotos.length > 0 && (
                                <div className="space-y-1">
                                    <span className="text-[8.5px] font-black uppercase text-muted-foreground/60 block font-sans">Logged Images ({qaPhotos.length})</span>
                                    <div className="flex gap-2 overflow-x-auto pt-1 pb-1 scrollbar-thin">
                                        {qaPhotos.map((photoId: string) => (
                                            <div key={photoId} className="h-14 w-14 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 relative group/thumb">
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
                </div>

                {/* Footer / Action triggers */}
                {selectedJO.status === "Ongoing" && !isDayCompleted ? (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 text-[11px]">
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
                                stepRequiresQA ? (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            onClose();
                                            await handleOpenQADialog(selectedJO, productId, routing.routing_id, Number(currentQty), routing.operation_name);
                                        }}
                                        disabled={!hasAssigned}
                                        className={`bg-amber-500 hover:bg-amber-600 text-slate-955 text-xs font-black px-4 py-2.5 rounded-xl shadow-md border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99] ${
                                            !hasAssigned ? "opacity-40 cursor-not-allowed" : ""
                                        }`}
                                    >
                                        <Camera className="h-4 w-4" /> QA Pass & Complete Task
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            onClose();
                                            await handleVerifyQAForTask(selectedJO, productId, routing.routing_id, "Passed", undefined, undefined, undefined, true);
                                        }}
                                        disabled={!hasAssigned}
                                        className={`bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-black px-4 py-2.5 rounded-xl shadow-md border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all hover:scale-[1.01] active:scale-[0.99] ${
                                            !hasAssigned ? "opacity-40 cursor-not-allowed" : ""
                                        }`}
                                    >
                                        <CheckCircle className="h-4 w-4" /> Complete Task
                                    </button>
                                )
                            ) : (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        onClose();
                                        await handleVerifyQAForTask(selectedJO, productId, routing.routing_id, "Pending");
                                    }}
                                    className="bg-slate-100 dark:bg-slate-950 hover:bg-slate-100 dark:bg-slate-900 text-muted-foreground hover:text-white text-[10px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer flex items-center justify-center gap-1 transition-all"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Undo Step
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] shrink-0">
                        <span className="font-bold text-muted-foreground uppercase">Status:</span>
                        {isCompleted ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-500 font-extrabold px-2.5 py-0.5 rounded-lg border border-emerald-500/25 uppercase">
                                <CheckCircle className="h-3 w-3" /> Done
                            </span>
                        ) : (
                            <span className="bg-slate-100 dark:bg-slate-800 text-muted-foreground font-extrabold px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 uppercase">
                                Waiting
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
