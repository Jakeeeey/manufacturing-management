import React, { useState, useMemo, useEffect } from "react";
import { Merge, CheckSquare, Square, Calendar, ChevronRight, Play } from "lucide-react";
import { SalesOrder, SalesOrderDetail } from "../types";
import { addJobOrder } from "../services/planning-api";
import { toast } from "sonner";

interface BatchConsolidationTableProps {
    salesOrders: SalesOrder[];
    soDetailsMap: Record<number, SalesOrderDetail[]>;
    branches: any[];
    selectedBranchId: number | "";
    setSelectedBranchId: (val: number) => void;
    onBatchCreated: () => void;
    selectedIds: number[];
    setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
}

export function BatchConsolidationTable({
    salesOrders,
    soDetailsMap,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    onBatchCreated,
    selectedIds,
    setSelectedIds
}: BatchConsolidationTableProps) {
    const [joNumber, setJoNumber] = useState(`JO-BATCH-${Math.floor(1000 + Math.random() * 9000)}`);
    const [dueDate, setDueDate] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [branchSearch, setBranchSearch] = useState("");
    const [isBranchFocused, setIsBranchFocused] = useState(false);

    useEffect(() => {
        const selectedBranchObj = branches.find(b => Number(b.id) === Number(selectedBranchId));
        if (selectedBranchObj) {
            setBranchSearch(`${selectedBranchObj.branch_name} (${selectedBranchObj.branch_code})`);
        } else {
            setBranchSearch("");
        }
    }, [selectedBranchId, branches]);

    const filteredBranches = branches.filter(b => 
        b.branch_name.toLowerCase().includes(branchSearch.toLowerCase()) ||
        b.branch_code.toLowerCase().includes(branchSearch.toLowerCase())
    );

    const toggleOrder = (orderId: number) => {
        setSelectedIds(prev => 
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
    };

    const toggleAll = () => {
        const currentPageIds = salesOrders.map(so => so.order_id);
        const allCurrentSelected = currentPageIds.every(id => selectedIds.includes(id));
        if (allCurrentSelected) {
            setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...currentPageIds])));
        }
    };

    // Calculate the consolidated products across all selected sales orders
    const consolidatedProducts = useMemo(() => {
        const prodMap: Record<number, {
            product_id: number;
            product_name: string;
            product_code: string;
            quantity: number;
            uom: string;
            uom_count: number;
            brand: string;
            category: string;
        }> = {};

        selectedIds.forEach(id => {
            const details = soDetailsMap[id] || [];
            details.forEach(det => {
                const pId = det.product_id?.product_id || Number(det.product_id);
                const pName = det.product_id?.product_name || `Product #${pId}`;
                const pCode = det.product_id?.product_code || `CODE-${pId}`;
                const qty = Number(det.ordered_quantity || 0);

                if (!prodMap[pId]) {
                    prodMap[pId] = {
                        product_id: pId,
                        product_name: pName,
                        product_code: pCode,
                        quantity: 0,
                        uom: det.product_id?.uom || "PCS",
                        uom_count: det.product_id?.uom_count || 1,
                        brand: det.product_id?.brand || "N/A",
                        category: det.product_id?.category || "N/A"
                    };
                }
                prodMap[pId].quantity += qty;
            });
        });

        return Object.values(prodMap);
    }, [selectedIds, soDetailsMap]);

    const handleCreateBatch = async () => {
        if (selectedIds.length === 0) {
            toast.error("Please select at least one Sales Order to consolidate.");
            return;
        }
        if (!dueDate || !joNumber.trim()) {
            toast.error("Please provide a target due date and Job Order number.");
            return;
        }
        if (!selectedBranchId) {
            toast.error("Please select a target production branch.");
            return;
        }

        setSubmitting(true);
        try {
            const selectedNoList = salesOrders
                .filter(so => selectedIds.includes(so.order_id))
                .map(so => so.order_no);

            // Construct payload following normalized schema
            const batchJO = {
                jo_id: joNumber.trim(),
                order_no: selectedNoList.join(", "),
                due_date: dueDate,
                status: "Draft",
                is_batched: true,
                procurementStatus: "Idle",
                branch_id: Number(selectedBranchId),
                // Pass consolidated products
                products: consolidatedProducts,
                // Top-level product defaults for compatibility with single-product hook/list views
                product_id: consolidatedProducts[0]?.product_id,
                product_name: consolidatedProducts[0]?.product_name,
                quantity: consolidatedProducts.reduce((sum, p) => sum + p.quantity, 0)
            };

            await addJobOrder(batchJO as any, selectedIds);
            toast.success(`Consolidated Job Order ${joNumber} successfully generated!`);
            onBatchCreated();
        } catch (e: any) {
            toast.error(e.message || "Failed to schedule consolidated Job Order");
        } finally {
            setSubmitting(false);
        }
    };

    if (salesOrders.length === 0) {
        return (
            <div className="text-center p-12 border rounded-xl bg-card">
                <Merge className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">No Orders Pending Consolidation</h4>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Sales Orders with status "For Consolidation" appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
            {/* Left Section: Sales Orders Selector */}
            <div className="xl:col-span-3 border rounded-xl bg-card shadow-sm overflow-hidden space-y-4">
                <div className="flex justify-between items-center bg-muted/30 border-b p-3.5">
                    <div>
                        <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Select Sales Orders for Consolidation</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Choose orders to sum up and schedule as a single floor batch run.</p>
                    </div>
                    <button
                        onClick={toggleAll}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    >
                        {salesOrders.length > 0 && salesOrders.map(so => so.order_id).every(id => selectedIds.includes(id)) ? "Deselect Page" : "Select Page"}
                    </button>
                </div>

                <div className="divide-y max-h-[500px] overflow-y-auto">
                    {salesOrders.map(so => {
                        const isChecked = selectedIds.includes(so.order_id);
                        const details = soDetailsMap[so.order_id] || [];

                        return (
                            <div 
                                key={so.order_id} 
                                onClick={() => toggleOrder(so.order_id)}
                                className={`flex items-start gap-3 p-3.5 hover:bg-muted/20 cursor-pointer transition-colors ${isChecked ? 'bg-primary/5' : ''}`}
                            >
                                <div className="mt-0.5 text-primary shrink-0">
                                    {isChecked ? (
                                        <CheckSquare className="h-4.5 w-4.5 text-primary fill-primary/10" />
                                    ) : (
                                        <Square className="h-4.5 w-4.5 text-muted-foreground/50" />
                                    )}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-extrabold text-foreground text-xs leading-none">{so.order_no}</span>
                                        <span className="text-[9px] text-muted-foreground font-bold">{so.order_date}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                                        <span>Customer: <strong className="text-foreground font-semibold">{so.customer_name || so.customer_code}</strong></span>
                                        <span className="text-primary font-bold">{details.length} item(s)</span>
                                    </div>
                                    {/* Brief items preview */}
                                    <div className="text-[9px] text-muted-foreground bg-muted/40 p-1.5 rounded-md mt-1 italic border border-muted-foreground/10">
                                        {details.map(d => `${d.product_id?.product_name || 'Item'} (${d.ordered_quantity} ${d.product_id?.uom || "PCS"})`).join(", ") || "No items"}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Section: Consolidated Checkout Summary */}
            <div className="xl:col-span-2 border rounded-xl bg-card shadow-sm p-5 space-y-4">
                <div className="border-b pb-3.5">
                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Consolidated Batch Checkout</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Summed products and quantities from selected orders.</p>
                </div>

                {selectedIds.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-[11px] border border-dashed rounded-xl p-4">
                        Select one or more Sales Orders on the left to review the consolidated product quantities.
                    </div>
                ) : (
                    <div className="space-y-4.5">
                        {/* Consolidated Products List */}
                        <div className="space-y-2">
                            <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block">Consolidated Products</span>
                            <div className="border rounded-xl divide-y overflow-hidden max-h-[200px] overflow-y-auto">
                                {consolidatedProducts.map(p => (
                                    <div key={p.product_id} className="p-3 flex justify-between items-center text-xs bg-muted/5">
                                        <div className="space-y-0.5">
                                            <span className="font-extrabold text-foreground block leading-tight">{p.product_name}</span>
                                            <span className="text-[9px] text-muted-foreground font-bold block">SKU: {p.product_code} (Count: {p.uom_count})</span>
                                            <span className="text-[9px] text-muted-foreground font-semibold block">Brand: {p.brand} • Cat: {p.category}</span>
                                        </div>
                                        <span className="font-black text-primary shrink-0">{p.quantity.toLocaleString()} {p.uom}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Batch scheduling form */}
                        <div className="space-y-3 pt-2 border-t">
                             {/* Target Branch Searchable Select */}
                             <div className="space-y-1.5 relative">
                                 <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">Target Production Branch</label>
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

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">Consolidated JO Number</label>
                                <input
                                    type="text"
                                    value={joNumber}
                                    onChange={(e) => setJoNumber(e.target.value)}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                    placeholder="JO-BATCH-XXXX"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider block">Target Delivery/Due Date</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                />
                            </div>

                            <button
                                disabled={submitting}
                                onClick={handleCreateBatch}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50"
                            >
                                <Play className="h-4 w-4" />
                                {submitting ? "Scheduling Batch..." : "Release Batch Job Order"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
