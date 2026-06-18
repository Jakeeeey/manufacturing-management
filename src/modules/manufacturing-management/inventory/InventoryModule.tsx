"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
    Boxes, 
    History, 
    AlertTriangle, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    CheckCircle, 
    Search, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    Filter, 
    TrendingDown, 
    Calendar, 
    ArrowUpRight, 
    ArrowDownLeft, 
    Layers, 
    Loader2,
    RefreshCw,
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    ShieldAlert,
    ChevronDown,
    ChevronRight,
    FolderOpen,
    Tag
} from "lucide-react";
import { toast } from "sonner";

export default function InventoryModule() {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<{ ledger: any[]; batches: any[]; products: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"stock" | "batches" | "ledger">("stock");
    const [searchQuery, setSearchQuery] = useState("");
    const [lowStockFilter, setLowStockFilter] = useState(false);
    const [expiryFilter, setExpiryFilter] = useState<"all" | "active" | "soon" | "expired">("all");
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: prev[key] === false }));
    };
    const isExpanded = (key: string) => {
        return expandedGroups[key] !== false; // default to true
    };

    const loadInventoryData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/manufacturing/inventory");
            if (res.ok) {
                setData(await res.json());
            } else {
                throw new Error("Failed to load inventory logs from server");
            }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to load inventory.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInventoryData();
    }, []);

    // 1. Group ledger to get current stock levels per product
    const stockLevels = useMemo(() => {
        if (!data) return [];
        const { ledger, products } = data;

        const stockMap: Record<number, { qty: number; branches: Record<number, number> }> = {};

        ledger.forEach(entry => {
            const pId = Number(entry.productId);
            const qty = Number(entry.quantity) || 0;
            const bId = Number(entry.branchId);

            if (!stockMap[pId]) {
                stockMap[pId] = { qty: 0, branches: {} };
            }
            stockMap[pId].qty += qty;
            stockMap[pId].branches[bId] = (stockMap[pId].branches[bId] || 0) + qty;
        });

        return products.map(prod => {
            const stockInfo = stockMap[Number(prod.product_id)] || { qty: 0, branches: {} };
            return {
                ...prod,
                currentStock: stockInfo.qty,
                branchStocks: stockInfo.branches
            };
        }).filter(item => {
            // Apply queries
            const query = searchQuery.toLowerCase();
            const brandName = item.product_brand?.brand_name || "Generic Brand";
            const categoryName = item.product_category?.category_name || "Unassigned Category";

            const matchesQuery = item.product_name.toLowerCase().includes(query) || 
                                 item.product_code.toLowerCase().includes(query) ||
                                 brandName.toLowerCase().includes(query) ||
                                 categoryName.toLowerCase().includes(query);
            
            const matchesLowStock = !lowStockFilter || item.currentStock < 50;

            return matchesQuery && matchesLowStock;
        });
    }, [data, searchQuery, lowStockFilter]);

    // Grouping category > brand > product
    const groupedStock = useMemo(() => {
        const categories: Record<string, Record<string, typeof stockLevels>> = {};
        
        stockLevels.forEach(prod => {
            const cat = prod.product_category?.category_name || "Unassigned Category";
            const brand = prod.product_brand?.brand_name || "Generic Brand";
            
            if (!categories[cat]) {
                categories[cat] = {};
            }
            if (!categories[cat][brand]) {
                categories[cat][brand] = [];
            }
            categories[cat][brand].push(prod);
        });
        
        return categories;
    }, [stockLevels]);

    // 2. Filterable Expiry batches
    const filteredBatches = useMemo(() => {
        if (!data) return [];
        const { batches, products } = data;

        return batches.map(b => {
            const prod = products.find(p => Number(p.product_id) === Number(b.product_id));
            const daysToExpiry = b.expiration_date 
                ? Math.ceil((new Date(b.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                : null;
            
            let status: "active" | "soon" | "expired" = "active";
            if (daysToExpiry !== null) {
                if (daysToExpiry < 0) status = "expired";
                else if (daysToExpiry <= 90) status = "soon";
            }

            return {
                ...b,
                product_name: prod?.product_name || "Unknown Product",
                product_code: prod?.product_code || "",
                daysToExpiry,
                expiryStatus: status
            };
        }).filter(b => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = b.product_name.toLowerCase().includes(query) || 
                                 b.product_code.toLowerCase().includes(query) ||
                                 (b.lot_number && b.lot_number.toLowerCase().includes(query));

            if (!matchesQuery) return false;

            if (expiryFilter === "expired") return b.expiryStatus === "expired";
            if (expiryFilter === "soon") return b.expiryStatus === "soon";
            if (expiryFilter === "active") return b.expiryStatus === "active";
            return true;
        });
    }, [data, searchQuery, expiryFilter]);

    // 3. Filtered Audit Ledger
    const filteredLedger = useMemo(() => {
        if (!data) return [];
        const { ledger, products } = data;

        return ledger.map(l => {
            const prod = products.find(p => Number(p.product_id) === Number(l.productId));
            return {
                ...l,
                productName: prod?.product_name || "Unknown Product",
                productCode: prod?.product_code || ""
            };
        }).filter(l => {
            const query = searchQuery.toLowerCase();
            return l.productName.toLowerCase().includes(query) || 
                   l.productCode.toLowerCase().includes(query) ||
                   (l.documentNo && l.documentNo.toLowerCase().includes(query)) ||
                   (l.documentDescription && l.documentDescription.toLowerCase().includes(query));
        });
    }, [data, searchQuery]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">Loading manufacturing inventory dashboard...</span>
            </div>
        );
    }

    // Metrics counters
    const totalStockVal = stockLevels.reduce((sum, s) => sum + (s.currentStock * (s.cost_per_unit || 0)), 0);
    const lowStockCount = stockLevels.filter(s => s.currentStock < 50).length;
    const soonExpiredCount = data?.batches.filter(b => {
        if (!b.expiration_date) return false;
        const days = Math.ceil((new Date(b.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= 90;
    }).length || 0;

    return (
        <div className="space-y-6">
            {/* KPI metrics bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Estimated Stock Value</span>
                        <h4 className="text-lg font-black text-foreground mt-1">₱{totalStockVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">Based on active standard costs</span>
                    </div>
                    <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/10">
                        <Boxes className="h-5 w-5 text-emerald-500" />
                    </div>
                </div>

                <div className="bg-card border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Consolidated SKUs</span>
                        <h4 className="text-lg font-black text-foreground mt-1">{stockLevels.length} Products</h4>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">Active catalog items</span>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                        <Layers className="h-5 w-5 text-primary" />
                    </div>
                </div>

                <div className="bg-card border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Shortages & Low Stock</span>
                        <h4 className="text-lg font-black text-amber-500 mt-1">{lowStockCount} Items</h4>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">Stock balance &lt; 50 units</span>
                    </div>
                    <div className="bg-amber-950/20 p-3 rounded-lg border border-amber-500/10">
                        <TrendingDown className="h-5 w-5 text-amber-500" />
                    </div>
                </div>

                <div className="bg-card border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Lots Expiring (90 days)</span>
                        <h4 className="text-lg font-black text-rose-500 mt-1">{soonExpiredCount} Batches</h4>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">Active FIFO inventory warning</span>
                    </div>
                    <div className="bg-rose-950/20 p-3 rounded-lg border border-rose-500/10">
                        <AlertTriangle className="h-5 w-5 text-rose-500" />
                    </div>
                </div>
            </div>

            {/* View navigation & Controls */}
            <div className="border border-slate-800 rounded-xl bg-card p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
                    <div className="flex bg-slate-950/40 border border-slate-800 p-1 rounded-lg gap-1">
                        <button
                            onClick={() => { setActiveTab("stock"); setSearchQuery(""); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "stock" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"
                            }`}
                        >
                            <Boxes className="h-4 w-4" /> Stock Balances
                        </button>
                        <button
                            onClick={() => { setActiveTab("batches"); setSearchQuery(""); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "batches" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"
                            }`}
                        >
                            <Calendar className="h-4 w-4" /> FIFO Batches
                        </button>
                        <button
                            onClick={() => { setActiveTab("ledger"); setSearchQuery(""); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "ledger" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"
                            }`}
                        >
                            <History className="h-4 w-4" /> Audit Ledger
                        </button>
                    </div>

                    <button 
                        onClick={loadInventoryData}
                        className="bg-slate-850 hover:bg-slate-800 text-foreground border border-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Sync stock
                    </button>
                </div>

                {/* Filter section */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by product name, code, brand, or lot number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>

                    {activeTab === "stock" && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="lowStockChk"
                                checked={lowStockFilter}
                                onChange={(e) => setLowStockFilter(e.target.checked)}
                                className="h-4 w-4 rounded bg-background border-slate-800 text-primary accent-primary"
                            />
                            <label htmlFor="lowStockChk" className="text-xs text-muted-foreground font-bold select-none cursor-pointer">
                                Low Stock (&lt;50) only
                            </label>
                        </div>
                    )}

                    {activeTab === "batches" && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground font-bold">Expiry Status:</span>
                            <select
                                value={expiryFilter}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onChange={(e: any) => setExpiryFilter(e.target.value)}
                                className="bg-background border border-slate-850 rounded-lg px-2 py-1 text-xs text-foreground font-semibold outline-none"
                            >
                                <option value="all">All Batches</option>
                                <option value="active">Safe Lots (&gt;90 days)</option>
                                <option value="soon">Expiring Soon (&le;90 days)</option>
                                <option value="expired">Expired Lots</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Tables / Lists depending on active tab */}
                <div className="overflow-x-auto">
                    {activeTab === "stock" && (
                        <div className="space-y-4">
                            {Object.keys(groupedStock).map((catName) => {
                                const catBrands = groupedStock[catName];
                                const catKey = `cat-${catName}`;
                                const catExpanded = isExpanded(catKey);

                                // Calculate category total stock and value
                                let catTotalStock = 0;
                                let catTotalValue = 0;
                                let catProductsCount = 0;

                                Object.values(catBrands).forEach(prods => {
                                    prods.forEach(p => {
                                        catTotalStock += p.currentStock;
                                        catTotalValue += p.currentStock * (p.cost_per_unit || 0);
                                        catProductsCount++;
                                    });
                                });

                                return (
                                    <div key={catName} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/10">
                                        {/* Category Header */}
                                        <button
                                            onClick={() => toggleGroup(catKey)}
                                            className="w-full flex items-center justify-between bg-slate-950/50 p-4 border-none text-left cursor-pointer transition-all hover:bg-slate-950/70"
                                        >
                                            <div className="flex items-center gap-3">
                                                {catExpanded ? <ChevronDown className="h-4.5 w-4.5 text-primary" /> : <ChevronRight className="h-4.5 w-4.5 text-primary" />}
                                                <FolderOpen className="h-4.5 w-4.5 text-amber-500" />
                                                <div>
                                                    <span className="text-xs font-extrabold text-foreground tracking-wider uppercase">{catName}</span>
                                                    <span className="text-[10px] text-muted-foreground block mt-0.5">{catProductsCount} Products</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-foreground block">₱{catTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <span className="text-[9px] text-muted-foreground block">Total Stock: {catTotalStock.toLocaleString()} PCS</span>
                                            </div>
                                        </button>

                                        {/* Brand Level */}
                                        {catExpanded && (
                                            <div className="p-4 space-y-4 bg-slate-950/20 border-t border-slate-800">
                                                {Object.keys(catBrands).map((brandName) => {
                                                    const brandProds = catBrands[brandName];
                                                    const brandKey = `brand-${catName}-${brandName}`;
                                                    const brandExpanded = isExpanded(brandKey);

                                                    const brandTotalStock = brandProds.reduce((sum, p) => sum + p.currentStock, 0);
                                                    const brandTotalValue = brandProds.reduce((sum, p) => sum + (p.currentStock * (p.cost_per_unit || 0)), 0);

                                                    return (
                                                        <div key={brandName} className="border border-slate-850/60 rounded-lg overflow-hidden bg-slate-900/5">
                                                            {/* Brand Header */}
                                                            <button
                                                                onClick={() => toggleGroup(brandKey)}
                                                                className="w-full flex items-center justify-between bg-slate-900/30 px-4 py-3 border-none text-left cursor-pointer transition-all hover:bg-slate-900/50"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {brandExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                                                    <Tag className="h-4 w-4 text-primary" />
                                                                    <span className="text-xs font-bold text-foreground">{brandName}</span>
                                                                    <span className="text-[10px] text-muted-foreground bg-slate-800/80 px-2 py-0.5 rounded-full ml-2 font-semibold">
                                                                        {brandProds.length} SKUs
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-6 text-[11px] font-bold text-foreground">
                                                                    <span>Stock: {brandTotalStock.toLocaleString()} PCS</span>
                                                                    <span className="text-primary">₱{brandTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            </button>

                                                            {/* Products list table */}
                                                            {brandExpanded && (
                                                                <div className="overflow-x-auto border-t border-slate-850">
                                                                    <table className="w-full border-collapse text-left text-[11px]">
                                                                        <thead>
                                                                            <tr className="border-b border-slate-850 bg-slate-950/20 text-muted-foreground font-extrabold">
                                                                                <th className="py-2.5 px-4">Product details</th>
                                                                                <th className="py-2.5 px-4 text-right">Standard Cost</th>
                                                                                <th className="py-2.5 px-4 text-right">Stock Balance</th>
                                                                                <th className="py-2.5 px-4 text-right">Asset Value</th>
                                                                                <th className="py-2.5 px-4">Status</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {brandProds.map((prod, idx) => {
                                                                                const assetVal = prod.currentStock * (prod.cost_per_unit || 0);
                                                                                const uom = prod.unit_of_measurement?.unit_shortcut || "PCS";
                                                                                const isLow = prod.currentStock < 50;

                                                                                return (
                                                                                    <tr key={idx} className="border-b border-slate-850/30 last:border-b-0 hover:bg-slate-950/10">
                                                                                        <td className="py-3 px-4">
                                                                                            <div>
                                                                                                <span className="font-bold text-foreground block">
                                                                                                    {prod.product_name}
                                                                                                    {prod.unit_of_measurement?.unit_name && (
                                                                                                        <span className="text-muted-foreground text-[10px] ml-1.5 font-normal">
                                                                                                            ({prod.unit_of_measurement.unit_name})
                                                                                                        </span>
                                                                                                    )}
                                                                                                </span>
                                                                                                <span className="text-[10px] text-muted-foreground font-mono">Code: {prod.product_code}</span>
                                                                                            </div>
                                                                                        </td>

                                                                                        <td className="py-3 px-4 text-right font-medium text-foreground">₱{prod.cost_per_unit?.toFixed(2) || "0.00"}</td>
                                                                                        <td className="py-3 px-4 text-right font-extrabold">
                                                                                            <span className={isLow ? "text-amber-500 animate-pulse" : "text-foreground"}>
                                                                                                {prod.currentStock.toLocaleString()} {uom}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-3 px-4 text-right font-bold text-foreground">₱{assetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                                        <td className="py-3 px-4">
                                                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                                                                                                isLow 
                                                                                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                                                                                                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                                                            }`}>
                                                                                                {isLow ? "Low Stock" : "Optimal"}
                                                                                            </span>
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
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {stockLevels.length === 0 && (
                                <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl bg-card">
                                    No products match search filters.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "batches" && (
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-850 text-muted-foreground">
                                    <th className="py-3 px-4 font-bold">Lot Number</th>
                                    <th className="py-3 px-4 font-bold">Product</th>
                                    <th className="py-3 px-4 font-bold">Expiry Date</th>
                                    <th className="py-3 px-4 font-bold">Branch ID</th>
                                    <th className="py-3 px-4 font-bold text-right">Qty Received</th>
                                    <th className="py-3 px-4 font-bold text-right">Landed Cost</th>
                                    <th className="py-3 px-4 font-bold">Expiry Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBatches.map((batch, idx) => {
                                    const cost = Number(batch.final_landed_unit_cost || batch.base_unit_cost_php || 0);
                                    
                                    return (
                                        <tr key={idx} className="border-b border-slate-850/50 hover:bg-slate-950/20">
                                            <td className="py-3.5 px-4 font-extrabold text-foreground">
                                                <code>{batch.lot_number}</code>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div>
                                                    <span className="font-bold text-foreground block">{batch.product_name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{batch.product_code}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 font-semibold text-foreground">
                                                {batch.expiration_date || <span className="text-muted-foreground italic">None (Static)</span>}
                                            </td>
                                            <td className="py-3.5 px-4 font-semibold text-muted-foreground">Branch {batch.branch_id}</td>
                                            <td className="py-3.5 px-4 text-right font-extrabold text-foreground">{Number(batch.quantity_received).toLocaleString()} PCS</td>
                                            <td className="py-3.5 px-4 text-right font-semibold text-foreground">₱{cost.toFixed(2)}</td>
                                            <td className="py-3.5 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                                                    batch.expiryStatus === "expired"
                                                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                                        : batch.expiryStatus === "soon"
                                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                }`}>
                                                    {batch.expiryStatus === "expired" 
                                                        ? "EXPIRED" 
                                                        : batch.expiryStatus === "soon"
                                                        ? `Expiring in ${batch.daysToExpiry} days`
                                                        : "Active Safe"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredBatches.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                                            No active lot batches found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {activeTab === "ledger" && (
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-850 text-muted-foreground">
                                    <th className="py-3 px-4 font-bold">Tx Date</th>
                                    <th className="py-3 px-4 font-bold">Doc No</th>
                                    <th className="py-3 px-4 font-bold">Product</th>
                                    <th className="py-3 px-4 font-bold">Document Type</th>
                                    <th className="py-3 px-4 font-bold">Description</th>
                                    <th className="py-3 px-4 font-bold">Branch</th>
                                    <th className="py-3 px-4 font-bold text-right">Movement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLedger.map((log, idx) => {
                                    const qty = Number(log.quantity) || 0;
                                    const isAddition = qty > 0;

                                    return (
                                        <tr key={idx} className="border-b border-slate-850/50 hover:bg-slate-950/20">
                                            <td className="py-3.5 px-4 font-semibold text-muted-foreground">{log.documentDate}</td>
                                            <td className="py-3.5 px-4 font-extrabold text-foreground">{log.documentNo || "ADJ"}</td>
                                            <td className="py-3.5 px-4">
                                                <div>
                                                    <span className="font-bold text-foreground block">{log.productName}</span>
                                                    <span className="text-[10px] text-muted-foreground">{log.productCode}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 font-semibold text-muted-foreground">{log.documentType}</td>
                                            <td className="py-3.5 px-4 text-muted-foreground max-w-[200px] truncate">{log.documentDescription}</td>
                                            <td className="py-3.5 px-4 font-semibold text-muted-foreground">Branch {log.branchId}</td>
                                            <td className="py-3.5 px-4 text-right">
                                                <span className={`inline-flex items-center gap-1 font-extrabold ${isAddition ? "text-emerald-500" : "text-rose-500"}`}>
                                                    {isAddition ? (
                                                        <>
                                                            <ArrowUpRight className="h-3 w-3" /> +{qty.toLocaleString()}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ArrowDownLeft className="h-3 w-3" /> {qty.toLocaleString()}
                                                        </>
                                                    )}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredLedger.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                                            No transaction history entries.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
