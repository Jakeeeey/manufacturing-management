import React, { useState, useEffect } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Trash2, AlertTriangle, Coins, Percent } from "lucide-react";
import { SelectedQuoteProduct } from "../types";

interface SelectedProductsListProps {
    selectedProductsList: SelectedQuoteProduct[];
    handleAgreedPriceChange: (productId: number, val: number) => void;
    removeProductFromQuote: (productId: number) => void;
    changeProductVersion: (productId: number, versionId: number | null, versionName: string | null) => void;
}

export function SelectedProductsList({
    selectedProductsList,
    handleAgreedPriceChange,
    removeProductFromQuote,
    changeProductVersion
}: SelectedProductsListProps) {
    const [cogsMap, setCogsMap] = useState<Record<string, number | null>>({});
    const [loadingCogs, setLoadingCogs] = useState<Record<string, boolean>>({});
    const [versionsMap, setVersionsMap] = useState<Record<number, { id: number; version_name: string; created_at?: string }[]>>({});
    const [loadingVersions, setLoadingVersions] = useState<Record<number, boolean>>({});

    // Fetch versions dynamically for selected products
    useEffect(() => {
        selectedProductsList.forEach(item => {
            const pid = item.product.product_id;
            if (versionsMap[pid] !== undefined || loadingVersions[pid]) return;

            setLoadingVersions(prev => ({ ...prev, [pid]: true }));
            fetch(`/api/manufacturing/finished-goods/versions?productId=${pid}`)
                .then(res => res.ok ? res.json() : [])
                .then(data => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const sorted = [...data].sort((a: any, b: any) => {
                        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        if (timeA !== timeB) return timeB - timeA;
                        return b.id - a.id;
                    });
                    setVersionsMap(prev => ({ ...prev, [pid]: sorted }));
                    
                    // Automatically default to the latest version by time if none is set
                    if (sorted.length > 0 && !item.versionId) {
                        changeProductVersion(pid, sorted[0].id, sorted[0].version_name);
                    }
                })
                .catch(e => console.error("Error fetching versions:", pid, e))
                .finally(() => {
                    setLoadingVersions(prev => ({ ...prev, [pid]: false }));
                });
        });
    }, [selectedProductsList, versionsMap, loadingVersions, changeProductVersion]);

    // Fetch cost for selected product + version cache key
    useEffect(() => {
        selectedProductsList.forEach(item => {
            const pid = item.product.product_id;
            const vid = item.versionId;
            const cacheKey = `${pid}-${vid || "default"}`;

            if (cogsMap[cacheKey] !== undefined || loadingCogs[cacheKey]) return;

            setLoadingCogs(prev => ({ ...prev, [cacheKey]: true }));
            const url = vid 
                ? `/api/manufacturing/finished-goods/bom-cost?productId=${pid}&versionId=${vid}`
                : `/api/manufacturing/finished-goods/bom-cost?productId=${pid}`;

            fetch(url)
                .then(res => res.ok ? res.json() : { cost: 0, hasCogs: false })
                .then(data => {
                    const hasCogs = data.hasCogs !== undefined ? data.hasCogs : (typeof data.cost === "number" && data.cost > 0);
                    const resolvedCost = hasCogs
                        ? (typeof data.cost === "number" ? data.cost : Number(item.product.cost_per_unit || 0))
                        : (item.product.has_cogs ? Number(item.product.cost_per_unit || 0) : null);
                    setCogsMap(prev => ({ ...prev, [cacheKey]: resolvedCost }));
                })
                .catch(() => {
                    setCogsMap(prev => ({ ...prev, [cacheKey]: item.product.has_cogs ? Number(item.product.cost_per_unit || 0) : null }));
                })
                .finally(() => {
                    setLoadingCogs(prev => ({ ...prev, [cacheKey]: false }));
                });
        });
    }, [selectedProductsList, cogsMap, loadingCogs]);

    return (
        <div className="space-y-4 rounded-2xl border bg-card/40 backdrop-blur-md p-6 shadow-xl lg:col-span-3">
            <div className="flex items-center justify-between border-b pb-3">
                <div>
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Coins className="h-4 w-4 text-violet-400" />
                        Agreed Pricing Override Sheet
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Define custom margins and price deviations from the catalog baseline.</p>
                </div>
            </div>

            {selectedProductsList.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-20 bg-muted/25 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2">
                    <Coins className="h-10 w-10 text-muted-foreground/60 animate-bounce" />
                    <span>No products selected. Click items from the catalog panel to add them to this pricing draft.</span>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border bg-muted/20">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-muted border-b text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                            <tr>
                                <th className="p-3.5">Product Details</th>
                                <th className="p-3.5">UOM</th>
                                <th className="p-3.5 text-right">Standard COGS</th>
                                <th className="p-3.5 text-right">Price Type Rate</th>
                                <th className="p-3.5 text-right">Agreed Price</th>
                                <th className="p-3.5 text-right">Gross Profit Margin</th>
                                <th className="p-3.5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/85">
                            {selectedProductsList.map((item) => {
                                const pid = item.product.product_id;
                                const vid = item.versionId;
                                const cacheKey = `${pid}-${vid || "default"}`;
                                const cost = cogsMap[cacheKey] !== undefined ? cogsMap[cacheKey] : (item.product.has_cogs ? Number(item.product.cost_per_unit || 0) : null);
                                const priceTypePrice = Number(item.priceTypePrice || 0);
                                const agreedPrice = Number(item.agreedPrice || 0);
                                const gp = cost !== null ? agreedPrice - cost : null;
                                const margin = (gp !== null && agreedPrice > 0) ? (gp / agreedPrice) * 100 : null;
                                const isOverride = Math.abs(agreedPrice - priceTypePrice) > 0.01;

                                return (
                                    <tr key={pid} className="hover:bg-muted/35 transition-colors">
                                        <td className="p-3.5">
                                            <span className="font-semibold text-foreground block text-xs">{item.product.product_name}</span>
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="text-[10px] text-muted-foreground font-mono">SKU: {item.product.product_code}</span>
                                                {versionsMap[pid] && versionsMap[pid].length > 0 && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Ver:</span>
                                                        <select
                                                            value={vid || ""}
                                                            onChange={e => {
                                                                const selectedId = parseInt(e.target.value);
                                                                const vObj = versionsMap[pid].find(v => v.id === selectedId);
                                                                if (vObj) {
                                                                    changeProductVersion(pid, vObj.id, vObj.version_name);
                                                                }
                                                            }}
                                                            className="text-[10px] bg-background text-primary font-bold border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
                                                        >
                                                            {versionsMap[pid].map(v => (
                                                                <option key={v.id} value={v.id}>
                                                                    {v.version_name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className="font-semibold text-foreground text-xs">{item.product.unit_of_measurement?.unit_shortcut || "PCS"}</span>
                                        </td>
                                        <td className="p-3.5 text-right font-semibold text-foreground">
                                            {loadingCogs[cacheKey] ? (
                                                <span className="text-muted-foreground animate-pulse text-[10px]">resolving...</span>
                                            ) : cost !== null ? (
                                                `₱${cost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                                            ) : (
                                                <span className="text-muted-foreground bg-muted border px-2 py-0.5 rounded-md text-[10px]">N/A</span>
                                            )}
                                        </td>
                                        <td className="p-3.5 text-right text-muted-foreground font-medium">
                                            ₱{priceTypePrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <div className="relative inline-block">
                                                <span className="absolute left-2.5 top-1.5 text-[10px] text-muted-foreground">₱</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={agreedPrice || ""}
                                                    onChange={e => handleAgreedPriceChange(pid, parseFloat(e.target.value) || 0)}
                                                    className={`w-28 rounded-lg border pl-6 pr-2.5 py-1 text-right text-xs bg-background outline-none transition-all ${
                                                        isOverride 
                                                            ? "border-amber-500/80 font-bold text-amber-500 focus:ring-1 focus:ring-amber-500" 
                                                            : "border-input text-foreground focus:ring-1 focus:ring-primary focus:border-primary"
                                                    }`}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <div className="flex flex-col items-end">
                                                {gp !== null ? (
                                                    <>
                                                        <span className={`font-bold text-xs ${gp >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                            ₱{gp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                        </span>
                                                        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${margin !== null && margin >= 15 ? "text-emerald-600/90" : "text-amber-500"}`}>
                                                            <Percent className="h-2.5 w-2.5" />
                                                            {margin !== null ? margin.toFixed(1) : 0}%
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground text-[10px] bg-muted border px-2 py-0.5 rounded-md">N/A</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <button
                                                onClick={() => removeProductFromQuote(pid)}
                                                className="p-2 hover:bg-muted text-rose-500/80 hover:text-rose-500 rounded-lg transition-all"
                                                title="Remove Item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
