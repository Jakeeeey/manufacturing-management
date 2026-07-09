import React, { useState, useMemo, useEffect } from "react";
import { Calendar, Play, X, MapPin, Hash, RefreshCw, Check, ShoppingCart, Merge } from "lucide-react";
import { SalesOrder, SalesOrderDetail } from "../types";
import { addJobOrder } from "../services/planning-api";
import { toast } from "sonner";

interface BatchConsolidationTableProps {
    salesOrders: SalesOrder[];
    soDetailsMap: Record<number, SalesOrderDetail[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    branches: any[];
    selectedBranchId: number | "";
    setSelectedBranchId: (val: number) => void;
    onBatchCreated: () => void;
    selectedIds: number[];
    setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: any[];
}

export function BatchConsolidationTable({
    salesOrders,
    soDetailsMap,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    onBatchCreated,
    selectedIds,
    setSelectedIds,
    products
}: BatchConsolidationTableProps) {
    const [joNumber, setJoNumber] = useState(`JO-BATCH-${Math.floor(1000 + Math.random() * 9000)}`);
    const [dueDate, setDueDate] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [branchSearch, setBranchSearch] = useState("");
    const [isBranchFocused, setIsBranchFocused] = useState(false);
    const [shiftOption, setShiftOption] = useState<string>("8");

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

    // Calculate stats for selection summary
    const selectedStats = useMemo(() => {
        let totalQty = 0;
        let totalItems = 0;
        selectedIds.forEach(id => {
            const details = soDetailsMap[id] || [];
            totalItems += details.length;
            details.forEach(det => {
                totalQty += Number(det.ordered_quantity || 0);
            });
        });
        return { totalQty, totalItems };
    }, [selectedIds, soDetailsMap]);

    const getProductCapacity = (productId: number): number => {
        const prod = products.find(p => Number(p.product_id) === Number(productId));
        return prod ? Number(prod.production_capacity || 0) : 0;
    };

    interface DailyBreakdownDay {
        day: number;
        date: string;
        quantity: number;
        status: string;
    }

    const calculateDailyBreakdown = (productId: number, qty: number, shift: string): DailyBreakdownDay[] | null => {
        const capacityPerHour = getProductCapacity(productId);
        if (!capacityPerHour || capacityPerHour <= 0) return null;
        
        const hoursPerDay = Number(shift);
        const dailyCapacity = capacityPerHour * hoursPerDay;
        const totalDays = Math.ceil(qty / dailyCapacity);
        
        const breakdown: DailyBreakdownDay[] = [];
        let remainingQty = qty;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
        
        for (let i = 1; i <= totalDays; i++) {
            const dayQty = Math.min(remainingQty, dailyCapacity);
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (i - 1));
            const dateString = currentDate.toISOString().split("T")[0];
            
            breakdown.push({
                day: i,
                date: dateString,
                quantity: dayQty,
                status: "Pending"
            });
            remainingQty -= dayQty;
        }
        return breakdown;
    };

    const mergeBreakdowns = (breakdowns: DailyBreakdownDay[][]) => {
        const merged: Record<string, { day: number; date: string; quantity: number; status: string }> = {};
        
        breakdowns.forEach(arr => {
            arr.forEach(item => {
                const date = item.date;
                if (!merged[date]) {
                    merged[date] = {
                        day: 0,
                        date,
                        quantity: 0,
                        status: "Pending"
                    };
                }
                merged[date].quantity += item.quantity;
            });
        });
        
        return Object.keys(merged)
            .sort()
            .map((date, idx) => ({
                day: idx + 1,
                date,
                quantity: merged[date].quantity,
                status: "Pending"
            }));
    };

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

            // Compute independent daily breakdowns for each product and merge them
            const breakdowns = consolidatedProducts.map(p => 
                calculateDailyBreakdown(p.product_id, p.quantity, shiftOption)
            ).filter((b): b is DailyBreakdownDay[] => b !== null);
            const mergedBreakdown = mergeBreakdowns(breakdowns);

