import React from "react";
import { PackageCheck, ArrowDownRight, ArrowUpRight, CheckCircle2 } from "lucide-react";

interface CompletedBatch {
    jo_id: string;
    product_name: string;
    expected_quantity: number;
    actual_yielded: number;
    variance: number;
    lot_codes: string;
    date_released: string;
}

interface ReleasedBatchesTableProps {
    completedBatches: CompletedBatch[];
}

export function ReleasedBatchesTable({
    completedBatches
}: ReleasedBatchesTableProps) {
    if (completedBatches.length === 0) {
        return (
            <div className="text-center p-12 border rounded-xl bg-card">
                <PackageCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">No Released Batches Found</h4>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Completed Job Orders with recorded stock releases will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-visible border rounded-xl bg-card shadow-sm">
            <table className="w-full border-collapse text-left text-xs table-fixed">
                <thead className="bg-muted/50 border-b">
                    <tr>
                        <th className="p-3 w-[15%] font-bold text-muted-foreground uppercase tracking-wider">Release Date</th>
                        <th className="p-3 w-[12%] font-bold text-muted-foreground uppercase tracking-wider">JO ID</th>
                        <th className="p-3 w-[25%] font-bold text-muted-foreground uppercase tracking-wider">Product</th>
                        <th className="p-3 w-[12%] font-bold text-muted-foreground uppercase tracking-wider text-right">Target Qty</th>
                        <th className="p-3 w-[12%] font-bold text-muted-foreground uppercase tracking-wider text-right">Yielded Qty</th>
                        <th className="p-3 w-[10%] font-bold text-muted-foreground uppercase tracking-wider text-center">Variance</th>
                        <th className="p-3 w-[14%] font-bold text-muted-foreground uppercase tracking-wider">Lot Code</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {completedBatches.map(batch => {
                        const hasDeficit = batch.variance < 0;
                        const hasSurplus = batch.variance > 0;

                        return (
                            <tr key={batch.jo_id} className="hover:bg-muted/30 transition-colors group">
                                <td className="p-3 text-muted-foreground font-semibold">
                                    {new Date(batch.date_released).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric"
                                    })}
                                </td>
                                <td className="p-3 font-bold text-foreground truncate">{batch.jo_id}</td>
                                <td className="p-3 font-semibold text-foreground truncate" title={batch.product_name}>
                                    {batch.product_name || "Unspecified Product"}
                                </td>
                                <td className="p-3 text-right font-bold text-muted-foreground">
                                    {Number(batch.expected_quantity).toLocaleString()}
                                </td>
                                <td className="p-3 text-right font-black text-foreground">
                                    {Number(batch.actual_yielded).toLocaleString()}
                                </td>
                                <td className="p-3 text-center">
                                    {hasDeficit ? (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                            <ArrowDownRight className="h-3 w-3" />
                                            {Math.abs(batch.variance).toLocaleString()}
                                        </span>
                                    ) : hasSurplus ? (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                            <ArrowUpRight className="h-3 w-3" />
                                            +{batch.variance.toLocaleString()}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
                                            <CheckCircle2 className="h-3 w-3" /> 100%
                                        </span>
                                    )}
                                </td>
                                <td className="p-3 font-semibold text-muted-foreground truncate" title={batch.lot_codes}>
                                    {batch.lot_codes}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
