import React, { useState, useEffect } from "react";
import { IncomingShipment, ShipmentLineItem, Supplier, RawMaterial } from "../types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Search, Plus, Calendar, ShieldCheck, Truck, Layers, Anchor, AlertCircle, Info, Landmark, Edit, RefreshCw, Loader2 } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { BOMMaterialSelect } from "@/modules/manufacturing-management/finished-goods/components/BOMMaterialSelect";
import { CreatableSelect } from "@/modules/manufacturing-management/finished-goods/components/CreatableSelect";

interface IncomingShipmentsProps {
    shipments: IncomingShipment[];
    suppliers: Supplier[];
    rawMaterials: RawMaterial[];
    selectedShipment: IncomingShipment | null;
    setSelectedShipment: (s: IncomingShipment | null) => void;
    lines: ShipmentLineItem[];
    isModalOpen: boolean;
    setIsModalOpen: (open: boolean) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    shipmentForm: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    setShipmentForm: React.Dispatch<React.SetStateAction<any>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    linesForm: any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLinesForm: React.Dispatch<React.SetStateAction<any[]>>;
    onCreateShipment: (e: React.FormEvent) => void;
    onTriggerAllocation: (s: IncomingShipment) => void;
    onUpdateShipmentStatus: (shipmentId: number, status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received") => void;
    loading?: boolean;
}

interface RawProductSelectorProps {
    id?: string;
    autoFocus?: boolean;
    rawMaterials: RawMaterial[];
    selectedProductId: string;
    parentProductId?: string;
    productName?: string;
    onSelect: (selected: {
        parent_product_id: string;
        product_id: string;
        product_name: string;
        product_code: string;
        selected_uom: string;
        base_unit_cost_php: string;
        uom_options: Array<{
            product_id: number;
            unit_shortcut: string;
            cost_per_unit: number;
        }>;
    }) => void;
}

function RawProductSelector({
    id,
    autoFocus,
    rawMaterials,
    selectedProductId,
    parentProductId,
    productName,
    onSelect
}: RawProductSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [autoFocus]);

    const handleFocus = () => {
        setIsOpen(true);
        const currentName = productName || rawMaterials.find(m => String(m.product_id) === String(parentProductId || selectedProductId))?.product_name || "";
        setSearchQuery(currentName);
    };

    const displayValue = isOpen 
        ? searchQuery 
        : (productName || rawMaterials.find(m => String(m.product_id) === String(parentProductId || selectedProductId))?.product_name || "");