            // Construct payload following normalized schema
            const batchJO = {
                jo_id: joNumber.trim(),
                order_no: selectedNoList.join(", "),
                due_date: dueDate,
                status: "Draft",
                is_batched: true,
                procurementStatus: "Idle",
                branch_id: Number(selectedBranchId),
                shiftOption: shiftOption,
                dailyBreakdown: mergedBreakdown,
                // Pass consolidated products mapped correctly
                products: consolidatedProducts.map(p => ({
                    product_id: p.product_id,
                    product_name: p.product_name,
                    quantity: p.quantity,
                    bom: null
                })),
                // Top-level product defaults for compatibility with single-product hook/list views
                product_id: consolidatedProducts[0]?.product_id,
                product_name: consolidatedProducts[0]?.product_name,
                quantity: consolidatedProducts.reduce((sum, p) => sum + p.quantity, 0)
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await addJobOrder(batchJO as any, selectedIds);
            toast.success(
                selectedIds.length > 1
                    ? `Consolidated Job Order ${joNumber} successfully generated!`
                    : `Job Order ${joNumber} successfully generated!`
            );
            onBatchCreated();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(
                e.message || 
                (selectedIds.length > 1 ? "Failed to schedule consolidated Job Order" : "Failed to schedule Job Order")
            );
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
                    Sales Orders with status &quot;For Consolidation&quot; appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6">
            {/* Sales Orders Tabular Selector */}
            <div className="border rounded-2xl bg-card shadow-lg border-slate-200 dark:border-slate-850 overflow-hidden">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-200/80 dark:border-slate-850 px-5 py-4 gap-4">
                    <div>
                        <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Select Sales Orders for Scheduling</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Toggle orders to schedule their item requirements into a production run.</p>
                    </div>
                    {selectedIds.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                const isConsolidated = selectedIds.length > 1;
                                const prefix = isConsolidated ? "JO-BATCH-" : "JO-";
                                setJoNumber(`${prefix}${Math.floor(1000 + Math.random() * 9000)}`);
                                setIsCheckoutModalOpen(true);
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-extrabold shadow-md transition-all duration-200 hover:scale-[1.02] border-none cursor-pointer"
                        >
                            <ShoppingCart className="h-4 w-4" />
                            {selectedIds.length > 1 ? `Proceed to Batch Checkout (${selectedIds.length})` : "Proceed to Checkout"}
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/20 dark:bg-slate-950/5 border-b border-slate-200/80 dark:border-slate-850 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                <th className="p-4 w-12 text-center">
                                    <button
                                        type="button"
                                        onClick={toggleAll}
                                        className={`h-5 w-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                                            salesOrders.length > 0 && salesOrders.map(so => so.order_id).every(id => selectedIds.includes(id))
                                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                                : "border-slate-200 dark:border-slate-850 hover:border-slate-350 dark:hover:border-slate-700 bg-background"
                                        }`}
                                    >
                                        {salesOrders.length > 0 && salesOrders.map(so => so.order_id).every(id => selectedIds.includes(id)) && (
                                            <Check className="h-3.5 w-3.5 stroke-[3.5]" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-4 text-[10px]">Order Details</th>
                                <th className="p-4 text-[10px]">Customer</th>
                                <th className="p-4 text-[10px]">Items / Products Breakdown</th>
                                <th className="p-4 text-right text-[10px] pr-6">Summary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                            {salesOrders.map(so => {
                                const isChecked = selectedIds.includes(so.order_id);
                                const details = soDetailsMap[so.order_id] || [];
                                const orderQtySum = details.reduce((sum, d) => sum + Number(d.ordered_quantity || 0), 0);

                                return (
                                    <tr 
                                        key={so.order_id} 
                                        onClick={() => toggleOrder(so.order_id)}
                                        className={`group hover:bg-slate-50/50 dark:hover:bg-slate-900/10 cursor-pointer transition-all duration-150 ${
                                            isChecked ? 'bg-primary/[0.02]' : ''
                                        }`}
                                    >
                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => toggleOrder(so.order_id)}
                                                className={`h-5 w-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all ${
                                                    isChecked 
                                                        ? 'border-primary bg-primary text-primary-foreground shadow-xs' 
                                                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-700 bg-background'
                                                }`}
                                            >
                                                {isChecked && <Check className="h-3.5 w-3.5 stroke-[3.5]" />}
                                            </button>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-extrabold text-foreground text-xs group-hover:text-primary transition-colors">{so.order_no}</span>
                                                <span className="text-[9px] text-muted-foreground font-semibold">{so.order_date}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-extrabold text-foreground text-xs truncate max-w-[200px] block">{so.customer_name || so.customer_code}</span>
                                                <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Code: {so.customer_code}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {details.length === 0 ? (
                                                <span className="text-[10px] text-muted-foreground italic">No products available.</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto max-w-[480px]">
                                                    {details.map((d, dIdx) => (
                                                        <span 
                                                            key={dIdx} 
                                                            className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-lg px-2 py-0.5 text-[9px] font-semibold text-foreground whitespace-nowrap"
                                                        >
                                                            <span>{d.product_id?.product_name || 'Item'}</span>
                                                            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                                            <strong className="text-primary">{d.ordered_quantity} {d.product_id?.uom || "PCS"}</strong>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right pr-6">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="font-extrabold text-foreground text-xs">{orderQtySum.toLocaleString()} units</span>
                                                <span className="text-[9px] text-muted-foreground font-semibold">{details.length} SKU Line{details.length !== 1 ? 's' : ''}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Floating Dock style Bottom Action Bar */}
                {selectedIds.length > 0 && (
                    <div className="bg-slate-100/50 dark:bg-slate-900/10 border-t border-slate-200/80 dark:border-slate-850 p-4.5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                            <div>
                                Selected: <strong className="text-foreground font-extrabold text-sm">{selectedIds.length}</strong> <span className="text-[10px]">Orders</span>
                            </div>
                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                            <div>
                                Total SKU Lines: <strong className="text-foreground font-extrabold text-sm">{selectedStats.totalItems}</strong>
                            </div>
                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                            <div>
                                Total Volume: <strong className="text-primary font-black text-sm">{selectedStats.totalQty.toLocaleString()}</strong> <span className="text-[10px] text-primary">units</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Pop-up Checkout Modal */}
            {isCheckoutModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-300">
                    <div className="bg-card border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-200/80 dark:border-slate-855 flex items-center justify-between bg-slate-100/50 dark:bg-slate-900/10 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                    <Merge className="h-4.5 w-4.5" />
                                </span>
                                <div>
                                    <h4 className="text-sm font-black text-foreground">
                                        {selectedIds.length > 1 ? "Consolidated Batch Checkout" : "Job Order Checkout"}
                                    </h4>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {selectedIds.length > 1
                                            ? `Scheduling consolidation for ${selectedIds.length} orders.`
                                            : "Scheduling production for selected order."}
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsCheckoutModalOpen(false)} 
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-muted-foreground hover:text-foreground border-none bg-transparent cursor-pointer transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Consolidated Products List */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                                    {selectedIds.length > 1 ? "Consolidated Products Breakdown" : "Products Breakdown"}
                                </span>
                                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                                    {consolidatedProducts.map(p => (
                                        <div key={p.product_id} className="p-3 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 rounded-xl hover:border-slate-350 dark:hover:border-slate-700 transition-colors">
                                            <div className="space-y-1">
                                                <span className="font-extrabold text-foreground text-xs block leading-tight">{p.product_name}</span>
                                                <div className="flex flex-wrap gap-1.5 items-center text-[9px]">
                                                    <span className="bg-slate-100 dark:bg-slate-800 text-muted-foreground px-1.5 py-0.2 rounded font-mono font-bold">SKU: {p.product_code}</span>
                                                    <span className="text-muted-foreground">•</span>
                                                    <span className="text-muted-foreground font-semibold">{p.brand}</span>
                                                    <span className="text-muted-foreground">•</span>
                                                    <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded font-extrabold uppercase">{p.category}</span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-black text-xs text-primary block">{p.quantity.toLocaleString()}</span>
                                                <span className="text-[8px] uppercase font-bold text-muted-foreground">{p.uom}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Batch scheduling form */}
                            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-850">
                                {/* Target Branch Searchable Select */}
                                <div className="space-y-1.5 relative">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Target Production Branch</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Type to search branch..."
                                            value={branchSearch}
                                            onFocus={() => setIsBranchFocused(true)}
                                            onBlur={() => setTimeout(() => setIsBranchFocused(false), 200)}
                                            onChange={(e) => {
                                                setBranchSearch(e.target.value);
                                            }}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-background pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        />
                                    </div>
                                    {isBranchFocused && (
                                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shadow-xl divide-y divide-slate-200 dark:divide-slate-800">
                                            {filteredBranches.map(b => (
                                                <button
                                                    type="button"
                                                    key={b.id}
                                                    onClick={() => {
                                                        setSelectedBranchId(Number(b.id));
                                                        setBranchSearch(`${b.branch_name} (${b.branch_code})`);
                                                        setIsBranchFocused(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-slate-800 dark:text-slate-100 transition-colors border-none bg-transparent cursor-pointer"
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

                                {/* JO Number with randomizer button */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                                        {selectedIds.length > 1 ? "Consolidated JO Number" : "Job Order Number"}
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Hash className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                            <input
                                                type="text"
                                                value={joNumber}
                                                onChange={(e) => setJoNumber(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-background pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                                placeholder="JO-BATCH-XXXX"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const prefix = selectedIds.length > 1 ? "JO-BATCH-" : "JO-";
                                                setJoNumber(`${prefix}${Math.floor(1000 + Math.random() * 9000)}`);
                                            }}
                                            className="px-3 border border-slate-200 dark:border-slate-800 bg-background hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                            title="Generate Random JO ID"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Shift Option as segment control */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Production Shift Schedule</label>
                                    <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
                                        {[
                                            { label: "Single Shift", hours: "8", desc: "8 hrs/day" },
                                            { label: "Double Shift", hours: "16", desc: "16 hrs/day" },
                                            { label: "Triple Shift", hours: "24", desc: "24 hrs/day" }
                                        ].map(opt => {
                                            const isSelected = shiftOption === opt.hours;
                                            return (
                                                <button
                                                    type="button"
                                                    key={opt.hours}
                                                    onClick={() => setShiftOption(opt.hours)}
                                                    className={`py-2 px-1 rounded-lg text-center transition-all cursor-pointer border-none flex flex-col items-center justify-center ${
                                                        isSelected 
                                                            ? "bg-card text-primary shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-700/30"
                                                            : "text-muted-foreground hover:text-foreground hover:bg-slate-200/30 dark:hover:bg-slate-800/30"
                                                    }`}
                                                >
                                                    <span className="text-[10px] font-extrabold">{opt.label}</span>
                                                    <span className="text-[8px] opacity-70 mt-0.5">{opt.desc}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Target Delivery/Due Date */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Target Delivery/Due Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-background pl-9 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        />
                                    </div>
                                </div>

                                {/* Create Button */}
                                <button
                                    disabled={submitting}
                                    onClick={async () => {
                                        await handleCreateBatch();
                                        setIsCheckoutModalOpen(false);
                                    }}
                                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-extrabold text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.01] disabled:opacity-50 mt-4 border-none cursor-pointer"
                                >
                                    <Play className="h-4 w-4" />
                                    {submitting
                                        ? "Scheduling..."
                                        : selectedIds.length > 1
                                        ? "Release Batch Job Order"
                                        : "Release Job Order"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
