"use client";

import React from "react";
import { Cpu, Search, Calendar } from "lucide-react";
import { JobOrder } from "../types";

interface OperatorQueueProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    statusFilter: "All" | "Proceed" | "Ongoing" | "On Hold";
    setStatusFilter: (filter: "All" | "Proceed" | "Ongoing" | "On Hold") => void;
    filteredJOs: JobOrder[];
    activeJOs: JobOrder[];
    selectedJoId: string | null;
    setSelectedJoId: (id: string | null) => void;
}

export function OperatorQueue({
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    filteredJOs,
    activeJOs,
    selectedJoId,
    setSelectedJoId
}: OperatorQueueProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="h-4.5 w-4.5 text-primary" />
                    Production Queue
                </h3>
                <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-primary/20">
                    {activeJOs.length} Active
                </span>
            </div>

            {/* Operator Search and Filter Pills */}
            <div className="space-y-2">
                <div className="relative flex items-center">
                    <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search Job Order or Product..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 text-muted-foreground hover:text-foreground text-xs font-bold bg-transparent border-none cursor-pointer"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Status Tabs */}
                <div className="flex flex-wrap gap-1">
                    {(["All", "Proceed", "Ongoing", "On Hold"] as const).map(status => {
                        const isSelected = statusFilter === status;
                        let count = 0;
                        if (status === "All") {
                            count = activeJOs.length;
                        } else {
                            count = activeJOs.filter(j => j.status === status).length;
                        }

                        const label = status === "Proceed" ? "Ready" : status;
                        
                        return (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                                    isSelected
                                        ? "bg-primary border-primary text-primary-foreground font-extrabold shadow-sm"
                                        : "bg-slate-955 border-slate-850 text-muted-foreground hover:text-foreground hover:bg-slate-900/60"
                                }`}
                            >
                                {label} ({count})
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Queue Card List */}
            <div className="space-y-3 max-h-[62dvh] overflow-y-auto pr-1">
                {filteredJOs.map(jo => {
                    const isSelected = selectedJoId === jo.jo_id;
                    
                    // Calculate step progress percentage
                    const productsList = jo.products && jo.products.length > 0 ? jo.products : [jo];
                    let totalSteps = 0;
                    let completedSteps = 0;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    productsList.forEach((p: any) => {
                        if (p.routings) {
                            totalSteps += p.routings.length;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            completedSteps += p.routings.filter((r: any) => r.qa_status === "Passed").length;
                        }
                    });
                    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                    let statusBorderColor = "border-slate-800";
                    if (jo.status === "Ongoing") statusBorderColor = "border-l-4 border-l-sky-500 border-slate-800";
                    else if (jo.status === "Proceed") statusBorderColor = "border-l-4 border-l-emerald-500 border-slate-800";
                    else if (jo.status === "On Hold") statusBorderColor = "border-l-4 border-l-amber-500 border-slate-800";

                    return (
                        <button
                            key={jo.jo_id}
                            onClick={() => setSelectedJoId(jo.jo_id)}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-3 cursor-pointer shadow-xs ${
                                isSelected 
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : `${statusBorderColor} bg-card hover:bg-slate-900/30`
                            }`}
                        >
                            <div className="flex justify-between items-start w-full">
                                <div>
                                    <span className="font-extrabold text-foreground text-xs">{jo.jo_id}</span>
                                    <h4 className="text-[11px] font-bold text-foreground truncate max-w-[190px] mt-0.5">
                                        {jo.product_name}
                                    </h4>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                    jo.status === "Ongoing"
                                        ? "bg-sky-500/15 text-sky-500 border-sky-500/25"
                                        : jo.status === "Proceed"
                                        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                                        : "bg-amber-500/15 text-amber-500 border-amber-500/25"
                                }`}>
                                    {jo.status === "Proceed" ? "Ready" : jo.status}
                                </span>
                            </div>

                            {/* Progress meter */}
                            <div className="w-full space-y-1.5 text-[10px]">
                                <div className="flex justify-between text-muted-foreground font-semibold">
                                    <span>Checklist Steps</span>
                                    <span>{completedSteps} / {totalSteps} Passed ({progressPercent}%)</span>
                                </div>
                                <div className="w-full bg-slate-850 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>

                            {/* Footer details */}
                            <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-slate-850">
                                <span className="font-bold text-foreground">{jo.quantity.toLocaleString()} PCS</span>
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" /> Due: {jo.due_date}
                                </span>
                            </div>
                        </button>
                    );
                })}

                {filteredJOs.length === 0 && (
                    <div className="p-8 text-center border border-dashed rounded-xl bg-card">
                        <Cpu className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                        <span className="text-[11px] text-muted-foreground block">No matching production runs found.</span>
                        <span className="text-[9px] text-muted-foreground/60 block mt-1">Try resetting your search query or status filter.</span>
                    </div>
                )}
            </div>
        </div>
    );
}
