import React, { useState } from "react";
import { History, Image, MessageSquare, ShieldAlert, CheckCircle } from "lucide-react";
import { QALogEntry } from "../types";

interface QALogHistoryTableProps {
    qaHistory: QALogEntry[];
}

export function QALogHistoryTable({
    qaHistory
}: QALogHistoryTableProps) {
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    if (qaHistory.length === 0) {
        return (
            <div className="text-center p-12 border rounded-xl bg-card">
                <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-foreground">No Inspection Logs Found</h4>
                <p className="text-[11px] text-muted-foreground mt-1">
                    QA audits and stage clearances will appear in this history trail once recorded.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="overflow-visible border rounded-xl bg-card shadow-sm">
                <table className="w-full border-collapse text-left text-xs table-fixed">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <th className="p-3 w-[15%] font-bold text-muted-foreground uppercase tracking-wider">Date & Time</th>
                            <th className="p-3 w-[12%] font-bold text-muted-foreground uppercase tracking-wider">JO ID</th>
                            <th className="p-3 w-[20%] font-bold text-muted-foreground uppercase tracking-wider">Product</th>
                            <th className="p-3 w-[18%] font-bold text-muted-foreground uppercase tracking-wider">Stage Task</th>
                            <th className="p-3 w-[12%] font-bold text-muted-foreground uppercase tracking-wider text-right">Yield (Act/Exp)</th>
                            <th className="p-3 w-[10%] font-bold text-muted-foreground uppercase tracking-wider text-center">Deficit</th>
                            <th className="p-3 w-[13%] font-bold text-muted-foreground uppercase tracking-wider">Remarks / Photos</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {qaHistory.map(log => {
                            const hasPhotos = log.photos && log.photos.length > 0;
                            const hasDeviation = log.deviation_quantity > 0;

                            return (
                                <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="p-3 text-muted-foreground font-semibold">
                                        {new Date(log.recorded_at).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })}
                                    </td>
                                    <td className="p-3 font-bold text-foreground truncate">{log.jo_id}</td>
                                    <td className="p-3 font-semibold text-foreground truncate">{log.product_name}</td>
                                    <td className="p-3 font-semibold text-foreground truncate">{log.task_name}</td>
                                    <td className="p-3 text-right font-extrabold text-foreground">
                                        {log.actual_quantity.toLocaleString()} / {log.expected_quantity.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-center">
                                        {hasDeviation ? (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                                -{log.deviation_quantity} PCS
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
                                                <CheckCircle className="h-3 w-3" /> Clear
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 font-medium text-muted-foreground">
                                        <div className="flex items-center gap-2 max-w-full">
                                            {log.comments ? (
                                                <span className="truncate italic flex-1" title={log.comments}>
                                                    "{log.comments}"
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground/40 italic flex-1">No comments</span>
                                            )}

                                            {/* Photo Attachment Icon */}
                                            {hasPhotos && (
                                                <div className="flex items-center shrink-0">
                                                    <button
                                                        onClick={() => setSelectedPhoto(log.photos![0])}
                                                        className="p-1 rounded-md bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                                        title="View Inspection Evidence"
                                                    >
                                                        <Image className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Photo lightbox modal */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="relative max-w-lg bg-card border rounded-2xl overflow-hidden shadow-2xl p-2 animate-in zoom-in-95 duration-150">
                        <img src={selectedPhoto} alt="Inspection Evidence" className="w-full max-h-[70vh] object-contain rounded-xl" />
                        <button
                            onClick={() => setSelectedPhoto(null)}
                            className="absolute right-4 top-4 p-2 bg-black/70 hover:bg-black/90 text-white rounded-full transition-colors"
                        >
                            Close Image
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
