"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
    Search,
    ArrowLeft,
    Save,
    CheckCircle2,
    Sparkles,
    GitFork,
    Trash2
} from "lucide-react";
import { toast } from "sonner";
import { PhysicalCountSheet, PhysicalInventoryLineItem, StorageLotDetails, RecipeVersionDetails, ProductDetails } from "../types";
import { calculateCountSheetSummary, formatCurrency, formatDate } from "../utils";
import SearchableSelect, { SelectOption } from "./SearchableSelect";

interface CountSheetEditorProps {
    countSheet?: PhysicalCountSheet;
    sheet?: PhysicalCountSheet;
    availableLots?: StorageLotDetails[];
    availableVersions?: RecipeVersionDetails[];
    onSaveDraft?: (updatedSheet: PhysicalCountSheet) => void;
    onSaveSheet?: (updatedSheet: PhysicalCountSheet) => void;
    onProceedToCommit: (sheet: PhysicalCountSheet) => void;
    onBackToList: () => void;
}

export default function CountSheetEditor({
    countSheet,
    sheet,
    availableLots = [],
    availableVersions = [],
    onSaveDraft,
    onSaveSheet,
    onProceedToCommit,
    onBackToList
}: CountSheetEditorProps) {
    const activeSheet = countSheet || sheet;

    const [lineItems, setLineItems] = useState<PhysicalInventoryLineItem[]>(activeSheet?.line_items || []);
    const [searchQuery, setSearchQuery] = useState("");
    const [varianceFilter, setVarianceFilter] = useState<"all" | "deficit" | "surplus" | "matched" | "uncounted">("all");
    const [isSaving, setIsSaving] = useState(false);
    const [prevActiveSheet, setPrevActiveSheet] = useState<PhysicalCountSheet | null>(null);
    const [prevAvailableVersions, setPrevAvailableVersions] = useState<RecipeVersionDetails[]>([]);

    if (activeSheet !== prevActiveSheet || availableVersions !== prevAvailableVersions) {
        setPrevActiveSheet(activeSheet || null);
        setPrevAvailableVersions(availableVersions);
        if (activeSheet) {
            const rawItems = activeSheet.line_items || [];
            const autoSelected = rawItems.map(item => {
                const pId = typeof item.product_id === "object"
                    ? Number(item.product_id?.product_id || item.product_id?.id || 0)
                    : Number(item.product_id || 0);

                const curVerId = typeof item.version_id === "object"
                    ? Number(item.version_id?.version_id || item.version_id?.id || 0)
                    : Number(item.version_id || 0);

                if ((!curVerId || curVerId === 0) && pId && availableVersions.length > 0) {
                    const matchingVersions = availableVersions.filter(v => {
                        const vPid = typeof v.product_id === "object"
                            ? Number(v.product_id?.product_id || v.product_id?.id || 0)
                            : Number(v.product_id || 0);
                        return vPid === pId;
                    });

                    if (matchingVersions.length === 1) {
                        const singleVerId = Number(matchingVersions[0].version_id || matchingVersions[0].id);
                        return {
                            ...item,
                            version_id: singleVerId
                        };
                    }
                }
                return item;
            });
            setLineItems(autoSelected);
        } else {
            setLineItems([]);
        }
    }
    const isReadOnly = activeSheet ? (activeSheet.isComitted || activeSheet.isCancelled) : false;

    // Helper: Resolve human-readable lot name for a line item
    const getLotName = useCallback((lotIdRaw: string | number | StorageLotDetails | null | undefined): string => {
        if (lotIdRaw && typeof lotIdRaw === "object") {
            return lotIdRaw.lot_name || lotIdRaw.name || "Main Warehouse Storage";
        }
        const idNum = Number(lotIdRaw || 0);
        if (!idNum) return "Main Warehouse Storage";
        const found = availableLots.find(l => Number(l.lot_id || l.id) === idNum);
        return found ? (found.lot_name || found.name || `Location Bin #${idNum}`) : "Main Warehouse Storage";
    }, [availableLots]);

    // Helper: Resolve human-readable recipe version name for a line item
    const getVersionName = useCallback((versionIdRaw: string | number | RecipeVersionDetails | null | undefined): string => {
        if (versionIdRaw && typeof versionIdRaw === "object") {
            return versionIdRaw.version_name || versionIdRaw.version_code || "Standard Production BOM";
        }
        const idNum = Number(versionIdRaw || 0);
        if (!idNum) return "Standard Production BOM";
        const found = availableVersions.find(v => Number(v.version_id || v.id) === idNum);
        return found ? (found.version_name || found.version_code || `Recipe Version v${idNum}`) : "Standard Production BOM";
    }, [availableVersions]);

    // Helper: Build product-specific recipe version options (filters strictly by product_id)
    const getProductVersionOptions = useCallback((productIdRaw: string | number | ProductDetails | null | undefined): SelectOption[] => {
        const pId = typeof productIdRaw === "object"
            ? Number(productIdRaw?.product_id || productIdRaw?.id || 0)
            : Number(productIdRaw || 0);

        const list: SelectOption[] = [
            { value: "0", label: "Standard Production BOM" }
        ];

        // Filter available versions belonging strictly to this product
        const matchingVersions = (availableVersions || []).filter(v => {
            if (!pId) return true;
            const vPid = typeof v.product_id === "object"
                ? Number(v.product_id?.product_id || v.product_id?.id || 0)
                : Number(v.product_id || 0);
            return vPid === pId;
        });

        matchingVersions.forEach(v => {
            const vId = v.version_id || v.id;
            const vName = v.version_name || v.version_code || `Recipe Version v${vId}`;
            if (vId) {
                list.push({
                    value: String(vId),
                    label: vName
                });
            }
        });

        return list;
    }, [availableVersions]);

    // Auto-selection of recipe versions is now handled during rendering when props change to prevent cascading render cycles.

    // Build master location lot options
    const locationLotOptions: SelectOption[] = useMemo(() => {
        const list: SelectOption[] = [
            { value: "0", label: "Main Warehouse Storage" }
        ];
        (availableLots || []).forEach(l => {
            const lId = l.lot_id || l.id;
            const lName = l.lot_name || l.name || `Storage Bin #${lId}`;
            if (lId) {
                list.push({
                    value: String(lId),
                    label: lName
                });
            }
        });
        return list;
    }, [availableLots]);

    // Auto-calculate sheet summary
    const summary = useMemo(() => {
        return calculateCountSheetSummary(lineItems);
    }, [lineItems]);

    // Handle physical count edit
    const handleCountChange = (itemId: string, value: string) => {
        if (isReadOnly) return;
        setLineItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const num = value === "" ? null : parseFloat(value);
                const physVal = isNaN(num as number) ? null : num;
                const sysVal = item.system_count || 0;
                const price = item.unit_price || 0;
                const diff = physVal !== null ? physVal - sysVal : 0;

                return {
                    ...item,
                    physical_count: physVal,
                    variance: diff,
                    difference_cost: diff * price,
                    amount: (physVal !== null ? physVal : sysVal) * price
                };
            }
            return item;
        }));
    };

    // Handle Storage Location (lot_id) change
    const handleLocationChange = (itemId: string, newLotId: string | number) => {
        if (isReadOnly) return;
        setLineItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    lot_id: Number(newLotId) || null
                };
            }
            return item;
        }));
    };

    // Handle Recipe Version (version_id) change
    const handleVersionChange = (itemId: string, newVersionId: string | number) => {
        if (isReadOnly) return;
        setLineItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    version_id: Number(newVersionId) || null
                };
            }
            return item;
        }));
    };

    // Handle Batch Number change
    const handleBatchChange = (itemId: string, newBatchNo: string) => {
        if (isReadOnly) return;
        setLineItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    batch_no: newBatchNo
                };
            }
            return item;
        }));
    };

    // Split Line Item into a new sub-row for multi-location / multi-version auditing
    const handleSplitLineItem = useCallback((targetItem: PhysicalInventoryLineItem) => {
        if (isReadOnly) return;
        const newSplitId = `new_split_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const splitItem: PhysicalInventoryLineItem = {
            ...targetItem,
            id: newSplitId,
            system_count: 0,
            physical_count: 0,
            variance: 0,
            difference_cost: 0,
            amount: 0,
            batch_no: targetItem.batch_no ? `${targetItem.batch_no}-B` : "",
        };

        setLineItems(prev => {
            const targetIndex = prev.findIndex(i => i.id === targetItem.id);
            const updatedList = [...prev];
            if (targetIndex >= 0) {
                updatedList.splice(targetIndex + 1, 0, splitItem);
            } else {
                updatedList.push(splitItem);
            }
            return updatedList;
        });
        toast.success(`Split line item added for ${targetItem.product_name || "product"}.`);
    }, [isReadOnly]);

    // Delete a split line item
    const handleDeleteLineItem = (itemId: string) => {
        if (isReadOnly) return;
        setLineItems(prev => prev.filter(item => item.id !== itemId));
        toast.info("Line item row removed.");
    };

    // Quick Action: Fill system counts
    const handleFillSystemCounts = () => {
        if (isReadOnly) return;
        setLineItems(prev => prev.map(item => {
            const physVal = item.physical_count === null ? item.system_count : item.physical_count;
            const sysVal = item.system_count || 0;
            const price = item.unit_price || 0;
            const diff = physVal !== null ? physVal - sysVal : 0;

            return {
                ...item,
                physical_count: physVal,
                variance: diff,
                difference_cost: diff * price,
                amount: (physVal !== null ? physVal : sysVal) * price
            };
        }));
        toast.info("Uncounted items populated with system count snapshot.");
    };

    // Save Draft
    const handleSave = () => {
        if (!activeSheet) return;
        setIsSaving(true);
        const updatedSheet: PhysicalCountSheet = {
            ...activeSheet,
            id: activeSheet.id || "",
            line_items: lineItems
        } as PhysicalCountSheet;
        const saveFn = onSaveDraft || onSaveSheet;
        if (saveFn) {
            saveFn(updatedSheet);
        }
        setIsSaving(false);
    };

    // Filter line items
    const filteredItems = useMemo(() => {
        return lineItems.filter(item => {
            const q = searchQuery.toLowerCase().trim();

            const pName = (typeof item.product_id === "object" ? item.product_id?.product_name : (item.product_name || item.sku_name || "")) || "";
            const pCode = (typeof item.product_id === "object" ? item.product_id?.product_code : (item.product_code || item.sku_code || "")) || "";
            const lName = (typeof item.lot_id === "object" ? (item.lot_id?.lot_name || item.lot_id?.name) : "") || "";
            const bNo = item.batch_no || "";

            const matchesSearch = !q ||
                pName.toLowerCase().includes(q) ||
                pCode.toLowerCase().includes(q) ||
                lName.toLowerCase().includes(q) ||
                bNo.toLowerCase().includes(q);

            if (!matchesSearch) return false;

            const sys = item.system_count || 0;
            const phys = item.physical_count;
            const diff = item.variance !== undefined ? item.variance : (phys !== null ? phys - sys : 0);

            if (varianceFilter === "uncounted") return phys === null;
            if (varianceFilter === "deficit") return phys !== null && diff < 0;
            if (varianceFilter === "surplus") return phys !== null && diff > 0;
            if (varianceFilter === "matched") return phys !== null && diff === 0;

            return true;
        });
    }, [lineItems, searchQuery, varianceFilter]);

    if (!activeSheet) return null;

    return (
        <div className="space-y-6">
            {/* Editor Top Bar */}
            <div className="bg-card border border-border p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBackToList}
                        className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-primary">#{activeSheet.ph_no}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                activeSheet.isComitted
                                    ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                    : activeSheet.isCancelled
                                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            }`}>
                                {activeSheet.isComitted ? "Committed to Ledger" : activeSheet.isCancelled ? "Cancelled" : "Draft (Active Audit)"}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span className="font-semibold text-foreground">{activeSheet.branch_name}</span>
                            <span>•</span>
                            <span>Cutoff: {formatDate(activeSheet.cutOff_date)}</span>
                        </p>
                    </div>
                </div>

                {/* Editor Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    {!isReadOnly && (
                        <>
                            <button
                                onClick={handleFillSystemCounts}
                                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                            >
                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                Fill System Snapshot
                            </button>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
                            >
                                <Save className="h-4 w-4" />
                                Save Draft
                            </button>

                            <button
                                onClick={() => onProceedToCommit({ ...activeSheet, line_items: lineItems })}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Proceed to Commit Ledger
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Summary Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 border border-border p-3.5 rounded-2xl">
                <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Audited Items</span>
                    <span className="text-sm font-black text-foreground mt-0.5 block">
                        {summary.countedItemsCount} / {summary.totalItemsCount} SKUs
                    </span>
                </div>
                <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Surplus Variance</span>
                    <span className="text-sm font-black text-emerald-500 mt-0.5 block">
                        +{summary.surplusItemsCount} items ({formatCurrency(summary.surplusVarianceCost)})
                    </span>
                </div>
                <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Deficit Variance</span>
                    <span className="text-sm font-black text-rose-500 mt-0.5 block">
                        -{summary.deficitItemsCount} items ({formatCurrency(summary.deficitVarianceCost)})
                    </span>
                </div>
                <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Net Financial Impact</span>
                    <span className={`text-sm font-black mt-0.5 block ${summary.netVarianceCost >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {formatCurrency(summary.netVarianceCost)}
                    </span>
                </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search SKU name, code, lot, batch..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
                    {(["all", "uncounted", "deficit", "surplus", "matched"] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setVarianceFilter(f)}
                            className={`px-3 py-1.2 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                                varianceFilter === f
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Line Items Table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                            <tr>
                                <th className="p-3">Product / SKU Item</th>
                                <th className="p-3">Recipe Version</th>
                                <th className="p-3">Storage Location / Rack</th>
                                <th className="p-3">Batch Number</th>
                                <th className="p-3 text-right">Unit Price</th>
                                <th className="p-3 text-right">System Count</th>
                                <th className="p-3 text-center">Physical Count</th>
                                <th className="p-3 text-right">Variance</th>
                                <th className="p-3 text-right">Difference Cost</th>
                                {!isReadOnly && <th className="p-3 text-center">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 font-medium">
                            {filteredItems.length > 0 ? (
                                filteredItems.map(item => {
                                    const productName = typeof item.product_id === "object"
                                        ? (item.product_id?.product_name || item.product_name || item.sku_name || "Manufacturing Product")
                                        : (item.product_name || item.sku_name || "Manufacturing Product");

                                    const productCode = typeof item.product_id === "object"
                                        ? (item.product_id?.product_code || item.product_code || item.sku_code || "")
                                        : (item.product_code || item.sku_code || "");

                                    const curLotId = typeof item.lot_id === "object"
                                        ? String(item.lot_id?.lot_id || item.lot_id?.id || "0")
                                        : String(item.lot_id || "0");

                                    const curVersionId = typeof item.version_id === "object"
                                        ? String(item.version_id?.version_id || item.version_id?.id || "0")
                                        : String(item.version_id || "0");

                                    const sysCount = item.system_count || 0;
                                    const physCount = item.physical_count;
                                    const unitPrice = item.unit_price || 0;
                                    const diff = item.variance !== undefined ? item.variance : (physCount !== null ? physCount - sysCount : 0);
                                    const diffCost = item.difference_cost !== undefined ? item.difference_cost : (diff * unitPrice);
                                    const isSplitItem = String(item.id).startsWith("new_split_");

                                    // Get recipe versions strictly belonging to THIS product
                                    const itemVersionOptions = getProductVersionOptions(item.product_id);

                                    return (
                                        <tr key={item.id} className={`hover:bg-muted/30 transition-colors ${isSplitItem ? "bg-primary/5" : ""}`}>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    {isSplitItem && (
                                                        <span className="p-1 rounded bg-primary/10 text-primary text-[10px] font-bold">SPLIT</span>
                                                    )}
                                                    <div>
                                                        <div className="font-bold text-foreground">{productName}</div>
                                                        {productCode && <div className="text-[10px] text-primary font-mono font-semibold">{productCode}</div>}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Product-Specific Editable Recipe Version Dropdown */}
                                            <td className="p-3 min-w-[170px]">
                                                {isReadOnly ? (
                                                    <span className="font-semibold text-muted-foreground">
                                                        {getVersionName(item.version_id)}
                                                    </span>
                                                ) : (
                                                    <SearchableSelect
                                                        options={itemVersionOptions}
                                                        value={curVersionId}
                                                        onChange={(val) => handleVersionChange(item.id, val)}
                                                        placeholder="Select recipe version..."
                                                        searchPlaceholder="Search product version..."
                                                        className="w-full text-[11px]"
                                                    />
                                                )}
                                            </td>

                                            {/* Editable Storage Location Dropdown */}
                                            <td className="p-3 min-w-[180px]">
                                                {isReadOnly ? (
                                                    <span className="font-semibold text-foreground">
                                                        {getLotName(item.lot_id)}
                                                    </span>
                                                ) : (
                                                    <SearchableSelect
                                                        options={locationLotOptions}
                                                        value={curLotId}
                                                        onChange={(val) => handleLocationChange(item.id, val)}
                                                        placeholder="Select location bin..."
                                                        searchPlaceholder="Search location bin..."
                                                        className="w-full text-[11px]"
                                                    />
                                                )}
                                            </td>

                                            {/* Editable Batch Number Input */}
                                            <td className="p-3 min-w-[130px]">
                                                {isReadOnly ? (
                                                    <span className="font-mono text-muted-foreground">{item.batch_no || "—"}</span>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={item.batch_no || ""}
                                                        onChange={(e) => handleBatchChange(item.id, e.target.value)}
                                                        placeholder="e.g. BATCH-001"
                                                        className="w-full px-2 py-1 text-xs font-mono bg-background border border-border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                                                    />
                                                )}
                                            </td>

                                            <td className="p-3 text-right font-mono">
                                                {formatCurrency(unitPrice)}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-muted-foreground">
                                                {sysCount.toLocaleString()} {item.uom || item.unit_of_measure || "PCS"}
                                            </td>
                                            <td className="p-3 text-center">
                                                {isReadOnly ? (
                                                    <span className="font-mono font-bold text-foreground">
                                                        {physCount !== null ? physCount.toLocaleString() : "—"}
                                                    </span>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        step="0.0001"
                                                        value={physCount !== null ? physCount : ""}
                                                        onChange={(e) => handleCountChange(item.id, e.target.value)}
                                                        placeholder="Enter count"
                                                        className="w-28 px-2 py-1 text-center font-mono font-bold bg-background border border-border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                                                    />
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold">
                                                {physCount === null ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : diff > 0 ? (
                                                    <span className="text-emerald-500">+{diff.toLocaleString()}</span>
                                                ) : diff < 0 ? (
                                                    <span className="text-rose-500">{diff.toLocaleString()}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">0</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold">
                                                {physCount === null ? (
                                                    <span className="text-muted-foreground">—</span>
                                                ) : diffCost > 0 ? (
                                                    <span className="text-emerald-500">+{formatCurrency(diffCost)}</span>
                                                ) : diffCost < 0 ? (
                                                    <span className="text-rose-500">{formatCurrency(diffCost)}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">₱0.00</span>
                                                )}
                                            </td>

                                            {/* Action column for Splitting / Deleting Split */}
                                            {!isReadOnly && (
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSplitLineItem(item)}
                                                            className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all"
                                                            title="Split row into sub-location / sub-version count"
                                                        >
                                                            <GitFork className="h-3.5 w-3.5" />
                                                        </button>
                                                        {isSplitItem && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteLineItem(item.id)}
                                                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all"
                                                                title="Remove split sub-row"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-muted-foreground text-xs">
                                        No line items match your current search/filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