    // Filter results locally
    const filteredResults = React.useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return rawMaterials;
        return rawMaterials.filter(m => 
            m.product_name.toLowerCase().includes(query) ||
            (m.product_code && m.product_code.toLowerCase().includes(query))
        );
    }, [searchQuery, rawMaterials]);

    // Group matching products by parent item dynamically
    const groupedResults = React.useMemo(() => {
        const parentMap = new Map<number, RawMaterial>();
        const childrenMap = new Map<number, RawMaterial[]>();

        // 1. Separate parents and children
        filteredResults.forEach(item => {
            if (!item.parent_id) {
                parentMap.set(item.product_id, item);
            }
        });

        filteredResults.forEach(item => {
            if (item.parent_id) {
                const pId = item.parent_id;
                if (!childrenMap.has(pId)) {
                    childrenMap.set(pId, []);
                }
                childrenMap.get(pId)!.push(item);
            }
        });

        // 2. Synthesize virtual parents for children whose parent records didn't match the search filter
        filteredResults.forEach(item => {
            if (item.parent_id && !parentMap.has(item.parent_id)) {
                parentMap.set(item.parent_id, {
                    product_id: item.parent_id,
                    product_name: item.product_name.replace(/\s*\(.*?\)\s*$/, ""),
                    product_code: item.product_code ? `${item.product_code}-P` : undefined,
                    cost_per_unit: 0,
                    estimated_unit_cost: 0,
                    density_factor: 1
                });
            }
        });

        // 3. Construct grouped array with all packaging UOM options
        return Array.from(parentMap.values()).map(parent => {
            const children = childrenMap.get(parent.product_id) || [];
            const optionsMap = new Map<number, RawMaterial>();
            
            if (parent.unit_of_measurement) {
                optionsMap.set(parent.product_id, parent);
            }
            children.forEach(c => optionsMap.set(c.product_id, c));
            
            if (optionsMap.size === 0) {
                optionsMap.set(parent.product_id, parent);
            }

            return {
                parent,
                options: Array.from(optionsMap.values())
            };
        });
    }, [filteredResults]);

    // Flatten options for easy single-index keyboard navigation
    const flatOptions = React.useMemo(() => {
        const list: Array<{
            product_id: number;
            parent: RawMaterial;
            option: any;
            uom_shortcut: string;
            cost: number;
            groupOptions: any[];
        }> = [];
        groupedResults.forEach(group => {
            group.options.forEach((opt: any) => {
                list.push({
                    product_id: opt.product_id,
                    parent: group.parent,
                    option: opt,
                    uom_shortcut: opt.unit_of_measurement?.unit_shortcut || "PCS",
                    cost: Number(opt.cost_per_unit || opt.estimated_unit_cost || 0),
                    groupOptions: group.options
                });
            });
        });
        return list;
    }, [groupedResults]);

    // Reset highlighted index when searchQuery changes
    useEffect(() => {
        setHighlightedIndex(0);
    }, [searchQuery]);

    // Scroll highlighted item into view automatically
    useEffect(() => {
        if (isOpen && highlightedIndex >= 0 && dropdownRef.current) {
            const highlightedEl = dropdownRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
            if (highlightedEl) {
                highlightedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
        }
    }, [highlightedIndex, isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            document.getElementById("register-shipment-btn")?.click();
            return;
        }

        if (!isOpen) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex(prev => {
                if (flatOptions.length === 0) return -1;
                return (prev + 1) % flatOptions.length;
            });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex(prev => {
                if (flatOptions.length === 0) return -1;
                return (prev - 1 + flatOptions.length) % flatOptions.length;
            });
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < flatOptions.length) {
                const sel = flatOptions[highlightedIndex];
                onSelect({
                    parent_product_id: String(sel.parent.product_id),
                    product_id: String(sel.product_id),
                    product_name: sel.parent.product_name,
                    product_code: sel.option.product_code || "",
                    selected_uom: sel.uom_shortcut,
                    base_unit_cost_php: String(sel.cost),
                    uom_options: sel.groupOptions.map((x: any) => ({
                        product_id: x.product_id,
                        unit_shortcut: x.unit_of_measurement?.unit_shortcut || "PCS",
                        cost_per_unit: x.cost_per_unit || x.estimated_unit_cost || 0
                    }))
                });
                setIsOpen(false);
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <div className="relative w-full">
            <div className="relative">
                <input
                    id={id}
                    ref={inputRef}
                    type="text"
                    placeholder="Type to search product..."
                    value={displayValue}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    className="w-full rounded-lg border bg-background pl-3 pr-8 py-2 text-xs h-9 font-semibold text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
                />
                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[40]" onClick={() => setIsOpen(false)} />
                    <div 
                        ref={dropdownRef}
                        data-dropdown-open="true"
                        className="absolute left-0 right-0 top-full mt-1 bg-card border rounded-xl shadow-2xl z-[50] max-h-60 overflow-y-auto divide-y"
                    >
                        {groupedResults.map((group) => {
                            const hasHighlightedOption = group.options.some((x: any) => {
                                const idx = flatOptions.findIndex(f => f.product_id === x.product_id);
                                return idx === highlightedIndex;
                            });

                            return (
                                <div 
                                    key={group.parent.product_id} 
                                    className={`p-3 transition-all flex flex-col gap-1.5 text-xs text-left ${
                                        hasHighlightedOption ? "bg-primary/[0.02] border-l-2 border-l-primary" : "hover:bg-muted/5"
                                    }`}
                                >
                                    <div>
                                        <div className="font-extrabold text-foreground">{group.parent.product_name}</div>
                                        <div className="text-[9px] text-muted-foreground font-mono">Base SKU: {group.parent.product_code || `ID-${group.parent.product_id}`}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                                        {group.options.map((opt: any) => {
                                            const cost = Number(opt.cost_per_unit || opt.estimated_unit_cost || 0);
                                            const flatIndex = flatOptions.findIndex(x => x.product_id === opt.product_id);
                                            const isHighlighted = flatIndex === highlightedIndex;

                                            return (
                                                <button
                                                    key={opt.product_id}
                                                    type="button"
                                                    data-index={flatIndex}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelect({
                                                            parent_product_id: String(group.parent.product_id),
                                                            product_id: String(opt.product_id),
                                                            product_name: group.parent.product_name,
                                                            product_code: opt.product_code || "",
                                                            selected_uom: opt.unit_of_measurement?.unit_shortcut || "PCS",
                                                            base_unit_cost_php: String(cost),
                                                            uom_options: group.options.map((x: any) => ({
                                                                product_id: x.product_id,
                                                                unit_shortcut: x.unit_of_measurement?.unit_shortcut || "PCS",
                                                                cost_per_unit: x.cost_per_unit || x.estimated_unit_cost || 0
                                                            }))
                                                        });
                                                        setIsOpen(false);
                                                    }}
                                                    className={`border px-2 py-1 rounded-[4px] text-[9px] font-bold transition-all flex items-center gap-1 ${
                                                        isHighlighted 
                                                            ? "bg-primary text-primary-foreground border-primary shadow-sm scale-[1.03]" 
                                                            : "bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border-primary/20"
                                                    }`}
                                                >
                                                    <span>{opt.unit_of_measurement?.unit_shortcut || "PCS"}</span>
                                                    <span className="opacity-50">|</span>
                                                    <span>₱{cost.toFixed(2)}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        {groupedResults.length === 0 && (
                            <div className="p-4 text-center text-xs text-muted-foreground italic">
                                No ingredients found matching "{searchQuery}"
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default function IncomingShipments({
    shipments,
    suppliers,
    rawMaterials,
    selectedShipment,
    setSelectedShipment,
    lines,
    isModalOpen,
    setIsModalOpen,
    shipmentForm,
    setShipmentForm,
    linesForm,
    setLinesForm,
    onCreateShipment,
    onTriggerAllocation,
    onUpdateShipmentStatus,
    loading = false
}: IncomingShipmentsProps) {
    const [search, setSearch] = useState("");

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === "n") {
                e.preventDefault();
                setIsModalOpen(true);
            }
            if (e.key === "Escape" && isModalOpen) {
                const activeDropdown = document.querySelector('[data-dropdown-open="true"]');
                if (!activeDropdown) {
                    setIsModalOpen(false);
                }
            }
        };
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [isModalOpen, setIsModalOpen]);

    const filteredShipments = shipments.filter(s =>
        s.reference_number.toLowerCase().includes(search.toLowerCase()) ||
        (s.supplier_id && typeof s.supplier_id === "object" && s.supplier_id.supplier_name.toLowerCase().includes(search.toLowerCase()))
    );

    const activeShipment = selectedShipment || filteredShipments[0] || null;

    const handleAddLineForm = () => {
        setLinesForm([...linesForm, { product_id: "", quantity_ordered: "", base_unit_cost_php: "" }]);
    };

    const handleRemoveLineForm = (index: number) => {
        const copy = [...linesForm];
        copy.splice(index, 1);
        setLinesForm(copy);
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleLineFormChange = (index: number, fieldOrObject: string | Record<string, any>, value?: any) => {
        const copy = [...linesForm];
        if (typeof fieldOrObject === "object") {
            copy[index] = { ...copy[index], ...fieldOrObject };
        } else {
            copy[index] = { ...copy[index], [fieldOrObject]: value };
        }
        setLinesForm(copy);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Ordered":
                return <span className="bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Ordered</span>;
            case "Approved":
                return <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Approved</span>;
            case "En Route":
                return <span className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">En Route</span>;
            case "Receiving (QA)":
                return <span className="bg-purple-500/10 text-purple-600 border border-purple-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Receiving (QA)</span>;
            case "Received":
                return <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Received</span>;
            default:
                return <span className="bg-muted text-muted-foreground border px-2 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{status}</span>;
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
            {/* Left Column: Shipments list */}
            <div className="w-full lg:w-2/5 flex flex-col border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="p-4 border-b space-y-3 shrink-0 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <Anchor className="h-4 w-4 text-primary" />
                            Incoming Shipments ({filteredShipments.length})
                        </h3>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-2.5 py-1.5 rounded-lg text-xs transition-all shadow-sm"
                        >
                            <Plus className="h-3.5 w-3.5" /> Log Cargo
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search BL/Reference, Supplier..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-xs bg-background outline-none focus:ring-1 focus:ring-primary font-medium"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y">
                    {filteredShipments.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                            No shipments logged. Click &quot;Log Cargo&quot; to add one.
                        </div>
                    ) : (
                        filteredShipments.map(s => {
                            const matchedSupplier = typeof s.supplier_id !== "object"
                                ? suppliers.find(sup => sup.id === Number(s.supplier_id))
                                : s.supplier_id;
                            const supName = matchedSupplier ? matchedSupplier.supplier_name : `Supplier ID: ${s.supplier_id}`;
                            return (
                                <button
                                    key={s.shipment_id}
                                    onClick={() => setSelectedShipment(s)}
                                    className={`w-full text-left p-4 hover:bg-muted/30 transition-all flex flex-col gap-2 ${
                                        activeShipment?.shipment_id === s.shipment_id ? "bg-primary/5 border-l-2 border-primary" : ""
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="font-bold text-xs text-foreground truncate">BL/PO: {s.reference_number}</span>
                                        {getStatusBadge(s.status)}
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                                        <span>{supName}</span>
                                        <span className="font-mono">{s.total_php_value ? `₱${Number(s.total_php_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "₱0.00"}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground flex justify-between">
                                        <span>Status: {s.status}</span>
                                        <span>
                                            {s.status === "Received" 
                                                ? `Received: ${s.date_received ? new Date(s.date_received).toLocaleDateString() : "N/A"}` 
                                                : `ETA: ${s.lead_time_receiving ? new Date(s.lead_time_receiving).toLocaleDateString() : "Pending"}`}
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right Column: Detailed shipment & cargo view */}
            <div className="flex-1 border rounded-xl bg-card overflow-y-auto p-6 shadow-sm flex flex-col gap-6">
                {activeShipment ? (
                    <>
                        {/* Header Details */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-5">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-extrabold text-foreground leading-tight">Cargo Invoice / BL: {activeShipment.reference_number}</h2>
                                    {getStatusBadge(activeShipment.status)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Supplier Source:{" "}
                                    <strong className="text-foreground font-semibold">
                                        {(() => {
                                            const matchedSupplier = typeof activeShipment.supplier_id !== "object"
                                                ? suppliers.find(sup => sup.id === Number(activeShipment.supplier_id))
                                                : activeShipment.supplier_id;
                                            return matchedSupplier ? matchedSupplier.supplier_name : `ID: ${activeShipment.supplier_id}`;
                                        })()}
                                    </strong>
                                </p>
                                <div className="flex items-center gap-1.5 mt-2 bg-muted/40 p-1 rounded-lg border text-[10px] font-bold w-fit">
                                    {(["Ordered", "Approved", "En Route", "Receiving (QA)"] as const).map((st) => {
                                        const isCurrent = activeShipment.status === st;
                                        return (
                                            <button
                                                key={st}
                                                type="button"
                                                onClick={() => onUpdateShipmentStatus(activeShipment.shipment_id, st)}
                                                className={`px-2.5 py-1 rounded transition-all ${
                                                    isCurrent 
                                                        ? "bg-primary text-primary-foreground shadow-sm" 
                                                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                                                }`}
                                            >
                                                {st}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:self-center">
                                <button
                                    onClick={() => onTriggerAllocation(activeShipment)}
                                    className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-3.5 py-2 rounded-lg text-xs shadow-sm transition-all"
                                >
                                    <Landmark className="h-4 w-4" /> Allocate Expenses & Duties
                                </button>
                            </div>
                        </div>

                        {/* Totals Summary */}
                        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
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
                                    {activeShipment.status === "Received" ? "Arrival Date" : "ETA / Expected"}
                                </span>
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5 text-primary" />
                                    {activeShipment.status === "Received"
                                        ? (activeShipment.date_received && activeShipment.date_received !== "1970-01-01" 
                                            ? new Date(activeShipment.date_received).toLocaleDateString() 
                                            : "N/A")
                                        : (activeShipment.lead_time_receiving 
                                            ? new Date(activeShipment.lead_time_receiving).toLocaleDateString() 
                                            : "Pending")}
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
                                            <th className="p-3 font-semibold text-muted-foreground">Product Ingredient</th>
                                            <th className="p-3 font-semibold text-muted-foreground text-right">Qty (QA / Ordered)</th>
                                            <th className="p-3 font-semibold text-muted-foreground text-right">FOB Unit Cost</th>
                                            <th className="p-3 font-semibold text-muted-foreground text-right">Landed Cost Allocated</th>
                                            <th className="p-3 font-semibold text-muted-foreground text-right bg-emerald-500/5 text-emerald-800 dark:text-emerald-300">Final Landed Unit Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {lines.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                    No items registered in this container.
                                                </td>
                                            </tr>
                                        ) : (
                                            lines.map(line => {
                                                const prod = line.product_id && typeof line.product_id === "object"
                                                    ? line.product_id
                                                    : { product_name: `ID: ${line.product_id}`, product_code: "N/A", unit_of_measurement: { unit_shortcut: "PCS" } };
                                                return (
                                                    <tr key={line.line_id} className="hover:bg-muted/20">
                                                        <td className="p-3">
                                                            <div className="font-semibold text-foreground">{prod.product_name}</div>
                                                            <div className="text-[10px] text-muted-foreground font-mono">Code: {prod.product_code}</div>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="font-semibold text-foreground">
                                                                {line.quantity_received !== null && line.quantity_received !== undefined ? (
                                                                    `${Number(line.quantity_received).toLocaleString()} / ${Number(line.quantity_ordered || 0).toLocaleString()}`
                                                                ) : (
                                                                    `${Number(line.quantity_ordered || 0).toLocaleString()} (Ordered)`
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground">{prod.unit_of_measurement?.unit_shortcut || "PCS"}</div>
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-[11px]">
                                                            ₱{Number(line.base_unit_cost_php).toFixed(2)}
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-[11px] text-muted-foreground">
                                                            +₱{Number(line.allocated_expense_php || 0).toFixed(2)}
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-[11px] font-bold bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                                                            ₱{Number(line.final_landed_unit_cost || line.base_unit_cost_php).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Informative Note */}
                        {activeShipment.status !== "Received" && (
                            <div className="flex items-start gap-2.5 bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl">
                                <Info className="h-4.5 w-4.5 text-blue-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <h5 className="text-xs font-bold text-blue-800 dark:text-blue-300">Pending Landed Cost Recalculation</h5>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        This cargo is currently marked as <strong className="text-foreground">{activeShipment.status}</strong>. Custom duties, ARR, brokerages, and shipping lines must be added/allocated. Marking this shipment as <strong>Received</strong> will commit the computed landed costs to the raw inventory database to update standard BOM prices.
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground h-full">
                        <Anchor className="h-16 w-16 mb-4 text-muted-foreground/30" />
                        No incoming shipments logged.
                    </div>
                )}
            </div>

            {/* Modal to Log Shipment Cargo */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-card text-foreground w-full max-w-2xl border rounded-xl shadow-lg p-6 space-y-4 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between border-b pb-3 shrink-0">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <Anchor className="h-4.5 w-4.5 text-primary" />
                                Log Incoming Cargo & PO Line Items
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground text-xs font-bold"
                            >
                                Close
                            </button>
                        </div>

                        <form onSubmit={onCreateShipment} className="space-y-4 overflow-y-auto pr-1 flex-1">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">PO / Bill of Lading Number *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. BL-NABATI-2026-004"
                                        value={shipmentForm.reference_number}
                                        onChange={e => setShipmentForm({...shipmentForm, reference_number: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>

                                <div className="space-y-1.5 flex flex-col">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Select Vendor / Supplier *</label>
                                    <CreatableSelect
                                        options={suppliers.map(s => ({ value: String(s.id), label: s.supplier_name }))}
                                        value={shipmentForm.supplier_id}
                                        onValueChange={(val) => setShipmentForm({...shipmentForm, supplier_id: val})}
                                        placeholder="Select Supplier..."
                                        className="h-9 text-xs w-full bg-background font-semibold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Customs FX Rate Used (USD to PHP)</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={shipmentForm.exchange_rate}
                                        onChange={e => setShipmentForm({...shipmentForm, exchange_rate: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Expected Arrival / ETA Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={shipmentForm.date_received || ""}
                                        onChange={e => setShipmentForm({...shipmentForm, date_received: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground">Initial Status</label>
                                    <select
                                        value={shipmentForm.status}
                                        onChange={e => setShipmentForm({...shipmentForm, status: e.target.value})}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                    >
                                        <option value="Ordered">Ordered</option>
                                        <option value="Approved">Approved</option>
                                        <option value="En Route">En Route</option>
                                        <option value="Receiving (QA)">Receiving (QA)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Cargo Manifest builder */}
                            <div className="space-y-3 pt-3 border-t">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Cargo Manifest Contents</h4>
                                    <button
                                        type="button"
                                        onClick={handleAddLineForm}
                                        className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-xs font-semibold"
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Add Row
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {linesForm.map((line, idx) => (
                                        <div key={idx} className="flex gap-3 items-end bg-muted/10 border p-3 rounded-lg relative flex-wrap sm:flex-nowrap">
                                            <div className="flex-[3] space-y-1.5 min-w-[200px] flex flex-col relative">
                                                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Raw Product Name</label>
                                                <RawProductSelector
                                                    id={`search-input-${idx}`}
                                                    autoFocus={idx === linesForm.length - 1 && linesForm.length > 1}
                                                    rawMaterials={rawMaterials}
                                                    selectedProductId={line.product_id}
                                                    parentProductId={line.parent_product_id}
                                                    productName={line.product_name}
                                                    onSelect={(selected) => {
                                                        handleLineFormChange(idx, selected);
                                                        // Move focus to Qty Ordered input of the same row
                                                        setTimeout(() => {
                                                            const nextInput = document.getElementById(`qty-input-${idx}`);
                                                            if (nextInput) {
                                                                nextInput.focus();
                                                                if (nextInput instanceof HTMLInputElement) {
                                                                    nextInput.select();
                                                                }
                                                            }
                                                        }, 50);
                                                    }}
                                                />
                                            </div>

                                            {line.uom_options && line.uom_options.length > 0 && (
                                                <div className="w-28 space-y-1.5 shrink-0">
                                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Packaging / UOM</label>
                                                    <select
                                                        value={line.product_id}
                                                        onChange={(e) => {
                                                            const selectedId = e.target.value;
                                                            const opt = line.uom_options?.find((o: any) => String(o.product_id) === String(selectedId));
                                                            if (opt) {
                                                                handleLineFormChange(idx, {
                                                                    product_id: String(selectedId),
                                                                    selected_uom: opt.unit_shortcut,
                                                                    base_unit_cost_php: String(opt.cost_per_unit)
                                                                });
                                                            }
                                                        }}
                                                        className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none h-9 text-foreground font-semibold"
                                                    >
                                                        {line.uom_options.map((o: any) => (
                                                            <option key={o.product_id} value={o.product_id}>
                                                                {o.unit_shortcut} (₱{Number(o.cost_per_unit || 0).toFixed(2)})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            <div className="w-24 space-y-1.5 shrink-0">
                                                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                                    Qty Ordered {line.selected_uom ? `(${line.selected_uom})` : ""}
                                                </label>
                                                <input
                                                    id={`qty-input-${idx}`}
                                                    type="number"
                                                    required
                                                    placeholder="1000"
                                                    value={line.quantity_ordered || ""}
                                                    onChange={e => handleLineFormChange(idx, "quantity_ordered", e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            const costInput = document.getElementById(`cost-input-${idx}`);
                                                            if (costInput) {
                                                                costInput.focus();
                                                                if (costInput instanceof HTMLInputElement) {
                                                                    costInput.select();
                                                                }
                                                            }
                                                        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                                            e.preventDefault();
                                                            document.getElementById("register-shipment-btn")?.click();
                                                        }
                                                    }}
                                                    className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none h-9 font-semibold"
                                                />
                                            </div>

                                            <div className="w-28 space-y-1.5 shrink-0">
                                                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">FOB Unit Cost (PHP)</label>
                                                <input
                                                    id={`cost-input-${idx}`}
                                                    type="number"
                                                    required
                                                    step="0.0001"
                                                    placeholder="19.00"
                                                    value={line.base_unit_cost_php}
                                                    onChange={e => handleLineFormChange(idx, "base_unit_cost_php", e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            if (idx === linesForm.length - 1) {
                                                                handleAddLineForm();
                                                            } else {
                                                                const nextSearchInput = document.getElementById(`search-input-${idx + 1}`);
                                                                if (nextSearchInput) {
                                                                    nextSearchInput.focus();
                                                                }
                                                            }
                                                        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                                            e.preventDefault();
                                                            document.getElementById("register-shipment-btn")?.click();
                                                        }
                                                    }}
                                                    className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none font-mono h-9"
                                                />
                                            </div>
                                            {linesForm.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLineForm(idx)}
                                                    className="text-red-500 hover:text-red-600 text-xs font-bold pb-2.5 shrink-0"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                                                id="register-shipment-btn"
                                                                type="submit"
                                                                disabled={loading}
                                                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {loading ? (
                                                                    <>
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                        Registering Shipment...
                                                                    </>
                                                                ) : "Register Shipment"}
                                                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
