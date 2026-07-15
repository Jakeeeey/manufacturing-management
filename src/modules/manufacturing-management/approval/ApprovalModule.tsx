/* eslint-disable */
"use client";

import React, { useState, useEffect } from "react";
import { Anchor, Calendar, Layers, Search, ShieldAlert, CheckCircle, Loader2 } from "lucide-react";
import { usePurchaseOrderApproval } from "../purchase-order-approval/hooks/usePurchaseOrderApproval";
import { toast } from "sonner";

export default function ApprovalModule() {
    const {
        loading,
        suppliers,
        shipments,
        selectedShipment,
        setSelectedShipment,
        selectedShipmentLines,
        approve,
        reject,
        updateStatus,
        load,
    } = usePurchaseOrderApproval();

    const [search, setSearch] = useState("");
    const [etaDate, setEtaDate] = useState("");
    const [approvedPrices, setApprovedPrices] = useState<Record<number, number>>({});
    const [isApproving, setIsApproving] = useState(false);
    const [rejectRemarks, setRejectRemarks] = useState("");
    const [isRejecting, setIsRejecting] = useState(false);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void load({ limit: 100, search });
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [load, search]);

    // Filter shipments: only show Ordered (Pending Approval) or Approved status
    const filteredShipments = shipments.filter(s => {
        const matchesSearch = s.reference_number.toLowerCase().includes(search.toLowerCase()) ||
            (s.supplier_id && typeof s.supplier_id === "object" && s.supplier_id.supplier_name.toLowerCase().includes(search.toLowerCase()));
        const matchesStatus = s.status === "Ordered" || s.status === "Approved";
        return matchesSearch && matchesStatus;
    });

    const activeShipment = selectedShipment || null;

    // Hydrate ETA Date and item prices when active shipment changes
    useEffect(() => {
        if (activeShipment) {
            setEtaDate(activeShipment.lead_time_receiving ? new Date(activeShipment.lead_time_receiving).toISOString().split('T')[0] : "");
        }
    }, [activeShipment]);

    useEffect(() => {
        if (selectedShipmentLines.length > 0) {
            const prices: Record<number, number> = {};
            selectedShipmentLines.forEach((line) => {
                const pId = typeof line.product_id === "object" && line.product_id ? line.product_id.product_id : Number(line.product_id);
                prices[pId] = Number(line.base_unit_cost_php || 0);
            });
            setApprovedPrices(prices);
        }
    }, [selectedShipmentLines]);

    const handleApprove = async () => {
        if (!activeShipment) return;
        if (!etaDate) {
            toast.error("Please set the Estimated Date of Arrival (ETA) before approving.");
            return;
        }

        try {
            setIsApproving(true);
            await approve(activeShipment.shipment_id, etaDate, approvedPrices);
            toast.success("Purchase Order approved and ETA scheduled successfully.");
        } catch {
            toast.error("Failed to approve Purchase Order.");
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async () => {
        if (!activeShipment) return;
        if (!rejectRemarks.trim()) {
            toast.error("Please specify a reason/remarks for rejecting this Purchase Order.");
            return;
        }

        try {
            setIsRejecting(true);
            await reject(activeShipment.shipment_id, rejectRemarks);
            toast.success("Purchase Order rejected successfully.");
        } catch (e: any) {
            toast.error(e.message || "Failed to reject Purchase Order.");
        } finally {
            setIsRejecting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Ordered":
                return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Pending Approval</span>;
            case "Approved":
                return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Approved</span>;
            case "Rejected":
                return <span className="bg-red-500/10 text-red-500 border border-red-500/25 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Rejected</span>;
            case "Cancelled":
                return <span className="bg-zinc-500/10 text-zinc-600 border border-zinc-500/25 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Cancelled</span>;
            default:
                return <span className="bg-muted text-muted-foreground border px-2 py-0.5 rounded text-[10px] font-bold uppercase">{status}</span>;
        }
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden space-y-4">
            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
                {/* Left Column: PO queues list */}
                <div className="w-full lg:w-2/5 flex flex-col border rounded-xl bg-card overflow-hidden shadow-sm">
                    <div className="p-4 border-b space-y-3 shrink-0 bg-muted/20">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 min-w-0">
                                <Anchor className="h-4 w-4 text-primary shrink-0" />
                                <span className="truncate">PO Approval Queue</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">({filteredShipments.length})</span>
                            </h3>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search PO/BL Reference, Supplier..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border rounded-lg text-xs bg-background outline-none focus:ring-1 focus:ring-primary font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y">
                        {filteredShipments.length === 0 ? (
                            <div className="p-8 text-center text-xs text-muted-foreground">
                                {loading ? "Loading queue..." : "No pending purchase orders in approval queue."}
                            </div>
                        ) : (
                            filteredShipments.map(s => {
                                const matchedSupplier = typeof s.supplier_id !== "object"
                                    ? suppliers.find(sup => sup.id === Number(s.supplier_id))
                                    : s.supplier_id;
                                const supName = matchedSupplier ? matchedSupplier.supplier_name : `Supplier ID: ${s.supplier_id}`;
                                const isSelected = activeShipment && activeShipment.shipment_id === s.shipment_id;

                                return (
                                    <div
                                        key={s.shipment_id}
                                        onClick={() => setSelectedShipment(s)}
                                        className={`p-4 text-left cursor-pointer transition-all ${isSelected ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-muted/10 border-l-4 border-l-transparent"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <span className="font-extrabold text-xs text-foreground tracking-tight">{s.reference_number}</span>
                                            {getStatusBadge(s.status)}
                                        </div>
                                        <div className="text-xs text-muted-foreground font-semibold truncate mb-2">{supName}</div>
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold font-mono">
                                            <span>₱{Number(s.total_php_value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                            <span>{new Date(s.created_at || new Date()).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="flex-1 border rounded-xl bg-card overflow-hidden shadow-sm flex flex-col min-h-0 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-xl">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                    {activeShipment ? (
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div className="space-y-1">
                                    <h2 className="text-base font-extrabold tracking-tight text-foreground">{activeShipment.reference_number}</h2>
                                    <p className="text-xs text-muted-foreground font-semibold">
                                        Supplier: <strong className="text-foreground">
                                            {(() => {
                                                const matchedSupplier = typeof activeShipment.supplier_id !== "object"
                                                    ? suppliers.find(sup => sup.id === Number(activeShipment.supplier_id))
                                                    : activeShipment.supplier_id;
                                                return matchedSupplier ? matchedSupplier.supplier_name : `Supplier ID: ${activeShipment.supplier_id}`;
                                            })()}
                                        </strong>
                                    </p>
                                </div>
                                <div className="text-right">
                                    {getStatusBadge(activeShipment.status)}
                                </div>
                            </div>

                            {/* Approval actions form */}
                            {activeShipment.status === "Ordered" ? (
                                <div className="p-4 border border-amber-200 bg-amber-50/15 dark:bg-amber-950/5 rounded-xl space-y-4 animate-in fade-in duration-200">
                                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                        <ShieldAlert className="h-4 w-4" /> Review & Approve Shipment PO
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5 text-left">
                                            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Set Estimated Arrival Date (ETA) *</label>
                                            <input
                                                type="date"
                                                required
                                                value={etaDate}
                                                onChange={(e) => setEtaDate(e.target.value)}
                                                className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                                            />
                                        </div>

                                        {/* List of item prices to approve */}
                                        <div className="space-y-2 text-left sm:col-span-2">
                                            <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Verify Approved Price Per Unit (PHP)</label>
                                            <div className="divide-y border rounded-lg bg-background max-h-[160px] overflow-y-auto">
                                                {selectedShipmentLines.map((line) => {
                                                    const pId = typeof line.product_id === "object" && line.product_id ? line.product_id.product_id : Number(line.product_id);
                                                    const pName = typeof line.product_id === "object" && line.product_id ? line.product_id.product_name : `Item ID: ${pId}`;
                                                    const currentPrice = approvedPrices[pId] !== undefined ? approvedPrices[pId] : Number(line.base_unit_cost_php || 0);
                                                    return (
                                                        <div key={pId} className="p-2 flex items-center justify-between gap-3 text-xs">
                                                            <span className="font-semibold text-muted-foreground truncate">{pName}</span>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <span className="text-[10px] text-muted-foreground">₱</span>
                                                                <input
                                                                    type="number"
                                                                    disabled
                                                                    value={currentPrice}
                                                                    className="w-20 rounded border bg-muted/20 px-1.5 py-0.5 text-right font-mono font-bold outline-none cursor-not-allowed text-muted-foreground opacity-70"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rejection remarks field */}
                                    <div className="space-y-1.5 text-left pt-3 border-t border-dashed col-span-2">
                                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Rejection Remarks / Reason *</label>
                                        <textarea
                                            placeholder="Specify reason for rejection (required to reject)..."
                                            value={rejectRemarks}
                                            onChange={(e) => setRejectRemarks(e.target.value)}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-red-500 h-16 resize-none"
                                        />
                                    </div>

                                    <div className="flex justify-end pt-1 gap-2 col-span-2">
                                        <button
                                            type="button"
                                            onClick={handleReject}
                                            disabled={isRejecting}
                                            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                                        >
                                            {isRejecting ? "Rejecting..." : "Reject PO"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleApprove}
                                            disabled={isApproving}
                                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-sm cursor-pointer"
                                        >
                                            {isApproving ? "Approving..." : "Confirm & Approve PO"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 border border-emerald-200 bg-emerald-500/5 rounded-xl flex flex-col gap-3">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400">PO Approved & ETA Scheduled</h4>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                This purchase order has been reviewed, prices locked, and scheduled for arrival on{" "}
                                                <strong>{activeShipment.lead_time_receiving ? new Date(activeShipment.lead_time_receiving).toLocaleDateString() : "Pending"}</strong>.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void updateStatus(activeShipment.shipment_id, "En Route")}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-all shadow-sm cursor-pointer mt-1"
                                    >
                                        Mark Cargo as En Route (Departed)
                                    </button>
                                </div>
                            )}

                            {/* Totals Summary */}
                            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 pt-4 border-t">
                                <div className="border p-4 rounded-xl bg-muted/5 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Raw FOB Cost</span>
                                    <span className="text-xs font-extrabold text-foreground">
                                        ₱{Number(activeShipment.total_php_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="border p-4 rounded-xl bg-muted/5 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Foreign Currency</span>
                                    <span className="text-xs font-extrabold text-foreground">
                                        ${Number(activeShipment.total_foreign_currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                                    </span>
                                </div>
                                <div className="border p-4 rounded-xl bg-muted/5 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Exchange Rate</span>
                                    <span className="text-xs font-extrabold text-foreground">₱{Number(activeShipment.exchange_rate).toFixed(2)}</span>
                                </div>
                                <div className="border p-4 rounded-xl bg-muted/5 space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                        ETA / Expected
                                    </span>
                                    <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                        {activeShipment.lead_time_receiving
                                            ? new Date(activeShipment.lead_time_receiving).toLocaleDateString()
                                            : "Pending"}
                                    </span>
                                </div>
                            </div>

                            {/* Shipment Cargo Lines List */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-b pb-2">
                                    <Layers className="h-4 w-4 text-primary" />
                                    Shipment Manifest & Contents
                                </h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-muted/50 border-b">
                                                <th className="p-3 font-semibold text-muted-foreground">Product Name</th>
                                                <th className="p-3 font-semibold text-muted-foreground">UOM</th>
                                                <th className="p-3 font-semibold text-muted-foreground text-right">Qty</th>
                                                <th className="p-3 font-semibold text-muted-foreground text-right">Unit Price</th>
                                                <th className="p-3 font-semibold text-muted-foreground text-right">ImpFreight Cost</th>
                                                <th className="p-3 font-semibold text-muted-foreground text-right">Total Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {selectedShipmentLines.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                                        No items registered in this container.
                                                    </td>
                                                </tr>
                                            ) : (
                                                selectedShipmentLines.map(line => {
                                                    const prod = line.product_id && typeof line.product_id === "object"
                                                        ? line.product_id
                                                        : { product_name: `ID: ${line.product_id}`, product_code: "N/A", unit_of_measurement: { unit_shortcut: "PCS" } };
                                                    const qty = Number(line.quantity_ordered || 0);
                                                    const price = Number(line.base_unit_cost_php || 0);
                                                    const freight = Number(line.allocated_expense_php || 0);
                                                    const totalCost = (qty * price) + freight;
                                                    return (
                                                        <tr key={line.line_id} className="hover:bg-muted/20">
                                                            <td className="p-3">
                                                                <div className="font-semibold text-foreground">{prod.product_name}</div>
                                                                <div className="text-[10px] text-muted-foreground font-mono">Code: {prod.product_code}</div>
                                                            </td>
                                                            <td className="p-3 text-muted-foreground font-semibold">
                                                                {prod.unit_of_measurement?.unit_shortcut || "PCS"}
                                                            </td>
                                                            <td className="p-3 text-right font-semibold">
                                                                {qty.toLocaleString()} (Ordered)
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-[11px]">
                                                                ₱{price.toFixed(2)}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-[11px] text-muted-foreground">
                                                                +₱{freight.toFixed(2)}
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-[11px] font-bold text-foreground">
                                                                ₱{totalCost.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground h-full">
                            <Anchor className="h-16 w-16 mb-4 text-muted-foreground/30" />
                            {filteredShipments.length > 0 ? "Select a purchase order from the queue to view details." : "No purchase orders in approval queue."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
