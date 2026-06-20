"use client";

import React, { useState } from "react";
import { ClipboardList, CheckSquare, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

export default function RequirementsSpecTab() {
    const [alignmentSelected, setAlignmentSelected] = useState<string>("ready");
    const [feedback, setFeedback] = useState<string>("");

    const handleSubmitFeedback = (e: React.FormEvent) => {
        e.preventDefault();
        toast.success("Logistics alignment feedback recorded successfully!");
        setFeedback("");
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left Column: Requirements details */}
            <div className="xl:col-span-7 space-y-4">
                <div className="border bg-card rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b pb-3">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        <div>
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Logistics Profiles Configurations</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Specifications and expected functions matrix</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">User Story</span>
                            <p className="text-xs text-foreground bg-muted/30 border p-3 rounded-lg leading-relaxed">
                                &quot;As a Logistics Manager, I want to set default delivery trip costs (fuel, helper fee, driver allowance) so the quotation engine automates dispatch overhead.&quot;
                            </p>
                        </div>

                        <div className="space-y-2">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Target User Role</span>
                            <span className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary font-bold text-[9px] px-2 py-0.5 rounded-full uppercase">
                                System Admins & Operations
                            </span>
                        </div>

                        <div className="space-y-2 border-t pt-3">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase block">Functional Scope Checkpoints</span>
                            <ul className="space-y-1.5 text-xs">
                                {[
                                    "Maintain baseline delivery vehicle templates (Plate, model, payload capacities, driver/helper flat allowance, fuel mileage index).",
                                    "Configure flat-rates or dynamic fuel indexes per shipping route (Destination name, standard distance, regional fuel price index, estimated highway tolls).",
                                    "Incorporate trip allowance metrics and highway toll allocations dynamically.",
                                    "Support quick sandbox simulator modeling to evaluate standard shipment overhead splits."
                                ].map((func, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                                        <CheckSquare className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                                        <span>{func}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Feedback Form */}
            <div className="xl:col-span-5 space-y-4">
                <div className="border bg-card rounded-xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b pb-3">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        <div>
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Alignment Feedback Sign-off</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Submit reviews and change requests</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmitFeedback} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Alignment Status</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAlignmentSelected("ready")}
                                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                        alignmentSelected === "ready"
                                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 font-bold"
                                            : "bg-transparent border-border hover:bg-muted"
                                    }`}
                                >
                                    Sign-off Ready
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAlignmentSelected("changes")}
                                    className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                        alignmentSelected === "changes"
                                            ? "bg-amber-500/10 border-amber-500 text-amber-600 font-bold"
                                            : "bg-transparent border-border hover:bg-muted"
                                    }`}
                                >
                                    Needs Review
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Meeting Notes & Change Requests</label>
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="Type meeting feedback, client-requested tweaks, or specific freight computation multipliers here..."
                                rows={4}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm"
                        >
                            <Send className="h-3.5 w-3.5" /> Submit Feedback
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
