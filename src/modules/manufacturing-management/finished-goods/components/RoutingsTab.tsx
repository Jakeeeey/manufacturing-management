import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { RoutingStep, ProductOverhead, OperationType, OverheadType } from "../types";


interface RoutingsTabProps {
    editedRoutings: RoutingStep[];
    handleRoutingChange: <K extends keyof RoutingStep>(stepId: string, field: K, value: RoutingStep[K]) => void;
    addRoutingStep: () => void;
    deleteRoutingStep: (id: string) => void;
    baseRoutingCost: number;
    
    // Custom Overheads additions
    editedOverheads: ProductOverhead[];
    setEditedOverheads: React.Dispatch<React.SetStateAction<ProductOverhead[]>>;
    overheadTypes: OverheadType[];
    setOverheadTypes?: React.Dispatch<React.SetStateAction<OverheadType[]>>;
    
    // Operations additions
    operationTypes: OperationType[];
    setOperationTypes?: React.Dispatch<React.SetStateAction<OperationType[]>>;
}

export const RoutingsTab: React.FC<RoutingsTabProps> = ({
    editedRoutings,
    handleRoutingChange,
    addRoutingStep,
    deleteRoutingStep,
    baseRoutingCost,
    
    editedOverheads,
    setEditedOverheads,
    overheadTypes,
    setOverheadTypes,
    
    operationTypes,
    setOperationTypes
}) => {


    const handleCreateOperationType = async (name: string, rowId: string) => {
        try {
            const res = await fetch("/api/manufacturing/finished-goods/operations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.operation) {
                    const newOp = data.operation;
                    handleRoutingChange(rowId, "operationId", newOp.id);
                    handleRoutingChange(rowId, "name", newOp.operation_name);
                    
                    // Refresh operations types list in the parent hook
                    const refreshRes = await fetch("/api/manufacturing/finished-goods/operations");
                    if (refreshRes.ok && setOperationTypes) {
                        setOperationTypes(await refreshRes.json());
                    }
                }
            }
        } catch (e) {
            console.error("Failed to create new operation type on the fly:", e);
        }
    };

    const handleCreateOverheadType = async (name: string, rowId: string) => {
        try {
            const res = await fetch("/api/manufacturing/finished-goods/overhead-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.type) {
                    const newType = data.type;
                    updateOverheadRow(rowId, { overheadId: newType.id, overheadName: newType.overhead_name });
                    
                    // Refresh the types list in the parent hook
                    const refreshRes = await fetch("/api/manufacturing/finished-goods/overhead-types");
                    if (refreshRes.ok && setOverheadTypes) {
                        setOverheadTypes(await refreshRes.json());
                    }
                }
            }
        } catch (e) {
            console.error("Failed to create new overhead type on the fly:", e);
        }
    };

    const updateOverheadRow = (rowId: string, updates: Partial<ProductOverhead>) => {
        setEditedOverheads(prev => prev.map(o => o.id === rowId ? { ...o, ...updates } : o));
    };

    const addOverheadRow = () => {
        const newRow: ProductOverhead = {
            id: `oh-new-${Date.now()}`,
            overheadId: 0,
            overheadName: "",
            amount: 0.0
        };
        setEditedOverheads(prev => [...prev, newRow]);
    };

    const deleteOverheadRow = (rowId: string) => {
        setEditedOverheads(prev => prev.filter(o => o.id !== rowId));
    };

    const totalOverheadsCost = editedOverheads.reduce((sum, o) => sum + (o.amount || 0), 0);

    return (
        <div className="space-y-8">
            {/* Datalist for autocomplete step names */}
            <datalist id="routing-steps-datalist">
                {operationTypes.map(op => (
                    <option key={op.id} value={op.operation_name} />
                ))}
            </datalist>

            {/* SECTION 1: ROUTING STAGES */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">1. Production Stages & Routings</h2>
                        <p className="text-xs text-muted-foreground">Labor and machinery run costs needed to construct the final product.</p>
                    </div>
                    <button 
                        onClick={addRoutingStep}
                        className="inline-flex items-center gap-1 rounded-lg border bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-accent"
                    >
                        <Plus className="h-3 w-3" /> Add Stage Step
                    </button>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm min-w-[850px]">
                            <thead>
                                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                                    <th className="p-3 w-20">Seq</th>
                                    <th className="p-3">Step Name</th>
                                    <th className="p-3">Labor Flat Rate</th>
                                    <th className="p-3">Machine Rate / Hr</th>
                                    <th className="p-3">Duration (Hrs)</th>
                                    <th className="p-3 text-right">Computed Cost</th>
                                    <th className="p-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {editedRoutings.sort((a,b) => a.sequence - b.sequence).map((step, index) => {
                                    const computedCost = step.laborFlatRate + (step.machineHourlyRate * step.durationHours);
                                    
                                    return (
                                        <tr key={step.id} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                                            <td className="p-1 border-r border-muted/20 w-20 align-middle">
                                                <input 
                                                    type="number" 
                                                    value={step.sequence} 
                                                    data-index={index}
                                                    onChange={e => handleRoutingChange(step.id, "sequence", parseInt(e.target.value) || 0)}
                                                    onKeyDown={e => {
                                                        if (e.key === "ArrowDown") {
                                                            e.preventDefault();
                                                            const el = document.querySelector(`.rt-seq-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowUp") {
                                                            e.preventDefault();
                                                            const el = document.querySelector(`.rt-seq-input[data-index="${index - 1}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowRight") {
                                                            const el = document.querySelector(`.rt-name-input[data-index="${index}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        }
                                                    }}
                                                    className="rt-seq-input w-full bg-transparent border-0 focus:ring-1 focus:ring-primary focus:bg-background focus:outline-hidden py-1 px-2 text-sm text-center text-foreground rounded-sm"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-muted/20 min-w-[150px] align-middle">
                                                <input 
                                                    type="text" 
                                                    value={step.name} 
                                                    data-index={index}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        handleRoutingChange(step.id, "name", val);
                                                        const matched = operationTypes.find(o => o.operation_name.toLowerCase() === val.trim().toLowerCase());
                                                        if (matched) {
                                                            handleRoutingChange(step.id, "operationId", matched.id);
                                                            handleRoutingChange(step.id, "name", matched.operation_name);
                                                        } else {
                                                            handleRoutingChange(step.id, "operationId", undefined);
                                                        }
                                                    }}
                                                    onBlur={async (e) => {
                                                        const val = e.target.value.trim();
                                                        if (!val) return;
                                                        const matched = operationTypes.find(o => o.operation_name.toLowerCase() === val.toLowerCase());
                                                        if (!matched) {
                                                            await handleCreateOperationType(val, step.id);
                                                        }
                                                    }}
                                                    list="routing-steps-datalist"
                                                    onKeyDown={e => {
                                                        if (e.key === "ArrowDown") {
                                                            e.preventDefault();
                                                            const el = document.querySelector(`.rt-name-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowUp") {
                                                            e.preventDefault();
                                                            const el = document.querySelector(`.rt-name-input[data-index="${index - 1}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowRight") {
                                                            const el = document.querySelector(`.rt-labor-input[data-index="${index}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowLeft") {
                                                            const el = document.querySelector(`.rt-seq-input[data-index="${index}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        }
                                                    }}
                                                    className="rt-name-input w-full bg-transparent border-0 focus:ring-1 focus:ring-primary focus:bg-background focus:outline-hidden py-1 px-2.5 text-sm font-medium text-foreground rounded-sm"
                                                />
                                            </td>
                                            <td className="p-1 border-r border-muted/20 w-36 align-middle">
                                                <div className="relative flex items-center px-2">
                                                    <span className="text-xs text-muted-foreground mr-1.5 select-none font-semibold">₱</span>
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        value={step.laborFlatRate || ""} 
                                                        data-index={index}
                                                        onChange={e => handleRoutingChange(step.id, "laborFlatRate", parseFloat(e.target.value) || 0)}
                                                        onKeyDown={e => {
                                                            if (e.key === "ArrowDown") {
                                                                e.preventDefault();
                                                                const el = document.querySelector(`.rt-labor-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            } else if (e.key === "ArrowUp") {
                                                                e.preventDefault();
                                                                const el = document.querySelector(`.rt-labor-input[data-index="${index - 1}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            } else if (e.key === "ArrowRight") {
                                                                const el = document.querySelector(`.rt-machine-input[data-index="${index}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            } else if (e.key === "ArrowLeft") {
                                                                const el = document.querySelector(`.rt-name-input[data-index="${index}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            }
                                                        }}
                                                        className="rt-labor-input w-full bg-transparent border-0 focus:ring-1 focus:ring-primary focus:bg-background focus:outline-hidden py-1 px-1.5 text-sm text-foreground rounded-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </td>

                                            <td className="p-1 border-r border-muted/20 w-36 align-middle">
                                                <div className="relative flex items-center px-2">
                                                    <span className="text-xs text-muted-foreground mr-1.5 select-none">₱</span>
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        value={step.machineHourlyRate || ""} 
                                                        data-index={index}
                                                        onChange={e => handleRoutingChange(step.id, "machineHourlyRate", parseFloat(e.target.value) || 0)}
                                                        onKeyDown={e => {
                                                            if (e.key === "ArrowDown") {
                                                                e.preventDefault();
                                                                const el = document.querySelector(`.rt-machine-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            } else if (e.key === "ArrowUp") {
                                                                e.preventDefault();
                                                                const el = document.querySelector(`.rt-machine-input[data-index="${index - 1}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            } else if (e.key === "ArrowRight") {
                                                                const el = document.querySelector(`.rt-duration-input[data-index="${index}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            } else if (e.key === "ArrowLeft") {
                                                                const el = document.querySelector(`.rt-labor-input[data-index="${index}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            }
                                                        }}
                                                        className="rt-machine-input w-full bg-transparent border-0 focus:ring-1 focus:ring-primary focus:bg-background focus:outline-hidden py-1 px-1.5 text-sm text-foreground rounded-sm"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-1 border-r border-muted/20 w-28 align-middle">
                                                <input 
                                                    type="number" 
                                                    step="0.0001"
                                                    value={step.durationHours || ""} 
                                                    data-index={index}
                                                    onChange={e => handleRoutingChange(step.id, "durationHours", parseFloat(e.target.value) || 0)}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            const isLastRow = index === editedRoutings.length - 1;
                                                            if (isLastRow) {
                                                                addRoutingStep();
                                                            } else {
                                                                const el = document.querySelector(`.rt-name-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            }
                                                        } else if (e.key === "ArrowDown") {
                                                            e.preventDefault();
                                                            const el = document.querySelector(`.rt-duration-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowUp") {
                                                            e.preventDefault();
                                                            const el = document.querySelector(`.rt-duration-input[data-index="${index - 1}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowLeft") {
                                                            const el = document.querySelector(`.rt-machine-input[data-index="${index}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        }
                                                    }}
                                                    className="rt-duration-input w-full bg-transparent border-0 focus:ring-1 focus:ring-primary focus:bg-background focus:outline-hidden py-1 px-2 text-sm text-foreground rounded-sm"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="p-3 text-right font-medium text-foreground">
                                                ₱{computedCost.toFixed(2)}
                                            </td>
                                            <td className="p-1 text-center align-middle">
                                                <button 
                                                    onClick={() => deleteRoutingStep(step.id)}
                                                    className="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors inline-flex items-center justify-center"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {editedRoutings.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                            No routing stages defined. Click &quot;Add Stage Step&quot; to begin.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="flex justify-end p-2 bg-muted/20 rounded-lg">
                    <span className="text-xs font-semibold text-muted-foreground">
                        Production Routing Subtotal: <span className="text-sm font-bold text-foreground">₱{baseRoutingCost.toFixed(2)}</span>
                    </span>
                </div>
            </div>

            {/* SECTION 2: CUSTOM VARIABLE OVERHEADS */}
            <div className="space-y-4 border-t pt-6">
                <datalist id="overhead-types-datalist">
                    {overheadTypes.map(t => (
                        <option key={t.id} value={t.overhead_name} />
                    ))}
                </datalist>

                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold tracking-tight text-foreground">2. Variable Version Overheads</h2>
                        <p className="text-xs text-muted-foreground">Trucking, storage, customs SOP, brokerage fees, and other variable expenses. Press [Enter] on the last amount to add a row.</p>
                    </div>
                    <button 
                        onClick={addOverheadRow}
                        className="inline-flex items-center gap-1 rounded-lg border bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-accent"
                    >
                        <Plus className="h-3 w-3" /> Add Overhead Item
                    </button>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-xs bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm min-w-[600px] border-spacing-0">
                            <thead>
                                <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                                    <th className="p-3 border-r border-muted/20">Overhead Variable Category Name</th>
                                    <th className="p-3 w-64 border-r border-muted/20">Amount (PHP)</th>
                                    <th className="p-3 w-16 text-center"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {editedOverheads.map((item, index) => (
                                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/5 transition-colors">
                                        <td className="p-1 border-r border-muted/20 align-middle">
                                            <input 
                                                type="text"
                                                value={item.overheadName || ""}
                                                list="overhead-types-datalist"
                                                autoFocus={item.overheadName === ""}
                                                data-index={index}
                                                className="oh-name-input w-full bg-transparent border-0 focus:ring-1 focus:ring-primary focus:bg-background focus:outline-hidden py-1.5 px-2.5 text-sm font-medium text-foreground rounded-sm transition-all"
                                                placeholder="Type or select overhead..."
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    updateOverheadRow(item.id, { overheadName: val });
                                                    
                                                    const matched = overheadTypes.find(t => t.overhead_name.toLowerCase() === val.trim().toLowerCase());
                                                    if (matched) {
                                                        updateOverheadRow(item.id, { overheadId: matched.id, overheadName: matched.overhead_name });
                                                    } else {
                                                        updateOverheadRow(item.id, { overheadId: 0 });
                                                    }
                                                }}
                                                onBlur={async (e) => {
                                                    const val = e.target.value.trim();
                                                    if (!val) return;
                                                    const matched = overheadTypes.find(t => t.overhead_name.toLowerCase() === val.toLowerCase());
                                                    if (!matched) {
                                                        await handleCreateOverheadType(val, item.id);
                                                    }
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === "ArrowDown") {
                                                        e.preventDefault();
                                                        const el = document.querySelector(`.oh-name-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                        if (el) el.focus();
                                                    } else if (e.key === "ArrowUp") {
                                                        e.preventDefault();
                                                        const el = document.querySelector(`.oh-name-input[data-index="${index - 1}"]`) as HTMLInputElement;
                                                        if (el) el.focus();
                                                    } else if (e.key === "ArrowRight") {
                                                        const el = document.querySelector(`.oh-amount-input[data-index="${index}"]`) as HTMLInputElement;
                                                        if (el) el.focus();
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td className="p-1 border-r border-muted/20 align-middle">
                                            <div className="relative flex items-center px-2">
                                                <span className="text-xs text-muted-foreground select-none mr-1.5">₱</span>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={item.amount || ""} 
                                                    data-index={index}
                                                    className="oh-amount-input w-full bg-transparent border-0 focus:ring-1 focus:ring-primary focus:bg-background focus:outline-hidden py-1.5 px-1.5 text-sm font-semibold text-foreground text-left rounded-sm transition-all"
                                                    placeholder="0.00"
                                                    onChange={e => updateOverheadRow(item.id, { amount: parseFloat(e.target.value) || 0 })}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            const isLastRow = index === editedOverheads.length - 1;
                                                            if (isLastRow) {
                                                                addOverheadRow();
                                                            } else {
                                                                const el = document.querySelector(`.oh-name-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                                if (el) el.focus();
                                                            }
                                                        } else if (e.key === "ArrowDown") {
                                                            e.preventDefault();
                                                            const el = document.querySelector(`.oh-amount-input[data-index="${index + 1}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowUp") {
                                                            e.preventDefault();
                                                            const el = document.querySelector(`.oh-amount-input[data-index="${index - 1}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        } else if (e.key === "ArrowLeft") {
                                                            const el = document.querySelector(`.oh-name-input[data-index="${index}"]`) as HTMLInputElement;
                                                            if (el) el.focus();
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-1 text-center align-middle">
                                            <button 
                                                onClick={() => deleteOverheadRow(item.id)}
                                                className="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors inline-flex items-center justify-center"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {editedOverheads.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-muted-foreground">
                                            No custom overhead variables registered. Click &quot;Add Overhead Item&quot; to begin.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="flex justify-end p-2 bg-muted/20 rounded-lg">
                    <span className="text-xs font-semibold text-muted-foreground">
                        Custom Overheads Subtotal: <span className="text-sm font-bold text-foreground">₱{totalOverheadsCost.toFixed(2)}</span>
                    </span>
                </div>
            </div>
        </div>
    );
};
