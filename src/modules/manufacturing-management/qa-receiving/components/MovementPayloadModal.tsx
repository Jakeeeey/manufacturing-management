"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReceivingMovementRoute, ReceivingPreview, ShipmentLineItem } from "../types";

interface MovementPayloadModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    preview: ReceivingPreview | null;
    lineItems: ShipmentLineItem[];
    posting: boolean;
    onCommit: () => void;
}

interface RouteRow {
    lineId: number;
    productName: string;
    productCode: string;
    route: ReceivingMovementRoute;
}

const pendingId = "Assigned on confirmation";

export default function MovementPayloadModal({
    open,
    onOpenChange,
    preview,
    lineItems,
    posting,
    onCommit
}: MovementPayloadModalProps) {
    const [verified, setVerified] = React.useState(false);

    React.useEffect(() => {
        if (open) setVerified(false);
    }, [open, preview]);

    const routeRows = React.useMemo<RouteRow[]>(() => {
        if (!preview) return [];
        return preview.lines.flatMap(line => {
            const poLine = lineItems.find(item => item.line_id === line.lineId);
            return line.routes.map(route => ({
                lineId: line.lineId,
                productName: poLine?.product_id?.product_name || `PO line ${line.lineId}`,
                productCode: poLine?.product_id?.product_code || `LINE-${line.lineId}`,
                route
            }));
        });
    }, [lineItems, preview]);

    const passedRows = routeRows.filter(row => row.route.kind === "Passed");
    const rejectedRows = routeRows.filter(row => row.route.kind === "Rejected");
    const allocations = passedRows.flatMap(row => row.route.allocationDrafts.map(allocation => ({ ...row, allocation })));

    if (!preview) return null;

    const movementTable = (rows: RouteRow[], kind: "Passed" | "Rejected") => (
        <section className="space-y-2" aria-label={`${kind} inventory movement drafts`}>
            <div className="flex items-center gap-2">
                {kind === "Passed" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
                <h3 className="text-xs font-bold">{kind === "Passed" ? "Good-stock movements" : "Bad-order movements"}</h3>
                <span className="text-[10px] text-muted-foreground">{rows.length} draft{rows.length === 1 ? "" : "s"}</span>
            </div>
            {rows.length === 0 ? (
                <p className="text-[11px] text-muted-foreground border-y py-3">No {kind.toLowerCase()} movement is required.</p>
            ) : (
                <div className="overflow-x-auto border-y">
                    <table className="w-full min-w-[1050px] text-[10px]">
                        <thead className="bg-muted/40 text-muted-foreground uppercase">
                            <tr>
                                <th className="px-2 py-2 text-left">Product</th>
                                <th className="px-2 py-2 text-left">Branch</th>
                                <th className="px-2 py-2 text-left">Storage lot / batch</th>
                                <th className="px-2 py-2 text-right">Quantity</th>
                                <th className="px-2 py-2 text-left">Dates</th>
                                <th className="px-2 py-2 text-left">Transaction / user</th>
                                <th className="px-2 py-2 text-left">Commit IDs</th>
                                <th className="px-2 py-2 text-left">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map(({ lineId, productName, productCode, route }) => (
                                <tr key={`${lineId}-${route.kind}`}>
                                    <td className="px-2 py-2 align-top"><strong>{productName}</strong><br /><span className="text-muted-foreground">{productCode}</span></td>
                                    <td className="px-2 py-2 align-top"><strong>{route.branch.name}</strong><br /><span className="text-muted-foreground">{route.branch.code} / ID {route.branch.id}</span></td>
                                    <td className="px-2 py-2 align-top"><strong>{route.storageLotName}</strong><br /><span className="text-muted-foreground">Location ID {route.storageLotId} / {route.supplierBatchNumber}</span></td>
                                    <td className="px-2 py-2 align-top text-right font-bold tabular-nums">{route.quantity.toLocaleString()}</td>
                                    <td className="px-2 py-2 align-top">MFG: {route.manufacturingDate || "N/A"}<br />EXP: {route.expiryDate || "N/A"}</td>
                                    <td className="px-2 py-2 align-top"><strong>{route.transactionType.name}</strong><br /><span className="text-muted-foreground">Type ID {route.transactionType.id} / User {route.createdBy}</span></td>
                                    <td className="px-2 py-2 align-top text-muted-foreground">Movement: {pendingId}<br />Receiving: {pendingId}<br />Inventory lot: {pendingId}</td>
                                    <td className="px-2 py-2 align-top max-w-[220px] whitespace-normal">{route.remarks || "None"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[94vw] max-w-[1200px] max-h-[90vh] p-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-5 pt-5 pb-3 border-b">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <ClipboardCheck className="h-5 w-5 text-primary" /> Ledger Movement Verification
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Receipt {preview.receiptNumber} for PO {preview.shipmentId}. Review the movement and allocation records before posting.
                    </DialogDescription>
                </DialogHeader>

                <div className="overflow-y-auto px-5 py-4 space-y-6">
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] border-y py-2">
                        <span><strong>Destination:</strong> {preview.destinationBranch.name} ({preview.destinationBranch.code})</span>
                        <span><strong>Inspector:</strong> User {preview.generatedBy}</span>
                        <span><strong>Status:</strong> Ready to post</span>
                    </div>

                    {movementTable(passedRows, "Passed")}
                    {movementTable(rejectedRows, "Rejected")}

                    <section className="space-y-2" aria-label="MRP allocation drafts">
                        <div className="flex items-center gap-2">
                            <PackageCheck className="h-4 w-4 text-blue-600" />
                            <h3 className="text-xs font-bold">MRP pre-allocation</h3>
                            <span className="text-[10px] text-muted-foreground">{allocations.length} draft{allocations.length === 1 ? "" : "s"}</span>
                        </div>
                        <div className="overflow-x-auto border-y">
                            <table className="w-full min-w-[760px] text-[10px]">
                                <thead className="bg-muted/40 text-muted-foreground uppercase">
                                    <tr>
                                        <th className="px-2 py-2 text-left">Product</th>
                                        <th className="px-2 py-2 text-left">Job order</th>
                                        <th className="px-2 py-2 text-left">Material requirement</th>
                                        <th className="px-2 py-2 text-right">Allocated</th>
                                        <th className="px-2 py-2 text-left">Commit IDs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {allocations.map(({ lineId, productName, allocation }) => (
                                        <tr key={`${lineId}-${allocation.jobOrderMaterialId}`}>
                                            <td className="px-2 py-2 font-bold">{productName}</td>
                                            <td className="px-2 py-2"><strong>{allocation.jobOrder.number}</strong><br /><span className="text-muted-foreground">ID {allocation.jobOrder.id}</span></td>
                                            <td className="px-2 py-2">ID {allocation.jobOrderMaterialId}</td>
                                            <td className="px-2 py-2 text-right font-bold tabular-nums">{allocation.quantity.toLocaleString()}</td>
                                            <td className="px-2 py-2 text-muted-foreground">Allocation: {pendingId}<br />Receiving: {pendingId}<br />Inventory lot: {pendingId}</td>
                                        </tr>
                                    ))}
                                    {allocations.length === 0 && (
                                        <tr><td colSpan={5} className="px-2 py-3 text-muted-foreground">No MRP allocation is required for this receipt.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {passedRows.some(row => row.route.unallocatedQuantity > 0) && (
                            <div className="text-[11px] text-amber-700 border-l-2 border-amber-500 pl-3 space-y-1">
                                {passedRows.filter(row => row.route.unallocatedQuantity > 0).map(row => (
                                    <p key={row.lineId}><strong>{row.productName}:</strong> {row.route.unallocatedQuantity.toLocaleString()} Passed unit(s) remain unallocated.</p>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <DialogFooter className="px-5 py-4 border-t gap-3 sm:items-center sm:justify-between">
                    <label className="flex items-start gap-2 text-[11px] font-semibold cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={verified}
                            onChange={event => setVerified(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        I verified these movement and allocation records.
                    </label>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close Preview</Button>
                        <Button type="button" disabled={!verified || posting || !preview.postingEnabled} onClick={onCommit}>
                            {posting ? "Posting..." : "Confirm & Post Receiving"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
