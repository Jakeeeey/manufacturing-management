import React from "react";
import { Shipment } from "../types";

interface InboundShipmentsListProps {
    loadingShipments: boolean;
    filteredShipments: Shipment[];
    selectedShipment: Shipment | null;
    showReceived: boolean;
    setShowReceived: (show: boolean) => void;
    onSelectShipment: (s: Shipment) => void;
}

export default function InboundShipmentsList({
    loadingShipments,
    filteredShipments,
    selectedShipment,
    showReceived,
    setShowReceived,
    onSelectShipment
}: InboundShipmentsListProps) {
    return (
        <div className="md:col-span-1 border rounded-xl bg-card overflow-hidden flex flex-col max-h-[75dvh]">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground">Pending Inspection Logs</h3>
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-muted-foreground select-none font-bold">
                    <input
                        type="checkbox"
                        checked={showReceived}
                        onChange={e => setShowReceived(e.target.checked)}
                        className="rounded border-border accent-primary"
                    />
                    Show Received
                </label>
            </div>
            <div className="p-3 overflow-y-auto space-y-2.5 flex-1">
                {loadingShipments ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">Loading shipments...</div>
                ) : filteredShipments.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground italic">No pending shipments found</div>
                ) : (
                    filteredShipments.map(s => (
                        <div
                            key={s.shipment_id}
                            onClick={() => onSelectShipment(s)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none space-y-2.5 ${
                                selectedShipment?.shipment_id === s.shipment_id
                                    ? "bg-primary/5 border-primary shadow-sm"
                                    : "bg-background border-border hover:bg-muted/10"
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="font-extrabold text-xs text-foreground block">
                                    {s.reference_number}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-extrabold border ${
                                    s.status === "Receiving (QA)"
                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                        : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                }`}>
                                    {s.status}
                                </span>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Value: ₱{Number(s.total_php_value || 0).toLocaleString()}</span>
                                <span>Date: {s.date_received || s.created_at?.split('T')[0] || "N/A"}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
