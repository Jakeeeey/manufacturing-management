/* eslint-disable */
"use client";

import React, { useState } from "react";
import { Plus, Check, X, Edit, Settings, Clock, Activity, DollarSign } from "lucide-react";
import { WorkCenter } from "../types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface WorkCentersTabProps {
    workCenters: WorkCenter[];
    handleAddWorkCenter: (workCenter: Omit<WorkCenter, "work_center_id">) => Promise<WorkCenter | undefined>;
    handleSaveWorkCenter: (workCenterId: number, workCenter: Partial<WorkCenter>) => Promise<WorkCenter | undefined>;
}

export const WorkCentersTab: React.FC<WorkCentersTabProps> = ({
    workCenters,
    handleAddWorkCenter,
    handleSaveWorkCenter
}) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    // Active edit states
    const [wcName, setWcName] = useState("");
    const [overheadCost, setOverheadCost] = useState("");
    const [capacity, setCapacity] = useState("");
    const [isActive, setIsActive] = useState(true);

    const handleEditClick = (wc: WorkCenter) => {
        setEditingId(wc.work_center_id);
        setIsCreatingNew(false);
        setWcName(wc.work_center_name);
        setOverheadCost(wc.overhead_cost_per_hour !== null ? String(wc.overhead_cost_per_hour) : "0");
        setCapacity(wc.capacity_per_hour !== null ? String(wc.capacity_per_hour) : "0");
        setIsActive(wc.is_active !== false);
    };

    const handleAddClick = () => {
        setEditingId(-1); // special ID for creating new
        setIsCreatingNew(true);
        setWcName("");
        setOverheadCost("0");
        setCapacity("0");
        setIsActive(true);
    };

    const handleCancel = () => {
        setEditingId(null);
        setIsCreatingNew(false);
    };

    const handleSaveClick = async (wcId: number) => {
        if (!wcName.trim()) {
            toast.error("Work center name cannot be empty.");
            return;
        }

        const payload = {
            work_center_name: wcName.trim(),
            overhead_cost_per_hour: parseFloat(overheadCost) || 0,
            capacity_per_hour: parseFloat(capacity) || 0,
            is_active: isActive
        };

        if (isCreatingNew) {
            const res = await handleAddWorkCenter(payload);
            if (res) {
                setEditingId(null);
                setIsCreatingNew(false);
            }
        } else {
            const res = await handleSaveWorkCenter(wcId, payload);
            if (res) {
                setEditingId(null);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-muted/50 pb-3">
                <div>
                    <h3 className="text-lg font-medium text-foreground">Work Centers &amp; Production Stations</h3>
                    <p className="text-xs text-muted-foreground">Manage factory floor layouts, hourly machine rates, and standard production rates per workstation.</p>
                </div>
                {!isCreatingNew && editingId === null && (
                    <Button 
                        onClick={handleAddClick}
                        className="inline-flex items-center gap-1.5 h-9 text-xs rounded-lg"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Work Center
                    </Button>
                )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-muted/50 bg-card text-card-foreground shadow-sm">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                        <tr className="bg-muted/10 border-b border-muted/50 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                            <th className="p-3.5 pl-5">Work Station Name</th>
                            <th className="p-3.5 flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5" /> Overhead Cost / Hour
                            </th>
                            <th className="p-3.5">
                                <Activity className="h-3.5 w-3.5 inline mr-1" /> Production Capacity / Hour
                            </th>
                            <th className="p-3.5">Availability Status</th>
                            <th className="p-3.5 text-center w-[12%]">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* New Row Insert */}
                        {isCreatingNew && (
                            <tr className="border-b border-primary/20 bg-primary/5">
                                <td className="p-2.5 pl-5 align-middle">
                                    <input 
                                        type="text"
                                        value={wcName}
                                        onChange={(e) => setWcName(e.target.value)}
                                        className="w-full h-8 px-2.5 border border-primary/30 bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="e.g. Packing Area Line 2"
                                    />
                                </td>
                                <td className="p-2.5 align-middle">
                                    <input 
                                        type="number"
                                        value={overheadCost}
                                        onChange={(e) => setOverheadCost(e.target.value)}
                                        className="w-32 h-8 px-2.5 border border-primary/30 bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </td>
                                <td className="p-2.5 align-middle">
                                    <input 
                                        type="number"
                                        value={capacity}
                                        onChange={(e) => setCapacity(e.target.value)}
                                        className="w-32 h-8 px-2.5 border border-primary/30 bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </td>
                                <td className="p-2.5 align-middle">
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                            className="h-4 w-4 rounded border-muted bg-background text-primary focus:ring-0"
                                        />
                                        Active
                                    </label>
                                </td>
                                <td className="p-2.5 align-middle text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleSaveClick(-1)}
                                            className="h-8 w-8 text-success hover:bg-success/15 rounded-md"
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleCancel}
                                            className="h-8 w-8 text-muted-foreground hover:bg-muted/10 rounded-md"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {workCenters.length === 0 && !isCreatingNew ? (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                                    No work centers defined yet. Click &quot;Add Work Center&quot; to configure one.
                                </td>
                            </tr>
                        ) : (
                            workCenters.map(wc => {
                                const isEditing = wc.work_center_id === editingId;
                                if (isEditing) {
                                    return (
                                        <tr key={wc.work_center_id} className="border-b border-primary/20 bg-primary/5">
                                            <td className="p-2.5 pl-5 align-middle">
                                                <input 
                                                    type="text"
                                                    value={wcName}
                                                    onChange={(e) => setWcName(e.target.value)}
                                                    className="w-full h-8 px-2.5 border border-primary/30 bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </td>
                                            <td className="p-2.5 align-middle">
                                                <input 
                                                    type="number"
                                                    value={overheadCost}
                                                    onChange={(e) => setOverheadCost(e.target.value)}
                                                    className="w-32 h-8 px-2.5 border border-primary/30 bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </td>
                                            <td className="p-2.5 align-middle">
                                                <input 
                                                    type="number"
                                                    value={capacity}
                                                    onChange={(e) => setCapacity(e.target.value)}
                                                    className="w-32 h-8 px-2.5 border border-primary/30 bg-background text-foreground text-xs rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                            </td>
                                            <td className="p-2.5 align-middle">
                                                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isActive}
                                                        onChange={(e) => setIsActive(e.target.checked)}
                                                        className="h-4 w-4 rounded border-muted bg-background text-primary focus:ring-0"
                                                    />
                                                    Active
                                                </label>
                                            </td>
                                            <td className="p-2.5 align-middle text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleSaveClick(wc.work_center_id)}
                                                        className="h-8 w-8 text-success hover:bg-success/15 rounded-md"
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={handleCancel}
                                                        className="h-8 w-8 text-muted-foreground hover:bg-muted/10 rounded-md"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={wc.work_center_id} className="border-b border-muted/40 hover:bg-muted/5">
                                        <td className="p-3.5 pl-5 align-middle font-medium text-foreground">
                                            {wc.work_center_name}
                                        </td>
                                        <td className="p-3.5 align-middle text-muted-foreground">
                                            ₱{(wc.overhead_cost_per_hour || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3.5 align-middle text-muted-foreground">
                                            {(wc.capacity_per_hour || 0).toLocaleString("en-US")} units
                                        </td>
                                        <td className="p-3.5 align-middle">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                wc.is_active !== false 
                                                    ? "bg-success/10 text-success" 
                                                    : "bg-destructive/10 text-destructive"
                                            }`}>
                                                {wc.is_active !== false ? "Operational" : "Under Maintenance / Off"}
                                            </span>
                                        </td>
                                        <td className="p-3.5 align-middle text-center">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEditClick(wc)}
                                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

