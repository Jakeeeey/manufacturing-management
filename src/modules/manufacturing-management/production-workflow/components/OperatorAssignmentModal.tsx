"use client";
 
import React from "react";
import { Users, X, Search, Loader2, UserMinus, Check } from "lucide-react";
import { JobOrder, ActiveAssigningTask } from "../types";
 
interface OperatorAssignmentModalProps {
    activeAssigningTask: ActiveAssigningTask | null;
    setActiveAssigningTask: (task: null) => void;
    operatorSearchText: string;
    setOperatorSearchText: (text: string) => void;
    jobOrders: JobOrder[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    users: any[];
    userWorkloads: Record<string, number>;
    assigningStepKeys: Record<string, boolean>;
    handleToggleOperatorForTask: (jo: JobOrder, productId: number, routingId: number, userId: number, shouldAdd: boolean) => Promise<void>;
}
 
export function OperatorAssignmentModal({
    activeAssigningTask,
    setActiveAssigningTask,
    operatorSearchText,
    setOperatorSearchText,
    jobOrders,
    users,
    userWorkloads,
    assigningStepKeys,
    handleToggleOperatorForTask
}: OperatorAssignmentModalProps) {
    if (!activeAssigningTask) return null;
 
    const jo = jobOrders.find(j => j.jo_id === activeAssigningTask.jo.jo_id);
    if (!jo) return null;
    const relTask = jo.routing_tasks?.find(t => Number(t.routing_id) === Number(activeAssigningTask.routingId));
    const currentAssignments = relTask?.assignments || [];
 
    // 1. Get assigned users
    const assignedUsers = users.filter(u => 
        currentAssignments.some(a => Number(a.user_id) === Number(u.user_id))
    ).map(u => {
        const workload = userWorkloads[String(u.user_id)] || 0;
        const isOver = workload > 40;
        return { ...u, workload, isOver, isAssigned: true };
    });
 
    // 2. Get available users (production staff only, excluding assigned)
    const availableUsers = users.filter(u => {
        const pos = (u.user_position || "").toLowerCase();
        if (pos !== "production staff") return false;
 
        const isAlreadyAssigned = currentAssignments.some(a => Number(a.user_id) === Number(u.user_id));
        return !isAlreadyAssigned;
    }).map(u => {
        const workload = userWorkloads[String(u.user_id)] || 0;
        const isOver = workload > 40;
        const opName = (activeAssigningTask.operationName || "").toLowerCase();
        const pos = (u.user_position || "").toLowerCase();
        const isRoleMatch = pos && opName && (opName.includes(pos) || pos.includes(opName) ||
            (pos.includes("welder") && opName.includes("weld")) ||
            (pos.includes("mixer") && opName.includes("mix")) ||
            (pos.includes("operator") && opName.includes("assemble")) ||
            (pos.includes("baker") && opName.includes("bake")) ||
            (pos.includes("packer") && opName.includes("pack")));
        return { ...u, workload, isOver, isRoleMatch, isAssigned: false };
    });
 
    // 3. Filter available users by search query
    const filteredAvailable = availableUsers.filter(u => {
        if (!operatorSearchText) return true;
        const name = `${u.user_fname} ${u.user_lname}`.toLowerCase();
        const pos = (u.user_position || "").toLowerCase();
        const query = operatorSearchText.toLowerCase();
        return name.includes(query) || pos.includes(query);
    }).sort((a, b) => {
        if (a.isRoleMatch && !b.isRoleMatch) return -1;
        if (!a.isRoleMatch && b.isRoleMatch) return 1;
        return a.workload - b.workload;
    });
 
    const colors = [
        "bg-blue-500/10 text-blue-400 border-blue-500/20",
        "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        "bg-purple-500/10 text-purple-400 border-purple-500/20",
        "bg-amber-500/10 text-amber-400 border-amber-500/20",
        "bg-teal-500/10 text-teal-400 border-teal-500/20",
    ];
 
    const stepKey = `${jo.jo_id}-${activeAssigningTask.productId}-${activeAssigningTask.routingId}`;
    const isStepLoading = !!assigningStepKeys[stepKey];
 
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden p-4 sm:p-6 space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 shrink-0">
                    <div className="space-y-1">
                        <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Assign Operator(s)
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-semibold">
                            Step: <strong className="text-foreground">{activeAssigningTask.operationName}</strong>
                        </p>
                    </div>
                    <button
                        onClick={() => setActiveAssigningTask(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors border-none bg-transparent cursor-pointer text-xs p-1 rounded-lg hover:bg-slate-800"
                    >
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>
 
                {/* Scrollable Container split in two sections */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-5 min-h-[350px]">
                    
                    {/* SECTION A: CURRENTLY ASSIGNED OPERATORS */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                Assigned Operator(s) ({assignedUsers.length})
                            </span>
                        </div>
                        {assignedUsers.length === 0 ? (
                            <div className="p-4 text-center border border-dashed rounded-xl border-slate-850 bg-slate-950/20 text-muted-foreground text-[10px] font-semibold">
                                No operators currently assigned to this task step.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assignedUsers.map((u, uIdx) => {
                                    const initials = `${u.user_fname?.[0] || ""}${u.user_lname?.[0] || ""}`.toUpperCase();
                                    const avatarStyle = colors[(u.user_id || 0) % colors.length];
                                    return (
                                        <div key={u.user_id || u.id || uIdx} className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarStyle}`}>
                                                    {initials}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="font-extrabold text-foreground text-xs leading-none">
                                                        {u.user_fname} {u.user_lname}
                                                    </div>
                                                    <span className="text-[9px] text-muted-foreground block font-semibold">{u.user_position || "Shop Personnel"}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={isStepLoading}
                                                onClick={() => handleToggleOperatorForTask(jo, activeAssigningTask.productId, activeAssigningTask.routingId, u.user_id, false)}
                                                className="px-2.5 py-1 rounded-lg text-[9px] font-black bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none flex items-center gap-1"
                                            >
                                                <UserMinus className="h-3 w-3" />
                                                Remove
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
 
                    {/* SECTION B: AVAILABLE OPERATORS SELECTION LIST */}
                    <div className="space-y-3 pt-2 border-t border-slate-800/60">
                        <div className="space-y-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                                Select Available Operator
                            </span>
                            
                            {/* Search available list */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search available operators by name..."
                                    value={operatorSearchText}
                                    onChange={(e) => setOperatorSearchText(e.target.value)}
                                    className="w-full bg-slate-955 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                                />
                                {operatorSearchText && (
                                    <button
                                        onClick={() => setOperatorSearchText("")}
                                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground text-xs font-bold bg-transparent border-none cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
 
                        <div className="space-y-2">
                            {filteredAvailable.length === 0 ? (
                                <div className="p-6 text-center border border-dashed rounded-xl border-slate-850 bg-slate-955/20">
                                    <Users className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                                    <span className="text-[10px] text-muted-foreground block font-semibold">
                                        No available production operators found matching &quot;{operatorSearchText}&quot;
                                    </span>
                                </div>
                            ) : (
                                filteredAvailable.map((u, uIdx) => {
                                    const initials = `${u.user_fname?.[0] || ""}${u.user_lname?.[0] || ""}`.toUpperCase();
                                    const avatarStyle = colors[(u.user_id || 0) % colors.length];
                                    return (
                                        <div key={u.user_id || u.id || uIdx} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/40 hover:border-slate-750 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${avatarStyle}`}>
                                                    {initials}
                                                </div>
 
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-extrabold text-foreground text-xs leading-none">
                                                            {u.user_fname} {u.user_lname}
                                                        </span>
                                                        {u.isRoleMatch && (
                                                            <span className="bg-primary/10 text-primary text-[8px] font-black px-1.5 py-0.5 rounded border border-primary/20 flex items-center gap-0.5 uppercase tracking-wider">
                                                                ⭐ Recommended
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2 pt-0.5">
                                                        <div className="w-12 bg-slate-850 h-1 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${u.workload > 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                                style={{ width: `${Math.min(100, (u.workload / 40) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-[8px] font-bold ${u.workload > 40 ? "text-amber-500" : "text-muted-foreground"}`}>
                                                            {u.workload.toFixed(1)} hrs loaded {u.workload > 40 && "⚠️"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
 
                                            <button
                                                type="button"
                                                disabled={isStepLoading}
                                                onClick={() => handleToggleOperatorForTask(jo, activeAssigningTask.productId, activeAssigningTask.routingId, u.user_id, true)}
                                                className="px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border-none flex items-center gap-1"
                                            >
                                                {isStepLoading ? (
                                                    <Loader2 className="h-3 w-3 animate-spin text-foreground" />
                                                ) : (
                                                    <>
                                                        <Check className="h-3 w-3" />
                                                        Assign
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
 
                </div>
 
                {/* Footer */}
                <div className="border-t border-slate-800 pt-3 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveAssigningTask(null)}
                        className="px-5 py-2.5 bg-primary text-primary-foreground font-black text-xs hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer border-none rounded-xl"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
