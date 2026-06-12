"use client";

import React from "react";
import { 
    TrendingUp, 
    DollarSign, 
    Layers, 
    AlertTriangle,
    ArrowRight,
    ClipboardList
} from "lucide-react";
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer
} from "recharts";
import Link from "next/link";

// Mock Data
const stats = [
    { label: "Avg. Gross Margin", value: "32.4%", change: "+2.1%", positive: true, icon: TrendingUp, detail: "Target: >30.0%" },
    { label: "Active BOM Recipes", value: "48", change: "6 draft", positive: true, icon: Layers, detail: "3 nested sub-assemblies" },
    { label: "Production Value", value: "₱12.4M", change: "-1.5%", positive: false, icon: DollarSign, detail: "Month-to-date total" },
    { label: "Pending Approvals", value: "4 Quotes", change: "Action required", positive: false, icon: ClipboardList, detail: "Margins < 15% threshold" }
];

const costVarianceData = [
    { date: "May 15", Standard: 48.20, Actual: 48.50 },
    { date: "May 20", Standard: 48.20, Actual: 49.10 },
    { date: "May 25", Standard: 48.20, Actual: 50.80 },
    { date: "May 30", Standard: 50.50, Actual: 51.20 },
    { date: "Jun 04", Standard: 50.50, Actual: 50.30 },
    { date: "Jun 09", Standard: 50.50, Actual: 52.40 },
    { date: "Jun 11", Standard: 52.00, Actual: 54.10 }
];

const materialSpikes = [
    { name: "Refined Palm Oil", before: "₱58.20 / L", now: "₱66.40 / L", spike: "+14.1%", severity: "high" },
    { name: "Soybean Crude Oil", before: "₱42.10 / L", now: "₱45.80 / L", spike: "+8.7%", severity: "medium" },
    { name: "PET Bottle 1L (High Density)", before: "₱3.80 / pc", now: "₱4.15 / pc", spike: "+9.2%", severity: "medium" },
    { name: "Cardboard Packaging (12x1L)", before: "₱18.50 / pc", now: "₱19.10 / pc", spike: "+3.2%", severity: "low" }
];

const pendingQuotes = [
    { id: "QT-2026-0041", client: "Universal Food Corp", product: "1L Blended Vegetable Oil", margin: "11.2%", status: "Requires GM Approval" },
    { id: "QT-2026-0043", client: "Mega Foods Inc", product: "Refined Canola Oil Bulk", margin: "14.5%", status: "Under Threshold" },
    { id: "QT-2026-0044", client: "Pacific Distributing", product: "250ml Coconut Oil Pack", margin: "22.1%", status: "Pending Finance Review" }
];

