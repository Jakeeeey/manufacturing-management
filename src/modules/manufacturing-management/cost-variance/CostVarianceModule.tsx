"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, ClipboardList, Hammer, AlertTriangle, CheckCircle, BarChart3, Plus, Percent } from "lucide-react";
import { toast } from "sonner";

export default function CostVarianceModule() {
    const [selectedJob, setSelectedJob] = useState<any | null>(null);
    const [logs, setLogs] = useState([
        { id: 101, joNumber: "JO-2026-001", productName: "Premium Vegetable Oil (1L)", date: "2026-06-12", expectedQty: 1000, actualQty: 980, variancePercent: -2.0, status: "Variance Flagged", standardCost: 45.50, actualCost: 47.80 },
        { id: 102, joNumber: "JO-2026-002", productName: "Cooking Oil Drums (20L)", date: "2026-06-11", expectedQty: 250, actualQty: 252, variancePercent: 0.8, status: "Optimal Run", standardCost: 850.00, actualCost: 842.50 },
        { id: 103, joNumber: "JO-2026-003", productName: "Coconut Frying Oil (500ml)", date: "2026-06-10", expectedQty: 2000, actualQty: 1995, variancePercent: -0.25, status: "Optimal Run", standardCost: 28.20, actualCost: 28.10 }
    ]);
    
    // Shopfloor Actual Logging form state
    const [form, setForm] = useState({
        joNumber: "",
        productName: "",
        expectedQty: "",
        actualQty: "",
        actualLaborHours: "",
        actualMaterialUsedKg: ""
    });

    const handleLogSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.joNumber || !form.actualQty || !form.expectedQty) {
            toast.error("Please fill in the Job Order Number and quantities");
            return;
        }

        const expected = parseFloat(form.expectedQty);
        const actual = parseFloat(form.actualQty);
        const variance = ((actual - expected) / expected) * 100;
        
        const newLog = {
            id: Date.now(),
            joNumber: form.joNumber,
            productName: form.productName || "Custom Blend Frying Oil",
            date: new Date().toISOString().split("T")[0],
            expectedQty: expected,
            actualQty: actual,
            variancePercent: Number(variance.toFixed(2)),
            status: Math.abs(variance) > 1.5 ? "Variance Flagged" : "Optimal Run",
            standardCost: 55.00,
            actualCost: 55.00 * (1 - variance / 100) // Simple variance cost shift helper
        };

        setLogs([newLog, ...logs]);
        toast.success(`Production Log for ${form.joNumber} submitted!`);
        setForm({
            joNumber: "",
            productName: "",
            expectedQty: "",
            actualQty: "",
            actualLaborHours: "",
            actualMaterialUsedKg: ""
        });
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto p-1">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/10 p-5 border rounded-xl">
                <div className="space-y-1">
                    <h2 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                        <BarChart3 className="h-4.5 w-4.5 text-primary" />
                        Production Shopfloor Logs & Cost Variance
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                        Compare standard recipe yields against actual raw execution inputs. Log batches to track cost deviations.
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-xl bg-card p-5 shadow-sm flex justify-between items-center">
                    <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Average Yield Variance</span>
                        <h3 className="text-xl font-black text-red-500">-0.48%</h3>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-500 bg-red-500/10 p-1.5 rounded-lg border border-red-500/20" />
                </div>
                
                <div className="border rounded-xl bg-card p-5 shadow-sm flex justify-between items-center">
                    <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Batches Flagged</span>
                        <h3 className="text-xl font-black text-amber-500">1 Run</h3>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-amber-500 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20" />
                </div>

                <div className="border rounded-xl bg-card p-5 shadow-sm flex justify-between items-center">
                    <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Optimal Runs</span>
                        <h3 className="text-xl font-black text-emerald-500">2 Runs</h3>
                    </div>
                    <CheckCircle className="h-8 w-8 text-emerald-500 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20" />
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Logs Table */}
                <div className="md:col-span-2 border rounded-xl bg-card overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 border-b bg-muted/5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <ClipboardList className="h-4 w-4 text-primary" />
                            Production History & Cost Variance Logs
                        </h3>
                    </div>

                    <div className="divide-y overflow-y-auto max-h-[50dvh]">
                        {logs.map((log) => (
                            <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 transition-colors">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-xs text-foreground">{log.joNumber}</span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                            log.status === "Optimal Run" 
                                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                                                : "bg-red-500/10 text-red-600 border-red-500/20"
                                        }`}>
                                            {log.status}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate">{log.productName}</p>
                                    <div className="flex gap-2 text-[10px] text-muted-foreground font-semibold">
                                        <span>Target: {log.expectedQty} units</span>
                                        <span>•</span>
                                        <span>Actual: {log.actualQty} units</span>
                                    </div>
                                </div>

                                <div className="flex sm:flex-col items-end justify-between gap-1">
                                    <span className="text-[10px] text-muted-foreground font-mono">{log.date}</span>
                                    <div className="text-xs font-bold font-mono">
                                        <span className="text-muted-foreground text-[10px]">Std: ₱{log.standardCost.toFixed(2)}</span>
                                        <span className="text-muted-foreground mx-1">/</span>
                                        <span className={log.actualCost > log.standardCost ? "text-red-500" : "text-emerald-500"}>
                                            Act: ₱{log.actualCost.toFixed(2)}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-mono font-bold ${log.variancePercent < 0 ? "text-red-500" : "text-emerald-500"}`}>
                                        {log.variancePercent > 0 ? "+" : ""}{log.variancePercent}% yield
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shopfloor logger form */}
                <div className="border rounded-xl bg-card p-5 shadow-sm space-y-4 flex flex-col h-fit">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                        <Hammer className="h-4 w-4 text-primary" />
                        Log Actual Production Run
                    </h3>
                    
                    <form onSubmit={handleLogSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">JO Reference Number</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. JO-2026-004"
                                value={form.joNumber}
                                onChange={e => setForm({...form, joNumber: e.target.value})}
                                className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Product Blend</label>
                            <input
                                type="text"
                                placeholder="e.g. Premium Frying Oil Blend"
                                value={form.productName}
                                onChange={e => setForm({...form, productName: e.target.value})}
                                className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Standard Qty</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="Expected"
                                    value={form.expectedQty}
                                    onChange={e => setForm({...form, expectedQty: e.target.value})}
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actual Output</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="Produced"
                                    value={form.actualQty}
                                    onChange={e => setForm({...form, actualQty: e.target.value})}
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actual Labor (Hrs)</label>
                                <input
                                    type="number"
                                    placeholder="Actual hours"
                                    value={form.actualLaborHours}
                                    onChange={e => setForm({...form, actualLaborHours: e.target.value})}
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actual Raw Materials (Kg)</label>
                                <input
                                    type="number"
                                    placeholder="Consumed"
                                    value={form.actualMaterialUsedKg}
                                    onChange={e => setForm({...form, actualMaterialUsedKg: e.target.value})}
                                    className="w-full bg-background border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Submit Production Run
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
