import React, { useState, useEffect } from "react";
import { X, CheckCircle2, ShieldAlert, Package, Calendar, Tag, Trash2, Camera, AlertCircle, FileText, Loader2 } from "lucide-react";
import { JobOrder, QALog } from "../types";

interface RoutingTask {
    id: number;
    name: string;
    sequence_order: number;
    status: string;
    requires_qa?: boolean;
}

interface ProductItem {
    product_id: number | string;
    product_name: string;
    quantity: number;
}

interface JobOrderQAAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    jo: JobOrder | null;
    qaHistory: QALog[];
    submittingAudit: boolean;
    releasingGoods: boolean;
    handleVerifyQATask: (
        taskId: number,
        productId: number,
        expectedQty: number,
        actualQty: number,
        comments: string,
        photos: string[]
    ) => Promise<void>;
    handleStartRoutingTask: (taskId: number) => Promise<void>;
    handleReleaseGoods: (
        yieldQties: Record<number, number>,
        lotNumbers: Record<number, string>,
        expiryDates: Record<number, string>
    ) => Promise<void>;
}

const MOCK_PHOTOS = [
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=60", // Lab inspection
    "https://images.unsplash.com/photo-1581091870622-0a37e89104de?w=500&auto=format&fit=crop&q=60", // Factory equipment
    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=60", // Quality control
    "https://images.unsplash.com/photo-1581091226033-d5c48150db21?w=500&auto=format&fit=crop&q=60"  // Packaging line
];

