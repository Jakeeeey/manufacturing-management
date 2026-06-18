import React from "react";
import { MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Shipment, ShipmentLineItem, Branch, InspectionRow } from "../types";

interface ShipmentInspectionFormProps {
    selectedShipment: Shipment;
    lineItems: ShipmentLineItem[];
    branches: Branch[];
    selectedBranchId: string;
    setSelectedBranchId: (val: string) => void;
    inspectionRows: Record<number, InspectionRow>;
    loadingLines: boolean;
    handleUpdateRow: (lineId: number, field: string, value: string | number | boolean) => void;
    handleSubmitInspection: (e: React.FormEvent) => void;
    onCancel: () => void;
}

export default function ShipmentInspectionForm({
    selectedShipment,
    lineItems,
    branches,
    selectedBranchId,
    setSelectedBranchId,
    inspectionRows,
    loadingLines,
    handleUpdateRow,
    handleSubmitInspection,
    onCancel
}: ShipmentInspectionFormProps) {
    return (
        <form onSubmit={handleSubmitInspection} className="flex flex-col h-full">
            <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                <div>
                    <h3 className="text-xs font-bold text-foreground">Cargo Manifest Inspection: {selectedShipment.reference_number}</h3>
                    <p className="text-[10px] text-muted-foreground">Verify physical quantities, tag batch IDs, and set Expiration limits.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="w-[200px] h-9 rounded-lg border bg-background text-foreground text-xs font-semibold px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all"
                    >
                        <option value="">Receive Branch...</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id.toString()}>{b.branch_name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Manifest Items Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingLines ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">Fetching manifest detail...</div>
                ) : (
                    lineItems.map(line => {
                        const row = inspectionRows[line.line_id] || {
                            acceptedQty: line.quantity_ordered,
                            lotNumber: "",
                            expirationDate: "",
                            rejectionReason: "",
                            qaStatus: "Passed",
                            isPackaging: false
                        };

                        const prod = line.product_id;

                        return (
                            <div key={line.line_id} className="border rounded-xl p-4 bg-muted/5 space-y-3.5 relative">
                                {/* Header info */}
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-2 border-b pb-2">
                                    <div>
                                        <span className="font-bold text-xs text-foreground block">{prod.product_name}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono">SKU: {prod.product_code || `ID-${prod.product_id}`}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateRow(line.line_id, "isPackaging", !row.isPackaging)}
                                            className={`px-2 py-0.5 rounded text-[8px] uppercase font-bold border transition-all ${
                                                row.isPackaging
                                                    ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                            }`}
                                        >
                                            {row.isPackaging ? "Packaging (Batch lot req)" : "Raw Material (Expiry req)"}
                                        </button>
                                        <span className="bg-muted px-2 py-0.5 text-muted-foreground font-bold text-[9px] rounded">
                                            Ordered: {line.quantity_ordered}
                                        </span>
                                    </div>
                                </div>

                                {/* QA Inputs Grid */}
                                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Accepted Quantity</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            max={line.quantity_ordered}
                                            value={row.acceptedQty}
                                            onChange={e => handleUpdateRow(line.line_id, "acceptedQty", Number(e.target.value))}
                                            className="w-full bg-background border text-foreground rounded-lg px-2 py-1.5 text-xs font-semibold"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                            Lot / Batch ID {row.isPackaging && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="text"
                                            required={row.isPackaging}
                                            placeholder="Batch lot tag"
                                            value={row.lotNumber}
                                            onChange={e => handleUpdateRow(line.line_id, "lotNumber", e.target.value)}
                                            className="w-full bg-background border text-foreground rounded-lg px-2 py-1.5 text-xs font-semibold"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                            Expiry Date {!row.isPackaging && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            type="date"
                                            required={!row.isPackaging}
                                            value={row.expirationDate}
                                            onChange={e => handleUpdateRow(line.line_id, "expirationDate", e.target.value)}
                                            className="w-full bg-background border text-foreground rounded-lg px-2 py-1.5 text-xs font-semibold"
                                        />
                                    </div>
                                </div>

                                {/* Secondary Rejection notes */}
                                <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 pt-1">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">QA Status Decision</label>
                                        <select
                                            value={row.qaStatus}
                                            onChange={(e) => handleUpdateRow(line.line_id, "qaStatus", e.target.value)}
                                            className="w-full h-9 rounded-lg border bg-background text-foreground text-xs font-semibold px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all"
                                        >
                                            <option value="">QA Decision...</option>
                                            <option value="Passed">Passed</option>
                                            <option value="Partially Accepted">Partially Accepted</option>
                                            <option value="Rejected">Rejected</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Rejection Notes (If Rejected/Partial)</label>
                                        <input
                                            type="text"
                                            placeholder="Reason for discrepancy or failure"
                                            value={row.rejectionReason}
                                            onChange={e => handleUpdateRow(line.line_id, "rejectionReason", e.target.value)}
                                            className="w-full bg-background border text-foreground rounded-lg px-2 py-1.5 text-xs font-semibold"
                                        />
                                    </div>
                                </div>

                                {/* Rejected qty calculations notice */}
                                {Number(line.quantity_ordered) - row.acceptedQty > 0 && (
                                    <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2 flex items-center gap-1.5 text-[10px] text-red-500">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        <span>Warning: {Number(line.quantity_ordered) - row.acceptedQty} units rejected, logging as Bad Stock.</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-4 border-t bg-muted/15 flex justify-end gap-3 shrink-0">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border rounded-lg text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                    Cancel Inspection
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
                >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Complete QA Receiving & Write Ledger
                </button>
            </div>
        </form>
    );
}
