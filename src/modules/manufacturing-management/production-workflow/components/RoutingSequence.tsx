/* eslint-disable */
import React from "react";
import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RoutingTask } from "../types";

interface RoutingSequenceProps {
    sortedTasks: RoutingTask[];
    selectedTaskId: number | null;
    setSelectedTaskId: (id: number) => void;
    operatorsSummary: { total_hours: number; total_labor_cost: number };
}

export function RoutingSequence({
    sortedTasks,
    selectedTaskId,
    setSelectedTaskId,
    operatorsSummary
}: RoutingSequenceProps) {
    return (
        <Card className="border border-border/60 shadow-sm rounded-2xl bg-card">
            <CardContent className="p-5">
                <div className="flex flex-col space-y-1 mb-3">
                    <h3 className="font-extrabold text-base text-foreground tracking-tight">Routing Steps Sequence</h3>
                    <p className="text-xs text-muted-foreground">The operations required to execute this Job Order, rendered in sequence order.</p>
                </div>
                
                {/* Horizontal bubbles sequence timeline without status dependency */}
                <div className="flex flex-wrap items-center gap-3">
                    {sortedTasks.map((task, idx) => {
                        const hasActiveTimer = task.assignments && task.assignments.some(a => a.started_at !== null && a.stopped_at === null);
                        
                        let bubbleStyle = "border-border bg-muted/20 text-muted-foreground";
                        if (hasActiveTimer) {
                            bubbleStyle = "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/10 animate-pulse";
                        }

                        return (
                            <React.Fragment key={task.id}>
                                <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl font-semibold text-xs transition-all ${bubbleStyle}`}>
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background border border-current text-[10px] font-mono">
                                        {task.sequence_order}
                                    </span>
                                    <span>{task.name}</span>
                                </div>
                                {idx < sortedTasks.length - 1 && (
                                    <span className="text-muted-foreground/30 font-bold text-xs select-none">➔</span>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