export function JobOrderQAAuditModal({
    isOpen,
    onClose,
    jo,
    qaHistory,
    submittingAudit,
    releasingGoods,
    handleVerifyQATask,
    handleStartRoutingTask,
    handleReleaseGoods
}: JobOrderQAAuditModalProps) {
    // Current task verification form state
    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const [expectedQty, setExpectedQty] = useState<number>(0);
    const [actualQty, setActualQty] = useState<number>(0);
    const [comments, setComments] = useState("");
    const [photos, setPhotos] = useState<string[]>([]);
    
    // Finished Goods Release state
    const [yieldQties, setYieldQties] = useState<Record<number, number>>({});
    const [lotNumbers, setLotNumbers] = useState<Record<number, string>>({});
    const [expiryDates, setExpiryDates] = useState<Record<number, string>>({});

    const handleCompleteNonQATask = async (task: RoutingTask) => {
        if (!jo) return;
        await handleVerifyQATask(
            task.id,
            jo.product_id,
            jo.quantity,
            jo.quantity,
            "Stage completed on shopfloor (No QA gate required).",
            []
        );
    };

    // Prep products list
    const productsList = jo?.products && jo.products.length > 0 
        ? jo.products 
        : jo 
            ? [{
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity
            }] 
            : [];

    // Pre-populate release states when JO becomes ready for release
    useEffect(() => {
        if (!jo) return;
        const initialYields: Record<number, number> = {};
        const initialLots: Record<number, string> = {};
        const initialExpirations: Record<number, string> = {};
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const innerProductsList = jo.products && jo.products.length > 0 
            ? jo.products 
            : [{
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity
            }];

        innerProductsList.forEach((p: ProductItem) => {
            const pId = Number(p.product_id);
            // Default yield is original quantity
            initialYields[pId] = p.quantity;
            // Default lot is LOT-QA-[JO_ID]-[PROD_ID]
            initialLots[pId] = `LOT-QA-${jo.jo_id}-${pId}`;
            // Expiry date is 1 year from now
            initialExpirations[pId] = oneYearFromNow;
        });

        setTimeout(() => {
            setYieldQties(initialYields);
            setLotNumbers(initialLots);
            setExpiryDates(initialExpirations);
        }, 0);
    }, [jo]);

    if (!isOpen || !jo) return null;

    const routingTasks = [...(jo.routing_tasks || jo.routingTasks || [])].sort((a: RoutingTask, b: RoutingTask) => a.sequence_order - b.sequence_order);
    
    // Determine overall completion
    const allTasksCompleted = routingTasks.length > 0 && routingTasks.every(t => t.status === "Completed");

    const handleSelectTaskForAudit = (task: RoutingTask) => {
        setEditingTaskId(task.id);
        // Default expected qty to the JO quantity or previous stage actual yield if we want,
        // but default to JO quantity for ease.
        setExpectedQty(jo.quantity);
        setActualQty(jo.quantity);
        setComments("");
        setPhotos([]);
    };

    const handleSimulatePhoto = () => {
        const randomPhoto = MOCK_PHOTOS[Math.floor(Math.random() * MOCK_PHOTOS.length)];
        if (!photos.includes(randomPhoto)) {
            setPhotos([...photos, randomPhoto]);
        }
    };

    const handleRemovePhoto = (url: string) => {
        setPhotos(photos.filter(p => p !== url));
    };

    const submitTaskAudit = async (task: RoutingTask) => {
        if (actualQty > expectedQty) {
            alert("Passed quantity cannot exceed expected quantity.");
            return;
        }
        await handleVerifyQATask(
            task.id,
            jo.product_id,
            expectedQty,
            actualQty,
            comments,
            photos
        );
        setEditingTaskId(null);
    };

    const submitRelease = async () => {
        await handleReleaseGoods(yieldQties, lotNumbers, expiryDates);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-card border rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b p-4 bg-muted/30">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-foreground">JO QA Clearance & Inspection</h3>
                            <p className="text-[10px] font-bold text-muted-foreground">
                                Job Order: <span className="text-foreground font-black">{jo.jo_id}</span> • Product: <span className="text-foreground font-black">{jo.product_name}</span>
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-4.5 w-4.5" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Routing Stages Flow */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h4 className="text-[11px] font-extrabold text-foreground uppercase tracking-wider">Production Routing Tasks & QA Gates</h4>
                            <span className="text-[10px] text-muted-foreground font-bold">In-sequence completion required</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Sequence checklist */}
                            <div className="space-y-3">
                                {routingTasks.map((task, idx) => {
                                    // Sequence constraint: task can be inspected if it is the first or if previous is completed
                                    const isFirst = idx === 0;
                                    const previousCompleted = isFirst ? true : routingTasks[idx - 1].status === "Completed";
                                    const isLocked = !previousCompleted && task.status !== "Completed";
                                    
                                    // Match historic log if completed
                                    const logEntry = qaHistory.find(log => {
                                        const logTaskId = typeof log.task_id === "object" ? log.task_id?.jo_route_id : log.task_id;
                                        return Number(logTaskId) === Number(task.id);
                                    });

                                    return (
                                        <div 
                                            key={task.id} 
                                            className={`p-3.5 border rounded-xl transition-all ${
                                                task.status === "Completed"
                                                    ? "bg-emerald-500/5 border-emerald-500/20"
                                                    : isLocked
                                                    ? "bg-muted/30 border-muted opacity-60 cursor-not-allowed"
                                                    : "bg-card border-primary/20 shadow-xs hover:border-primary/40"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <span className={`text-[10px] font-black h-5.5 w-5.5 flex items-center justify-center rounded-lg ${
                                                        task.status === "Completed"
                                                            ? "bg-emerald-500 text-white"
                                                            : "bg-muted text-muted-foreground"
                                                    }`}>
                                                        {task.sequence_order}
                                                    </span>
                                                    <div>
                                                        <span className="text-xs font-bold text-foreground block leading-tight">
                                                            {task.name}
                                                        </span>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {task.requires_qa && (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                                                    Requires QA
                                                                </span>
                                                            )}
                                                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                                task.status === "Completed"
                                                                    ? "text-emerald-500"
                                                                    : task.status === "In Progress"
                                                                    ? "text-sky-500"
                                                                    : "text-muted-foreground"
                                                            }`}>
                                                                {task.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action for task */}
                                                {!isLocked && task.status !== "Completed" && (
                                                    task.status === "Pending" ? (
                                                        <button
                                                            disabled={submittingAudit}
                                                            onClick={() => handleStartRoutingTask(task.id)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-60 disabled:cursor-wait text-white text-[10px] font-bold transition-all shadow-xs inline-flex items-center gap-1"
                                                        >
                                                            {submittingAudit ? <><Loader2 className="h-3 w-3 animate-spin" /> Starting...</> : "Start Stage"}
                                                        </button>
                                                    ) : task.requires_qa ? (
                                                        <button
                                                            disabled={submittingAudit}
                                                            onClick={() => handleSelectTaskForAudit(task)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/95 disabled:opacity-60 transition-all shadow-xs"
                                                        >
                                                            Record Audit
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled={submittingAudit}
                                                            onClick={() => handleCompleteNonQATask(task)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-wait text-white text-[10px] font-bold transition-all shadow-xs inline-flex items-center gap-1"
                                                        >
                                                            {submittingAudit ? <><Loader2 className="h-3 w-3 animate-spin" /> Completing...</> : "Complete Stage"}
                                                        </button>
                                                    )
                                                )}
                                            </div>

                                            {/* Historic QA log details for this stage */}
                                            {logEntry && (
                                                <div className="mt-3 pt-2.5 border-t border-dashed border-emerald-500/20 text-[10px] text-muted-foreground font-semibold space-y-1 bg-emerald-500/5 p-2 rounded-lg">
                                                    <div className="flex justify-between text-foreground">
                                                        <span>Audited Yield: <strong>{logEntry.actual_quantity} / {logEntry.expected_quantity}</strong></span>
                                                        {logEntry.deviation_quantity > 0 && (
                                                            <span className="text-rose-500 font-extrabold">-{logEntry.deviation_quantity} Scrap</span>
                                                        )}
                                                    </div>
                                                    {logEntry.comments && (
                                                        <p className="italic text-muted-foreground mt-1">&quot; {logEntry.comments} &quot;</p>
                                                    )}
                                                    {logEntry.photos && (
                                                        <div className="flex gap-1.5 overflow-x-auto pt-1.5">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img 
                                                                src={logEntry.photos} 
                                                                alt="Audit attachment" 
                                                                className="h-10 w-10 object-cover rounded-md border border-muted"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Inspection Action Form Column */}
                            <div className="border rounded-xl bg-muted/20 p-4.5">
                                {editingTaskId ? (
                                    (() => {
                                        const activeTask = routingTasks.find(t => t.id === editingTaskId)!;
                                        const deviation = Math.max(0, expectedQty - actualQty);

                                        return (
                                            <div className="space-y-4.5">
                                                <div className="flex justify-between items-center border-b pb-2 mb-2">
                                                    <h5 className="text-[11px] font-extrabold text-primary uppercase tracking-wider">
                                                        Audit Entry: {activeTask.name}
                                                    </h5>
                                                    <button 
                                                        onClick={() => setEditingTaskId(null)}
                                                        className="text-[10px] text-muted-foreground font-bold hover:text-foreground"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>

                                                {activeTask.requires_qa && (
                                                    <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl border border-indigo-500/20 text-[10px] font-medium flex gap-2">
                                                        <ShieldAlert className="h-4 w-4 shrink-0" />
                                                        <div>
                                                            <p className="font-extrabold">QA Gate Enabled</p>
                                                            <p className="mt-0.5">Please verify the input raw materials and production output specs. Record passed quantity and deviations below.</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-3.5 text-xs">
                                                    <div className="space-y-1">
                                                        <label className="font-bold text-muted-foreground">Expected Qty</label>
                                                        <input 
                                                            type="number"
                                                            value={expectedQty}
                                                            onChange={e => setExpectedQty(Math.max(0, Number(e.target.value)))}
                                                            className="w-full bg-card border rounded-lg px-3 py-1.5 text-foreground font-extrabold outline-none focus:ring-1 focus:ring-primary"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="font-bold text-muted-foreground">Passed Qty</label>
                                                        <input 
                                                            type="number"
                                                            value={actualQty}
                                                            onChange={e => setActualQty(Math.max(0, Number(e.target.value)))}
                                                            className="w-full bg-card border rounded-lg px-3 py-1.5 text-foreground font-extrabold outline-none focus:ring-1 focus:ring-primary"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Deviation Warning */}
                                                {deviation > 0 && (
                                                    <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 text-[10px] font-semibold flex items-center justify-between">
                                                        <span className="flex items-center gap-1">
                                                            <AlertCircle className="h-4 w-4" />
                                                            Scrap Yield Deficit
                                                        </span>
                                                        <span className="font-black text-xs">-{deviation} PCS</span>
                                                    </div>
                                                )}

                                                {/* Inspector Comments */}
                                                <div className="space-y-1 text-xs">
                                                    <label className="font-bold text-muted-foreground">Audit Remarks & Log Details</label>
                                                    <textarea 
                                                        value={comments}
                                                        onChange={e => setComments(e.target.value)}
                                                        placeholder="Record density observations, moisture readings, or packaging defect codes..."
                                                        rows={3}
                                                        className="w-full bg-card border rounded-lg px-3 py-2 text-foreground text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
                                                    />
                                                </div>

                                                {/* Photo attachments simulation */}
                                                <div className="space-y-2 text-xs">
                                                    <div className="flex justify-between items-center">
                                                        <label className="font-bold text-muted-foreground">Log Photo Evidences</label>
                                                        <button 
                                                            onClick={handleSimulatePhoto}
                                                            className="inline-flex items-center gap-1 text-[10px] text-primary font-bold hover:underline"
                                                        >
                                                            <Camera className="h-3.5 w-3.5" />
                                                            Simulate Cam
                                                        </button>
                                                    </div>
                                                    
                                                    {photos.length === 0 ? (
                                                        <div className="border border-dashed rounded-xl py-6 text-center text-muted-foreground/60 text-[10px] font-medium bg-card">
                                                            No photos logged. Click simulate camera to append sample.
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 flex-wrap">
                                                            {photos.map((url, idx) => (
                                                                <div key={idx} className="relative group/img h-14 w-14 border rounded-lg overflow-hidden">
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img src={url} alt="Evid" className="h-full w-full object-cover" />
                                                                    <button 
                                                                        onClick={() => handleRemovePhoto(url)}
                                                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity"
                                                                    >
                                                                        <Trash2 className="h-4.5 w-4.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Submit Task Audit */}
                                                <button
                                                    onClick={() => submitTaskAudit(activeTask)}
                                                    disabled={submittingAudit}
                                                    className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-1"
                                                >
                                                    {submittingAudit ? "Saving Stage Log..." : "Log QA Stage Pass"}
                                                </button>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                                        <FileText className="h-8 w-8 opacity-30 mb-2" />
                                        <p className="text-xs font-semibold">Select a routing stage on the left to inspect and record audits.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Finished Goods Inventory Stock Release Section */}
                    {allTasksCompleted && (
                        <div className="border border-emerald-500/30 rounded-2xl bg-emerald-500/5 p-5 space-y-4">
                            <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-3">
                                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <Package className="h-4 w-4" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">Final Finished Goods Stock Release</h4>
                                    <p className="text-[10px] text-muted-foreground">All stage gates completed. Authorize stock release into inventory ledger.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {productsList.map((prod: ProductItem) => {
                                    const pId = Number(prod.product_id);
                                    return (
                                        <div key={pId} className="bg-card border rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4.5 text-xs">
                                            <div className="md:col-span-3 font-bold text-foreground border-b pb-1.5">
                                                {prod.product_name} <span className="text-muted-foreground font-medium text-[10px]">(Target: {prod.quantity})</span>
                                            </div>
                                            
                                            {/* Yield Qty */}
                                            <div className="space-y-1">
                                                <label className="font-bold text-muted-foreground flex items-center gap-1">
                                                    Passed Yield Quantity
                                                </label>
                                                <input 
                                                    type="number"
                                                    value={yieldQties[pId] || 0}
                                                    onChange={e => {
                                                        setYieldQties({
                                                            ...yieldQties,
                                                            [pId]: Math.max(0, Number(e.target.value))
                                                        });
                                                    }}
                                                    className="w-full bg-muted/20 border rounded-lg px-3 py-1.5 text-foreground font-extrabold outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            {/* Lot Number */}
                                            <div className="space-y-1">
                                                <label className="font-bold text-muted-foreground flex items-center gap-1">
                                                    <Tag className="h-3.5 w-3.5 text-primary" />
                                                    Assigned Lot Code
                                                </label>
                                                <input 
                                                    type="text"
                                                    value={lotNumbers[pId] || ""}
                                                    onChange={e => {
                                                        setLotNumbers({
                                                            ...lotNumbers,
                                                            [pId]: e.target.value
                                                        });
                                                    }}
                                                    placeholder="LOT-X-YYY"
                                                    className="w-full bg-muted/20 border rounded-lg px-3 py-1.5 text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>

                                            {/* Expiration Date */}
                                            <div className="space-y-1">
                                                <label className="font-bold text-muted-foreground flex items-center gap-1">
                                                    <Calendar className="h-3.5 w-3.5 text-primary" />
                                                    Expiration Date
                                                </label>
                                                <input 
                                                    type="date"
                                                    value={expiryDates[pId] || ""}
                                                    onChange={e => {
                                                        setExpiryDates({
                                                            ...expiryDates,
                                                            [pId]: e.target.value
                                                        });
                                                    }}
                                                    className="w-full bg-muted/20 border rounded-lg px-3 py-1.5 text-foreground font-semibold outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Release Trigger */}
                            <div className="pt-2 flex justify-end">
                                <button
                                    onClick={submitRelease}
                                    disabled={releasingGoods}
                                    className="px-6 py-2.5 bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-1.5 disabled:opacity-60"
                                >
                                    {releasingGoods ? "Releasing Stock..." : "Approve & Release Stock to Inventory"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="border-t p-4 flex justify-between bg-muted/30">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                    >
                        Close Portal
                    </button>
                </div>
            </div>
        </div>
    );
}
