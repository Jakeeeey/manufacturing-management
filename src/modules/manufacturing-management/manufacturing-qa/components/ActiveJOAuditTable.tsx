import React from "react";
import { ClipboardList, ShieldCheck, Eye } from "lucide-react";
import { JobOrder, Branch } from "../types";

interface ActiveJOAuditTableProps {
    jobOrders: JobOrder[];
    branches: Branch[];
    handleOpenAudit: (jo: JobOrder) => void;
}

export function ActiveJOAuditTable({
    jobOrders,
    branches,
    handleOpenAudit
}: ActiveJOAuditTableProps) {
    const getBranchName = (branchId?: number) => {
        if (!branchId) return "Unspecified";
        const branch = branches.find(b => Number(b.id) === Number(branchId));
        return branch ? `${branch.branch_name} (${branch.branch_code})` : `Branch ID ${branchId}`;
    };

    if (jobOrders.length === 0) {
        return (
            <div className="text-center p-12 border rounded-xl bg-card">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">No Active Job Orders Found</h4>
                <p className="text-[11px] text-muted-foreground mt-1">
                    There are no Job Orders currently in production or awaiting QA inspections.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-visible border rounded-xl bg-card shadow-sm">
            <table className="w-full border-collapse text-left text-xs table-fixed">
                <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-3 w-[15%] font-bold text-muted-foreground uppercase tracking-wider">JO ID</th>
                        <th className="p-3 w-[30%] font-bold text-muted-foreground uppercase tracking-wider">Product Name</th>
                        <th className="p-3 w-[12%] font-bold text-muted-foreground uppercase tracking-wider text-right">Target Qty</th>
                        <th className="p-3 w-[18%] font-bold text-muted-foreground uppercase tracking-wider">Branch/Site</th>
                        <th className="p-3 w-[13%] font-bold text-muted-foreground uppercase tracking-wider text-center">Status</th>
                        <th className="p-3 w-[12%] font-bold text-muted-foreground uppercase tracking-wider text-center">QA Audit</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {jobOrders.map(jo => {
                        const routingTasks = jo.routing_tasks || [];
                        const completedTasks = routingTasks.filter(t => t.status === "Completed").length;
                        const totalTasks = routingTasks.length;
                        
                        const qaTasks = routingTasks.filter(t => t.requires_qa);
                        const completedQATasks = qaTasks.filter(t => t.status === "Completed").length;
                        const totalQATasks = qaTasks.length;

                        // Check if all routing tasks are complete. If so, they are ready for final finished goods release.
                        const allTasksCompleted = totalTasks > 0 && completedTasks === totalTasks;

                        return (
                            <tr key={jo.jo_id} className="hover:bg-muted/30 transition-colors group">
                                <td className="p-3 font-bold text-foreground truncate">{jo.jo_id}</td>
                                <td className="p-3">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-foreground leading-tight truncate">
                                            {jo.product_name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                            Due Date: {new Date(jo.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-3 text-right font-extrabold text-foreground">
                                    {Number(jo.quantity || 0).toLocaleString()}
                                </td>
                                <td className="p-3 font-semibold text-muted-foreground truncate">
                                    {getBranchName(jo.branch_id)}
                                </td>
                                <td className="p-3">
                                    <div className="flex flex-col items-center gap-1">
                                        {/* Status Badge */}
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            jo.status === "Ongoing" 
                                                ? "bg-sky-500/10 text-sky-500 border border-sky-500/20" 
                                                : jo.status === "Proceed" 
                                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                                                : jo.status === "On Hold"
                                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                                : "bg-muted text-muted-foreground border border-muted-foreground/10"
                                        }`}>
                                            {jo.status}
                                        </span>
                                        
                                        {/* Progress Bar / Task status */}
                                        <div className="w-16 bg-muted h-1 rounded-full overflow-hidden mt-1" title={`${completedTasks}/${totalTasks} Steps completed`}>
                                            <div 
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    allTasksCompleted ? "bg-emerald-500" : "bg-primary"
                                                }`} 
                                                style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                                            />
                                        </div>
                                        <span className="text-[8px] text-muted-foreground font-bold">
                                            {completedTasks}/{totalTasks} steps
                                        </span>
                                    </div>
                                </td>
                                <td className="p-3 text-center">
                                    <button
                                        onClick={() => handleOpenAudit(jo)}
                                        className={`inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm transition-all duration-150 ${
                                            allTasksCompleted
                                                ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                                                : totalQATasks > 0 && completedQATasks < totalQATasks
                                                ? "bg-primary hover:bg-primary/95 text-primary-foreground"
                                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                        }`}
                                    >
                                        {allTasksCompleted ? (
                                            <>
                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                FG Release
                                            </>
                                        ) : totalQATasks > 0 && completedQATasks < totalQATasks ? (
                                            <>
                                                <ShieldCheck className="h-3.5 w-3.5 animate-pulse" />
                                                Inspect ({completedQATasks}/{totalQATasks})
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="h-3.5 w-3.5" />
                                                View Steps
                                            </>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
