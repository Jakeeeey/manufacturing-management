import React from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { History, Trash2, ShieldCheck, HelpCircle } from "lucide-react";
import { ConversionLog } from "../types";

interface UOMValidationLogsProps {
    logs: ConversionLog[];
    onClear: () => void;
}

export default function UOMValidationLogs({ logs, onClear }: UOMValidationLogsProps) {
    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Calculation Audit Log */}
            <div className="border rounded-xl bg-card p-5 shadow-sm space-y-4 flex flex-col max-h-[350px] min-h-[250px]">
                <div className="flex items-center justify-between border-b pb-2 shrink-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <History className="h-4 w-4 text-primary" />
                        Audit Calculation Logs
                    </h3>
                    {logs.length > 0 && (
                        <button
                            onClick={onClear}
                            className="text-[10px] font-bold text-destructive hover:bg-destructive/5 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                        >
                            <Trash2 className="h-3 w-3" />
                            Clear Logs
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 min-h-0 pr-1 select-none">
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                            <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
                            <span className="text-[10px] font-semibold text-muted-foreground">No recent conversions logged</span>
                        </div>
                    ) : (
                        logs.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between text-xs p-3 border rounded-lg bg-muted/10 font-semibold gap-2"
                            >
                                <div className="space-y-0.5 min-w-0">
                                    <span className="text-[9px] text-muted-foreground block font-mono">
                                        {item.timestamp} • {item.oilType}
                                    </span>
                                    <span className="text-foreground block truncate">
                                        {item.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} {item.fromUnit}
                                    </span>
                                </div>
                                <span className="text-primary font-mono text-right shrink-0">
                                    → {item.result.toLocaleString(undefined, { maximumFractionDigits: 6 })} {item.toUnit}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Standard UOM Validation Rules */}
            <div className="border rounded-xl bg-card p-5 shadow-sm space-y-4 flex-1 flex flex-col">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2 shrink-0">
                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                    Standard BOM Validation Rules
                </h3>

                <div className="space-y-3.5 overflow-y-auto flex-1 text-[11px] leading-relaxed text-muted-foreground">
                    <div className="space-y-1">
                        <h4 className="font-bold text-foreground flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            1. Volumetric Density Standard
                        </h4>
                        <p className="pl-2.5">
                            Oils are purchased in mass measures (e.g. Metric Tons) but consumed in volumetric ratios (Liters/Milliliters) in production recipes. All BOM ingredients must specify a valid density coefficient.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <h4 className="font-bold text-foreground flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            2. Ingredient Wastage Percentage
                        </h4>
                        <p className="pl-2.5">
                            Standard recipes must account for chemical shrinkage and residual storage tank residue by enforcing a line item &quot;Wastage %&quot; (typically 1.5% for Palm oil transfers).
                        </p>
                    </div>

                    <div className="space-y-1">
                        <h4 className="font-bold text-foreground flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            3. Packaging Multiplier Rules
                        </h4>
                        <p className="pl-2.5">
                            Carton boxes, plastic caps, and PET bottles must be allocated using discrete units (PCS) linked to packaging multiplier scales configured in the Finished Good detail tab.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
