import React, { useState, useEffect } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Play, Merge, Plus, Trash2, Layers, Calendar } from "lucide-react";
import { SalesOrder, SalesOrderDetail } from "../types";

interface PlanningSidebarFormProps {
    selectedSO: SalesOrder | null;
    setSelectedSO: (so: SalesOrder | null) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedBatchCandidate: any | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSelectedBatchCandidate: (candidate: any | null) => void;
    soDetails: SalesOrderDetail[];
    selectedDetailId: string;
    handleDetailChange: (detailIdStr: string) => void;
    joNumber: string;
    setJoNumber: (val: string) => void;
    joQty: number;
    setJoQty: (val: number) => void;
    dueDate: string;
    setDueDate: (val: string) => void;
    handleCreateJobOrder: () => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    branches: any[];
    selectedBranchId: number | "";
    setSelectedBranchId: (val: number) => void;
    isStandaloneMode: boolean;
    setIsStandaloneMode: (val: boolean) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedStandaloneProduct: any | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSelectedStandaloneProduct: (val: any | null) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    selectedProductsList: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSelectedProductsList: (list: any[]) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    productVersions: Record<number, any[]>;
    loadVersionsForProduct: (productId: number) => Promise<void>;
    shiftOption: string;
    setShiftOption: (val: string) => void;
    handleUpdateProductCapacity: (productId: number, capacity: number) => Promise<void>;
    selectedBomVersionId: string;
    setSelectedBomVersionId: (val: string) => void;
}

