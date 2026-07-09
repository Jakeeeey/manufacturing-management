"use client";

import React, { useState, useMemo } from "react";
import { Users, AlertTriangle, CheckCircle, ShieldAlert, Cpu, Sparkles, Scale } from "lucide-react";
import { JobOrder } from "../types";

interface ManpowerWorkloadAnalysisProps {
    jobOrders: JobOrder[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    users: any[];
}

export function ManpowerWorkloadAnalysis({ jobOrders, users }: ManpowerWorkloadAnalysisProps) {
    const [selectedRole, setSelectedRole] = useState<string>("All");

    // Calculate workload metrics
    const analysis = useMemo(() => {
        // Map of userId -> list of task assignments and total hours
        const workerLoads: Record<string, {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            user: any;
            totalHours: number;
            tasks: Array<{
                joId: string;
                productName: string;
                qty: number;
                operation: string;
                sequence: number;
                duration: number;
                stepHours: number;
                status: string;
            }>;
        }> = {};

        // Pre-fill all users
        users.forEach(u => {
            workerLoads[String(u.user_id)] = {
                user: u,
                totalHours: 0,
                tasks: []
            };
        });

        // Unassigned tasks count and list
        const unassignedTasks: Array<{
            joId: string;
            productId: number;
            productName: string;
            qty: number;
            routingId: number;
            operation: string;
            sequence: number;
            duration: number;
            stepHours: number;
            status: string;
        }> = [];

        // Operation-level metrics (e.g. Mixing, Assembly, Baking)
        const operationLoads: Record<string, {
            operationName: string;
            totalHours: number;
            taskCount: number;
            assignedWorkerIds: Set<string>;
        }> = {};

        jobOrders.forEach(jo => {
            const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity,
                routings: jo.routings
            }];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
            productsList.forEach((p: any) => {
                if (!p.routings) return;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
                p.routings.forEach((r: any) => {
                    const stepHours = (Number(r.duration_hours) || 0) * Number(p.quantity);
                    const opName = r.operation_name || "General Operation";

                    // Update operation load
                    if (!operationLoads[opName]) {
                        operationLoads[opName] = {
                            operationName: opName,
                            totalHours: 0,
                            taskCount: 0,
                            assignedWorkerIds: new Set()
                        };
                    }
                    operationLoads[opName].totalHours += stepHours;
                    operationLoads[opName].taskCount += 1;

                    const assigned = r.assigned_personnel;
                    if (assigned && (assigned.id || assigned.user_id)) {
                        const wId = String(assigned.id || assigned.user_id);
                        if (workerLoads[wId]) {
                            workerLoads[wId].totalHours += stepHours;
                            workerLoads[wId].tasks.push({
                                joId: jo.jo_id,
                                productName: p.product_name,
                                qty: p.quantity,
                                operation: opName,
                                sequence: r.sequence_order,
                                duration: Number(r.duration_hours) || 0,
                                stepHours,
                                status: jo.status
                            });
                            operationLoads[opName].assignedWorkerIds.add(wId);
                        }
                    } else {
                        unassignedTasks.push({
                            joId: jo.jo_id,
                            productId: p.product_id,
                            productName: p.product_name,
                            qty: p.quantity,
                            routingId: r.routing_id,
                            operation: opName,
                            sequence: r.sequence_order,
                            duration: Number(r.duration_hours) || 0,
                            stepHours,
                            status: jo.status
                        });
                    }
                });
            });
        });

        // Convert workerLoads to array
        const workersArray = Object.values(workerLoads).sort((a, b) => b.totalHours - a.totalHours);

        // Roles list for filtering
        const roles = Array.from(new Set(users.map(u => u.user_position).filter(Boolean))) as string[];

        // Operation load summary
        const operationsArray = Object.values(operationLoads).map(op => ({
            ...op,
            workersCount: op.assignedWorkerIds.size
        })).sort((a, b) => b.totalHours - a.totalHours);

        return {
            workers: workersArray,
            unassigned: unassignedTasks,
            operations: operationsArray,
            roles,
            totalWorkloadHours: workersArray.reduce((sum, w) => sum + w.totalHours, 0) + unassignedTasks.reduce((sum, t) => sum + t.stepHours, 0)
        };
    }, [jobOrders, users]);

    // Filtered workers
    const filteredWorkers = useMemo(() => {
        if (selectedRole === "All") return analysis.workers;
        return analysis.workers.filter(w => w.user.user_position === selectedRole);
    }, [analysis.workers, selectedRole]);

    // Average workload per worker
    const averageWorkload = useMemo(() => {
        if (users.length === 0) return 0;
        return analysis.totalWorkloadHours / users.length;
    }, [analysis.totalWorkloadHours, users.length]);

    // Load Balancing recommendations
    const balanceSuggestions = useMemo(() => {
        const suggestions: Array<{
            type: "warning" | "tip" | "info";
            message: string;
            details?: string;
        }> = [];

        // 1. Find overloaded workers (> 40 hours)
        const overloaded = analysis.workers.filter(w => w.totalHours > 40);
        overloaded.forEach(w => {
            suggestions.push({
                type: "warning",
                message: `${w.user.user_fname} ${w.user.user_lname} is overloaded!`,
                details: `Currently assigned ${w.totalHours.toFixed(1)} hours of work. Consider shifting some tasks to underloaded staff.`
            });
        });

        // 2. Highlight unassigned tasks
        if (analysis.unassigned.length > 0) {
            const totalUnassignedHours = analysis.unassigned.reduce((s, t) => s + t.stepHours, 0);
            suggestions.push({
                type: "info",
                message: `${analysis.unassigned.length} steps require operators`,
                details: `A total of ${totalUnassignedHours.toFixed(1)} hours are currently unassigned and need allocation.`
            });
        }

        // 3. Operation load imbalance (bottlenecks)
        analysis.operations.forEach(op => {
            const ratio = op.workersCount > 0 ? op.totalHours / op.workersCount : op.totalHours;
            if (op.totalHours > 20 && op.workersCount === 0) {
                suggestions.push({
                    type: "warning",
                    message: `Bottleneck Operation: ${op.operationName}`,
                    details: `${op.totalHours.toFixed(1)} hours of work scheduled but no specific operators are assigned.`
                });
            } else if (ratio > 40) {
                suggestions.push({
                    type: "tip",
                    message: `High work-per-worker ratio on ${op.operationName}`,
                    details: `Average of ${ratio.toFixed(1)} hours per worker. Consider cross-training or assigning more personnel here.`
                });
            }
        });

        return suggestions;
    }, [analysis]);

    return (
        <div className="space-y-6 bg-slate-50/50 dark:bg-slate-900/10 border p-5 rounded-xl">
            {/* Header section */}
            <div className="bg-slate-100 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 rounded-xl p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                <Scale className="h-4 w-4" />
                            </span>
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Manpower Routing Workload Dashboard</h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Analyze operator workloads and route durations to optimize distribution, identify bottleneck stages, and prevent schedule overruns.
                        </p>
                    </div>
                    {/* Filters */}
                    <div className="flex items-center gap-2 self-start md:self-auto">
                        <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Filter Position:</span>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="bg-background border rounded-lg px-2 py-1 text-xs text-foreground font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                            <option value="All">All Positions</option>
                            {analysis.roles.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Stat summary grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-200 dark:border-slate-850">
                    <div className="p-3 bg-slate-50/30 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800/60">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Total Workload</span>
                        <span className="text-base font-extrabold text-foreground">{analysis.totalWorkloadHours.toFixed(1)} <span className="text-[10px] text-muted-foreground font-normal">hrs</span></span>
                    </div>
                    <div className="p-3 bg-slate-50/30 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800/60">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Total Workforce</span>
                        <span className="text-base font-extrabold text-foreground">{users.length} <span className="text-[10px] text-muted-foreground font-normal">Active</span></span>
                    </div>
                    <div className="p-3 bg-slate-50/30 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800/60">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Average Load</span>
                        <span className="text-base font-extrabold text-primary">{averageWorkload.toFixed(1)} <span className="text-[10px] text-primary/70 font-normal">hrs / op</span></span>
                    </div>
                    <div className="p-3 bg-slate-50/30 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800/60">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground block">Unassigned Steps</span>
                        <span className={`text-base font-extrabold ${analysis.unassigned.length > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                            {analysis.unassigned.length} <span className="text-[10px] font-normal">Steps</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Content Body Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Workers Workload List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-primary" />
                            Operator Workload Distribution
                        </h4>
                        <span className="text-[10px] text-muted-foreground font-semibold">Showing {filteredWorkers.length} personnel</span>
                    </div>

                    <div className="space-y-3">
                        {filteredWorkers.map(w => {
                            const isOverloaded = w.totalHours > 40;
                            const capacityPercent = Math.min(100, (w.totalHours / 40) * 100);

                            return (
                                <div key={w.user.user_id} className="bg-card border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-xs">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className="font-bold text-foreground text-xs block">{w.user.user_fname} {w.user.user_lname}</span>
                                            <span className="text-[10px] text-muted-foreground">{w.user.user_position || "Operator"}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-xs font-extrabold ${isOverloaded ? "text-destructive" : "text-primary"}`}>
                                                {w.totalHours.toFixed(1)} hrs
                                            </span>
                                            <span className="text-[9px] text-muted-foreground block">of 40 hrs capacity</span>
                                        </div>
                                    </div>

                                    {/* Capacity Progress Bar */}
                                    <div className="space-y-1">
                                        <div className="w-full bg-slate-100 dark:bg-slate-850 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    isOverloaded ? "bg-destructive" : w.totalHours > 30 ? "bg-amber-500" : "bg-emerald-500"
                                                }`}
                                                style={{ width: `${capacityPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Detail Tasks assigned */}
                                    {w.tasks.length > 0 ? (
                                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 space-y-1">
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Assigned Tasks:</span>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {w.tasks.map((t, idx) => (
                                                    <div key={idx} className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/50 rounded p-2 flex items-center justify-between text-[10px]">
                                                        <div>
                                                            <span className="font-bold text-foreground block">{t.joId} • {t.operation}</span>
                                                            <span className="text-muted-foreground block text-[9px] truncate max-w-[150px]">{t.productName} ({t.qty} PCS)</span>
                                                        </div>
                                                        <span className="font-extrabold text-primary shrink-0">{t.stepHours.toFixed(1)} hrs</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-muted-foreground italic">No tasks currently assigned. Available for routing step assignments.</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Side Analytics: Recommendations & Operations */}
                <div className="space-y-6">
                    {/* Dynamic Balancing Suggestions */}
                    <div className="bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl p-4 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-amber-400" />
                            Workload Advisor
                        </h4>

                        <div className="space-y-3">
                            {balanceSuggestions.length > 0 ? (
                                balanceSuggestions.map((s, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`p-3 rounded-lg border text-[11px] space-y-1 ${
                                            s.type === "warning"
                                                ? "bg-destructive/10 border-destructive/20 text-destructive"
                                                : s.type === "tip"
                                                ? "bg-primary/10 border-primary/20 text-primary"
                                                : "bg-amber-500/10 border-amber-500/20 text-amber-550"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 font-bold">
                                            {s.type === "warning" ? (
                                                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                            ) : s.type === "tip" ? (
                                                <Scale className="h-3.5 w-3.5 shrink-0" />
                                            ) : (
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                            <span>{s.message}</span>
                                        </div>
                                        <p className="text-muted-foreground text-[10px] leading-relaxed">
                                            {s.details}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground gap-2">
                                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                                    <span className="text-[11px] font-bold text-foreground">Perfectly Balanced!</span>
                                    <span className="text-[10px]">Workloads are evenly distributed across the current routes.</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Routing Operations Bottleneck Breakdown */}
                    <div className="bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 rounded-xl p-4 space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Cpu className="h-4 w-4 text-emerald-400" />
                            Route Operation Demand
                        </h4>

                        <div className="space-y-3">
                            {analysis.operations.map((op, idx) => {
                                return (
                                    <div key={idx} className="space-y-1.5 text-[11px]">
                                        <div className="flex justify-between font-bold text-foreground">
                                            <span>{op.operationName}</span>
                                            <span>{op.totalHours.toFixed(1)} hrs</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>{op.taskCount} occurrences</span>
                                            <span className="font-semibold text-primary">{op.workersCount} assigned</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-850 rounded-full h-1 overflow-hidden">
                                            <div 
                                                className="bg-emerald-500 h-full rounded-full" 
                                                style={{ width: `${Math.min(100, (op.totalHours / Math.max(1, analysis.totalWorkloadHours)) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {analysis.operations.length === 0 && (
                                <p className="text-[10px] text-muted-foreground italic">No operations registered in the active job orders.</p>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
