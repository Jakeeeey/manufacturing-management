/* eslint-disable */
import React from "react";
import { ArrowLeft, MapPin, AlertTriangle, CheckCircle2, Search, ChevronDown, Image as ImageIcon, Plus, Minus } from "lucide-react";
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
    const [dropdownOpen, setDropdownOpen] = React.useState(false);
    const [dropdownSearch, setDropdownSearch] = React.useState("");
    const [highlightedLineId, setHighlightedLineId] = React.useState<number | null>(null);

    const dropdownRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredLines = React.useMemo(() => {
        if (!dropdownSearch.trim()) return lineItems;
        const q = dropdownSearch.toLowerCase();
        return lineItems.filter(l => 
            l.product_id?.product_name?.toLowerCase().includes(q) ||
            l.product_id?.product_code?.toLowerCase().includes(q)
        );
    }, [lineItems, dropdownSearch]);

    const handleSelectProduct = (lineId: number) => {
        setDropdownOpen(false);
        setDropdownSearch("");
        setHighlightedLineId(lineId);
        
        // Find and scroll to card
        const element = document.getElementById(`line-card-${lineId}`);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        
        // Clear highlight
        setTimeout(() => {
            setHighlightedLineId(null);
        }, 3000);
    };

    // Filter out Bihon Bad Branch and quarantine branches from main selector
    const filteredBranches = React.useMemo(() => {
        return branches.filter(b => {
            const name = (b.branch_name || "").toLowerCase();
            return !name.includes("bad branch") && 
                   !name.includes("quarantine") && 
                   !name.includes("damaged") && 
                   !name.includes("holding") && 
                   !name.includes("bad order");
        });
    }, [branches]);

    const originalBranchName = React.useMemo(() => {
        if (!selectedShipment.branch_id) return "N/A";
        return branches.find(b => b.id === selectedShipment.branch_id)?.branch_name || `Branch ID ${selectedShipment.branch_id}`;
    }, [branches, selectedShipment.branch_id]);

    return (
        <form onSubmit={handleSubmitInspection} className="flex flex-col h-full">
            <div className="p-4 border-b bg-muted/20 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="md:hidden p-2 hover:bg-muted rounded-xl border text-muted-foreground transition-colors shrink-0 flex items-center justify-center animate-in fade-in slide-in-from-left-2 duration-200"
                        title="Back to Queue"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold text-foreground truncate">
                            Cargo Manifest Inspection: {selectedShipment.reference_number}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <p className="text-[10px] text-muted-foreground">Verify physical quantities, tag batch IDs, and set Expiration limits.</p>
                            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-extrabold whitespace-nowrap">
                                Original PO Branch: {originalBranchName}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-stretch lg:self-auto justify-end shrink-0">
                    {/* Product Name Searchable Dropdown */}
                    <div ref={dropdownRef} className="relative w-full sm:w-[220px]">
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="w-full h-11 sm:h-10 rounded-xl border bg-background text-foreground text-xs font-semibold px-3.5 py-2 flex items-center justify-between shadow-sm outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none"
                        >
                            <span className="truncate flex items-center gap-2">
                                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="truncate">Jump to Product...</span>
                            </span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                        {dropdownOpen && (
                            <div className="absolute right-0 mt-1.5 w-[280px] bg-popover border text-popover-foreground rounded-xl shadow-lg z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                <input
                                    type="text"
                                    placeholder="Search name or SKU..."
                                    value={dropdownSearch}
                                    onChange={e => setDropdownSearch(e.target.value)}
                                    className="w-full h-9 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                />
                                <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-1">
                                    {filteredLines.length === 0 ? (
                                        <div className="text-[10px] text-muted-foreground text-center py-2">No products found</div>
                                    ) : (
                                        filteredLines.map(l => (
                                            <button
                                                key={l.line_id}
                                                type="button"
                                                onClick={() => handleSelectProduct(l.line_id)}
                                                className="w-full text-left px-2 py-2 rounded-lg text-[11px] font-medium hover:bg-accent hover:text-accent-foreground transition-all truncate block"
                                            >
                                                <span className="font-bold block truncate">{l.product_id?.product_name}</span>
                                                <span className="text-[9px] text-muted-foreground font-mono">SKU: {l.product_id?.product_code || `ID-${l.product_id?.product_id}`}</span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <MapPin className="h-4 w-4 text-primary shrink-0" />
                        <select
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(e.target.value)}
                            className="w-full sm:w-[200px] h-11 sm:h-10 rounded-xl border bg-background text-foreground text-xs font-semibold px-3.5 py-2 outline-none focus:ring-1 focus:ring-primary cursor-pointer transition-all"
                        >
                            <option value="">Receive Branch...</option>
                            {filteredBranches.map(b => (
                                <option key={b.id} value={b.id.toString()}>{b.branch_name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Manifest Items Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingLines ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">Fetching manifest detail...</div>
                ) : (
                    lineItems.map(line => {
                        const row = inspectionRows[line.line_id] || {
                            receivedQty: "",
                            acceptedQty: "",
                            boQty: "",
                            lotNumber: "",
                            expirationDate: "",
                            rejectionReason: "",
                            qaStatus: "",
                            isPackaging: false
                        };

                        const prod = line.product_id;
                        const isHighlighted = highlightedLineId === line.line_id;

                        const receivedVal = row.receivedQty !== "" ? Number(row.receivedQty) : 0;
                        const orderedVal = Number(line.quantity_ordered || 0);
                        const acceptedVal = row.acceptedQty !== "" ? Number(row.acceptedQty) : 0;
                        // BO is the shortfall only (non-negative). Over-accepted units are all accepted stock.
                        const boVal = row.receivedQty !== "" && row.acceptedQty !== "" ? Math.max(0, receivedVal - acceptedVal) : (row.boQty !== "" ? Number(row.boQty) : 0);
                        const isOverAcceptance = row.acceptedQty !== "" && row.receivedQty !== "" && acceptedVal > receivedVal;

                        // Remarks mandatory rule: BO Qty > 0, Received ≠ Ordered, OR over-acceptance
                        const isRemarksMandatory = boVal > 0 || (row.receivedQty !== "" && receivedVal !== orderedVal) || isOverAcceptance;

                        return (
                            <div 
                                key={line.line_id} 
                                id={`line-card-${line.line_id}`}
                                className={`border rounded-xl p-4 bg-muted/5 space-y-3.5 relative transition-all duration-300 ${
                                    isHighlighted 
                                        ? "ring-2 ring-primary bg-primary/5 border-primary scale-[1.01]" 
                                        : "border-border"
                                }`}
                            >
                                {/* Header info with Product Image */}
                                <div className="flex gap-4 border-b pb-3 items-center">
                                    {/* Directus Product Image */}
                                    <div className="h-16 w-16 rounded-xl bg-background border flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                                        {prod.product_image ? (
                                            <img
                                                src={`${process.env.NEXT_PUBLIC_DIRECTUS_URL || "http://vtc:8074"}/assets/${prod.product_image}`}
                                                alt={prod.product_name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-xs sm:text-sm text-foreground block truncate">{prod.product_name}</span>
                                        <span className="text-[10px] text-muted-foreground font-mono">SKU: {prod.product_code || `ID-${prod.product_id}`}</span>
                                    </div>
                                    
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateRow(line.line_id, "isPackaging", !row.isPackaging)}
                                            className={`px-2.5 py-1 rounded-lg text-[8px] uppercase font-extrabold border transition-all ${
                                                row.isPackaging
                                                    ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                            }`}
                                        >
                                            {row.isPackaging ? "Packaging (Lot Req)" : "Raw Material (Expiry Req)"}
                                        </button>
                                    </div>
                                </div>

                                 {/* QA Inputs Grid - Touch Optimized layout */}
                                 {(() => {
                                     const convFactor = Number(line.product_id?.unit_of_measurement_count || 1);
                                     const childUom = line.product_id?.unit_of_measurement?.unit_shortcut || "PCS";
                                     const parentObj = line.product_id?.parent_id;
                                     const parentUom = parentObj && typeof parentObj === "object" 
                                         ? (parentObj as any).unit_of_measurement?.unit_shortcut 
                                         : null;
                                     const baseUom = parentUom || childUom;

                                     const receivedEquiv = receivedVal * convFactor;
                                     const acceptedEquiv = acceptedVal * convFactor;
                                     const boEquiv = Number(row.boQty || 0) * convFactor;

                                     return (
                                         <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                                             {/* Received Quantity Stepper */}
                                             <div className="space-y-1">
                                                 <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                                     Received Quantity
                                                 </label>
                                                 <div className="flex items-center">
                                                     <button
                                                         type="button"
                                                         onClick={() => handleUpdateRow(line.line_id, "receivedQty", Math.max(0, receivedVal - 1))}
                                                         className="w-10 h-10 border border-r-0 bg-background text-foreground rounded-l-lg hover:bg-muted font-extrabold flex items-center justify-center transition-colors text-base select-none shrink-0"
                                                     >
                                                         <Minus className="h-3.5 w-3.5" />
                                                     </button>
                                                     <input
                                                         type="number"
                                                         required
                                                         min="0"
                                                         placeholder="Manually count"
                                                         value={row.receivedQty}
                                                         onChange={e => handleUpdateRow(line.line_id, "receivedQty", e.target.value === "" ? "" : Number(e.target.value))}
                                                         className="w-full h-10 border bg-background text-center text-xs font-semibold text-foreground outline-none focus:ring-0"
                                                     />
                                                     <button
                                                         type="button"
                                                         onClick={() => handleUpdateRow(line.line_id, "receivedQty", receivedVal + 1)}
                                                         className="w-10 h-10 border border-l-0 bg-background text-foreground rounded-r-lg hover:bg-muted font-extrabold flex items-center justify-center transition-colors text-base select-none shrink-0"
                                                     >
                                                         <Plus className="h-3.5 w-3.5" />
                                                     </button>
                                                 </div>
                                                 {receivedEquiv > 0 && convFactor !== 1 && (
                                                     <span className="text-[9px] text-primary font-bold block mt-1 bg-primary/5 px-2 py-0.5 rounded border border-primary/10 w-fit select-none">
                                                         = {receivedEquiv.toLocaleString()} {baseUom}
                                                     </span>
                                                 )}
                                             </div>

                                             {/* Accepted Quantity Stepper */}
                                             <div className="space-y-1">
                                                 <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                                     Accepted Quantity <span className="text-red-500">*</span>
                                                     <span className="ml-1 text-[8px] text-primary/70 normal-case font-semibold">(can exceed received)</span>
                                                 </label>
                                                 <div className="flex items-center">
                                                     <button
                                                         type="button"
                                                         onClick={() => handleUpdateRow(line.line_id, "acceptedQty", Math.max(0, acceptedVal - 1))}
                                                         className="w-10 h-10 border border-r-0 bg-background text-foreground rounded-l-lg hover:bg-muted font-extrabold flex items-center justify-center transition-colors text-base select-none shrink-0"
                                                     >
                                                         <Minus className="h-3.5 w-3.5" />
                                                     </button>
                                                     <input
                                                         type="number"
                                                         required
                                                         min="0"
                                                         placeholder="Accepted qty"
                                                         value={row.acceptedQty}
                                                         onChange={e => handleUpdateRow(line.line_id, "acceptedQty", e.target.value === "" ? "" : Number(e.target.value))}
                                                         className="w-full h-10 border bg-background text-center text-xs font-semibold text-foreground outline-none focus:ring-0"
                                                     />
                                                     <button
                                                         type="button"
                                                         onClick={() => handleUpdateRow(line.line_id, "acceptedQty", acceptedVal + 1)}
                                                         className="w-10 h-10 border border-l-0 bg-background text-foreground rounded-r-lg hover:bg-muted font-extrabold flex items-center justify-center transition-colors text-base select-none shrink-0"
                                                     >
                                                         <Plus className="h-3.5 w-3.5" />
                                                     </button>
                                                 </div>
                                                 {acceptedEquiv > 0 && convFactor !== 1 && (
                                                     <span className="text-[9px] text-emerald-600 font-bold block mt-1 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 w-fit select-none">
                                                         = {acceptedEquiv.toLocaleString()} {baseUom}
                                                     </span>
                                                 )}
                                             </div>

                                             {/* BO Qty (Calculated, Read Only) */}
                                             <div className="space-y-1">
                                                 <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                                     BO Qty (Calculated)
                                                 </label>
                                                 <input
                                                     type="number"
                                                     readOnly
                                                     disabled
                                                     placeholder="0"
                                                     value={row.boQty}
                                                     className="w-full h-10 bg-muted/40 border border-border text-muted-foreground rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-not-allowed select-none"
                                                 />
                                                 {boEquiv > 0 && convFactor !== 1 && (
                                                     <span className="text-[9px] text-red-600 font-bold block mt-1 bg-red-500/5 px-2 py-0.5 rounded border border-red-500/10 w-fit select-none">
                                                         = {boEquiv.toLocaleString()} {baseUom}
                                                     </span>
                                                 )}
                                             </div>
                                         </div>
                                     );
                                 })()}

                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 pt-1">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                            Lot / Batch ID <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Batch lot tag"
                                            value={row.lotNumber}
                                            onChange={e => handleUpdateRow(line.line_id, "lotNumber", e.target.value)}
                                            className="w-full h-10 bg-background border text-foreground rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-primary"
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
                                            className="w-full h-10 bg-background border text-foreground rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-primary"
                                        />
                                    </div>

                                    {/* Segmented Button Selection for QA Status Decision */}
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                            QA Status Decision <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-3 gap-1 p-1 bg-muted/40 rounded-xl border h-10">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateRow(line.line_id, "qaStatus", "Passed")}
                                                className={`text-[10px] font-bold rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                                    row.qaStatus === "Passed"
                                                        ? "bg-green-500 text-white shadow-sm"
                                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                }`}
                                            >
                                                Passed
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateRow(line.line_id, "qaStatus", "Partially Accepted")}
                                                className={`text-[10px] font-bold rounded-lg flex items-center justify-center transition-all text-center leading-tight cursor-pointer ${
                                                    row.qaStatus === "Partially Accepted"
                                                        ? "bg-amber-500 text-white shadow-sm"
                                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                }`}
                                            >
                                                Partial
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateRow(line.line_id, "qaStatus", "Rejected")}
                                                className={`text-[10px] font-bold rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                                    row.qaStatus === "Rejected"
                                                        ? "bg-red-500 text-white shadow-sm"
                                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                                }`}
                                            >
                                                Rejected
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Remarks field */}
                                <div className="space-y-1 pt-1">
                                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
                                        Remarks / Rejection Notes {isRemarksMandatory && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={isRemarksMandatory ? "Logistics discrepancy or bad order explanation is mandatory" : "Reason for discrepancy or failure"}
                                        value={row.rejectionReason}
                                        onChange={e => handleUpdateRow(line.line_id, "rejectionReason", e.target.value)}
                                        className="w-full h-10 bg-background border text-foreground rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                {/* Discrepancy warnings */}
                                {row.receivedQty !== "" && receivedVal !== orderedVal && !isOverAcceptance && (
                                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5 flex items-center gap-2 text-[10px] text-amber-600 animate-in fade-in duration-200">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span>Logistics discrepancy detected (Counted quantity differs from original purchase order). Remarks are mandatory.</span>
                                    </div>
                                )}
                                {isOverAcceptance && (
                                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5 flex items-center gap-2 text-[10px] text-blue-600 animate-in fade-in duration-200">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span>
                                            Over-acceptance: Accepted ({acceptedVal}) exceeds Received ({receivedVal}). Extra units will be logged as additional accepted stock. Remarks documenting the source of extra units are mandatory.
                                        </span>
                                    </div>
                                )}
                                {boVal > 0 && (
                                    <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2.5 flex items-center gap-2 text-[10px] text-red-500 animate-in fade-in duration-200">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        <span>Warning: {boVal} units flagged as Bad Order (Routed to quarantine holding location). Remarks are mandatory.</span>
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
                    className="px-5 py-2.5 border rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted h-11 flex items-center justify-center cursor-pointer"
                >
                    Cancel Inspection
                </button>
                <button
                    type="submit"
                    className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 shadow h-11 justify-center cursor-pointer"
                >
                    <CheckCircle2 className="h-4 w-4" />
                    Complete QA Receiving & Write Ledger
                </button>
            </div>
        </form>
    );
}
