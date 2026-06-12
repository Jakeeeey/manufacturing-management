import React, { useState } from "react";
import { RawMaterial } from "../types";
import { Search, Layers, ChevronDown, ChevronUp, MapPin, Bookmark, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface RawMaterialsMasterProps {
    rawMaterials: RawMaterial[];
}

export default function RawMaterialsMaster({ rawMaterials }: RawMaterialsMasterProps) {
    const [search, setSearch] = useState("");
    const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [productBatches, setProductBatches] = useState<any[]>([]);

    const filtered = rawMaterials.filter(m =>
        m.product_name.toLowerCase().includes(search.toLowerCase()) ||
        m.product_code?.toLowerCase().includes(search.toLowerCase())
    );

    const handleToggleExpand = async (productId: number) => {
        if (expandedProductId === productId) {
            setExpandedProductId(null);
            setProductBatches([]);
            return;
        }

        setExpandedProductId(productId);
        setLoadingBatches(true);
        try {
            const res = await fetch(`/api/manufacturing/procurement/qa-receiving?productId=${productId}`);
            if (res.ok) {
                const data = await res.json();
                setProductBatches(data || []);
            } else {
                toast.error("Failed to load inventory details");
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error loading inventory details");
        } finally {
            setLoadingBatches(false);
        }
    };

    // Group batches by branch name for rendering
    const groupedByBranch = React.useMemo(() => {
        const branchesMap: Record<string, {
            branchName: string;
            branchCode: string;
            batches: any[];
            totalQty: number;
        }> = {};

        productBatches.forEach((item: any) => {
            const branch = item.branch_id || { branch_name: "Unassigned Warehouse", branch_code: "N/A" };
            const branchName = branch.branch_name;

            if (!branchesMap[branchName]) {
                branchesMap[branchName] = {
                    branchName,
                    branchCode: branch.branch_code,
                    batches: [],
                    totalQty: 0
                };
            }

            branchesMap[branchName].batches.push({
                lot_number: item.lot_number || "BATCH-N/A",
                expiration_date: item.expiration_date,
                qty: Number(item.quantity_received || 0),
                reception_date: item.shipment_id?.date_received || "N/A",
                shipment_ref: item.shipment_id?.reference_number || "N/A"
            });

            branchesMap[branchName].totalQty += Number(item.quantity_received || 0);
        });

        return Object.values(branchesMap);
    }, [productBatches]);

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
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 border p-4 rounded-xl">
                <div className="space-y-0.5">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 shrink-0">
                        <Layers className="h-4.5 w-4.5 text-primary" />
                        Raw Materials & Packaging Master Catalog ({filtered.length})
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Select a raw material row to inspect stock balances and FIFO batch schedules per branch location.</p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search raw ingredients, packaging..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border rounded-lg text-xs bg-background outline-none focus:ring-1 focus:ring-primary font-medium"
                    />
                </div>
            </div>

            {/* List */}
            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-muted/50 border-b">
                            <th className="p-3 w-10"></th>
                            <th className="p-3 font-semibold text-muted-foreground">Material Name</th>
                            <th className="p-3 font-semibold text-muted-foreground">Product Code</th>
                            <th className="p-3 font-semibold text-muted-foreground text-center">UOM</th>
                            <th className="p-3 font-semibold text-muted-foreground text-right">Density Factor</th>
                            <th className="p-3 font-semibold text-muted-foreground text-right font-bold text-foreground">Standard Landed Unit Cost (PHP)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-muted-foreground">
                                    No raw materials found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map(m => {
                                const isExpanded = expandedProductId === m.product_id;
                                const isPkg = m.product_name.toLowerCase().includes("box") || m.product_name.toLowerCase().includes("bottle") || m.product_name.toLowerCase().includes("cap") || m.product_name.toLowerCase().includes("sticker") || m.product_name.toLowerCase().includes("packaging");

                                return (
                                    <React.Fragment key={m.product_id}>
                                        <tr 
                                            onClick={() => handleToggleExpand(m.product_id)}
                                            className="hover:bg-muted/10 cursor-pointer transition-all"
                                        >
                                            <td className="p-3 text-center">
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                            </td>
                                            <td className="p-3">
                                                <span className="font-semibold text-foreground block">{m.product_name}</span>
                                                <span className={`text-[8px] font-bold uppercase tracking-wider block ${isPkg ? "text-purple-500" : "text-amber-500"}`}>
                                                    {isPkg ? "Packaging Item" : "Raw Material"}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                                {m.product_code || `ID-${m.product_id}`}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-bold text-foreground">
                                                    {m.unit_of_measurement?.unit_shortcut || "PCS"}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono font-medium">
                                                {m.density_factor ? m.density_factor.toFixed(3) : "1.000"} g/mL
                                            </td>
                                            <td className="p-3 text-right font-mono text-xs font-bold text-foreground bg-emerald-500/5">
                                                ₱{m.cost_per_unit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>

                                        {/* Expandable FIFO Stock Breakdown */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={6} className="bg-muted/5 p-4 border-b">
                                                    <div className="space-y-4">
                                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-1.5">
                                                            <MapPin className="h-3.5 w-3.5 text-primary" />
                                                            Active Stock Locations & Batch Logs
                                                        </h4>
                                                        
                                                        {loadingBatches ? (
                                                            <div className="text-center py-4 text-xs text-muted-foreground">Loading stock logs...</div>
                                                        ) : groupedByBranch.length === 0 ? (
                                                            <div className="text-center py-4 text-xs text-muted-foreground italic flex items-center justify-center gap-1.5">
                                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                                                No physical stock batches currently recorded at any warehouse location.
                                                            </div>
                                                        ) : (
                                                            <div className="grid gap-4 sm:grid-cols-2">
                                                                {groupedByBranch.map((branchGroup, bIdx) => (
                                                                    <div key={bIdx} className="bg-card border rounded-lg p-3 space-y-2.5">
                                                                        <div className="flex justify-between items-center border-b pb-1">
                                                                            <span className="font-extrabold text-xs text-foreground block">{branchGroup.branchName}</span>
                                                                            <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded">
                                                                                {branchGroup.totalQty.toLocaleString()} {m.unit_of_measurement?.unit_shortcut || "PCS"}
                                                                            </span>
                                                                        </div>

                                                                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                                                                            {branchGroup.batches.map((batch, btIdx) => {
                                                                                const expStatus = getExpirationStatus(batch.expiration_date);
                                                                                return (
                                                                                    <div key={btIdx} className="flex justify-between items-center text-[10px] py-1 border-b last:border-0 border-muted/30">
                                                                                        <span className="font-bold text-foreground flex items-center gap-1">
                                                                                            <Bookmark className="h-3 w-3 text-primary" />
                                                                                            {batch.lot_number}
                                                                                        </span>
                                                                                        <span className="text-muted-foreground">
                                                                                            {isPkg ? `Rec: ${batch.reception_date}` : `Exp: ${batch.expiration_date || "N/A"}`}
                                                                                        </span>
                                                                                        <span className="font-mono font-bold text-foreground">
                                                                                            {batch.qty.toLocaleString()} units
                                                                                        </span>
                                                                                        {!isPkg && (
                                                                                            <span className={`px-1 rounded text-[8px] font-black uppercase ${expStatus.color}`}>
                                                                                                {expStatus.text}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
