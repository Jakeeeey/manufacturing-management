import React from "react";
import { Search, MapPin, ChevronDown, ChevronUp, Bookmark } from "lucide-react";
import { Branch, FIFOInventoryItem, FIFOBatch } from "../types";

interface FIFOInventoryListProps {
    branches: Branch[];
    fifoBranchId: string;
    loadingFifo: boolean;
    fifoSearch: string;
    setFifoSearch: (val: string) => void;
    filteredFifoList: FIFOInventoryItem[];
    expandedProducts: Record<number, boolean>;
    toggleProductExpand: (prodId: number) => void;
    handleLoadFifoInventory: (branchId: string) => void;
}

export default function FIFOInventoryList({
    branches,
    fifoBranchId,
    loadingFifo,
    fifoSearch,
    setFifoSearch,
    filteredFifoList,
    expandedProducts,
    toggleProductExpand,
    handleLoadFifoInventory
}: FIFOInventoryListProps) {
    
    // Date checker helper for raw material badge status
    const getExpirationStatus = (expDate?: string) => {
        if (!expDate) return { text: "No Date", color: "text-muted-foreground bg-muted" };
        const today = new Date();
        const exp = new Date(expDate);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { text: "Expired", color: "text-red-500 bg-red-500/10 border border-red-500/20" };
        } else if (diffDays <= 30) {
            return { text: `Expiring: ${diffDays}d`, color: "text-amber-500 bg-amber-500/10 border border-amber-500/20" };
        } else {
            return { text: "Fresh", color: "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20" };
        }
    };

    return (
        <div className="border rounded-xl bg-card p-5 space-y-5">
            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3.5 border-b pb-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <select
                        value={fifoBranchId}
                        onChange={(e) => handleLoadFifoInventory(e.target.value)}
                        className="w-full sm:w-64 h-9 rounded-lg border bg-background text-foreground text-xs font-bold px-3 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all"
                    >
                        <option value="">Select Branch Location...</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id.toString()}>{b.branch_name}</option>
                        ))}
                    </select>
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={fifoSearch}
                        onChange={e => setFifoSearch(e.target.value)}
                        className="w-full bg-background border text-foreground rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Stock reading area */}
            {loadingFifo ? (
                <div className="p-16 text-center text-xs text-muted-foreground">Loading FIFO queues...</div>
            ) : !fifoBranchId ? (
                <div className="p-16 text-center text-xs text-muted-foreground italic">
                    Select a branch location to read current raw materials and packaging ledger.
                </div>
            ) : filteredFifoList.length === 0 ? (
                <div className="p-16 text-center text-xs text-muted-foreground italic">
                    No inventory items found matching filters.
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredFifoList.map(item => {
                        const isExpanded = expandedProducts[item.product.product_id] || false;

                        return (
                            <div key={item.product.product_id} className="border rounded-xl overflow-hidden transition-all bg-muted/5">
                                {/* Product header info */}
                                <div 
                                    onClick={() => toggleProductExpand(item.product.product_id)}
                                    className="p-4 bg-card hover:bg-muted/10 transition-all cursor-pointer flex items-center justify-between gap-4"
                                >
                                    <div className="space-y-1 min-w-0">
                                        <span className="font-extrabold text-xs text-foreground block truncate">{item.product.product_name}</span>
                                        <div className="flex gap-2 text-[10px]">
                                            <span className="text-muted-foreground font-mono">Code: {item.product.product_code}</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span className={`font-bold ${item.isPackaging ? "text-purple-500" : "text-amber-500"}`}>
                                                {item.isPackaging ? "Packaging" : "Raw Material"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                            <span className="text-xs font-black text-foreground block">
                                                {item.totalQty.toLocaleString()} Units
                                            </span>
                                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wide block">
                                                Total In Stock
                                            </span>
                                        </div>
                                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                </div>

                                {/* Expandable FIFO batches table */}
                                {isExpanded && (
                                    <div className="p-4 bg-muted/5 border-t overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead>
                                                <tr className="text-[10px] text-muted-foreground uppercase font-black border-b pb-2">
                                                    <th className="pb-2">Batch / Lot Number</th>
                                                    {item.isPackaging ? (
                                                        <th className="pb-2">Received Date</th>
                                                    ) : (
                                                        <th className="pb-2">Expiration Date</th>
                                                    )}
                                                    <th className="pb-2 text-right">Received Qty</th>
                                                    <th className="pb-2">Shipment Ref</th>
                                                    <th className="pb-2 text-right">FIFO Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {item.batches.map((batch: FIFOBatch, index: number) => {
                                                    const expStatus = getExpirationStatus(batch.expiration_date);
                                                    return (
                                                        <tr key={index} className="border-b last:border-0 hover:bg-muted/10">
                                                            <td className="py-2.5 font-bold text-foreground flex items-center gap-1.5">
                                                                <Bookmark className="h-3.5 w-3.5 text-primary shrink-0" />
                                                                {batch.lot_number}
                                                            </td>
                                                            <td className="py-2.5 font-semibold text-muted-foreground">
                                                                {item.isPackaging ? batch.reception_date : (batch.expiration_date || "N/A")}
                                                            </td>
                                                            <td className="py-2.5 text-right font-mono text-foreground font-bold">
                                                                {batch.received_qty.toLocaleString()}
                                                            </td>
                                                            <td className="py-2.5 text-muted-foreground font-mono">
                                                                {batch.shipment_ref}
                                                            </td>
                                                            <td className="py-2.5 text-right">
                                                                {item.isPackaging ? (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                                        index === 0 
                                                                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                                                                            : "bg-muted text-muted-foreground"
                                                                    }`}>
                                                                        {index === 0 ? "Next Out (Oldest)" : "Buffered"}
                                                                    </span>
                                                                ) : (
                                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${expStatus.color}`}>
                                                                        {expStatus.text}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
