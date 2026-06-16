import React, { useState, useEffect } from "react";
import { Play, Merge, Plus, Trash2, Layers } from "lucide-react";
import { SalesOrder, SalesOrderDetail } from "../types";

interface PlanningSidebarFormProps {
    selectedSO: SalesOrder | null;
    setSelectedSO: (so: SalesOrder | null) => void;
    selectedBatchCandidate: any | null;
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
    branches: any[];
    selectedBranchId: number | "";
    setSelectedBranchId: (val: number) => void;
    isStandaloneMode: boolean;
    setIsStandaloneMode: (val: boolean) => void;
    products: any[];
    selectedStandaloneProduct: any | null;
    setSelectedStandaloneProduct: (val: any | null) => void;
    selectedProductsList: any[];
    setSelectedProductsList: (list: any[]) => void;
    productVersions: Record<number, any[]>;
    loadVersionsForProduct: (productId: number) => Promise<void>;
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
    loadVersionsForProduct
}: PlanningSidebarFormProps) {
    const [branchSearch, setBranchSearch] = useState("");
    const [isBranchFocused, setIsBranchFocused] = useState(false);
    const [detailSearch, setDetailSearch] = useState("");
    const [isDetailFocused, setIsDetailFocused] = useState(false);
    
    // Standalone product search
    const [productSearch, setProductSearch] = useState("");
    const [isProductFocused, setIsProductFocused] = useState(false);

    const [prevSelectedBranchId, setPrevSelectedBranchId] = useState<number | "">(selectedBranchId);
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
        const selectedDetailObj = soDetails.find(d => String(d.detail_id) === String(selectedDetailId));
        setDetailSearch(selectedDetailObj ? `${selectedDetailObj.product_id?.product_name || `ID: ${selectedDetailObj.product_id}`} (Qty: ${selectedDetailObj.ordered_quantity})` : "");
    }

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

    const filteredBranches = branches.filter(b => 
        b.branch_name.toLowerCase().includes(branchSearch.toLowerCase()) ||
        b.branch_code.toLowerCase().includes(branchSearch.toLowerCase())
    );

    const filteredDetails = soDetails.filter(d => {
        const prodName = d.product_id?.product_name || "";
        return prodName.toLowerCase().includes(detailSearch.toLowerCase());
    });

    const filteredProducts = products.filter(p => 
        p.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.product_code.toLowerCase().includes(productSearch.toLowerCase())
    );

    // Helper to add a product line
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
                                {filteredDetails.length === 0 && (
                                    <div className="p-2 text-xs text-muted-foreground text-center">No items found</div>
                                )}
                            </div>
                        )}
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
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Committed target quantity</label>
                        <input
                            type="number"
                            value={joQty}
                            onChange={(e) => setJoQty(Number(e.target.value))}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                            min={1}
                        />
                    </div>

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
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateLineQty(item.product_id, Number(e.target.value))}
                                                    className="w-full rounded border bg-background px-2 py-1 text-[10px] font-semibold text-foreground"
                                                    min={1}
                                                />
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
