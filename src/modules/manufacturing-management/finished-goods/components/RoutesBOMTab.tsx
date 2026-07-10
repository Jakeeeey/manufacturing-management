"use client";

import React from "react";
import { Plus, Trash2, Shield, Settings, DollarSign, Clock, Layers } from "lucide-react";
import { RouteStep, RouteBOMItem, OperationType, WorkCenter, QATemplate, Unit } from "../types";
import { BOMMaterialSelect } from "./BOMMaterialSelect";
import { CreatableSelect } from "./CreatableSelect";
import { Button } from "@/components/ui/button";

interface RoutesBOMTabProps {
    editedRoutes: RouteStep[];
    setEditedRoutes: React.Dispatch<React.SetStateAction<RouteStep[]>>;
    operationTypes: OperationType[];
    workCenters: WorkCenter[];
    qaTemplates: QATemplate[];
    units: Unit[];
    setHasUnsavedChanges: (val: boolean) => void;
}

export const RoutesBOMTab: React.FC<RoutesBOMTabProps> = ({
    editedRoutes,
    setEditedRoutes,
    operationTypes,
    workCenters,
    qaTemplates,
    units,
    setHasUnsavedChanges
}) => {
    const handleAddRoute = () => {
        const nextSeq = editedRoutes.length > 0
            ? Math.max(...editedRoutes.map(r => r.sequence_order)) + 1
            : 1;

        const newRoute: RouteStep = {
            route_id: -Math.floor(Math.random() * 1000000),
            version_id: 0,
            work_center_id: null,
            operation_id: null,
            sequence_order: nextSeq,
            setup_time_hours: 0,
            run_time_hours: 0,
            estimated_labor_cost: 0,
            qa_template_id: null,
            bom_items: []
        };

        setEditedRoutes(prev => [...prev, newRoute]);
        setHasUnsavedChanges(true);
    };

    const handleDeleteRoute = (routeId: number) => {
        setEditedRoutes(prev => prev.filter(r => r.route_id !== routeId));
        setHasUnsavedChanges(true);
    };

    const handleUpdateRoute = (routeId: number, field: keyof RouteStep, value: unknown) => {
        setEditedRoutes(prev => prev.map(r => r.route_id === routeId ? { ...r, [field]: value } : r));
        setHasUnsavedChanges(true);
    };

    const handleAddIngredient = (routeId: number) => {
        setEditedRoutes(prev => prev.map(r => {
            if (r.route_id !== routeId) return r;
            const newBomItem: RouteBOMItem = {
                id: -Math.floor(Math.random() * 1000000),
                route_id: routeId,
                product_id: 0,
                quantity_required: 0,
                unit_of_measurement: null,
                wastage_factor_percentage: 0,
                cost_per_unit: 0
            };
            return {
                ...r,
                bom_items: [...(r.bom_items || []), newBomItem]
            };
        }));
        setHasUnsavedChanges(true);
    };

    const handleDeleteIngredient = (routeId: number, bomItemId: number) => {
        setEditedRoutes(prev => prev.map(r => {
            if (r.route_id !== routeId) return r;
            return {
                ...r,
                bom_items: (r.bom_items || []).filter(b => b.id !== bomItemId)
            };
        }));
        setHasUnsavedChanges(true);
    };

    const handleUpdateIngredient = (routeId: number, bomItemId: number, field: keyof RouteBOMItem, value: unknown) => {
        setEditedRoutes(prev => prev.map(r => {
            if (r.route_id !== routeId) return r;
            return {
                ...r,
                bom_items: (r.bom_items || []).map(b => b.id === bomItemId ? { ...b, [field]: value } : b)
            };
        }));
        setHasUnsavedChanges(true);
    };

    const unitOptions = React.useMemo(() => {
        return units.map(u => ({
            value: u.unit_shortcut,
            label: `${u.unit_name} (${u.unit_shortcut})`
        }));
    }, [units]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium text-foreground">Routing Steps &amp; BOM Ingredients</h3>
                    <p className="text-xs text-muted-foreground">Configure the sequence of operations, setup times, work centers, and assign raw materials directly under each step.</p>
                </div>
                <Button 
                    onClick={handleAddRoute}
                    className="inline-flex items-center gap-1.5 h-9 text-xs rounded-lg"
                >
                    <Plus className="h-3.5 w-3.5" /> Add Route Step
                </Button>
            </div>

            {editedRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-dashed bg-muted/5 border-muted text-center">
                    <Layers className="h-10 w-10 text-muted-foreground opacity-40 mb-3" />
                    <h4 className="text-sm font-medium text-foreground">No route steps added yet</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">Route steps outline the physical workstations and operations required to produce this version.</p>
                    <Button onClick={handleAddRoute} variant="outline" size="sm" className="mt-4 text-xs">
                        Create First Step
                    </Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {editedRoutes.map((r, index) => {
                        const stepNum = index + 1;
                        return (
                            <div 
                                key={r.route_id}
                                className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden border-muted/50"
                            >
                                {/* Header */}
                                <div className="flex justify-between items-center px-4 py-3 bg-muted/10 border-b border-muted/50">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                                            {stepNum}
                                        </div>
                                        <h4 className="text-sm font-semibold">Route Step #{stepNum}</h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 text-xs">
                                            <span className="text-muted-foreground">Seq:</span>
                                            <input 
                                                type="number"
                                                value={r.sequence_order}
                                                onChange={(e) => handleUpdateRoute(r.route_id, "sequence_order", parseInt(e.target.value) || 0)}
                                                className="w-12 h-7 px-1.5 rounded border border-muted bg-background text-foreground text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteRoute(r.route_id)}
                                            className="h-7 w-7 text-destructive hover:bg-destructive/15 rounded-md"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Step Form Fields */}
                                <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    {/* Operation */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide flex items-center gap-1">
                                            <Settings className="h-3 w-3" /> Operation
                                        </label>
                                        <select
                                            value={r.operation_id || ""}
                                            onChange={(e) => handleUpdateRoute(r.route_id, "operation_id", e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-full h-9 px-2.5 rounded-lg border border-muted bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="">Select Operation...</option>
                                            {operationTypes.map(op => (
                                                <option key={op.id} value={op.id}>{op.operation_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Work Center */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide flex items-center gap-1">
                                            <Layers className="h-3 w-3" /> Work Station / Center
                                        </label>
                                        <select
                                            value={r.work_center_id || ""}
                                            onChange={(e) => handleUpdateRoute(r.route_id, "work_center_id", e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-full h-9 px-2.5 rounded-lg border border-muted bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="">Select Work Center...</option>
                                            {workCenters.map(wc => (
                                                <option key={wc.work_center_id} value={wc.work_center_id}>{wc.work_center_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Setup Time */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> Setup Time (Hours)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={r.setup_time_hours}
                                            onChange={(e) => handleUpdateRoute(r.route_id, "setup_time_hours", parseFloat(e.target.value) || 0)}
                                            className="w-full h-9 px-2.5 rounded-lg border border-muted bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>

                                    {/* Run Time */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> Run Time (Hours)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={r.run_time_hours}
                                            onChange={(e) => handleUpdateRoute(r.route_id, "run_time_hours", parseFloat(e.target.value) || 0)}
                                            className="w-full h-9 px-2.5 rounded-lg border border-muted bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>

                                    {/* Estimated Labor Cost */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide flex items-center gap-1">
                                            <DollarSign className="h-3 w-3" /> Labor Cost (Flat)
                                        </label>
                                        <input
                                            type="number"
                                            value={r.estimated_labor_cost}
                                            onChange={(e) => handleUpdateRoute(r.route_id, "estimated_labor_cost", parseFloat(e.target.value) || 0)}
                                            className="w-full h-9 px-2.5 rounded-lg border border-muted bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>

                                    {/* QA Template */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide flex items-center gap-1">
                                            <Shield className="h-3 w-3" /> QA Template (Checklist)
                                        </label>
                                        <select
                                            value={r.qa_template_id || ""}
                                            onChange={(e) => handleUpdateRoute(r.route_id, "qa_template_id", e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-full h-9 px-2.5 rounded-lg border border-muted bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="">No QA checklist required</option>
                                            {qaTemplates.map(qa => (
                                                <option key={qa.template_id} value={qa.template_id}>{qa.template_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Nested BOM Ingredients Table */}
                                <div className="border-t border-muted/50 p-4 bg-muted/5">
                                    <div className="flex justify-between items-center mb-3">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">BOM Ingredients Required in Step #{stepNum}</h5>
                                    </div>

                                    {(r.bom_items || []).length === 0 ? (
                                        <div className="text-center py-6 border border-dashed rounded-lg border-muted bg-card">
                                            <p className="text-xs text-muted-foreground">No ingredients linked to this routing step yet.</p>
                                            <Button 
                                                onClick={() => handleAddIngredient(r.route_id)} 
                                                variant="outline" 
                                                size="sm" 
                                                className="mt-2 h-7 text-[10px]"
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> Add First Ingredient
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-lg border border-muted/60 bg-card">
                                            <table className="w-full border-collapse text-left text-xs">
                                                <thead>
                                                    <tr className="bg-muted/10 border-b border-muted/60 text-muted-foreground font-bold">
                                                        <th className="p-2.5 w-[30%]">Material</th>
                                                        <th className="p-2.5 w-[15%]">Qty Required</th>
                                                        <th className="p-2.5 w-[15%]">UOM</th>
                                                        <th className="p-2.5 w-[12%]">Wastage %</th>
                                                        <th className="p-2.5 w-[12%]">Landed Cost</th>
                                                        <th className="p-2.5 w-[12%]">Computed Cost</th>
                                                        <th className="p-2.5 w-[6%] text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(r.bom_items || []).map((b) => {
                                                        const wastageFact = 1 - (Number(b.wastage_factor_percentage || 0) / 100);
                                                        const compCost = (Number(b.quantity_required || 0) * Number(b.cost_per_unit || 0)) / (wastageFact > 0 ? wastageFact : 1);
                                                        return (
                                                            <tr key={b.id} className="border-b border-muted/50 hover:bg-muted/5">
                                                                <td className="p-1.5 align-middle">
                                                                    <BOMMaterialSelect
                                                                        value={b.product_id || undefined}
                                                                        onSelectProduct={(prod) => {
                                                                            handleUpdateIngredient(r.route_id, b.id, "product_id", prod.product_id);
                                                                            handleUpdateIngredient(r.route_id, b.id, "product_name", prod.product_name);
                                                                            handleUpdateIngredient(r.route_id, b.id, "product_code", prod.product_code);
                                                                            handleUpdateIngredient(r.route_id, b.id, "cost_per_unit", Number(prod.cost_per_unit || prod.price_per_unit || 0));
                                                                            handleUpdateIngredient(r.route_id, b.id, "unit_of_measurement", prod.unit_of_measurement?.unit_shortcut || "PCS");
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className="p-1.5 align-middle">
                                                                    <input 
                                                                        type="number"
                                                                        step="0.0001"
                                                                        value={b.quantity_required}
                                                                        onChange={(e) => handleUpdateIngredient(r.route_id, b.id, "quantity_required", parseFloat(e.target.value) || 0)}
                                                                        className="w-full h-8 px-2 border border-muted bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                                    />
                                                                </td>
                                                                <td className="p-1.5 align-middle">
                                                                    <CreatableSelect
                                                                        options={unitOptions}
                                                                        value={String(b.unit_of_measurement || "")}
                                                                        onValueChange={(val) => handleUpdateIngredient(r.route_id, b.id, "unit_of_measurement", val)}
                                                                        placeholder="UOM"
                                                                        className="h-8 py-0 px-2 text-xs"
                                                                    />
                                                                </td>
                                                                <td className="p-1.5 align-middle">
                                                                    <input 
                                                                        type="number"
                                                                        value={b.wastage_factor_percentage}
                                                                        onChange={(e) => handleUpdateIngredient(r.route_id, b.id, "wastage_factor_percentage", parseFloat(e.target.value) || 0)}
                                                                        className="w-full h-8 px-2 border border-muted bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                                    />
                                                                </td>
                                                                <td className="p-1.5 align-middle">
                                                                    <input 
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={b.cost_per_unit || 0}
                                                                        onChange={(e) => handleUpdateIngredient(r.route_id, b.id, "cost_per_unit", parseFloat(e.target.value) || 0)}
                                                                        className="w-full h-8 px-2 border border-muted bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                                    />
                                                                </td>
                                                                <td className="p-1.5 align-middle text-right font-medium pr-3 text-muted-foreground">
                                                                    ₱{compCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td className="p-1.5 align-middle text-center">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleDeleteIngredient(r.route_id, b.id)}
                                                                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            <div className="p-2 border-t border-muted/50 bg-muted/5 flex justify-end">
                                                <Button 
                                                    onClick={() => handleAddIngredient(r.route_id)} 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-8 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-md inline-flex items-center gap-1"
                                                >
                                                    <Plus className="h-3.5 w-3.5" /> Add Ingredient
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