export default function DashboardModule() {
    return (
        <div className="space-y-6">
            {/* Top welcome message */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Executive Costing Summary</h1>
                    <p className="text-sm text-muted-foreground">
                        Real-time tracking of manufacturing bills of materials, routings, and margin thresholds.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium text-muted-foreground">Landed Cost Engine Connected</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <div 
                            key={i}
                            className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                                <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                                    <Icon className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="mt-3 flex items-baseline gap-2">
                                <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                                <span className={`text-xs font-semibold ${
                                    stat.positive ? "text-emerald-500" : "text-amber-500"
                                }`}>
                                    {stat.change}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
                        </div>
                    );
                })}
            </div>

            {/* Charts & Spikes Layout */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Cost Variance Chart */}
                <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">Cost Variance Trend (PHP)</h2>
                            <p className="text-xs text-muted-foreground">Comparing Standard Cost vs. Live Landed Cost per Liter</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full bg-primary" />
                                <span className="font-medium text-muted-foreground">Standard Cost</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full bg-amber-500" />
                                <span className="font-medium text-muted-foreground">Actual Landed Cost</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={costVarianceData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorStd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} domain={[40, 60]} />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: "hsl(var(--card))", 
                                        borderColor: "hsl(var(--border))",
                                        borderRadius: "8px",
                                        fontSize: "12px"
                                    }}
                                />
                                <Area type="monotone" dataKey="Standard" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorStd)" />
                                <Area type="monotone" dataKey="Actual" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorAct)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Raw Material Cost Spikes */}
                <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight">Cost Spike Alerts</h2>
                                <p className="text-xs text-muted-foreground">Top material increases in last shipment batch</p>
                            </div>
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="space-y-4">
                            {materialSpikes.map((spike, i) => (
                                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                    <div>
                                        <p className="text-sm font-semibold">{spike.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Was {spike.before} ➔ <span className="font-medium text-foreground">{spike.now}</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            spike.severity === "high" 
                                                ? "bg-destructive/10 text-destructive" 
                                                : spike.severity === "medium"
                                                ? "bg-amber-500/10 text-amber-600"
                                                : "bg-slate-500/10 text-slate-600"
                                        }`}>
                                            {spike.spike}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4 pt-2 border-t text-center">
                        <Link href="/mm/raw-materials" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                            View Raw Materials Master <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Pending Quotes & Quick Actions */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Pending Quote Approvals */}
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h2 className="mb-3 text-lg font-semibold tracking-tight">Pending Approval Queue</h2>
                    <div className="space-y-3">
                        {pendingQuotes.map((quote, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg border bg-background/50 p-3 hover:bg-background/80 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold">{quote.id}</span>
                                        <span className="text-xs text-muted-foreground">{quote.client}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{quote.product}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-amber-600">Margin: {quote.margin}</div>
                                    <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-medium">
                                        {quote.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 text-center">
                        <Link href="/mm/quotation-builder" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                            Open Quotation Builder <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>

                {/* Core Navigation Shortcuts */}
                <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <h2 className="mb-2 text-lg font-semibold tracking-tight">Active Workflows</h2>
                        <p className="text-xs text-muted-foreground mb-4">Jump directly to production or costing tools.</p>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <Link 
                                href="/mm/finished-goods" 
                                className="flex flex-col gap-1 rounded-lg border bg-background/40 p-3 hover:bg-background/80 hover:border-primary/50 transition-all text-left"
                            >
                                <span className="text-xs font-bold text-primary">BOM & Routings</span>
                                <span className="text-[10px] text-muted-foreground">Edit finished goods recipes</span>
                            </Link>

                            <Link 
                                href="/mm/margin-simulator" 
                                className="flex flex-col gap-1 rounded-lg border bg-background/40 p-3 hover:bg-background/80 hover:border-primary/50 transition-all text-left"
                            >
                                <span className="text-xs font-bold text-primary">Margin Sandbox</span>
                                <span className="text-[10px] text-muted-foreground">Simulate yield & cost spikes</span>
                            </Link>

                            <Link 
                                href="/mm/suppliers" 
                                className="flex flex-col gap-1 rounded-lg border bg-background/40 p-3 hover:bg-background/80 hover:border-primary/50 transition-all text-left"
                            >
                                <span className="text-xs font-bold text-primary">Supplier Costs</span>
                                <span className="text-[10px] text-muted-foreground">Verify landed unit prices</span>
                            </Link>

                            <Link 
                                href="/mm/forex-manager" 
                                className="flex flex-col gap-1 rounded-lg border bg-background/40 p-3 hover:bg-background/80 hover:border-primary/50 transition-all text-left"
                            >
                                <span className="text-xs font-bold text-primary">Forex Settings</span>
                                <span className="text-[10px] text-muted-foreground">Adjust exchange multipliers</span>
                            </Link>
                        </div>
                    </div>

                    <div className="mt-4 text-xs text-center text-muted-foreground border-t pt-3">
                        VOS Enterprise Resource Planning ➔ Production & Engineering Module
                    </div>
                </div>
            </div>
        </div>
    );
}