export function PlanningSidebarForm({
    selectedSO,
    setSelectedSO,
    selectedBatchCandidate,
    setSelectedBatchCandidate,
    soDetails,
    selectedDetailId,
    handleDetailChange,
    joNumber,
    setJoNumber,
    joQty,
    setJoQty,
    dueDate,
    setDueDate,
    handleCreateJobOrder,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    isStandaloneMode,
    setIsStandaloneMode,
    products,
    selectedStandaloneProduct,
    setSelectedStandaloneProduct,
    selectedProductsList,
    setSelectedProductsList,
    productVersions,
    loadVersionsForProduct,
    shiftOption,
    setShiftOption,
    handleUpdateProductCapacity,
    selectedBomVersionId,
    setSelectedBomVersionId
}: PlanningSidebarFormProps) {
    const [branchSearch, setBranchSearch] = useState("");
    const [isBranchFocused, setIsBranchFocused] = useState(false);
    const [detailSearch, setDetailSearch] = useState("");
    const [isDetailFocused, setIsDetailFocused] = useState(false);
    
    // Standalone product search
    const [productSearch, setProductSearch] = useState("");
    const [isProductFocused, setIsProductFocused] = useState(false);

    const [editingCapacity, setEditingCapacity] = useState<string>("");
    const [isSavingCapacity, setIsSavingCapacity] = useState<boolean>(false);
    const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

    const activeProductId = selectedSO
        ? (selectedDetailId === "all"
            ? soDetails[0]?.product_id?.product_id
            : soDetails.find(d => String(d.detail_id) === selectedDetailId)?.product_id?.product_id)
        : (selectedBatchCandidate
            ? selectedBatchCandidate.productId
            : (isStandaloneMode
                ? (selectedStandaloneProduct?.product_id || selectedProductsList[0]?.product_id)
                : undefined));

    const activeQty = isStandaloneMode
        ? selectedProductsList.reduce((sum, p) => sum + Number(p.quantity || 0), 0)
        : joQty;

    function getProductCapacity(productId: number) {
        const p = products.find(prod => Number(prod.product_id) === Number(productId));
        if (!p) return 0;

        if (p.production_capacity_per_hour && Number(p.production_capacity_per_hour) > 0) {
            return Number(p.production_capacity_per_hour);
        }

        const parentId = p.parent_id && typeof p.parent_id === "object"
            ? Number((p.parent_id as { product_id?: number }).product_id)
            : (p.parent_id ? Number(p.parent_id) : null);

        if (parentId) {
            const parent = products.find(prod => Number(prod.product_id) === Number(parentId));
            if (parent && parent.production_capacity_per_hour && Number(parent.production_capacity_per_hour) > 0) {
                const uomCount = Number(p.unit_of_measurement_count || 1);
                return Number(parent.production_capacity_per_hour) * uomCount;
            }
        }

        return 0;
    }

    useEffect(() => {
        if (activeProductId) {
            const cap = getProductCapacity(activeProductId);
            setEditingCapacity(cap > 0 ? String(cap) : "");
        } else {
            setEditingCapacity("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProductId, products]);


    const calculateDaysCount = (productId: number, qty: number, shift: string) => {
        const capacity = getProductCapacity(productId);
        if (!capacity || capacity <= 0) return 0;
        const dailyCapacity = capacity * Number(shift);
        return Math.ceil(qty / dailyCapacity);
    };

    const renderBreakdownModal = () => {
        if (!isBreakdownModalOpen || !activeProductId) return null;
        
        const capacity = getProductCapacity(activeProductId);
        const hoursPerDay = Number(shiftOption);
        const dailyCapacity = capacity * hoursPerDay;
        const totalDays = dailyCapacity > 0 ? Math.ceil(activeQty / dailyCapacity) : 0;
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 1); // Start tomorrow
        
        const completionDate = new Date(startDate);
        if (totalDays > 0) {
            completionDate.setDate(startDate.getDate() + (totalDays - 1));
        }
        const completionDateString = totalDays > 0 
            ? completionDate.toLocaleDateString(undefined, { 
                weekday: "short", 
                month: "short", 
                day: "numeric", 
                year: "numeric" 
              })
            : "N/A";
            
        const selectedProd = products.find(p => Number(p.product_id) === Number(activeProductId));

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
                <div className="bg-card border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-950/40">
                        <div className="flex items-center gap-2.5">
                            <Calendar className="h-5 w-5 text-primary animate-pulse" />
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    Production Capacity & Schedule Breakdown
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Configure hourly producible rate and preview the sequential daily runs for this SKU.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsBreakdownModalOpen(false)}
                            className="text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors px-3 py-1.5 hover:bg-slate-900 rounded-lg"
                        >
                            Close
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                        {/* Left Side: Parameters Form */}
                        <div className="md:col-span-2 p-6 overflow-y-auto space-y-5 bg-slate-950/10">
                            <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider block mb-1">
                                Scheduling Parameters
                            </h4>

                            <div className="space-y-4">
                                {/* Product Details */}
                                <div className="p-3.5 bg-slate-900/30 border border-slate-850 rounded-xl space-y-1 text-xs">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Selected finished good SKU</span>
                                    <span className="font-extrabold text-foreground block">
                                        {selectedProd?.product_name || "Unknown SKU"}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground font-mono block">
                                        Code: {selectedProd?.product_code || "N/A"}
                                    </span>
                                </div>

                                {/* Editable capacity */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Hourly Production Capacity (SKU Master)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editingCapacity}
                                            onChange={(e) => setEditingCapacity(e.target.value)}
                                            placeholder="Units producible per hour..."
                                            className="w-full rounded-lg border border-slate-800 bg-slate-950/20 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const capVal = parseFloat(editingCapacity);
                                                if (!isNaN(capVal) && capVal >= 0) {
                                                    setIsSavingCapacity(true);
                                                    await handleUpdateProductCapacity(activeProductId, capVal);
                                                    setIsSavingCapacity(false);
                                                }
                                            }}
                                            disabled={isSavingCapacity || editingCapacity === String(capacity || "")}
                                            className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs px-3 rounded-lg disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                                        >
                                            {isSavingCapacity ? "Saving..." : "Save"}
                                        </button>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground block">
                                        Directly updates the finished good&apos;s production capacity in Finished Goods Master.
                                    </span>
                                </div>

                                {/* Shift hours selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Production Shift Schedule
                                    </label>
                                    <select
                                        value={shiftOption}
                                        onChange={(e) => setShiftOption(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950/20 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                    >
                                        <option value="8">Single Shift (8 Hours/Day)</option>
                                        <option value="16">Double Shift (16 Hours/Day)</option>
                                        <option value="24">Triple Shift (24 Hours/Day)</option>
                                    </select>
                                </div>

                                {/* Build Quantity input (Only editable if not standalone forecast lines summary) */}
                                {!isStandaloneMode && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                            Target Job Build Quantity
                                        </label>
                                        <input
                                            type="number"
                                            value={joQty}
                                            onChange={(e) => setJoQty(Number(e.target.value))}
                                            min={1}
                                            className="w-full rounded-lg border border-slate-800 bg-slate-950/20 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Generated Schedule View */}
                        <div className="md:col-span-3 p-6 overflow-hidden flex flex-col space-y-4">
                            <div className="flex justify-between items-center shrink-0">
                                <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                                    Generated Run Schedule
                                </h4>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                    Tomorrow Start
                                </span>
                            </div>

                            {(() => {
                                if (!capacity || capacity <= 0) {
                                    return (
                                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border border-dashed border-yellow-500/20 bg-yellow-500/5 rounded-xl space-y-2">
                                            <span className="text-2xl">⚠️</span>
                                            <h5 className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase">
                                                Hourly capacity required
                                            </h5>
                                            <p className="text-[10px] text-muted-foreground max-w-xs">
                                                Configure and save the hourly production capacity first to generate the daily schedule breakdown runs.
                                            </p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                                        {/* Summary Widgets */}
                                        <div className="grid grid-cols-3 gap-3 bg-slate-900/30 border border-slate-800/80 p-3 rounded-xl text-xs shrink-0 font-semibold text-slate-300">
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-bold text-muted-foreground uppercase block">Run Duration</span>
                                                <span className="text-[13px] font-extrabold text-primary block">{totalDays} Days</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-bold text-muted-foreground uppercase block">Run Rate / Day</span>
                                                <span className="text-[13px] font-extrabold text-foreground block">{dailyCapacity.toLocaleString()} PCS</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-bold text-muted-foreground uppercase block">Est. Completion</span>
                                                <span className="text-[10px] font-extrabold text-emerald-500 block truncate" title={completionDateString}>
                                                    {completionDateString}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Scrollable grid of days */}
                                        <div className="flex-1 overflow-y-auto pr-1">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
                                                {Array.from({ length: totalDays }).map((_, i) => {
                                                    const dayQty = Math.min(activeQty - (i * dailyCapacity), dailyCapacity);
                                                    const currentDate = new Date(startDate);
                                                    currentDate.setDate(startDate.getDate() + i);
                                                    const dateString = currentDate.toLocaleDateString(undefined, { 
                                                        month: "short", 
                                                        day: "numeric", 
                                                        year: "numeric" 
                                                    });

                                                    return (
                                                        <div 
                                                            key={i} 
                                                            className="flex justify-between items-center bg-slate-950/40 border border-slate-850 hover:border-slate-700/60 rounded-xl px-3 py-2 text-[10px] font-semibold text-foreground transition-all"
                                                        >
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-primary font-extrabold">Day {i + 1}</span>
                                                                <span className="text-[8px] text-muted-foreground">{dateString}</span>
                                                            </div>
                                                            <span className="font-extrabold text-foreground">
                                                                {dayQty.toLocaleString()} units
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 shrink-0 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setIsBreakdownModalOpen(false)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs px-5 py-2 rounded-xl shadow-lg transition-all"
                        >
                            Apply Parameters
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const [prevSelectedBranchId, setPrevSelectedBranchId] = useState<number | "">(selectedBranchId);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [prevBranches, setPrevBranches] = useState<any[]>(branches);
    if (selectedBranchId !== prevSelectedBranchId || branches !== prevBranches) {
        setPrevSelectedBranchId(selectedBranchId);
        setPrevBranches(branches);
        const selectedBranchObj = branches.find(b => Number(b.id) === Number(selectedBranchId));
        setBranchSearch(selectedBranchObj ? `${selectedBranchObj.branch_name} (${selectedBranchObj.branch_code})` : "");
    }

    const [prevSelectedDetailId, setPrevSelectedDetailId] = useState<string>(selectedDetailId);
    const [prevSoDetails, setPrevSoDetails] = useState<SalesOrderDetail[]>(soDetails);
    if (selectedDetailId !== prevSelectedDetailId || soDetails !== prevSoDetails) {
        setPrevSelectedDetailId(selectedDetailId);
        setPrevSoDetails(soDetails);
        if (selectedDetailId === "all") {
            setDetailSearch("All Items in Sales Order");
        } else {
            const selectedDetailObj = soDetails.find(d => String(d.detail_id) === String(selectedDetailId));
            setDetailSearch(selectedDetailObj ? `${selectedDetailObj.product_id?.product_name || `ID: ${selectedDetailObj.product_id}`} (Qty: ${selectedDetailObj.ordered_quantity})` : "");
        }
    }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [prevSelectedStandaloneProduct, setPrevSelectedStandaloneProduct] = useState<any | null>(selectedStandaloneProduct);
    if (selectedStandaloneProduct !== prevSelectedStandaloneProduct) {
        setPrevSelectedStandaloneProduct(selectedStandaloneProduct);
        setProductSearch(selectedStandaloneProduct ? selectedStandaloneProduct.product_name : "");
    }

    // Load versions for all items in selected products list
    useEffect(() => {
        selectedProductsList.forEach(p => {
            loadVersionsForProduct(p.product_id);
        });
    }, [selectedProductsList, loadVersionsForProduct]);

    useEffect(() => {
        if (activeProductId) {
            loadVersionsForProduct(activeProductId);
        }
    }, [activeProductId, loadVersionsForProduct]);

    const filteredBranches = branches.filter(b => 
        b.branch_name.toLowerCase().includes(branchSearch.toLowerCase()) ||
        b.branch_code.toLowerCase().includes(branchSearch.toLowerCase())
    );

    const filteredDetails = soDetails.filter(d => {
        const prodName = d.product_id?.product_name || "";
        if (detailSearch === "All Items in Sales Order") return true;
        return prodName.toLowerCase().includes(detailSearch.toLowerCase());
    });

    const filteredProducts = products.filter(p => 
        p.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.product_code.toLowerCase().includes(productSearch.toLowerCase())
    );

    // Helper to add a product line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAddProductLine = (p: any) => {
        if (selectedProductsList.some(item => item.product_id === p.product_id)) {
            return; // already added
        }
        const uomShortcut = p.unit_of_measurement?.unit_shortcut || "PC";
        const newLine = {
            product_id: p.product_id,
            product_name: p.product_name,
            product_code: p.product_code,
            uom: uomShortcut,
            quantity: 100, // default quantity
            bom_version_id: undefined,
            bom_version_name: "Latest (Active)"
        };
        setSelectedProductsList([...selectedProductsList, newLine]);
        setSelectedStandaloneProduct(null);
        setProductSearch("");
    };

    // Helper to update a product line's quantity
    const handleUpdateLineQty = (productId: number, qty: number) => {
        setSelectedProductsList(selectedProductsList.map(item => 
            item.product_id === productId ? { ...item, quantity: qty } : item
        ));
    };

    // Helper to update a product line's version
    const handleUpdateLineVersion = (productId: number, versionId: number, versionName: string) => {
        setSelectedProductsList(selectedProductsList.map(item => 
            item.product_id === productId ? { ...item, bom_version_id: versionId, bom_version_name: versionName } : item
        ));
    };

    // Helper to remove a product line
    const handleRemoveProductLine = (productId: number) => {
        setSelectedProductsList(selectedProductsList.filter(item => item.product_id !== productId));
    };

    if (selectedSO) {
        return (
            /* Single Order 1:1 Form */
            <div className="border rounded-xl bg-card p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                    <div>
                        <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Generate Floor JO (1:1)</h4>
                        <p className="text-[10px] text-muted-foreground">Scheduling: {selectedSO.order_no}</p>
                    </div>
                    <button
                        onClick={() => setSelectedSO(null)}
                        className="text-muted-foreground hover:text-foreground text-xs font-semibold animate-pulse"
                    >
                        Cancel
                    </button>
                </div>

                <div className="space-y-3.5">
                    {/* Target Branch Searchable Select */}
                    <div className="space-y-1.5 relative">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Target Production Branch</label>
                        <input
                            type="text"
                            placeholder="Type to search branch..."
                            value={branchSearch}
                            onFocus={() => setIsBranchFocused(true)}
                            onBlur={() => setTimeout(() => setIsBranchFocused(false), 200)}
                            onChange={(e) => {
                                setBranchSearch(e.target.value);
                            }}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        />
                        {isBranchFocused && (
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl divide-y divide-slate-800">
                                {filteredBranches.map(b => (
                                    <button
                                        type="button"
                                        key={b.id}
                                        onClick={() => {
                                            setSelectedBranchId(Number(b.id));
                                            setBranchSearch(`${b.branch_name} (${b.branch_code})`);
                                            setIsBranchFocused(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-100 transition-colors"
                                    >
                                        {b.branch_name} ({b.branch_code})
                                    </button>
                                ))}
                                {filteredBranches.length === 0 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center">No branches found</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Target Finished Good Line Item Searchable Select */}
                    <div className="space-y-1.5 relative">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Target finished good line item</label>
                        <input
                            type="text"
                            placeholder="Type to search item..."
                            value={detailSearch}
                            onFocus={() => setIsDetailFocused(true)}
                            onBlur={() => setTimeout(() => setIsDetailFocused(false), 200)}
                            onChange={(e) => {
                                setDetailSearch(e.target.value);
                            }}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        />
                        {isDetailFocused && (
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl divide-y divide-slate-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleDetailChange("all");
                                        setDetailSearch("All Items in Sales Order");
                                        setIsDetailFocused(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-100 font-bold transition-colors bg-slate-900/50"
                                >
                                    [All Items in Sales Order] (Qty: {soDetails.reduce((sum, d) => sum + Number(d.ordered_quantity || 0), 0)})
                                </button>
                                {filteredDetails.map(d => (
                                    <button
                                        type="button"
                                        key={d.detail_id}
                                        onClick={() => {
                                            handleDetailChange(String(d.detail_id));
                                            setDetailSearch(`${d.product_id?.product_name || `ID: ${d.product_id}`} (Qty: ${d.ordered_quantity})`);
                                            setIsDetailFocused(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-100 transition-colors"
                                    >
                                        {d.product_id?.product_name || `ID: ${d.product_id}`} (Qty: {d.ordered_quantity})
                                    </button>
                                ))}
                                {filteredDetails.length === 0 && detailSearch !== "All Items in Sales Order" && (
                                    <div className="p-2 text-xs text-muted-foreground text-center">No items found</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Read-Only Preview of Sales Order Items */}
                    <div className="space-y-1.5 border-t pt-3.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Sales Order Line Items (Read-Only)</span>
                        <div className="border rounded-lg divide-y bg-muted/10 overflow-hidden max-h-36 overflow-y-auto">
                            {soDetails.map(d => (
                                <div key={d.detail_id} className="p-2.5 flex justify-between items-center text-xs">
                                    <div className="space-y-0.5">
                                        <span className="font-bold text-foreground block">{d.product_id?.product_name || `Product #${d.product_id}`}</span>
                                        <span className="text-[9px] text-muted-foreground font-mono">SKU: {d.product_id?.product_code || "N/A"}</span>
                                    </div>
                                    <span className="font-bold text-muted-foreground bg-muted border px-2 py-0.5 rounded text-[10px]">
                                        Order Qty: {d.ordered_quantity} {d.product_id?.uom || "PCS"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Job Order Identifier</label>
                        <input
                            type="text"
                            value={joNumber}
                            onChange={(e) => setJoNumber(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                            placeholder="JO-XXXXXXXX"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                            Committed target quantity {selectedDetailId !== "all" && `(${soDetails.find(d => String(d.detail_id) === selectedDetailId)?.product_id?.uom || "PCS"})`}
                        </label>
                        <div className="relative flex items-center">
                            <input
                                type="number"
                                value={joQty}
                                onChange={(e) => setJoQty(Number(e.target.value))}
                                className="w-full rounded-lg border bg-background px-3 py-2 pr-12 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                min={1}
                            />
                            {selectedDetailId !== "all" && (
                                <span className="absolute right-3 text-[10px] font-extrabold text-muted-foreground uppercase">
                                    {soDetails.find(d => String(d.detail_id) === selectedDetailId)?.product_id?.uom || "PCS"}
                                </span>
                            )}
                        </div>
                    </div>

                    {selectedDetailId !== "all" && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Recipe Version Selection</label>
                            <select
                                value={selectedBomVersionId}
                                onChange={(e) => setSelectedBomVersionId(e.target.value)}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold cursor-pointer"
                            >
                                <option value="">Latest (Active)</option>
                                {(productVersions[activeProductId] || []).map(v => (
                                    <option key={v.bom_id} value={v.bom_id}>
                                        {v.version_name} {v.is_active ? "(Active)" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Production Shift Schedule</label>
                        <select
                            value={shiftOption}
                            onChange={(e) => setShiftOption(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        >
                            <option value="8">Single Shift (8 Hours/Day)</option>
                            <option value="16">Double Shift (16 Hours/Day)</option>
                            <option value="24">Triple Shift (24 Hours/Day)</option>
                        </select>
                    </div>

                    {activeProductId && (
                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-800 bg-slate-950/20">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-muted-foreground uppercase tracking-wider block">
                                    Scheduling Runs & Capacity
                                </span>
                                {getProductCapacity(activeProductId) > 0 ? (
                                    <span className="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.2 rounded font-extrabold uppercase text-slate-300">
                                        {calculateDaysCount(activeProductId, joQty, shiftOption)} Days Run
                                    </span>
                                ) : (
                                    <span className="text-[8px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-1.5 py-0.2 rounded font-extrabold uppercase text-yellow-500">
                                        Needs Config
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBreakdownModalOpen(true)}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800/80 py-2 text-xs font-bold text-foreground border border-slate-700/60 shadow-sm transition-all cursor-pointer"
                            >
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                {getProductCapacity(activeProductId) > 0 
                                    ? `View Daily Breakdown (${calculateDaysCount(activeProductId, joQty, shiftOption)} Days)`
                                    : "Configure Capacity & Runs"}
                            </button>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Target floor due date</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        />
                    </div>

                    <button
                        onClick={handleCreateJobOrder}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/95 py-2 text-xs font-bold text-primary-foreground shadow-md transition-all cursor-pointer"
                    >
                        <Play className="h-4 w-4" />
                        Generate Job Order
                    </button>

                    {renderBreakdownModal()}
                </div>
            </div>
        );
    }

    if (selectedBatchCandidate) {
        return (
            /* Batched Consolidation Form */
            <div className="border rounded-xl bg-card p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                    <div>
                        <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Schedule Batched JO</h4>
                        <p className="text-[10px] text-muted-foreground">Consolidating {selectedBatchCandidate.orders.length} Orders</p>
                    </div>
                    <button
                        onClick={() => setSelectedBatchCandidate(null)}
                        className="text-muted-foreground hover:text-foreground text-xs font-semibold"
                    >
                        Cancel
                    </button>
                </div>

                <div className="space-y-3.5">
                    {/* Target Branch Searchable Select */}
                    <div className="space-y-1.5 relative">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Target Production Branch</label>
                        <input
                            type="text"
                            placeholder="Type to search branch..."
                            value={branchSearch}
                            onFocus={() => setIsBranchFocused(true)}
                            onBlur={() => setTimeout(() => setIsBranchFocused(false), 200)}
                            onChange={(e) => {
                                setBranchSearch(e.target.value);
                            }}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        />
                        {isBranchFocused && (
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl divide-y divide-slate-800">
                                {filteredBranches.map(b => (
                                    <button
                                        type="button"
                                        key={b.id}
                                        onClick={() => {
                                            setSelectedBranchId(Number(b.id));
                                            setBranchSearch(`${b.branch_name} (${b.branch_code})`);
                                            setIsBranchFocused(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-100 transition-colors"
                                    >
                                        {b.branch_name} ({b.branch_code})
                                    </button>
                                ))}
                                {filteredBranches.length === 0 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center">No branches found</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-1 text-xs">
                        <span className="font-bold text-foreground block">Product SKU:</span>
                        <span className="text-muted-foreground font-medium block">{selectedBatchCandidate.productName}</span>
                        <span className="font-bold text-foreground block pt-2">Orders Combined:</span>
                        <span className="text-muted-foreground font-medium block">
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {selectedBatchCandidate.orders.map((o: any) => o.order_no).join(", ")}
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Batched JO Number</label>
                        <input
                            type="text"
                            value={joNumber}
                            onChange={(e) => setJoNumber(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                            placeholder="JO-BATCH-XXXX"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Combined Batch Quantity</label>
                        <input
                            type="number"
                            value={joQty}
                            onChange={(e) => setJoQty(Number(e.target.value))}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                            min={1}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Production Shift Schedule</label>
                        <select
                            value={shiftOption}
                            onChange={(e) => setShiftOption(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        >
                            <option value="8">Single Shift (8 Hours/Day)</option>
                            <option value="16">Double Shift (16 Hours/Day)</option>
                            <option value="24">Triple Shift (24 Hours/Day)</option>
                        </select>
                    </div>

                    {activeProductId && (
                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-800 bg-slate-950/20">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-muted-foreground uppercase tracking-wider block">
                                    Scheduling Runs & Capacity
                                </span>
                                {getProductCapacity(activeProductId) > 0 ? (
                                    <span className="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.2 rounded font-extrabold uppercase text-slate-300">
                                        {calculateDaysCount(activeProductId, joQty, shiftOption)} Days Run
                                    </span>
                                ) : (
                                    <span className="text-[8px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-1.5 py-0.2 rounded font-extrabold uppercase text-yellow-500">
                                        Needs Config
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBreakdownModalOpen(true)}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800/80 py-2 text-xs font-bold text-foreground border border-slate-700/60 shadow-sm transition-all cursor-pointer"
                            >
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                {getProductCapacity(activeProductId) > 0 
                                    ? `View Daily Breakdown (${calculateDaysCount(activeProductId, joQty, shiftOption)} Days)`
                                    : "Configure Capacity & Runs"}
                            </button>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Production Target Due Date</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        />
                    </div>

                    <button
                        onClick={handleCreateJobOrder}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
                    >
                        <Merge className="h-4 w-4" />
                        Consolidate & Release Batch JO
                    </button>

                    {renderBreakdownModal()}
                </div>
            </div>
        );
    }

    if (isStandaloneMode) {
        return (
            /* Standalone / Forecast Form (Header > Detail Based) */
            <div className="border rounded-xl bg-card p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                    <div>
                        <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Generate Standalone / Forecast JO</h4>
                        <p className="text-[10px] text-muted-foreground">Scheduling multi-product production run</p>
                    </div>
                    <button
                        onClick={() => {
                            setIsStandaloneMode(false);
                            setSelectedProductsList([]);
                        }}
                        className="text-muted-foreground hover:text-foreground text-xs font-semibold"
                    >
                        Cancel
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Header: Target Production Branch */}
                    <div className="space-y-1.5 relative">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Target Production Branch</label>
                        <input
                            type="text"
                            placeholder="Type to search branch..."
                            value={branchSearch}
                            onFocus={() => setIsBranchFocused(true)}
                            onBlur={() => setTimeout(() => setIsBranchFocused(false), 200)}
                            onChange={(e) => setBranchSearch(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        />
                        {isBranchFocused && (
                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl divide-y divide-slate-800">
                                {filteredBranches.map(b => (
                                    <button
                                        type="button"
                                        key={b.id}
                                        onClick={() => {
                                            setSelectedBranchId(Number(b.id));
                                            setBranchSearch(`${b.branch_name} (${b.branch_code})`);
                                            setIsBranchFocused(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-100 transition-colors"
                                    >
                                        {b.branch_name} ({b.branch_code})
                                    </button>
                                ))}
                                {filteredBranches.length === 0 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center">No branches found</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Header: Job Order Identifier */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Job Order Identifier</label>
                        <input
                            type="text"
                            value={joNumber}
                            onChange={(e) => setJoNumber(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                            placeholder="JO-XXXXXXXX"
                        />
                    </div>

                    {/* Header: Target floor due date */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Target floor due date</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Production Shift Schedule</label>
                        <select
                            value={shiftOption}
                            onChange={(e) => setShiftOption(e.target.value)}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                        >
                            <option value="8">Single Shift (8 Hours/Day)</option>
                            <option value="16">Double Shift (16 Hours/Day)</option>
                            <option value="24">Triple Shift (24 Hours/Day)</option>
                        </select>
                    </div>

                    {activeProductId && (
                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-800 bg-slate-950/20">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-muted-foreground uppercase tracking-wider block">
                                    Scheduling Runs & Capacity
                                </span>
                                {getProductCapacity(activeProductId) > 0 ? (
                                    <span className="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.2 rounded font-extrabold uppercase text-slate-300">
                                        {calculateDaysCount(activeProductId, activeQty, shiftOption)} Days Run
                                    </span>
                                ) : (
                                    <span className="text-[8px] bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 px-1.5 py-0.2 rounded font-extrabold uppercase text-yellow-500">
                                        Needs Config
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBreakdownModalOpen(true)}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800/80 py-2 text-xs font-bold text-foreground border border-slate-700/60 shadow-sm transition-all cursor-pointer"
                            >
                                <Calendar className="h-3.5 w-3.5 text-primary" />
                                {getProductCapacity(activeProductId) > 0 
                                    ? `View Daily Breakdown (${calculateDaysCount(activeProductId, activeQty, shiftOption)} Days)`
                                    : "Configure Capacity & Runs"}
                            </button>
                        </div>
                    )}

                    {/* Section: Detail Line Items */}
                    <div className="border-t pt-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold text-foreground uppercase tracking-wider">Job Order Detail Lines</span>
                            <span className="text-[9px] text-muted-foreground font-bold">{selectedProductsList.length} items</span>
                        </div>

                        {/* Search SKU to add */}
                        <div className="space-y-1.5 relative">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase block">Add Product to JO Detail</label>
                            <div className="flex gap-1.5">
                                <input
                                    type="text"
                                    placeholder="Type SKU name to add..."
                                    value={productSearch}
                                    onFocus={() => setIsProductFocused(true)}
                                    onBlur={() => setTimeout(() => setIsProductFocused(false), 200)}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                />
                            </div>
                            {isProductFocused && (
                                <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl divide-y divide-slate-800">
                                    {filteredProducts.map(p => (
                                        <button
                                            type="button"
                                            key={p.product_id}
                                            onClick={() => handleAddProductLine(p)}
                                            className="w-full text-left px-3 py-2 text-[11px] hover:bg-primary hover:text-primary-foreground text-slate-100 transition-colors flex justify-between"
                                        >
                                            <span>{p.product_name}</span>
                                            <span className="text-muted-foreground/75 font-semibold text-[9px] uppercase">{p.unit_of_measurement?.unit_shortcut || "PC"}</span>
                                        </button>
                                    ))}
                                    {filteredProducts.length === 0 && (
                                        <div className="p-2 text-xs text-muted-foreground text-center">No products found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected lines list */}
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {selectedProductsList.map((item, index) => {
                                const versions = productVersions[item.product_id] || [];
                                return (
                                    <div key={item.product_id} className="border border-slate-800 bg-slate-900/50 rounded-lg p-3 space-y-2 relative">
                                        <button
                                            onClick={() => handleRemoveProductLine(item.product_id)}
                                            className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                        <div>
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase block">SKU #{index + 1}</span>
                                            <strong className="text-[11px] text-foreground block pr-6">{item.product_name}</strong>
                                            <span className="text-[9px] text-muted-foreground font-semibold uppercase block">UOM: {item.uom}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Quantity */}
                                            <div className="space-y-1">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Quantity</span>
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateLineQty(item.product_id, Number(e.target.value))}
                                                        className="w-full rounded border bg-background px-2 py-1 pr-10 text-[10px] font-semibold text-foreground outline-none"
                                                        min={1}
                                                    />
                                                    <span className="absolute right-2 text-[9px] font-extrabold text-muted-foreground uppercase">
                                                        {item.uom || "PCS"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Version Dropdown */}
                                            <div className="space-y-1">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase block">Recipe Version</span>
                                                <select
                                                    value={item.bom_version_id || ""}
                                                    onChange={(e) => {
                                                        const opt = e.target.selectedOptions[0];
                                                        handleUpdateLineVersion(item.product_id, Number(e.target.value), opt.text);
                                                    }}
                                                    className="w-full rounded border bg-background px-1.5 py-1 text-[10px] font-semibold text-foreground outline-none"
                                                >
                                                    <option value="">Latest (Active)</option>
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                    {versions.map((v: any) => (
                                                        <option key={v.id} value={v.id}>{v.version_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {selectedProductsList.length === 0 && (
                                <div className="text-center py-6 border border-dashed rounded-lg text-muted-foreground text-[10px] italic">
                                    No product lines added yet. Add a finished good above.
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleCreateJobOrder}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/95 py-2 text-xs font-bold text-primary-foreground shadow-md transition-all cursor-pointer"
                    >
                        <Play className="h-4 w-4" />
                        Generate Standalone / Forecast JO
                    </button>

                    {renderBreakdownModal()}
                </div>
            </div>
        );
    }

    return (
        <div className="border border-dashed rounded-xl p-8 text-center text-muted-foreground text-xs space-y-4 bg-muted/5">
            <p>Select an approved Sales Order or click Batch into JO to schedule factory operations.</p>
            <div className="text-muted-foreground font-bold">OR</div>
            <button
                onClick={() => {
                    setIsStandaloneMode(true);
                    setDueDate("");
                    setJoNumber(`JO-FORECAST-${Math.floor(1000 + Math.random() * 9000)}`);
                    setSelectedSO(null);
                    setSelectedBatchCandidate(null);
                    setSelectedProductsList([]);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 hover:bg-primary/20 px-4 py-2 text-xs font-bold text-primary shadow-xs transition-all cursor-pointer mx-auto"
            >
                <Play className="h-3.5 w-3.5" />
                Create Forecast / Standalone JO
            </button>
        </div>
    );
}
