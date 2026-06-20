import React, { useState } from "react";
import { Cpu, Merge, Loader2, Layers, AlertTriangle, ArrowRight, CheckCircle, Clock, DollarSign, Users, UserPlus, CheckSquare, Square, Calendar, Play } from "lucide-react";
import { JobOrder } from "../types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { toast } from "sonner";

interface JobOrdersListProps {
    jobOrders: JobOrder[];
    checkingInventoryId: string | null;
    procurementLoadingId: string | null;
    handleRunFIFOInventoryCheck: (jo: JobOrder) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleTriggerProcurement: (joId: string, supplierId: number, poNumber: string, lineItems: any[]) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleProgressProcurement: (jo: JobOrder, action: "Approve" | "Ship" | "QA", qaData?: any) => void;
    handleDeleteJO: (joId: string) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    branches: any[];
    handleCreatePrerequisiteJobOrder: (
        parentJo: JobOrder,
        compName: string,
        compProductId: number,
        suggestedQty: number,
        customCapacity?: number,
        customShift?: string
    ) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    users: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    suppliers: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleAssignPersonnel: (joId: string, personnel: any[]) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    modifyJobOrder: (joId: string, patch: any) => Promise<void>;
}

export function JobOrdersList({
    jobOrders,
    checkingInventoryId,
    procurementLoadingId,
    handleRunFIFOInventoryCheck,
    handleTriggerProcurement,
    handleProgressProcurement,
    handleDeleteJO,
    branches,
    handleCreatePrerequisiteJobOrder,
    users,
    suppliers,
    products,
    handleAssignPersonnel,
    modifyJobOrder
}: JobOrdersListProps) {
    const [assigningJoId, setAssigningJoId] = useState<string | null>(null);
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

    const [prereqParentJo, setPrereqParentJo] = useState<JobOrder | null>(null);
    const [prereqCompName, setPrereqCompName] = useState<string>("");
    const [prereqCompProductId, setPrereqCompProductId] = useState<number | null>(null);
    const [prereqQty, setPrereqQty] = useState<number>(0);
    const [prereqCapacity, setPrereqCapacity] = useState<string>("");
    const [prereqShiftOption, setPrereqShiftOption] = useState<string>("8");
    const [isPrereqModalOpen, setIsPrereqModalOpen] = useState<boolean>(false);

    const getProductCapacityLocal = (productId: number) => {
        const p = products.find(prod => Number(prod.product_id) === Number(productId));
        if (!p) return 0;
        if (p.production_capacity_per_hour && Number(p.production_capacity_per_hour) > 0) {
            return Number(p.production_capacity_per_hour);
        }
        const parentId = p.parent_id && typeof p.parent_id === "object"
            ? Number((p.parent_id as any).product_id)
            : (p.parent_id ? Number(p.parent_id) : null);
        if (parentId) {
            const parent = products.find(prod => Number(prod.product_id) === Number(parentId));
            if (parent && parent.production_capacity_per_hour && Number(parent.production_capacity_per_hour) > 0) {
                const uomCount = Number(p.unit_of_measurement_count || 1);
                return Number(parent.production_capacity_per_hour) * uomCount;
            }
        }
        return 0;
    };

    const openPrereqModal = (parentJo: JobOrder, compName: string, compProductId: number, qty: number) => {
        setPrereqParentJo(parentJo);
        setPrereqCompName(compName);
        setPrereqCompProductId(compProductId);
        setPrereqQty(qty);
        const cap = getProductCapacityLocal(compProductId);
        setPrereqCapacity(cap > 0 ? String(cap) : "");
        setPrereqShiftOption("8");
        setIsPrereqModalOpen(true);
    };

    const previewDailyBreakdown = React.useMemo(() => {
        if (!prereqCompProductId || prereqQty <= 0) return null;
        const capacityPerHour = Number(prereqCapacity) || 0;
        if (capacityPerHour <= 0) return null;
        
        const hoursPerDay = Number(prereqShiftOption);
        const dailyCapacity = capacityPerHour * hoursPerDay;
        const totalDays = Math.ceil(prereqQty / dailyCapacity);
        
        const breakdown = [];
        let remainingQty = prereqQty;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
        
        const limitDays = Math.min(totalDays, 100);
        for (let i = 1; i <= limitDays; i++) {
            const dayQty = Math.min(remainingQty, dailyCapacity);
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (i - 1));
            const dateString = currentDate.toISOString().split("T")[0];
            
            breakdown.push({
                day: i,
                date: dateString,
                quantity: dayQty
            });
            remainingQty -= dayQty;
            if (remainingQty <= 0) break;
        }
        return {
            breakdown,
            totalDays,
            dailyRate: dailyCapacity,
            hasTruncated: totalDays > 100
        };
    }, [prereqCompProductId, prereqQty, prereqCapacity, prereqShiftOption]);


    const userWorkloads = React.useMemo(() => {
        const loads: Record<string, number> = {};
        users.forEach(u => {
            loads[String(u.user_id)] = 0;
        });

        jobOrders.forEach(jo => {
            const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity,
                routings: jo.routings
            }];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
            productsList.forEach((p: any) => {
                if (!p.routings) return;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                p.routings.forEach((r: any) => {
                    const stepHours = (Number(r.duration_hours) || 0) * Number(p.quantity);
                    const assigned = r.assigned_personnel;
                    if (assigned && (assigned.id || assigned.user_id)) {
                        const wId = String(assigned.id || assigned.user_id);
                        if (loads[wId] !== undefined) {
                            loads[wId] += stepHours;
                        }
                    }
                });
            });
        });
        return loads;
    }, [jobOrders, users]);

    const [procurementInputs, setProcurementInputs] = useState<Record<string, {
        supplierId: string;
        poNumber: string;
        baseCosts: Record<number, string>;
        selectedComponentIds?: number[];
    }>>({});

    const [qaInputs, setQaInputs] = useState<Record<string, {
        inspectorId: string;
        lineItems: Record<number, {
            lotNumber: string;
            expirationDate: string;
            quantityReceived: string;
            quantityRejected: string;
            qaStatus: "Passed" | "Failed";
        }>;
    }>>({});

    const [assigningStepKeys, setAssigningStepKeys] = useState<Record<string, boolean>>({});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateProcInput = (joId: string, patch: any) => {
        setProcurementInputs(prev => {
            const current = prev[joId] || {
                supplierId: suppliers[0]?.supplier_id?.toString() || suppliers[0]?.id?.toString() || "",
                poNumber: `PO-${joId}-${Math.floor(1000 + Math.random() * 9000)}`,
                baseCosts: {}
            };
            return {
                ...prev,
                [joId]: { ...current, ...patch }
            };
        });
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateQaInput = (joId: string, patch: any) => {
        setQaInputs(prev => {
            const current = prev[joId] || {
                inspectorId: users[0]?.id?.toString() || "",
                lineItems: {}
            };
            return {
                ...prev,
                [joId]: { ...current, ...patch }
            };
        });
    };

    const handleAssignPersonnelToTask = async (jo: JobOrder, productId: number, routingId: number, userId: string) => {
        const stepKey = `${jo.jo_id}-${productId}-${routingId}`;
        setAssigningStepKeys(prev => ({ ...prev, [stepKey]: true }));
        try {
            const userObj = users.find(u => Number(u.user_id) === Number(userId));
            const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity,
                bom: jo.bom,
                components: jo.components,
                routings: jo.routings,
                allocationResults: jo.allocationResults
            }];

            const updatedProductsList = productsList.map(p => {
                if (Number(p.product_id) === Number(productId)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const updatedRoutings = (p.routings || []).map((r: any) => {
                        if (Number(r.routing_id) === Number(routingId)) {
                            return { 
                                ...r, 
                                assigned_personnel: userObj ? { 
                                    id: userObj.user_id, 
                                    name: `${userObj.user_fname} ${userObj.user_lname}`, 
                                    position: userObj.user_position 
                                } : null 
                            };
                        }
                        return r;
                    });
                    return { ...p, routings: updatedRoutings };
                }
                return p;
            });

            await modifyJobOrder(jo.jo_id, { products: updatedProductsList });
            toast.success("Personnel assigned to step successfully.");
        } catch (err) {
            console.error("[JobOrdersList] Assign operator error:", err);
            toast.error("Failed to assign operator.");
        } finally {
            setAssigningStepKeys(prev => ({ ...prev, [stepKey]: false }));
        }
    };

    const handleVerifyQAForTask = async (jo: JobOrder, productId: number, routingId: number, qaStatus: "Passed" | "Pending") => {
        const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
            product_id: jo.product_id,
            product_name: jo.product_name,
            quantity: jo.quantity,
            bom: jo.bom,
            components: jo.components,
            routings: jo.routings,
            allocationResults: jo.allocationResults
        }];

        const updatedProductsList = productsList.map(p => {
            if (Number(p.product_id) === Number(productId)) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updatedRoutings = (p.routings || []).map((r: any) => {
                    if (Number(r.routing_id) === Number(routingId)) {
                        return { 
                            ...r, 
                            qa_status: qaStatus, 
                            completed_at: qaStatus === "Passed" ? new Date().toISOString() : null 
                        };
                    }
                    return r;
                });
                return { ...p, routings: updatedRoutings };
            }
            return p;
        });

        await modifyJobOrder(jo.jo_id, { products: updatedProductsList });
    };

    if (jobOrders.length === 0) {
        return (
            <div className="text-center p-12 border rounded-xl bg-card">
                <Cpu className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">No active Job Orders</h4>
                <p className="text-[11px] text-muted-foreground mt-1">Schedule Job Orders from winning Sales Orders to feed the factory floor.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {jobOrders.map(jo => {
                // Summarize duration routing metrics if available
                const totalHours = jo.routings ? jo.routings.reduce((sum, r) => sum + (Number(r.duration_hours) || 0), 0) : 0;
                const totalLaborCost = jo.routings ? jo.routings.reduce((sum, r) => sum + (Number(r.estimated_labor_cost) || 0), 0) : 0;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
                const laborCostAdjusted = totalLaborCost * jo.quantity;

                // Suggested manpower based on routing steps duration and quantity demand (assuming standard 8-hour shift)
                const suggestedManpower = (() => {
                    let total = 0;
                    const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                        product_id: jo.product_id,
                        product_name: jo.product_name,
                        quantity: jo.quantity,
                        routings: jo.routings
                    }];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    productsList.forEach((p: any) => {
                        if (p.routings) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                            p.routings.forEach((r: any) => {
                                const stepHours = (Number(r.duration_hours) || 0) * Number(p.quantity);
                                total += Math.max(1, Math.ceil(stepHours / 8));
                            });
                        }
                    });
                    return total || 1;
                })();

                const currentAssigned = jo.assignedPersonnel || [];

                return (
                    <div key={jo.jo_id} className="border rounded-xl bg-card p-5 shadow-sm space-y-4">
                        {/* Top Card Bar */}
                        <div className="flex justify-between items-start border-b pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-foreground text-sm">{jo.jo_id}</span>
                                    {jo.is_batched ? (
                                        <span className="inline-flex items-center gap-0.5 bg-primary/10 text-primary text-[9px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                                            <Merge className="h-2.5 w-2.5" />
                                            Batched Run
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground font-semibold">Ref SO: {jo.order_no}</span>
                                    )}
                                </div>
                                {jo.products && jo.products.length > 1 ? (
                                    <div className="mt-2 space-y-1 pl-3 border-l-2 border-primary/30">
                                        <span className="text-[9px] text-muted-foreground font-extrabold uppercase block tracking-wider">Products in this Run:</span>
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        {jo.products.map((p: any, pIdx: number) => (
                                            <div key={pIdx} className="text-[11px] text-foreground flex items-center gap-4 font-semibold">
                                                <span>• {p.product_name}</span>
                                                <span className="text-primary text-[10px] ml-auto font-bold">{p.quantity ? Number(p.quantity) : 0} PCS</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <h4 className="text-xs font-bold text-muted-foreground mt-1">Product: <span className="text-foreground">{jo.product_name}</span></h4>
                                )}
                                {jo.is_batched && (
                                    <p className="text-[9px] text-muted-foreground mt-0.5 font-medium">Consolidated Sales Orders: <span className="text-foreground font-bold">{jo.order_no}</span></p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    jo.status === "Proceed"
                                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                        : jo.status === "Ongoing"
                                        ? "bg-sky-500/10 text-sky-600 border border-sky-500/20"
                                        : jo.status === "Finished"
                                        ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-extrabold"
                                        : jo.status === "Shortage"
                                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                                        : jo.status === "On Hold"
                                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                        : jo.status === "Cancelled"
                                        ? "bg-destructive/10 text-destructive border border-destructive/20"
                                        : "bg-muted text-muted-foreground border"
                                }`}>
                                    {jo.status === "Proceed" 
                                        ? "Proceed (Good to Go)" 
                                        : jo.status === "Ongoing" 
                                        ? "Ongoing (Production)" 
                                        : jo.status === "Finished" 
                                        ? "Finished & QA Passed" 
                                        : jo.status === "Shortage" 
                                        ? "Shortage Halted" 
                                        : jo.status === "On Hold" 
                                        ? "On Hold" 
                                        : jo.status === "Cancelled" 
                                        ? "Cancelled" 
                                        : "Draft (Pending Stock Check)"
                                    }
                                </span>
                                <button
                                    onClick={() => handleDeleteJO(jo.jo_id)}
                                    className="text-muted-foreground hover:text-destructive text-xs font-semibold"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>

                        {/* Details section */}
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-[11px] bg-muted/5 p-3 rounded-lg border">
                            <div>
                                <span className="text-muted-foreground font-bold block uppercase text-[9px]">Target Branch</span>
                                <span className="font-bold text-foreground text-[10px]">
                                    {branches.find(b => Number(b.id) === Number(jo.branch_id))?.branch_name || `ID: ${jo.branch_id || "N/A"}`}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground font-bold block uppercase text-[9px]">Build Qty</span>
                                <span className="font-extrabold text-foreground">{jo.quantity} PCS</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground font-bold block uppercase text-[9px]">Target Due Date</span>
                                <span className="font-bold text-foreground">{jo.due_date}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground font-bold block uppercase text-[9px]">BOM Version</span>
                                <span className="font-bold text-primary">{jo.bom ? `v${jo.bom.version} (${jo.bom.bom_name})` : "Not Exploded"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground font-bold block uppercase text-[9px]">Routing Hours</span>
                                <span className="font-bold text-primary">{totalHours > 0 ? `${(totalHours * jo.quantity).toFixed(1)} hrs` : "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground font-bold block uppercase text-[9px]">Suggested Manpower</span>
                                <span className="font-extrabold text-primary flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {suggestedManpower} Workers
                                </span>
                            </div>
                        </div>

                        {/* Daily runs breakdown section */}
                        {jo.dailyBreakdown && jo.dailyBreakdown.length > 0 && (
                            <div className="mt-3 border-t border-slate-800/80 pt-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                        Daily Production Runs Breakdown
                                    </span>
                                    {jo.shiftOption && (
                                        <span className="text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">
                                            {jo.shiftOption === "8" ? "Single Shift (8h)" : jo.shiftOption === "16" ? "Double Shift (16h)" : "Triple Shift (24h)"}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                    {jo.dailyBreakdown.map((run: any) => (
                                        <div 
                                            key={run.day} 
                                            className="bg-slate-950/20 border border-slate-800/80 p-2.5 rounded-xl text-[10px] flex flex-col gap-1.5 hover:border-slate-700/80 transition-colors"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-extrabold text-primary">Day {run.day}</span>
                                                <span className={`text-[8px] border px-1.5 py-0.2 rounded font-bold uppercase ${
                                                    run.status === "Finished" || run.status === "Completed"
                                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                        : run.status === "Ongoing" || run.status === "In Progress"
                                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                        : "bg-slate-800 text-muted-foreground border-slate-700"
                                                }`}>
                                                    {run.status}
                                                </span>
                                            </div>
                                            <div className="text-muted-foreground font-semibold space-y-1">
                                                <div className="flex justify-between">
                                                    <span>{run.date}</span>
                                                    <span className="font-bold text-foreground">Target: {run.quantity.toLocaleString()}</span>
                                                </div>
                                                {(run.status === "Finished" || run.status === "Completed") && (
                                                    <div className="flex justify-between items-center border-t border-slate-800/40 pt-1 text-[9.5px]">
                                                        <span className="text-muted-foreground">Yielded:</span>
                                                        {(() => {
                                                            const actual = run.actual_yield ?? run.quantity;
                                                            const target = run.quantity;
                                                            const diff = actual - target;
                                                            
                                                            if (diff < 0) {
                                                                return (
                                                                    <span className="font-extrabold text-rose-500">
                                                                        {actual.toLocaleString()} ({diff.toLocaleString()})
                                                                    </span>
                                                                );
                                                            } else if (diff > 0) {
                                                                return (
                                                                    <span className="font-extrabold text-sky-500">
                                                                        {actual.toLocaleString()} (+{diff.toLocaleString()})
                                                                    </span>
                                                                );
                                                            } else {
                                                                return (
                                                                    <span className="font-extrabold text-emerald-500">
                                                                        {actual.toLocaleString()}
                                                                    </span>
                                                                );
                                                            }
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Allocation Check Action */}
                        {jo.status === "Draft" && (
                            <button
                                disabled={checkingInventoryId === jo.jo_id}
                                onClick={() => handleRunFIFOInventoryCheck(jo)}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-all cursor-pointer"
                            >
                                {checkingInventoryId === jo.jo_id ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Exploding Consolidated BOM & Allocating FIFO Stock...
                                    </>
                                ) : (
                                    <>
                                        <Layers className="h-4 w-4" />
                                        Run Consolidated BOM FIFO Allocation & Inventory Fork Check
                                    </>
                                )}
                            </button>
                        )}

                        {/* Exploded Allocation Results Table */}
                        {jo.allocationResults && (
                            <div className="space-y-2 border-t pt-3">
                                <h5 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">BOM FIFO Raw Materials Allocation</h5>
                                <div className="border rounded-lg overflow-hidden bg-card text-xs">
                                    <table className="w-full border-collapse text-left">
                                        <thead className="bg-muted/40 border-b">
                                            <tr>
                                                <th className="p-2 font-bold text-muted-foreground">Raw Material Component</th>
                                                <th className="p-2 text-right font-bold text-muted-foreground">Required</th>
                                                <th className="p-2 text-right font-bold text-muted-foreground">Allocated</th>
                                                <th className="p-2 text-right font-bold text-muted-foreground">Deficit</th>
                                                <th className="p-2 font-bold text-muted-foreground">FIFO Lot Allocations</th>
                                                <th className="p-2 text-center font-bold text-muted-foreground">Planning Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {jo.allocationResults.map((alloc, idx) => (
                                                <tr key={idx} className="hover:bg-muted/10">
                                                    <td className="p-2 font-medium text-foreground">{alloc.component_name}</td>
                                                    <td className="p-2 text-right font-semibold text-muted-foreground">{alloc.required.toFixed(2)}</td>
                                                    <td className="p-2 text-right font-bold text-emerald-600">{alloc.available.toFixed(2)}</td>
                                                    <td className={`p-2 text-right font-bold ${alloc.deficit > 0 ? "text-destructive" : "text-emerald-600"}`}>
                                                        {alloc.deficit > 0 ? alloc.deficit.toFixed(2) : "0.00"}
                                                    </td>
                                                    <td className="p-2 text-[10px] text-muted-foreground max-w-xs">
                                                        {alloc.batches.length > 0 ? (
                                                            <div className="space-y-0.5">
                                                                {alloc.batches.map((b, bidx) => (
                                                                    <div key={bidx}>
                                                                        Lot: <strong className="text-foreground">{b.lot_number}</strong> ({b.quantity.toFixed(1)} allocated, Exp: {b.expiration_date})
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-destructive font-semibold">No Expiring FIFO Lots Available</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        {alloc.deficit > 0 ? (
                                                            alloc.has_bom ? (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span className="inline-flex items-center bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded border border-primary/20">
                                                                        Internally Producible
                                                                    </span>
                                                                    <button
                                                                        onClick={() => {
                                                                            const base = Number(alloc.base_quantity || 1);
                                                                            const suggested = Math.max(base, Math.ceil(alloc.deficit / base) * base);
                                                                            openPrereqModal(jo, alloc.component_name, alloc.component_product_id!, suggested);
                                                                        }}
                                                                        className="bg-primary text-primary-foreground font-bold hover:bg-primary/95 text-[9px] px-2 py-0.5 rounded shadow-sm transition-all cursor-pointer"
                                                                    >
                                                                        Create JO ({Math.max(Number(alloc.base_quantity || 1), Math.ceil(alloc.deficit / Number(alloc.base_quantity || 1)) * Number(alloc.base_quantity || 1))} PCS)
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center bg-amber-500/10 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20">
                                                                    Procure Externally
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="inline-flex items-center bg-emerald-500/10 text-emerald-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                                Fully Covered
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Shortage Path / Procurement trigger */}
                        {jo.status === "Shortage" && (() => {
                            const defaultSelectedIds = jo.allocationResults
                                ?.filter(alloc => alloc.deficit > 0 && !alloc.has_bom)
                                .map(alloc => alloc.component_product_id || 0) || [];

                            const currentProcInput = procurementInputs[jo.jo_id] || {
                                supplierId: suppliers[0]?.supplier_id?.toString() || suppliers[0]?.id?.toString() || "",
                                poNumber: `PO-${jo.jo_id}-${Math.floor(1000 + Math.random() * 9000)}`,
                                baseCosts: {},
                                selectedComponentIds: defaultSelectedIds
                            };

                            const selectedIds = currentProcInput.selectedComponentIds ?? defaultSelectedIds;

                            const currentQaInput = qaInputs[jo.jo_id] || {
                                inspectorId: users[0]?.id?.toString() || "",
                                lineItems: {}
                            };

                            return (
                                <div className="border rounded-lg p-4 bg-amber-500/5 border-amber-500/10 space-y-4">
                                    <div className="flex items-center justify-between border-b border-amber-500/10 pb-3">
                                        <div className="flex gap-2 text-amber-600">
                                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <h5 className="text-[11px] font-extrabold uppercase">Procurement Fork Required</h5>
                                                <p className="text-[10px]">Production halted. Consolidated shortages must be requested, approved, and QA inspected.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={checkingInventoryId === jo.jo_id}
                                                onClick={() => handleRunFIFOInventoryCheck(jo)}
                                                className="inline-flex items-center gap-1.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded border border-amber-600/30 transition-all cursor-pointer"
                                            >
                                                {checkingInventoryId === jo.jo_id ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        Re-checking...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Cpu className="h-3 w-3" />
                                                        Re-check Stock Allocation
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                disabled={checkingInventoryId === jo.jo_id}
                                                onClick={async () => {
                                                    if (confirm("Are you sure you want to bypass the shortage block and release this Job Order to the shop floor? This allows daily production runs to start using existing inventory.")) {
                                                        try {
                                                            await modifyJobOrder(jo.jo_id, { status: "Proceed" });
                                                            toast.success("Job Order successfully released to production!");
                                                        } catch (err: any) {
                                                            toast.error("Failed to release Job Order.");
                                                        }
                                                    }
                                                }}
                                                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer border-none shadow-sm font-sans"
                                            >
                                                <Play className="h-3 w-3 fill-white" />
                                                Release to Production Anyway
                                            </button>
                                        </div>
                                    </div>

                                    {jo.procurementStatus === "Idle" && (
                                        <div className="space-y-3 p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                            <h6 className="text-[11px] font-bold text-amber-700 uppercase">Create Purchase Order for Deficiencies</h6>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Select Supplier</label>
                                                    <select
                                                        className="w-full bg-background border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        value={currentProcInput.supplierId}
                                                        onChange={(e) => updateProcInput(jo.jo_id, { supplierId: e.target.value })}
                                                    >
                                                        <option value="">-- Choose Supplier --</option>
                                                        {suppliers.map(s => (
                                                            <option key={s.supplier_id || s.id} value={s.supplier_id || s.id}>{s.supplier_name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">PO Number / Ref</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-background border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                        value={currentProcInput.poNumber}
                                                        onChange={(e) => updateProcInput(jo.jo_id, { poNumber: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* Shortage Item pricing table */}
                                            <div className="mt-2 border rounded overflow-hidden">
                                                <table className="w-full text-[11px] text-left">
                                                    <thead className="bg-muted text-muted-foreground font-bold uppercase text-[9px]">
                                                        <tr>
                                                            <th className="p-2 w-12 text-center">Procure?</th>
                                                            <th className="p-2">Material SKU</th>
                                                            <th className="p-2 text-right">Deficit</th>
                                                            <th className="p-2 text-right w-24">Est. Cost (PHP)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {jo.allocationResults?.filter(alloc => alloc.deficit > 0).map(alloc => {
                                                            const compId = alloc.component_product_id || 0;
                                                            const costVal = currentProcInput.baseCosts[compId] ?? "10.0";
                                                            const isChecked = selectedIds.includes(compId);
                                                            return (
                                                                <tr key={compId} className="hover:bg-muted/10">
                                                                    <td className="p-2 text-center">
                                                                        <input 
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={(e) => {
                                                                                const updatedSelected = e.target.checked
                                                                                    ? [...selectedIds, compId]
                                                                                    : selectedIds.filter(id => id !== compId);
                                                                                updateProcInput(jo.jo_id, { selectedComponentIds: updatedSelected });
                                                                            }}
                                                                            className="rounded text-amber-600 focus:ring-amber-550 cursor-pointer"
                                                                        />
                                                                    </td>
                                                                    <td className="p-2 font-medium text-foreground">{alloc.component_name}</td>
                                                                    <td className="p-2 text-right font-bold text-amber-600">{Number(alloc.deficit).toLocaleString()}</td>
                                                                    <td className="p-2 text-right">
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            className="w-20 bg-background border rounded text-right px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                                            value={costVal}
                                                                            onChange={(e) => {
                                                                                const updatedCosts = { ...currentProcInput.baseCosts, [compId]: e.target.value };
                                                                                updateProcInput(jo.jo_id, { baseCosts: updatedCosts });
                                                                            }}
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    disabled={procurementLoadingId === jo.jo_id || !currentProcInput.supplierId || !currentProcInput.poNumber || selectedIds.length === 0}
                                                    onClick={async () => {
                                                        const lineItems = jo.allocationResults
                                                            ?.filter(alloc => alloc.deficit > 0 && selectedIds.includes(alloc.component_product_id || 0))
                                                            .map(alloc => {
                                                                const compId = alloc.component_product_id || 0;
                                                                const costVal = parseFloat(currentProcInput.baseCosts[compId] || "10.0");
                                                                return {
                                                                    product_id: compId,
                                                                    quantity_ordered: alloc.deficit,
                                                                    base_unit_cost_php: isNaN(costVal) ? 10.0 : costVal
                                                                };
                                                            }) || [];

                                                        if (lineItems.length === 0) return;

                                                        await handleTriggerProcurement(
                                                            jo.jo_id,
                                                            parseInt(currentProcInput.supplierId),
                                                            currentProcInput.poNumber,
                                                            lineItems
                                                        );
                                                    }}
                                                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer border-none"
                                                >
                                                    {procurementLoadingId === jo.jo_id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <>
                                                            Create PO & Transition to ORDERED
                                                            <ArrowRight className="h-3 w-3" />
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {jo.procurementStatus && jo.procurementStatus !== "Idle" && (
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase">
                                                <span>Procurement Status: </span>
                                                <span className="text-amber-600 font-extrabold">{jo.procurementStatus}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {["Ordered", "Approved", "En Route", "Received QA"].map((step, sIdx) => {
                                                    const isActive = jo.procurementStatus === step;
                                                    const isPassed = ["Ordered", "Approved", "En Route", "Received QA"].indexOf(jo.procurementStatus || "") >= sIdx;
                                                    return (
                                                        <div key={step} className="flex items-center gap-1">
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                                                isActive 
                                                                    ? "bg-amber-500 text-white border-amber-500" 
                                                                    : isPassed 
                                                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                                                                    : "bg-muted text-muted-foreground border-transparent"
                                                            }`}>
                                                                {step}
                                                            </span>
                                                            {sIdx < 3 && <span className="text-muted-foreground/30 text-[9px]">➔</span>}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {jo.procurementStatus === "Ordered" && (
                                                <div className="pt-2">
                                                    <p className="text-[10px] text-muted-foreground mb-2">Purchase order is created. Confirm order approval with the supplier.</p>
                                                    <button
                                                        disabled={procurementLoadingId === jo.jo_id}
                                                        onClick={() => handleProgressProcurement(jo, "Approve")}
                                                        className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer border-none"
                                                    >
                                                        {procurementLoadingId === jo.jo_id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <>
                                                                Approve PO
                                                                <CheckCircle className="h-3 w-3" />
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}

                                            {jo.procurementStatus === "Approved" && (
                                                <div className="pt-2">
                                                    <p className="text-[10px] text-muted-foreground mb-2">PO approved. Awaiting dispatch. Ship materials to start freight transit.</p>
                                                    <button
                                                        disabled={procurementLoadingId === jo.jo_id}
                                                        onClick={() => handleProgressProcurement(jo, "Ship")}
                                                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer border-none"
                                                    >
                                                        {procurementLoadingId === jo.jo_id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <>
                                                                Dispatch Freight / Ship
                                                                <ArrowRight className="h-3 w-3" />
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}

                                            {jo.procurementStatus === "En Route" && (
                                                <div className="space-y-3 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10 mt-3">
                                                    <h6 className="text-[11px] font-bold text-emerald-700 uppercase">QA Inspection & Stock receiving</h6>
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">QA Inspector</label>
                                                            <select
                                                                className="w-full bg-background border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                value={currentQaInput.inspectorId}
                                                                onChange={(e) => updateQaInput(jo.jo_id, { inspectorId: e.target.value })}
                                                            >
                                                                <option value="">-- Choose Inspector --</option>
                                                                {users.map(u => (
                                                                    <option key={u.user_id} value={u.user_id}>{u.user_fname} {u.user_lname}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Material line receiving items */}
                                                    <div className="border rounded overflow-hidden mt-2">
                                                        <table className="w-full text-[11px] text-left">
                                                            <thead className="bg-muted text-muted-foreground font-bold uppercase text-[9px]">
                                                                <tr>
                                                                    <th className="p-2">Material SKU</th>
                                                                    <th className="p-2 text-right">Deficit</th>
                                                                    <th className="p-2">Lot Number</th>
                                                                    <th className="p-2 w-28">Exp Date</th>
                                                                    <th className="p-2 text-right w-16">Passed</th>
                                                                    <th className="p-2 text-right w-16">Rejected</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {jo.allocationResults?.filter(alloc => alloc.deficit > 0 && !alloc.has_bom).map(alloc => {
                                                                    const compId = alloc.component_product_id || 0;
                                                                    
                                                                    const matchProduct = products.find(p => Number(p.product_id) === Number(compId));
                                                                    const shelfLifeDays = matchProduct?.product_shelf_life;
                                                                    let defaultExpDate = "N/A";
                                                                    if (shelfLifeDays && !isNaN(Number(shelfLifeDays)) && Number(shelfLifeDays) > 0) {
                                                                        const d = new Date();
                                                                        d.setDate(d.getDate() + Number(shelfLifeDays));
                                                                        defaultExpDate = d.toISOString().split('T')[0];
                                                                    }

                                                                    const itemInput = currentQaInput.lineItems[compId] || {
                                                                        lotNumber: `LOT-${jo.jo_id}-${compId}-${Math.floor(1000 + Math.random() * 9000)}`,
                                                                        expirationDate: defaultExpDate,
                                                                        quantityReceived: alloc.deficit.toString(),
                                                                        quantityRejected: "0",
                                                                        qaStatus: "Passed"
                                                                    };

                                                                    // Update line item in inputs helper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                                    const setItemField = (field: string, value: any) => {
                                                                        const currentLine = currentQaInput.lineItems[compId] || {
                                                                            lotNumber: `LOT-${jo.jo_id}-${compId}-${Math.floor(1000 + Math.random() * 9000)}`,
                                                                            expirationDate: defaultExpDate,
                                                                            quantityReceived: alloc.deficit.toString(),
                                                                            quantityRejected: "0",
                                                                            qaStatus: "Passed"
                                                                        };
                                                                        const updatedLines = {
                                                                            ...currentQaInput.lineItems,
                                                                            [compId]: { ...currentLine, [field]: value }
                                                                        };
                                                                        updateQaInput(jo.jo_id, { lineItems: updatedLines });
                                                                    };

                                                                    return (
                                                                        <tr key={compId} className="hover:bg-muted/10">
                                                                            <td className="p-2 font-medium text-foreground">{alloc.component_name}</td>
                                                                            <td className="p-2 text-right font-bold text-amber-600">{Number(alloc.deficit).toLocaleString()}</td>
                                                                            <td className="p-2">
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-full bg-background border rounded px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                                    value={itemInput.lotNumber}
                                                                                    onChange={(e) => setItemField("lotNumber", e.target.value)}
                                                                                />
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <input
                                                                                    type="text"
                                                                                    placeholder="YYYY-MM-DD or N/A"
                                                                                    className="w-full bg-background border rounded px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                                    value={itemInput.expirationDate}
                                                                                    onChange={(e) => setItemField("expirationDate", e.target.value)}
                                                                                />
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-16 bg-background border rounded text-right px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                                    value={itemInput.quantityReceived}
                                                                                    onChange={(e) => setItemField("quantityReceived", e.target.value)}
                                                                                />
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-16 bg-background border rounded text-right px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                                    value={itemInput.quantityRejected}
                                                                                    onChange={(e) => setItemField("quantityRejected", e.target.value)}
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="flex justify-end pt-2">
                                                        <button
                                                            disabled={procurementLoadingId === jo.jo_id || !currentQaInput.inspectorId}
                                                            onClick={async () => {
                                                                const lines = jo.allocationResults
                                                                    ?.filter(alloc => alloc.deficit > 0 && !alloc.has_bom)
                                                                    .map(alloc => {
                                                                        const compId = alloc.component_product_id || 0;
                                                                        
                                                                        const matchProduct = products.find(p => Number(p.product_id) === Number(compId));
                                                                        const shelfLifeDays = matchProduct?.product_shelf_life;
                                                                        let defaultExpDate = "N/A";
                                                                        if (shelfLifeDays && !isNaN(Number(shelfLifeDays)) && Number(shelfLifeDays) > 0) {
                                                                            const d = new Date();
                                                                            d.setDate(d.getDate() + Number(shelfLifeDays));
                                                                            defaultExpDate = d.toISOString().split('T')[0];
                                                                        }

                                                                        const itemInput = currentQaInput.lineItems[compId] || {
                                                                            lotNumber: `LOT-${jo.jo_id}-${compId}-${Math.floor(1000 + Math.random() * 9000)}`,
                                                                            expirationDate: defaultExpDate,
                                                                            quantityReceived: alloc.deficit.toString(),
                                                                            quantityRejected: "0",
                                                                            qaStatus: "Passed"
                                                                        };

                                                                        const isNaVal = !itemInput.expirationDate || 
                                                                            itemInput.expirationDate.trim() === "" || 
                                                                            itemInput.expirationDate.toUpperCase() === "N/A";

                                                                        return {
                                                                            product_id: compId,
                                                                            quantity_received: parseFloat(itemInput.quantityReceived || "0"),
                                                                            quantity_rejected: parseFloat(itemInput.quantityRejected || "0"),
                                                                            lot_number: itemInput.lotNumber,
                                                                            expiration_date: isNaVal ? null : itemInput.expirationDate,
                                                                            rejection_reason: parseFloat(itemInput.quantityRejected || "0") > 0 ? "QA Reject" : null,
                                                                            qa_status: itemInput.qaStatus || "Passed"
                                                                        };
                                                                    }) || [];

                                                                await handleProgressProcurement(jo, "QA", {
                                                                    inspectorId: parseInt(currentQaInput.inspectorId),
                                                                    lineItems: lines
                                                                });
                                                            }}
                                                            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm cursor-pointer border-none"
                                                        >
                                                            {procurementLoadingId === jo.jo_id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    Approve & Receive Inventory (QA)
                                                                    <CheckCircle className="h-3 w-3" />
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Proceed Path / Routings timelines & manpower */}
                        {(jo.status === "Proceed" || jo.status === "Ongoing" || jo.status === "Finished" || jo.status === "On Hold" || jo.status === "Cancelled") && (
                            <div className="border rounded-lg p-4 bg-emerald-500/5 border-emerald-500/10 space-y-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-3">
                                    <div className="flex gap-2 text-emerald-600">
                                        <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <h5 className="text-[11px] font-extrabold uppercase">Production Execution Control</h5>
                                            <p className="text-[9px]">Track routing operations, delegate task personnel, and complete QA checks.</p>
                                        </div>
                                    </div>

                                    {/* Workflow Stage Actions */}
                                    <div className="flex items-center gap-2">
                                        {jo.status === "Proceed" && (
                                            <button
                                                onClick={() => modifyJobOrder(jo.jo_id, { status: "Ongoing" })}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm border-none cursor-pointer flex items-center gap-1.5"
                                            >
                                                <ArrowRight className="h-3.5 w-3.5" /> Start Production Workflow
                                            </button>
                                        )}

                                        {jo.status === "Ongoing" && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    onClick={() => modifyJobOrder(jo.jo_id, { status: "On Hold" })}
                                                    className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm border-none cursor-pointer"
                                                >
                                                    Pause / On Hold
                                                </button>
                                                <button
                                                    onClick={() => modifyJobOrder(jo.jo_id, { status: "Cancelled" })}
                                                    className="bg-destructive hover:bg-destructive/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm border-none cursor-pointer"
                                                >
                                                    Cancel Job Order
                                                </button>
                                                {(() => {
                                                    const productsList = jo.products && jo.products.length > 0 ? jo.products : [jo];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    const allQA = productsList.every((p: any) => 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        p.routings && p.routings.length > 0 && p.routings.every((r: any) => r.qa_status === "Passed")
                                                    );
                                                    if (allQA) {
                                                        return (
                                                            <button
                                                                onClick={() => modifyJobOrder(jo.jo_id, { status: "Finished" })}
                                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm border-none cursor-pointer flex items-center gap-1.5 animate-pulse"
                                                            >
                                                                <CheckCircle className="h-3.5 w-3.5" /> Complete Production & Finalize JO
                                                            </button>
                                                        );
                                                    }
                                                    return (
                                                        <span className="text-[9px] text-muted-foreground font-semibold italic bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                                                            Awaiting QA pass on all tasks below
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {jo.status === "On Hold" && (
                                            <button
                                                onClick={() => modifyJobOrder(jo.jo_id, { status: "Ongoing" })}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm border-none cursor-pointer"
                                            >
                                                Resume Production Workflow
                                            </button>
                                        )}

                                        {jo.status === "Finished" && (
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg border border-emerald-500/20 uppercase">
                                                    <CheckCircle className="h-3.5 w-3.5" /> Finished & QA Passed
                                                </span>
                                                <button
                                                    onClick={() => modifyJobOrder(jo.jo_id, { status: "Finished" })}
                                                    className="bg-slate-800 hover:bg-slate-700 text-foreground text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 cursor-pointer"
                                                >
                                                    Re-sync Inventory Stock
                                                </button>
                                            </div>
                                        )}

                                        {jo.status === "Cancelled" && (
                                            <span className="bg-destructive/10 text-destructive text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg border border-destructive/20 uppercase">
                                                Cancelled
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-[10px] pb-2 border-b border-emerald-500/10">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-4 w-4 text-emerald-600" />
                                        <div>
                                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Total Operations Duration</span>
                                            <span className="font-extrabold text-foreground text-xs">
                                                {(() => {
                                                    const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                                                        product_id: jo.product_id,
                                                        product_name: jo.product_name,
                                                        quantity: jo.quantity,
                                                        routings: jo.routings
                                                    }];
                                                    let sumHours = 0;
                                                    productsList.forEach(p => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        const pHours = p.routings ? p.routings.reduce((s: number, r: any) => s + (Number(r.duration_hours) || 0), 0) : 0;
                                                        sumHours += pHours * Number(p.quantity);
                                                    });
                                                    return sumHours.toFixed(1);
                                                })()} Hours
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <DollarSign className="h-4 w-4 text-emerald-600" />
                                        <div>
                                            <span className="text-muted-foreground block text-[9px] uppercase font-bold">Standard Operations Labor Cost</span>
                                            <span className="font-extrabold text-foreground text-xs">
                                                ₱{(() => {
                                                    const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                                                        product_id: jo.product_id,
                                                        product_name: jo.product_name,
                                                        quantity: jo.quantity,
                                                        routings: jo.routings
                                                    }];
                                                    let sumCost = 0;
                                                    productsList.forEach(p => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        const pCost = p.routings ? p.routings.reduce((s: number, r: any) => s + (Number(r.estimated_labor_cost) || 0), 0) : 0;
                                                        sumCost += pCost * Number(p.quantity);
                                                    });
                                                    return sumCost.toLocaleString(undefined, { minimumFractionDigits: 2 });
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {(() => {
                                        const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                                            product_id: jo.product_id,
                                            product_name: jo.product_name,
                                            quantity: jo.quantity,
                                            routings: jo.routings
                                        }];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        return productsList.map((p: any, pIdx: number) => {
                                            if (!p.routings || p.routings.length === 0) return null;
                                            return (
                                                <div key={pIdx} className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0 border-emerald-500/10">
                                                    <span className="text-[10px] font-extrabold uppercase text-primary block">
                                                        Routing Sequence: {p.product_name || jo.product_name} ({p.quantity} PCS)
                                                    </span>
                                                    <div className="flex items-stretch gap-3 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin scrollbar-thumb-slate-850 scrollbar-track-transparent">
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                        {p.routings.map((rout: any, rIdx: number) => {
                                                            const labor = Number(rout.estimated_labor_cost) || 0;
                                                            const overhead = Number(rout.estimated_overhead_cost) || 0;
                                                            const stepHours = (Number(rout.duration_hours) || 0) * Number(p.quantity);
                                                            const stepManpower = Math.max(1, Math.ceil(stepHours / 8));

                                                            const relTask = jo.routing_tasks?.find(t => Number(t.routing_id) === Number(rout.routing_id));
                                                            const taskQAStatus = relTask ? (relTask.status === "Completed" ? "Passed" : "Pending") : (rout.qa_status || "Pending");
                                                            const isCompleted = taskQAStatus === "Passed";

                                                            // QA Log parsing
                                                            const latestQaLog = relTask?.qa_logs?.[relTask.qa_logs.length - 1];
                                                            const qaPhotos = Array.isArray(latestQaLog?.photos) ? latestQaLog.photos : [];
                                                            const qaComments = latestQaLog?.comments;
                                                            const actualYield = latestQaLog?.actual_quantity;

                                                            return (
                                                                <React.Fragment key={rout.routing_id}>
                                                                    <div className="w-80 shrink-0 flex flex-col justify-between bg-slate-900/35 hover:bg-slate-900/50 border border-slate-800/80 rounded-xl p-3.5 shadow-lg relative transition-all duration-200 space-y-3 overflow-hidden">
                                                                        <div className="space-y-2.5 text-[10px]">
                                                                            <div className="flex justify-between font-bold text-foreground">
                                                                                <span className="text-[9px] text-primary font-extrabold uppercase tracking-wider">Step {rout.sequence_order}</span>
                                                                                <span className="text-muted-foreground">{rout.duration_hours} Hrs/Unit ({stepHours.toFixed(1)}h total)</span>
                                                                            </div>
                                                                            <div className="font-extrabold text-foreground text-xs min-h-[28px] flex items-center">
                                                                                {rout.operation_name}
                                                                            </div>
                                                                            <div className="flex justify-between text-muted-foreground pt-1.5 border-t border-slate-800/40">
                                                                                <span>Labor: ₱{labor.toFixed(2)} | OH: ₱{overhead.toFixed(2)}</span>
                                                                                <span className="text-primary font-bold">{stepManpower} Workers suggested</span>
                                                                            </div>
                                                                            
                                                                            {/* Operator Assignment per Task */}
                                                                            {jo.status === "Ongoing" ? (
                                                                                <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-800/40">
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1 shrink-0">
                                                                                            Assign Operator:
                                                                                            {assigningStepKeys[`${jo.jo_id}-${p.product_id}-${rout.routing_id}`] && (
                                                                                                <Loader2 className="h-2.5 w-2.5 animate-spin text-emerald-500" />
                                                                                            )}
                                                                                        </span>
                                                                                        <select
                                                                                            disabled={assigningStepKeys[`${jo.jo_id}-${p.product_id}-${rout.routing_id}`]}
                                                                                            className="bg-background border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 max-w-[140px] truncate"
                                                                                            value={rout.assigned_personnel?.id?.toString() || ""}
                                                                                            onChange={(e) => handleAssignPersonnelToTask(jo, p.product_id, rout.routing_id, e.target.value)}
                                                                                        >
                                                                                            <option value="">-- Choose Operator --</option>
                                                                                            {[...users].map(u => {
                                                                                                const workload = userWorkloads[String(u.user_id)] || 0;
                                                                                                const isOver = workload > 40;
                                                                                                const opName = (rout.operation_name || "").toLowerCase();
                                                                                                const pos = (u.user_position || "").toLowerCase();
                                                                                                const isRoleMatch = pos && opName && (opName.includes(pos) || pos.includes(opName) ||
                                                                                                    (pos.includes("welder") && opName.includes("weld")) ||
                                                                                                    (pos.includes("mixer") && opName.includes("mix")) ||
                                                                                                    (pos.includes("operator") && opName.includes("assemble")) ||
                                                                                                    (pos.includes("baker") && opName.includes("bake")) ||
                                                                                                    (pos.includes("packer") && opName.includes("pack")));
                                                                                                return { ...u, workload, isRoleMatch, isOver };
                                                                                            }).sort((a, b) => {
                                                                                                if (a.isRoleMatch && !b.isRoleMatch) return -1;
                                                                                                if (!a.isRoleMatch && b.isRoleMatch) return 1;
                                                                                                return a.workload - b.workload;
                                                                                            }).map(u => {
                                                                                                const statusStr = u.isOver ? "⚠️ OVERLOADED" : `${u.workload.toFixed(1)} hrs`;
                                                                                                const prefix = u.isRoleMatch ? "⭐ [Match] " : "";
                                                                                                return (
                                                                                                    <option key={u.user_id} value={u.user_id}>
                                                                                                        {prefix}{u.user_fname} {u.user_lname} ({u.user_position || "Operator"}) — {statusStr}
                                                                                                    </option>
                                                                                                );
                                                                                            })}
                                                                                        </select>
                                                                                    </div>
                                                                                    {rout.assigned_personnel && (
                                                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                                                            <span className="bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20 text-[9px] px-2 py-0.5 rounded leading-normal">
                                                                                                {rout.assigned_personnel.name} ({rout.assigned_personnel.position})
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-[10px] mt-2 pt-2 border-t border-slate-800/40 text-muted-foreground font-semibold flex flex-col gap-1">
                                                                                    <span>Assigned Worker:</span>
                                                                                    {rout.assigned_personnel ? (
                                                                                        <div className="flex flex-wrap gap-1">
                                                                                            <span className="bg-slate-800 text-foreground border border-slate-700 text-[9px] px-2 py-0.5 rounded leading-normal">
                                                                                                {rout.assigned_personnel.name} ({rout.assigned_personnel.position})
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="italic text-muted-foreground/50 text-[9px]">None</span>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            {/* If completed, show QA Log details */}
                                                                            {isCompleted && latestQaLog && (
                                                                                <div className="mt-2 p-2 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1 text-[9px] text-muted-foreground">
                                                                                    <div className="flex justify-between font-semibold">
                                                                                        <span>Yield: <strong className="text-foreground">{actualYield ?? p.quantity}</strong> / {p.quantity} PCS</span>
                                                                                        {latestQaLog.recorded_at && (
                                                                                            <span>{new Date(latestQaLog.recorded_at).toLocaleDateString()}</span>
                                                                                        )}
                                                                                    </div>
                                                                                    {qaComments && (
                                                                                        <div className="text-slate-300 italic border-l border-slate-700 pl-1.5 py-0.5">
                                                                                            &quot;{qaComments}&quot;
                                                                                        </div>
                                                                                    )}
                                                                                    {qaPhotos.length > 0 && (
                                                                                        <div className="flex gap-1 overflow-x-auto pt-1 scrollbar-none">
                                                                                            {qaPhotos.map((photoId: string) => (
                                                                                                <div key={photoId} className="h-8 w-8 shrink-0 rounded overflow-hidden border border-slate-850 bg-slate-900">
                                                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                                    <img
                                                                                                        src={`http://vtc:8074/assets/${photoId}`}
                                                                                                        alt="QA thumbnail"
                                                                                                        className="w-full h-full object-cover cursor-zoom-in"
                                                                                                        onClick={() => window.open(`http://vtc:8074/assets/${photoId}`, '_blank')}
                                                                                                    />
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            {/* Task Status & QA Verification */}
                                                                            {jo.status === "Ongoing" ? (
                                                                                <div className="flex items-center justify-between border-t border-slate-800/40 pt-2 mt-2">
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Task QA:</span>
                                                                                        {isCompleted ? (
                                                                                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 text-[9px] font-extrabold px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                                                                                                <CheckCircle className="h-2.5 w-2.5" /> Passed
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="bg-amber-500/10 text-amber-600 text-[9px] font-extrabold px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                                                                                                Pending
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    
                                                                                    {!isCompleted ? (
                                                                                        <button
                                                                                            onClick={() => handleVerifyQAForTask(jo, p.product_id, rout.routing_id, "Passed")}
                                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold px-2 py-1 rounded shadow-sm border-none cursor-pointer flex items-center gap-1"
                                                                                        >
                                                                                            <CheckCircle className="h-2.5 w-2.5" /> QA Pass & Complete Task
                                                                                        </button>
                                                                                    ) : (
                                                                                        <button
                                                                                            onClick={() => handleVerifyQAForTask(jo, p.product_id, rout.routing_id, "Pending")}
                                                                                            className="bg-slate-800 hover:bg-slate-700 text-muted-foreground hover:text-foreground text-[9px] font-bold px-2 py-1 rounded shadow-sm border-none cursor-pointer flex items-center gap-1"
                                                                                        >
                                                                                            Reset Task
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-800/40 text-[9px]">
                                                                                    <span className="font-bold text-muted-foreground uppercase">Task QA:</span>
                                                                                    {isCompleted ? (
                                                                                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 font-extrabold px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                                                                                            <CheckCircle className="h-2.5 w-2.5" /> QA Passed {rout.completed_at && `(at ${new Date(rout.completed_at).toLocaleString()})`}
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="bg-slate-800 text-muted-foreground font-extrabold px-2 py-0.5 rounded border border-slate-700 uppercase">
                                                                                            Not Started
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {rIdx < p.routings.length - 1 && (
                                                                        <div className="flex items-center justify-center shrink-0 self-center text-slate-700 animate-pulse px-1">
                                                                            <ArrowRight className="h-4 w-4" />
                                                                        </div>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Personnel and Payroll Section */}
                        <div className="border rounded-lg p-4 bg-slate-900/50 border-slate-700/50 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                    <Users className="h-4 w-4 text-primary" />
                                    <span>Assigned Personnel for Payroll Run</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-semibold">
                                    Requires {suggestedManpower} operators (suggested)
                                </span>
                            </div>

                            {/* Assigned badges list */}
                            <div className="flex flex-wrap gap-2">
                                {currentAssigned.length > 0 ? (
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    currentAssigned.map((u: any, uIdx: number) => (
                                        <span key={uIdx} className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-0.5 text-[10px] font-semibold text-foreground">
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            {u.user_fname} {u.user_lname} ({u.user_position || "Operator"})
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[10px] text-muted-foreground italic font-medium">No personnel assigned to this job order yet.</span>
                                )}
                            </div>

                            {/* Assignment trigger & form */}
                            {assigningJoId === jo.jo_id ? (
                                <div className="border border-slate-700 rounded-lg p-3 bg-slate-900 space-y-3">
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Select Workers to Assign</div>
                                    <div className="max-h-36 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded bg-background">
                                        {[...users].map(u => {
                                            const workload = userWorkloads[String(u.user_id)] || 0;
                                            const isOver = workload > 40;
                                            return { ...u, workload, isOver };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        }).sort((a, b) => a.workload - b.workload).map((u: any) => {
                                            const isSelected = selectedUserIds.includes(Number(u.user_id));
                                            return (
                                                <button
                                                    type="button"
                                                    key={u.user_id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedUserIds(selectedUserIds.filter(id => id !== Number(u.user_id)));
                                                        } else {
                                                            setSelectedUserIds([...selectedUserIds, Number(u.user_id)]);
                                                        }
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-[10px] flex items-center justify-between hover:bg-muted/30 text-foreground transition-colors cursor-pointer"
                                                >
                                                    <div>
                                                        <strong className="text-foreground">{u.user_fname} {u.user_lname}</strong>
                                                        <span className="text-muted-foreground ml-1.5">({u.user_position})</span>
                                                        <span className={`ml-2 px-1 py-0.5 rounded text-[8px] font-bold ${u.isOver ? "bg-destructive/20 text-destructive border border-destructive/30" : "bg-primary/10 text-primary"}`}>
                                                            {u.workload.toFixed(1)} hrs assigned
                                                        </span>
                                                    </div>
                                                    {isSelected ? (
                                                        <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                                    ) : (
                                                        <Square className="h-3.5 w-3.5 text-muted-foreground/50" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {users.length === 0 && (
                                            <div className="p-2 text-center text-muted-foreground text-[10px]">No personnel found in department.</div>
                                        )}
                                    </div>
                                    <div className="flex justify-end gap-2 text-[10px]">
                                        <button
                                            onClick={() => setAssigningJoId(null)}
                                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 font-bold text-foreground cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => {
                                                const mappedUsers = selectedUserIds.map(id => users.find(u => Number(u.user_id) === id)).filter(Boolean);
                                                handleAssignPersonnel(jo.jo_id, mappedUsers);
                                                setAssigningJoId(null);
                                            }}
                                            className="px-2.5 py-1 rounded bg-primary text-primary-foreground font-bold hover:bg-primary/90 cursor-pointer"
                                        >
                                            Save Assignments
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        setAssigningJoId(jo.jo_id);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        setSelectedUserIds(currentAssigned.map((u: any) => Number(u.id || u.user_id || u)));
                                    }}
                                    className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                                >
                                    <UserPlus className="h-3 w-3" />
                                    Assign / Edit Workers
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Prerequisite Parameters Modal */}
            {isPrereqModalOpen && prereqCompProductId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                    <Cpu className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground text-sm">Configure Prerequisite Job Order</h3>
                                    <p className="text-[10px] text-muted-foreground">Setup daily production capacity & shift parameters</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPrereqModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* SKU Info */}
                            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950/40 border border-slate-800/40 rounded-xl text-xs">
                                <div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sub-Assembly SKU</div>
                                    <div className="font-semibold text-foreground mt-0.5">{prereqCompName}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Suggested Quantity</div>
                                    <div className="font-bold text-primary mt-0.5">{prereqQty.toLocaleString()} Units</div>
                                </div>
                            </div>

                            {/* Parameter Settings */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Hourly Production Capacity (SKU Master)
                                    </label>
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={prereqCapacity}
                                        onChange={(e) => setPrereqCapacity(e.target.value)}
                                        placeholder="Units producible per hour..."
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950/20 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                    />
                                    <span className="text-[9px] text-muted-foreground block">
                                        Adjust rate. Creating the Job Order will also update this rate in the Finished Goods master.
                                    </span>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Shift Schedule Option
                                    </label>
                                    <select
                                        value={prereqShiftOption}
                                        onChange={(e) => setPrereqShiftOption(e.target.value)}
                                        className="w-full rounded-lg border border-slate-800 bg-slate-950/20 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                    >
                                        <option value="8">Single Shift (8h Run/Day)</option>
                                        <option value="16">Double Shift (16h Run/Day)</option>
                                        <option value="24">Triple Shift (24h Run/Day)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Live Stats Preview */}
                            {previewDailyBreakdown && typeof previewDailyBreakdown === "object" && (
                                <div className="space-y-3">
                                    <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/20 space-y-3">
                                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estimated Metrics</div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="p-2.5 bg-slate-950/50 border border-slate-800/40 rounded-lg">
                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">Duration</div>
                                                <div className="text-xs font-extrabold text-foreground mt-0.5">
                                                    {(previewDailyBreakdown as any).totalDays} Day{(previewDailyBreakdown as any).totalDays !== 1 ? "s" : ""}
                                                </div>
                                            </div>
                                            <div className="p-2.5 bg-slate-950/50 border border-slate-800/40 rounded-lg">
                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">Daily Output</div>
                                                <div className="text-xs font-extrabold text-primary mt-0.5">
                                                    {(previewDailyBreakdown as any).dailyRate.toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="p-2.5 bg-slate-950/50 border border-slate-800/40 rounded-lg">
                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">Rate / Hour</div>
                                                <div className="text-xs font-extrabold text-emerald-600 mt-0.5">
                                                    {Number(prereqCapacity) || 0}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Daily Breakdown Day-by-Day scrollable list */}
                                    {((previewDailyBreakdown as any).breakdown || []).length > 0 && (
                                        <div className="space-y-1.5">
                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                                                <span>Proposed Daily Breakdown Preview</span>
                                                {(previewDailyBreakdown as any).hasTruncated && (
                                                    <span className="text-[9px] text-amber-500 font-semibold normal-case">Showing first 100 days</span>
                                                )}
                                            </div>
                                            <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800 bg-slate-950/10">
                                                {((previewDailyBreakdown as any).breakdown || []).map((day: any) => (
                                                    <div key={day.day} className="px-4 py-2 flex items-center justify-between hover:bg-slate-900/50 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                                                            <span className="font-semibold text-foreground">Day {day.day}</span>
                                                            <span className="text-muted-foreground text-[10px]">({day.date})</span>
                                                        </div>
                                                        <div className="font-bold text-primary">{day.quantity.toLocaleString()} pcs</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50 text-xs font-bold">
                            <button
                                onClick={() => setIsPrereqModalOpen(false)}
                                className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-foreground cursor-pointer transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    const capNum = parseFloat(prereqCapacity) || 0;
                                    if (capNum <= 0) {
                                        toast.error("Please enter a valid production capacity greater than zero.");
                                        return;
                                    }
                                    if (prereqParentJo && prereqCompProductId) {
                                        await handleCreatePrerequisiteJobOrder(
                                            prereqParentJo,
                                            prereqCompName,
                                            prereqCompProductId,
                                            prereqQty,
                                            capNum,
                                            prereqShiftOption
                                        );
                                        setIsPrereqModalOpen(false);
                                    }
                                }}
                                className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer transition-colors flex items-center gap-1.5"
                            >
                                Confirm and Create Job Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
