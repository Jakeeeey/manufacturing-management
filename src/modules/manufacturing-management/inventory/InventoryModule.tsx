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
    Tag,
    Sliders,
    Plus,
    X
} from "lucide-react";
import { toast } from "sonner";

export default function InventoryModule() {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [data, setData] = useState<{ ledger: any[]; batches: any[]; products: any[]; branches: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"stock" | "batches" | "ledger">("stock");
    const [searchQuery, setSearchQuery] = useState("");
    const [lowStockFilter, setLowStockFilter] = useState(false);
    const [expiryFilter, setExpiryFilter] = useState<"all" | "active" | "soon" | "expired">("all");
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
    const [expandedBatches, setExpandedBatches] = useState<Record<number, boolean>>({});
    const [expandedLedgers, setExpandedLedgers] = useState<Record<number, boolean>>({});
    const [flashStates, setFlashStates] = useState<Record<number, "up" | "down">>({});
    const prevStocksRef = React.useRef<Record<number, number>>({});

    // Stock adjustment modal states
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjProductId, setAdjProductId] = useState("");
    const [adjBranchId, setAdjBranchId] = useState("1");
    const [adjQty, setAdjQty] = useState("");
    const [adjType, setAdjType] = useState("Stock Take Reconciliation");
    const [adjRemarks, setAdjRemarks] = useState("");
    const [adjDate, setAdjDate] = useState(new Date().toISOString().split("T")[0]);
    const [submittingAdj, setSubmittingAdj] = useState(false);

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: prev[key] === false }));
    };
    const isExpanded = (key: string) => {
        return expandedGroups[key] !== false; // default to true
    };
    const toggleProductExpand = (prodId: number) => {
        setExpandedProducts(prev => ({ ...prev, [prodId]: !prev[prodId] }));
    };
    const toggleBatchExpand = (batchId: number) => {
        setExpandedBatches(prev => ({ ...prev, [batchId]: !prev[batchId] }));
    };
    const toggleLedgerExpand = (ledgerId: number) => {
        setExpandedLedgers(prev => ({ ...prev, [ledgerId]: !prev[ledgerId] }));
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

    const handlePostAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjProductId || !adjQty) {
            toast.warning("Please select a product and input quantity.");
            return;
        }

        const qty = parseFloat(adjQty);
        if (isNaN(qty) || qty === 0) {
            toast.warning("Please enter a valid non-zero quantity.");
            return;
        }

        setSubmittingAdj(true);
        try {
            const res = await fetch("/api/manufacturing/inventory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: Number(adjProductId),
                    branchId: Number(adjBranchId),
                    quantity: qty,
                    documentType: adjType,
                    documentDescription: adjRemarks,
                    documentDate: adjDate
                })
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || "Failed to submit stock adjustment.");
            }

            toast.success("Stock adjustment successfully posted!");
            setIsAdjustmentModalOpen(false);
            // Reset form
            setAdjProductId("");
            setAdjQty("");
            setAdjRemarks("");
            
            // Reload inventory
            loadInventoryData();
        } catch (err) {
            toast.error((err as Error).message || "An error occurred.");
        } finally {
            setSubmittingAdj(false);
        }
    };

    useEffect(() => {
        // 1. Initial Load
        loadInventoryData();

        // 2. Establish Realtime WebSocket Connection
        let ws: WebSocket | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
        let isDisposed = false;

        const connectWebSocket = () => {
            if (isDisposed) return;
            
            try {
                const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
                const wsUrl = `${baseUrl.replace(/^http/, "ws")}/websocket`;
                
                ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    console.log("[Directus Realtime] Connected to WebSocket");
                    
                    // Authenticate with the server using the static token 'test'
                    ws?.send(JSON.stringify({
                        type: "auth",
                        access_token: "test"
                    }));
                };

                ws.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        
                        // Handle authentication success -> Subscribe to collections
                        if (msg.type === "auth" && msg.status === "ok") {
                            console.log("[Directus Realtime] Authenticated successfully");
                            
                            // Subscribe to inventory_lots
                            ws?.send(JSON.stringify({
                                type: "subscribe",
                                collection: "inventory_lots",
                                query: { fields: ["*"] }
                            }));

                            // Subscribe to product_ledger
                            ws?.send(JSON.stringify({
                                type: "subscribe",
                                collection: "product_ledger",
                                query: { fields: ["*"] }
                            }));
                        }

                        // Handle event message -> Trigger silent refresh
                        if (msg.type === "subscription" && (msg.event === "create" || msg.event === "update" || msg.event === "delete")) {
                            console.log(`[Directus Realtime] Event detected (${msg.event} on ${msg.collection}). Refreshing dashboard...`);
                            
                            // Silent API refresh
                            fetch("/api/manufacturing/inventory")
                                .then(res => res.ok ? res.json() : null)
                                .then(json => {
                                    if (json) setData(json);
                                })
                                .catch(() => {});
                        }
                    } catch (e) {
                        console.error("[Directus Realtime] Error parsing WebSocket message:", e);
                    }
                };

                ws.onclose = () => {
                    console.warn("[Directus Realtime] WebSocket connection closed. Reconnecting...");
                    ws = null;
                    if (!isDisposed) {
                        reconnectTimeout = setTimeout(connectWebSocket, 5000);
                    }
                };

                ws.onerror = (err) => {
                    console.error("[Directus Realtime] WebSocket error:", err);
                    ws?.close();
                };

            } catch (err) {
                console.error("[Directus Realtime] Failed to initialize WebSocket:", err);
                if (!isDisposed) {
                    reconnectTimeout = setTimeout(connectWebSocket, 5000);
                }
            }
        };

        connectWebSocket();

        // 3. Fallback Polling interval (every 10s as a secondary sync layer)
        const pollInterval = setInterval(() => {
            if (document.visibilityState === "visible") {
                fetch("/api/manufacturing/inventory")
                    .then(res => res.ok ? res.json() : null)
                    .then(json => {
                        if (json) setData(json);
                    })
                    .catch(() => {});
            }
        }, 10000);

        return () => {
            isDisposed = true;
            if (ws) {
                ws.close();
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            clearInterval(pollInterval);
        };
    }, []);

    useEffect(() => {
        if (!data) return;
        const { ledger } = data;
        
        // Compute new stock levels map
        const newStocks: Record<number, number> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ledger.forEach((entry: any) => {
            const pId = Number(entry.productId);
            const qty = Number(entry.quantity) || 0;
            newStocks[pId] = (newStocks[pId] || 0) + qty;
        });

        // Compare with previous stocks
        const newFlashStates: Record<number, "up" | "down"> = {};
        let hasChanges = false;

        Object.entries(newStocks).forEach(([pIdStr, newQty]) => {
            const pId = Number(pIdStr);
            const oldQty = prevStocksRef.current[pId];
            if (oldQty !== undefined && oldQty !== newQty) {
                newFlashStates[pId] = newQty > oldQty ? "up" : "down";
                hasChanges = true;
                
                // Trigger toast notification
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const prod = data.products.find((p: any) => Number(p.product_id) === pId);
                const prodName = prod ? prod.product_name : `Product #${pId}`;
                const diff = Math.abs(newQty - oldQty);
                if (newQty > oldQty) {
                    toast.success(`Stock increased for ${prodName} (+${diff.toLocaleString()})`);
                } else {
                    toast.info(`Stock decreased for ${prodName} (-${diff.toLocaleString()})`);
                }
            }
        });

        if (hasChanges) {
            setFlashStates(prev => ({ ...prev, ...newFlashStates }));
            
            // Clear flash animation state after 2.5 seconds
            const timer = setTimeout(() => {
                setFlashStates(prev => {
                    const next = { ...prev };
                    Object.keys(newFlashStates).forEach(k => {
                        delete next[Number(k)];
                    });
                    return next;
                });
            }, 2500);
            
            return () => clearTimeout(timer);
        }

        // Save current stocks for next comparison
        prevStocksRef.current = newStocks;
    }, [data]);

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
        const { batches, products, branches = [] } = data;

        return batches.map(b => {
            const prod = products.find(p => Number(p.product_id) === Number(b.product_id));
            const branchObj = branches.find(br => Number(br.id) === Number(b.branch_id));
            const branchName = branchObj ? branchObj.branch_name : `Branch #${b.branch_id}`;

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
                unit_name: prod?.unit_of_measurement?.unit_name || "Units",
                branch_name: branchName,
                daysToExpiry,
                expiryStatus: status
            };
        }).filter(b => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = b.product_name.toLowerCase().includes(query) || 
                                 b.product_code.toLowerCase().includes(query) ||
                                 (b.lot_number && b.lot_number.toLowerCase().includes(query)) ||
                                 b.branch_name.toLowerCase().includes(query);

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
        const { ledger, products, branches = [] } = data;

        return ledger.map(l => {
            const prod = products.find(p => Number(p.product_id) === Number(l.productId));
            const branchObj = branches.find(br => Number(br.id) === Number(l.branchId));
            const branchName = branchObj ? branchObj.branch_name : `Branch #${l.branchId}`;

            return {
                ...l,
                productName: prod?.product_name || "Unknown Product",
                productCode: prod?.product_code || "",
                unitName: prod?.unit_of_measurement?.unit_name || "Units",
                branchName: branchName
            };
        }).filter(l => {
            const query = searchQuery.toLowerCase();
            return l.productName.toLowerCase().includes(query) || 
                   l.productCode.toLowerCase().includes(query) ||
                   (l.documentNo && l.documentNo.toLowerCase().includes(query)) ||
                   (l.documentDescription && l.documentDescription.toLowerCase().includes(query)) ||
                   l.branchName.toLowerCase().includes(query);
        });
    }, [data, searchQuery]);

    if (loading && !data) {
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
            <style>{`
                @keyframes flash-green {
                    0% { background-color: rgba(16, 185, 129, 0.25); }
                    100% { background-color: transparent; }
                }
                @keyframes flash-red {
                    0% { background-color: rgba(239, 68, 68, 0.25); }
                    100% { background-color: transparent; }
                }
                .animate-flash-up {
                    animation: flash-green 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .animate-flash-down {
                    animation: flash-red 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
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

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-lg uppercase tracking-wider shadow-xs">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            Live
                        </div>
                        <button
                            onClick={() => setIsAdjustmentModalOpen(true)}
                            className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all border-none cursor-pointer shadow-xs"
                        >
                            <Sliders className="h-3.5 w-3.5" /> Post Adjustment
                        </button>
                        <button 
                            onClick={loadInventoryData}
                            className="bg-slate-850 hover:bg-slate-800 text-foreground border border-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                            disabled={loading}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Sync stock
                        </button>
                    </div>
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
                                                <span className="text-[9px] text-muted-foreground block">Total Stock: {catTotalStock.toLocaleString()} Units</span>
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
                                                                    <span>Stock: {brandTotalStock.toLocaleString()} Units</span>
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
                                                                                <th className="py-2.5 px-4 text-right hidden sm:table-cell">Standard Cost</th>
                                                                                <th className="py-2.5 px-4 text-right">Stock Balance</th>
                                                                                <th className="py-2.5 px-4 text-right hidden md:table-cell">Asset Value</th>
                                                                                <th className="py-2.5 px-4">Status</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {brandProds.map((prod, idx) => {
                                                                                const assetVal = prod.currentStock * (prod.cost_per_unit || 0);
                                                                                const uom = prod.unit_of_measurement?.unit_name || "Units";
                                                                                const isLow = prod.currentStock < 50;
                                                                                const isExpanded = !!expandedProducts[Number(prod.product_id)];

                                                                                const flash = flashStates[Number(prod.product_id)];
                                                                                const trClass = `border-b border-slate-850/30 last:border-b-0 hover:bg-slate-950/10 cursor-pointer select-none transition-all duration-300 ${
                                                                                    flash === "up" ? "animate-flash-up" : flash === "down" ? "animate-flash-down" : ""
                                                                                }`;

                                                                                return (
                                                                                    <React.Fragment key={prod.product_id || idx}>
                                                                                        <tr 
                                                                                            className={trClass}
                                                                                            onClick={() => toggleProductExpand(Number(prod.product_id))}
                                                                                        >
                                                                                            <td className="py-3 px-4">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90 text-primary" : ""}`} />
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
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="py-3 px-4 text-right font-medium text-foreground hidden sm:table-cell">₱{prod.cost_per_unit?.toFixed(2) || "0.00"}</td>
                                                                                            <td className="py-3 px-4 text-right font-extrabold">
                                                                                                <span className={prod.currentStock < 0 ? "text-red-500 flex items-center justify-end gap-1" : isLow ? "text-amber-500 animate-pulse" : "text-foreground"}>
                                                                                                    {prod.currentStock < 0 && <AlertTriangle className="h-3 w-3 text-red-500 animate-bounce" />}
                                                                                                    {prod.currentStock.toLocaleString()} {uom}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-3 px-4 text-right font-bold text-foreground hidden md:table-cell">₱{assetVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                                            <td className="py-3 px-4">
                                                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                                                                                                    prod.currentStock < 0
                                                                                                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                                                                                                        : isLow 
                                                                                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                                                                                                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                                                                }`}>
                                                                                                    {prod.currentStock < 0 ? "Stock Deficit" : isLow ? "Low Stock" : "Optimal"}
                                                                                                </span>
                                                                                            </td>
                                                                                        </tr>
                                                                                        {isExpanded && (
                                                                                            <tr className="bg-slate-950/15 border-b border-slate-850/30">
                                                                                                <td colSpan={5} className="p-4">
                                                                                                    <div className="border-l-2 border-primary/45 pl-4 py-1.5 space-y-2">
                                                                                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stock Breakdown by Branch</div>
                                                                                                        {Object.keys(prod.branchStocks || {}).length > 0 ? (
                                                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                                                                {Object.entries(prod.branchStocks).map(([bId, qty]) => {
                                                                                                                    const branchObj = data?.branches?.find(br => Number(br.id) === Number(bId));
                                                                                                                    const branchName = branchObj ? branchObj.branch_name : `Branch #${bId}`;
                                                                                                                    return (
                                                                                                                        <div key={bId} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-slate-850">
                                                                                                                            <span className="text-[10px] font-medium text-muted-foreground">{branchName}</span>
                                                                                                                            <span className={`text-[11px] font-bold ${(qty as number) < 0 ? "text-red-400" : "text-foreground"}`}>
                                                                                                                                {(qty as number).toLocaleString()} {uom}
                                                                                                                            </span>
                                                                                                                        </div>
                                                                                                                    );
                                                                                                                })}
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <div className="text-[10px] text-muted-foreground italic">No branch stock records.</div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </td>
                                                                                            </tr>
                                                                                        )}
                                                                                    </React.Fragment>
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
                                    <th className="py-3 px-4 font-bold hidden sm:table-cell">Expiry Date</th>
                                    <th className="py-3 px-4 font-bold hidden sm:table-cell">Warehouse Branch</th>
                                    <th className="py-3 px-4 font-bold text-right">Qty Received</th>
                                    <th className="py-3 px-4 font-bold text-right hidden md:table-cell">Landed Cost</th>
                                    <th className="py-3 px-4 font-bold">Expiry Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBatches.map((batch, idx) => {
                                    const cost = Number(batch.final_landed_unit_cost || batch.base_unit_cost_php || 0);
                                    const isExpanded = !!expandedBatches[Number(batch.line_id)];

                                    return (
                                        <React.Fragment key={batch.line_id || idx}>
                                            <tr 
                                                className="border-b border-slate-850/50 hover:bg-slate-950/20 cursor-pointer select-none"
                                                onClick={() => toggleBatchExpand(Number(batch.line_id))}
                                            >
                                                <td className="py-3.5 px-4 font-extrabold text-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90 text-primary" : ""}`} />
                                                        <code>{batch.lot_number}</code>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div>
                                                        <span className="font-bold text-foreground block">{batch.product_name}</span>
                                                        <span className="text-[10px] text-muted-foreground">{batch.product_code}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-foreground hidden sm:table-cell">
                                                    {batch.expiration_date || <span className="text-muted-foreground italic">None (Static)</span>}
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-foreground hidden sm:table-cell">{batch.branch_name}</td>
                                                <td className="py-3.5 px-4 text-right font-extrabold text-foreground">{Number(batch.quantity_received).toLocaleString()} {batch.unit_name}</td>
                                                <td className="py-3.5 px-4 text-right font-semibold text-foreground hidden md:table-cell">₱{cost.toFixed(2)}</td>
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
                                            {isExpanded && (
                                                <tr className="bg-slate-950/15 border-b border-slate-850/50">
                                                    <td colSpan={7} className="p-4">
                                                        <div className="border-l-2 border-primary/45 pl-4 py-1.5 space-y-2">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Batch Details</div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-850">
                                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Expiration Date</div>
                                                                    <div className="text-xs font-semibold text-foreground mt-0.5">
                                                                        {batch.expiration_date || <span className="text-muted-foreground italic">None (Static)</span>}
                                                                    </div>
                                                                </div>
                                                                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-850">
                                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Branch Location</div>
                                                                    <div className="text-xs font-semibold text-foreground mt-0.5">{batch.branch_name}</div>
                                                                </div>
                                                                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-850">
                                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Landed Unit Cost</div>
                                                                    <div className="text-xs font-semibold text-foreground mt-0.5">₱{cost.toFixed(2)}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
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
                                    <th className="py-3 px-4 font-bold hidden sm:table-cell">Doc No</th>
                                    <th className="py-3 px-4 font-bold">Product</th>
                                    <th className="py-3 px-4 font-bold hidden sm:table-cell">Document Type</th>
                                    <th className="py-3 px-4 font-bold hidden md:table-cell">Description</th>
                                    <th className="py-3 px-4 font-bold hidden sm:table-cell">Branch</th>
                                    <th className="py-3 px-4 font-bold text-right">Movement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLedger.map((log, idx) => {
                                    const qty = Number(log.quantity) || 0;
                                    const isAddition = qty > 0;
                                    const isExpanded = !!expandedLedgers[Number(log.id)];

                                    return (
                                        <React.Fragment key={log.id || idx}>
                                            <tr 
                                                className="border-b border-slate-850/50 hover:bg-slate-950/20 cursor-pointer select-none"
                                                onClick={() => toggleLedgerExpand(Number(log.id))}
                                            >
                                                <td className="py-3.5 px-4 font-semibold text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90 text-primary" : ""}`} />
                                                        {log.documentDate}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 font-extrabold text-foreground hidden sm:table-cell">{log.documentNo || "ADJ"}</td>
                                                <td className="py-3.5 px-4">
                                                    <div>
                                                        <span className="font-bold text-foreground block">{log.productName}</span>
                                                        <span className="text-[10px] text-muted-foreground">{log.productCode}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-muted-foreground hidden sm:table-cell">{log.documentType}</td>
                                                <td className="py-3.5 px-4 text-muted-foreground max-w-[200px] truncate hidden md:table-cell">{log.documentDescription}</td>
                                                <td className="py-3.5 px-4 font-semibold text-foreground hidden sm:table-cell">{log.branchName}</td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <span className={`inline-flex items-center gap-1 font-extrabold ${isAddition ? "text-emerald-500" : "text-rose-500"}`}>
                                                        {isAddition ? (
                                                            <>
                                                                <ArrowUpRight className="h-3 w-3" /> +{qty.toLocaleString()} {log.unitName}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ArrowDownLeft className="h-3 w-3" /> {qty.toLocaleString()} {log.unitName}
                                                            </>
                                                        )}
                                                    </span>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-950/15 border-b border-slate-850/50">
                                                    <td colSpan={7} className="p-4">
                                                        <div className="border-l-2 border-primary/45 pl-4 py-1.5 space-y-2">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Transaction Ledger Details</div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                                                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-850">
                                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Document Number</div>
                                                                    <div className="text-xs font-semibold text-foreground mt-0.5">{log.documentNo || "ADJ"}</div>
                                                                </div>
                                                                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-850">
                                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Document Type</div>
                                                                    <div className="text-xs font-semibold text-foreground mt-0.5">{log.documentType}</div>
                                                                </div>
                                                                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-850">
                                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Branch Location</div>
                                                                    <div className="text-xs font-semibold text-foreground mt-0.5">{log.branchName}</div>
                                                                </div>
                                                                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-850">
                                                                    <div className="text-[9px] text-muted-foreground uppercase font-bold">Description / Remarks</div>
                                                                    <div className="text-xs font-semibold text-foreground mt-0.5 whitespace-pre-wrap">{log.documentDescription || "No details provided."}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
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

            {/* Stock Adjustment Modal */}
            {isAdjustmentModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-300">
                    <div className="bg-card border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
                            <div>
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                    <Sliders className="h-4.5 w-4.5 text-primary" />
                                    Post Stock Adjustment
                                </h3>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Post manual corrections, losses, or reconciliations directly to the ledger.</p>
                            </div>
                            <button
                                onClick={() => setIsAdjustmentModalOpen(false)}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handlePostAdjustment} className="p-5 space-y-4">
                            {/* Product selection */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Product SKU</label>
                                <select
                                    value={adjProductId}
                                    onChange={e => setAdjProductId(e.target.value)}
                                    className="w-full bg-background border border-slate-800 rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                    required
                                >
                                    <option value="">Select product to adjust...</option>
                                    {data?.products.map(p => (
                                        <option key={p.product_id} value={p.product_id}>
                                            {p.product_name} ({p.product_code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Grid: Branch ID & Quantity */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Branch ID</label>
                                    <select
                                        value={adjBranchId}
                                        onChange={e => setAdjBranchId(e.target.value)}
                                        className="w-full bg-background border border-slate-800 rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                    >
                                        {data?.branches && data.branches.length > 0 ? (
                                            data.branches.map(br => (
                                                <option key={br.id} value={br.id}>
                                                    {br.branch_name}
                                                </option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="1">Branch 1 (Main Warehouse)</option>
                                                <option value="2">Branch 2 (Logistics Hub)</option>
                                                <option value="3">Branch 3 (Factory Storage)</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Qty Change</label>
                                    <input
                                        type="number"
                                        step="any"
                                        placeholder="e.g. -50 or 120"
                                        value={adjQty}
                                        onChange={e => setAdjQty(e.target.value)}
                                        className="w-full bg-background border border-slate-800 rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                        required
                                    />
                                    <span className="text-[9px] text-muted-foreground block mt-0.5">Use negative numbers to deduct</span>
                                </div>
                            </div>

                            {/* Adjustment Type & Date */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Adjustment Type</label>
                                    <select
                                        value={adjType}
                                        onChange={e => setAdjType(e.target.value)}
                                        className="w-full bg-background border border-slate-850 rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                    >
                                        <option value="Stock Take Reconciliation">Stock Reconciliation</option>
                                        <option value="Loss / Damage Adjustment">Spill/Loss/Damage</option>
                                        <option value="Quality Scrap Deduction">Quality Scrap</option>
                                        <option value="Reclassification Adjustment">Reclassification</option>
                                        <option value="Supplier Inbound Shortage">Supplier Shortage</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Effective Date</label>
                                    <input
                                        type="date"
                                        value={adjDate}
                                        onChange={e => setAdjDate(e.target.value)}
                                        className="w-full bg-background border border-slate-850 rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Remarks / Description */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Remarks / Description</label>
                                <textarea
                                    rows={2}
                                    placeholder="Enter reasoning (e.g., Damaged during forklift operation, reconciliation after annual audit)..."
                                    value={adjRemarks}
                                    onChange={e => setAdjRemarks(e.target.value)}
                                    className="w-full bg-background border border-slate-850 rounded-lg px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                                    required
                                />
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsAdjustmentModalOpen(false)}
                                    className="bg-slate-850 hover:bg-slate-800 text-foreground border border-slate-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAdj}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-all border-none flex items-center gap-1.5 shadow-sm"
                                >
                                    {submittingAdj ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Posting...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-3.5 w-3.5" /> Save Adjustment
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
