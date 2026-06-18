import React from "react";
import { Plus, Trash2, Shield, Info } from "lucide-react";
import { DensityFactor } from "../types";

interface DensityMatrixTableProps {
    densities: DensityFactor[];
    onDelete: (id: string) => void;
    onAddClick: () => void;
}

export default function DensityMatrixTable({ densities, onDelete, onAddClick }: DensityMatrixTableProps) {
    return (
        <div className="border rounded-xl bg-card shadow-sm flex flex-col h-full">
            <div className="p-5 border-b flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Plus className="h-4 w-4 text-primary" />
                        Oil Density Matrix (kg/L)
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                        Specific gravities used for weight-to-volume recipes and shipping cost conversions.
                    </p>
                </div>
                <button
                    onClick={onAddClick}
                    className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/95 transition-all shadow-sm"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add Liquid
                </button>
            </div>

            <div className="flex-1 overflow-x-auto min-h-0">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-muted/30 border-b text-muted-foreground font-bold uppercase tracking-wider">
                            <th className="p-4 font-semibold">Liquid Name</th>
                            <th className="p-4 font-semibold text-right">Density (kg/L)</th>
                            <th className="p-4 font-semibold">Description</th>
                            <th className="p-4 font-semibold text-center w-16">Source</th>
                            <th className="p-4 font-semibold text-center w-12">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {densities.map((item) => (
                            <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                                <td className="p-4 font-bold text-foreground">{item.name}</td>
                                <td className="p-4 font-mono font-bold text-right text-primary">
                                    {item.density.toFixed(4)}
                                </td>
                                <td className="p-4 text-muted-foreground max-w-xs truncate" title={item.description}>
                                    {item.description}
                                </td>
                                <td className="p-4 text-center">
                                    {item.isSystem ? (
                                        <span className="inline-flex items-center gap-0.5 bg-sky-500/10 text-sky-600 px-2 py-0.5 rounded-full text-[9px] font-extrabold border border-sky-500/10">
                                            <Shield className="h-2.5 w-2.5" />
                                            System
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full text-[9px] font-extrabold border border-amber-500/10">
                                            Custom
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-center">
                                    {item.isSystem ? (
                                        <span className="text-[10px] text-muted-foreground/40 font-semibold">—</span>
                                    ) : (
                                        <button
                                            onClick={() => onDelete(item.id)}
                                            className="text-destructive hover:bg-destructive/10 p-1.5 rounded-md transition-colors"
                                            title="Delete entry"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-muted/10 border-t flex gap-2 items-start text-[10px] text-muted-foreground leading-relaxed">
                <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>
                    <strong>Calculation Note:</strong> 1 Liter of RBD Palm Olein (density 0.895) equals 0.895 kg. Conversely, 1 Metric Ton (1000 kg) of Palm Olein equals approximately 1,117.32 Liters. These factors are dynamic and can vary based on temperature.
                </span>
            </div>
        </div>
    );
}
