import React, { useMemo } from "react";
import { CheckCircle2, AlertTriangle, TrendingDown, ClipboardCheck, ArrowUpRight } from "lucide-react";
import { QALogEntry, JobOrder, CatalogProduct } from "../types";

interface QAOverviewDashboardProps {
    qaHistory: QALogEntry[];
    activeJOs: JobOrder[];
    catalogProducts: CatalogProduct[];
}

export function QAOverviewDashboard({
    qaHistory,
    activeJOs,
    catalogProducts
}: QAOverviewDashboardProps) {
    const stats = useMemo(() => {
        let totalExpected = 0;
        let totalActual = 0;
        let totalScrap = 0;
        let totalWastageCost = 0;

        // Map product names to their unit costs for accurate calculation
        const productCostMap = new Map<string, number>();
        catalogProducts.forEach(p => {
            if (p.product_name) {
                productCostMap.set(p.product_name.toLowerCase(), Number(p.cost_per_unit || 0));
            }
        });

        // Track defects per product for the breakdown list
        const productDefects: Record<string, { scrap: number; cost: number }> = {};

        qaHistory.forEach(log => {
            const exp = Number(log.expected_quantity || 0);
            const act = Number(log.actual_quantity || 0);
            const dev = Math.max(0, exp - act); // deviation is expected - actual quantity

            totalExpected += exp;
            totalActual += act;
            totalScrap += dev;

            const unitCost = productCostMap.get(log.product_name?.toLowerCase()) || 0;
            const logScrapCost = dev * unitCost;
            totalWastageCost += logScrapCost;

            if (dev > 0) {
                const prodName = log.product_name || "Other / Unspecified";
                if (!productDefects[prodName]) {
                    productDefects[prodName] = { scrap: 0, cost: 0 };
                }
                productDefects[prodName].scrap += dev;
                productDefects[prodName].cost += logScrapCost;
            }
        });

        const clearanceRate = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 100;
        const scrapRate = totalExpected > 0 ? (totalScrap / totalExpected) * 100 : 0;

        // Sort product defects by total cost to find top drivers
        const topDefectProducts = Object.entries(productDefects)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 4);

        return {
            clearanceRate,
            scrapRate,
            totalScrap,
            totalWastageCost,
            totalAudited: totalExpected,
            topDefectProducts
        };
    }, [qaHistory, catalogProducts]);

    const pendingAuditCount = useMemo(() => {
        // Calculate pending audits. A JO is pending if there are tasks with requires_qa = true that are not Completed.
        return activeJOs.filter(jo => {
            const qaTasks = jo.routing_tasks?.filter(t => t.requires_qa) || [];
            return qaTasks.some(t => t.status !== "Completed");
        }).length;
    }, [activeJOs]);

    const formatPHP = (val: number) => {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP"
        }).format(val);
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Clearance Rate */}
                <div className="bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-2 mt-[-8px]" />
                    </div>
                    <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">QA Clearance Rate</span>
                    <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-2xl font-black tracking-tight text-foreground">
                            {stats.clearanceRate.toFixed(1)}%
                        </span>
                        <span className="text-[10px] font-bold text-emerald-500 flex items-center">
                            Passed yield
                        </span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
                        <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${stats.clearanceRate}%` }}
                        />
                    </div>
                </div>

                {/* Total Defect Items */}
                <div className="bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-16 w-16 bg-amber-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
                        <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-[-8px]" />
                    </div>
                    <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">Scrap / Defect Count</span>
                    <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-2xl font-black tracking-tight text-foreground">
                            {stats.totalScrap.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-amber-500">
                            ({stats.scrapRate.toFixed(1)}% Scrap Rate)
                        </span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
                        <div 
                            className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(100, stats.scrapRate * 5)}%` }}
                        />
                    </div>
                </div>

                {/* Estimated Cost Loss */}
                <div className="bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-16 w-16 bg-rose-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
                        <TrendingDown className="h-5 w-5 text-rose-500 mr-2 mt-[-8px]" />
                    </div>
                    <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">Scrap Financial Impact</span>
                    <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-2xl font-black tracking-tight text-foreground">
                            {formatPHP(stats.totalWastageCost)}
                        </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-3">Calculated via product cost list</p>
                </div>

                {/* Pending JO Audits */}
                <div className="bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-16 w-16 bg-indigo-500/5 rounded-bl-full flex items-center justify-center transition-all group-hover:scale-110">
                        <ClipboardCheck className="h-5 w-5 text-indigo-500 mr-2 mt-[-8px]" />
                    </div>
                    <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">JOs Pending QA Audit</span>
                    <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-2xl font-black tracking-tight text-foreground">
                            {pendingAuditCount}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold">Active queue</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-3">Requires checkpoint confirmation</p>
                </div>
            </div>

            {/* Sub-dashboard Breakdown widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Scrap Drivers / Loss Leaders */}
                <div className="lg:col-span-2 bg-card border rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                        <div>
                            <h4 className="text-xs font-bold text-foreground">Top Quality Scrap Drivers</h4>
                            <p className="text-[10px] text-muted-foreground">Products contributing most to QA deviations & financial loss.</p>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Sorted by Cost</span>
                    </div>

                    {stats.topDefectProducts.length === 0 ? (
                        <div className="text-center py-10">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground font-medium">No QA scrap or deviations recorded yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {stats.topDefectProducts.map((p, idx) => {
                                const maxCost = Math.max(...stats.topDefectProducts.map(item => item.cost), 1);
                                const percentageOfMax = (p.cost / maxCost) * 100;

                                return (
                                    <div key={p.name} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-foreground truncate max-w-[60%] flex items-center gap-1.5">
                                                <span className="text-[9px] h-4 w-4 bg-muted text-muted-foreground flex items-center justify-center rounded-sm font-black">
                                                    {idx + 1}
                                                </span>
                                                {p.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground text-[10px]">Qty: {p.scrap.toLocaleString()}</span>
                                                <span className="text-rose-500 font-extrabold">{formatPHP(p.cost)}</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-muted/50 h-2 rounded-sm overflow-hidden">
                                            <div 
                                                className="bg-gradient-to-r from-rose-500/80 to-rose-600 h-full rounded-sm"
                                                style={{ width: `${percentageOfMax}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Quick Auditing Guidelines / Tip widget */}
                <div className="bg-card border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-indigo-500 font-bold border-b pb-2 mb-3">
                            <ClipboardCheck className="h-4 w-4" />
                            <h4 className="text-xs font-extrabold uppercase tracking-wider">Inspector Standard</h4>
                        </div>
                        <ul className="space-y-2.5 text-[11px] text-muted-foreground font-medium">
                            <li className="flex items-start gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                Inspect items at active routing stages carrying the <strong className="text-foreground">Requires QA</strong> flag.
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                Record precise passed quantities. Any discrepancy will log as deficit scrap.
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                Provide detailed remarks on volumetric density, packaging integrity, or temperature variances if QA fails.
                            </li>
                        </ul>
                    </div>
                    <div className="pt-4 border-t border-muted/50 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                        <span>Ver. 1.4.0 (QA Control)</span>
                        <a href="#" className="text-primary flex items-center gap-0.5 hover:underline">
                            Read SOP <ArrowUpRight className="h-3 w-3" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
