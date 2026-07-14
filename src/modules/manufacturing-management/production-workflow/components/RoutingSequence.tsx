import React from "react";
import { Check, ShieldAlert } from "lucide-react";
import { RoutingTask, RouteOperatorRecord } from "../types";

interface RoutingSequenceProps {
    sortedTasks: RoutingTask[];
    selectedTaskId: number | null;
    setSelectedTaskId: (id: number | null) => void;
    operatorsSummary?: { total_hours: number; total_labor_cost: number };
    routeOperators?: RouteOperatorRecord[];
}

export function RoutingSequence({
    sortedTasks,
    selectedTaskId,
    setSelectedTaskId,
    routeOperators
}: RoutingSequenceProps) {
    return (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-nowrap min-w-0 w-full scrollbar-thin scrollbar-thumb-muted-foreground/10 scrollbar-track-transparent">
            {sortedTasks.map((task, idx) => {
                const isSelected = selectedTaskId === task.id;
                const hasActiveTimer = task.assignments && task.assignments.some(a => a.started_at !== null && a.stopped_at === null);
                const isCompleted = task.status === "Completed";
                const isQAHold = task.status === "QA Hold";

                // Get active clocked-in operators for this step
                const activeOpsForTask = routeOperators
                    ? routeOperators.filter(op => op.task_id === task.id && op.started_at !== null && op.stopped_at === null)
                    : [];

                let bubbleStyle = "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground";
                
                if (isSelected) {
                    bubbleStyle = "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/10 scale-[1.01] font-bold";
                } else if (isCompleted) {
                    bubbleStyle = "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50";
                } else if (isQAHold) {
                    bubbleStyle = "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50";
                } else if (hasActiveTimer || task.status === "Ongoing") {
                    bubbleStyle = "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:bg-amber-50/10 hover:border-amber-500/50 animate-pulse";
                }

                return (
                    <React.Fragment key={task.id}>
                        <div 
                            onClick={() => setSelectedTaskId(task.id)}
                            className={`flex flex-col items-start gap-1 p-2 border rounded-xl font-semibold text-[11px] cursor-pointer select-none transition-all duration-200 transform active:scale-95 min-w-[95px] max-w-[160px] ${bubbleStyle}`}
                        >
                            <div className="flex items-center gap-1.5 w-full min-w-0">
                                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-mono border shrink-0 ${
                                    isSelected 
                                        ? "bg-primary-foreground text-primary border-primary-foreground" 
                                        : isCompleted
                                            ? "bg-emerald-500 text-white border-emerald-500"
                                            : isQAHold
                                                ? "bg-rose-500 text-white border-rose-500"
                                                : "bg-background text-foreground border-current"
                                }`}>
                                    {isCompleted ? (
                                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                                    ) : isQAHold ? (
                                        <ShieldAlert className="h-2.5 w-2.5" />
                                    ) : (
                                        task.sequence_order
                                    )}
                                </span>
                                <span className="truncate flex-1" title={task.name}>{task.name}</span>
                            </div>
                            {activeOpsForTask.length > 0 && (
                                <div className="flex items-center gap-1 mt-0.5 text-[8px] font-bold opacity-90 border-t border-current/25 pt-0.5 w-full min-w-0">
                                    <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse shrink-0 inline-block" />
                                    <span className="truncate flex-1">
                                        {activeOpsForTask.map(op => op.user_name || `User #${op.user_id}`).join(", ")}
                                    </span>
                                </div>
                            )}
                        </div>
                        {idx < sortedTasks.length - 1 && (
                            <span className="text-muted-foreground/30 font-bold text-xs select-none">➔</span>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

