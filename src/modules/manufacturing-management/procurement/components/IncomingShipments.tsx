import React, { useState } from "react";
import { IncomingShipment, ShipmentLineItem, Supplier, RawMaterial } from "../types";
import { Search, Plus, Calendar, ShieldCheck, Truck, Layers, Anchor, AlertCircle, Info, Landmark, Edit, RefreshCw } from "lucide-react";
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
    shipmentForm: any;
    setShipmentForm: React.Dispatch<React.SetStateAction<any>>;
    linesForm: any[];
    setLinesForm: React.Dispatch<React.SetStateAction<any[]>>;
    onCreateShipment: (e: React.FormEvent) => void;
    onTriggerAllocation: (s: IncomingShipment) => void;
    onUpdateShipmentStatus: (shipmentId: number, status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received") => void;
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
    onUpdateShipmentStatus
}: IncomingShipmentsProps) {
    const [search, setSearch] = useState("");
    const [lookupIndex, setLookupIndex] = useState<number | null>(null);
    const [lookupSearch, setLookupSearch] = useState("");
    const [searchResults, setSearchResults] = useState<RawMaterial[]>([]);
    const [searching, setSearching] = useState(false);

    // Debounced server-side product search
    React.useEffect(() => {
        if (lookupIndex === null) {
            setSearchResults([]);
            return;
        }

        let active = true;
        setSearching(true);

        const delayDebounce = setTimeout(() => {
            fetch(`/api/manufacturing/finished-goods/products?search=${encodeURIComponent(lookupSearch.trim())}&limit=80`)
                .then(res => res.json())
                .then(data => {
                    if (!active) return;
                    if (Array.isArray(data)) {
                        const mapped: RawMaterial[] = data.map((p: any) => ({
                            product_id: p.product_id,
                            parent_id: p.parent_id ? (typeof p.parent_id === "object" ? p.parent_id.product_id : p.parent_id) : null,
                            product_code: p.product_code || `SKU-${p.product_id}`,
                            product_name: p.product_name,
                            unit_of_measurement: p.unit_of_measurement ? {
                                unit_id: p.unit_of_measurement.unit_id,
                                unit_shortcut: p.unit_of_measurement.unit_shortcut,
                                unit_name: p.unit_of_measurement.unit_name || p.unit_of_measurement.unit_shortcut
                            } : undefined,
                            cost_per_unit: Number(p.cost_per_unit || 0),
                            estimated_unit_cost: Number(p.estimated_unit_cost || 0),
                            density_factor: Number(p.density_factor || 1.0)
                        }));
                        setSearchResults(mapped);
                    }
                    setSearching(false);
                })
                .catch(err => {
                    console.error("Error searching products:", err);
                    if (active) setSearching(false);
                });
        }, 250);

        return () => {
            active = false;
            clearTimeout(delayDebounce);
        };
    }, [lookupSearch, lookupIndex]);

    // Group matching products by parent item dynamically
    const groupedResults = React.useMemo(() => {
        const parentMap = new Map<number, RawMaterial>();
        const childrenMap = new Map<number, RawMaterial[]>();

        // 1. Separate parents and children from searchResults
        searchResults.forEach(item => {
            if (!item.parent_id) {
                parentMap.set(item.product_id, item);
            }
        });

        searchResults.forEach(item => {
            if (item.parent_id) {
                const pId = item.parent_id;
                if (!childrenMap.has(pId)) {
                    childrenMap.set(pId, []);
                }
                childrenMap.get(pId)!.push(item);
            }
        });

        // 2. Synthesize virtual parents for children whose parent records didn't match the search filter
        searchResults.forEach(item => {
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
    }, [searchResults]);

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
                            No shipments logged. Click "Log Cargo" to add one.
                        </div>
                    ) : (
                        filteredShipments.map(s => {
                            const supName = s.supplier_id && typeof s.supplier_id === "object"
                                ? s.supplier_id.supplier_name
                                : `Supplier ID: ${s.supplier_id}`;
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
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span className="truncate max-w-[60%]">{supName}</span>
                                        <span className="flex items-center gap-1 shrink-0 font-semibold text-foreground">
                                            ₱{s.total_php_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                        {activeShipment.supplier_id && typeof activeShipment.supplier_id === "object"
                                            ? activeShipment.supplier_id.supplier_name
                                            : `ID: ${activeShipment.supplier_id}`}
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
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Arrival Date</span>
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5 text-primary" />
                                    {activeShipment.date_received && activeShipment.date_received !== "1970-01-01" 
                                        ? new Date(activeShipment.date_received).toLocaleDateString() 
                                        : "Pending QA"}
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
                                        <div key={idx} className="flex gap-3 items-end bg-muted/10 border p-3 rounded-lg relative">
                                            <div className="flex-[3] space-y-1.5 min-w-0 flex flex-col">
                                                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Raw Product Name</label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLookupIndex(idx);
                                                        setLookupSearch("");
                                                    }}
                                                    className="w-full text-left rounded-lg border bg-background px-3 py-2 text-xs flex justify-between items-center h-9 font-semibold text-foreground"
                                                >
                                                    <span className="truncate">
                                                        {line.product_name 
                                                            ? `${line.product_name} (${line.selected_uom || "PCS"})` 
                                                            : rawMaterials.find(m => String(m.product_id) === String(line.parent_product_id))?.product_name 
                                                                ? `${rawMaterials.find(m => String(m.product_id) === String(line.parent_product_id))?.product_name} (${rawMaterials.find(m => String(m.product_id) === String(line.product_id))?.unit_of_measurement?.unit_shortcut || "PCS"})`
                                                                : "Click to select Product..."
                                                        }
                                                    </span>
                                                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                </button>
                                            </div>

                                            <div className="w-1/4 space-y-1.5 shrink-0">
                                                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                                    Qty Ordered {line.selected_uom ? `(${line.selected_uom})` : ""}
                                                </label>
                                                <input
                                                    type="number"
                                                    required
                                                    placeholder="1000"
                                                    value={line.quantity_ordered || ""}
                                                    onChange={e => handleLineFormChange(idx, "quantity_ordered", e.target.value)}
                                                    className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none h-9 font-semibold"
                                                />
                                            </div>

                                            <div className="w-1/4 space-y-1.5 shrink-0">
                                                <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">FOB Unit Cost (PHP)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    step="0.0001"
                                                    placeholder="19.00"
                                                    value={line.base_unit_cost_php}
                                                    onChange={e => handleLineFormChange(idx, "base_unit_cost_php", e.target.value)}
                                                    className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none font-mono h-9"
                                                />
                                            </div>
                                            {linesForm.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLineForm(idx)}
                                                    className="text-red-500 hover:text-red-600 text-xs font-bold pb-2 shrink-0"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm shrink-0"
                            >
                                Register Shipment
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Searchable Product Selector Modal Overlay */}
            {lookupIndex !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card text-foreground w-full max-w-xl border rounded-xl shadow-2xl p-6 space-y-4 flex flex-col max-h-[80vh] scale-in duration-200">
                        <div className="flex items-center justify-between border-b pb-3 shrink-0">
                            <h3 className="font-extrabold text-sm flex items-center gap-2">
                                <Layers className="h-4.5 w-4.5 text-primary" />
                                Select Raw Material / Ingredient
                            </h3>
                            <button
                                type="button"
                                onClick={() => setLookupIndex(null)}
                                className="text-xs font-bold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground px-2.5 py-1 rounded"
                            >
                                Cancel
                            </button>
                        </div>

                        <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Type raw ingredient name or code to filter..."
                                value={lookupSearch}
                                onChange={e => setLookupSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-xs bg-background outline-none focus:ring-1 focus:ring-primary font-medium"
                            />
                        </div>

                        {/* Scrollable list */}
                        <div className="flex-1 overflow-y-auto divide-y border rounded-lg max-h-[45vh]">
                            {searching && (
                                <div className="flex items-center justify-center p-8 text-muted-foreground gap-2">
                                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></span>
                                    <span className="text-xs">Searching materials list...</span>
                                </div>
                            )}
                            
                            {!searching && groupedResults.map(({ parent, options }) => {
                                return (
                                    <div key={parent.product_id} className="p-3.5 hover:bg-muted/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs text-foreground truncate">{parent.product_name}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Code: {parent.product_code || `ID-${parent.product_id}`}</div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 shrink-0 items-center">
                                            {options.map(opt => (
                                                <button
                                                    key={opt.product_id}
                                                    type="button"
                                                    onClick={() => {
                                                        const serializedOptions = options.map(o => ({
                                                            product_id: o.product_id,
                                                            unit_shortcut: o.unit_of_measurement?.unit_shortcut || "PCS",
                                                            cost_per_unit: o.cost_per_unit || o.estimated_unit_cost || 0
                                                        }));

                                                        handleLineFormChange(lookupIndex, {
                                                            parent_product_id: String(parent.product_id),
                                                            product_id: String(opt.product_id),
                                                            product_name: parent.product_name,
                                                            product_code: parent.product_code || "",
                                                            selected_uom: opt.unit_of_measurement?.unit_shortcut || "PCS",
                                                            base_unit_cost_php: String(opt.cost_per_unit || opt.estimated_unit_cost || 0),
                                                            uom_options: serializedOptions
                                                        });
                                                        setLookupIndex(null);
                                                    }}
                                                    className="bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 px-2.5 py-1 rounded text-[10px] font-bold transition-all shadow-sm"
                                                >
                                                    {opt.unit_of_measurement?.unit_shortcut || "PCS"} (₱{Number(opt.cost_per_unit || opt.estimated_unit_cost || 0).toFixed(2)})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {!searching && groupedResults.length === 0 && (
                                <div className="p-8 text-center text-xs text-muted-foreground">
                                    No ingredients found matching &quot;{lookupSearch}&quot;
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
