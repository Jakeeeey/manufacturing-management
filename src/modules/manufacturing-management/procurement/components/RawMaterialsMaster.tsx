import React, { useState, useEffect } from "react";
import { RawMaterial, Supplier } from "../types";
import { Search, Layers, ChevronDown, ChevronUp, MapPin, Bookmark, AlertTriangle, Plus, X, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { CreatableSelect } from "../../finished-goods/components/CreatableSelect";

interface RawMaterialsMasterProps {
    rawMaterials: RawMaterial[];
    suppliers: Supplier[];
    onRegisterRawMaterial: (productDetails: any, supplierIds: number[]) => Promise<boolean>;
}

interface UnitOption {
    unit_id: number;
    unit_name: string;
    unit_shortcut: string;
}

interface SelectOption {
    value: string;
    label: string;
}

export default function RawMaterialsMaster({ rawMaterials, suppliers, onRegisterRawMaterial }: RawMaterialsMasterProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "raw" | "pkg">("all");
    const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [productBatches, setProductBatches] = useState<any[]>([]);

    // Registration Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [registering, setRegistering] = useState(false);
    const [units, setUnits] = useState<UnitOption[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [brandsList, setBrandsList] = useState<SelectOption[]>([]);
    const [categoriesList, setCategoriesList] = useState<SelectOption[]>([]);

    // Form fields
    const [formName, setFormName] = useState("");
    const [formCode, setFormCode] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formUom, setFormUom] = useState<number | "">("");
    const [formCost, setFormCost] = useState("0.00");
    const [formDensity, setFormDensity] = useState("1.000");
    const [formBrand, setFormBrand] = useState("");
    const [formCategory, setFormCategory] = useState("");
    const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
    const [supplierSearch, setSupplierSearch] = useState("");

    // Load metadata lists on modal mount
    useEffect(() => {
        if (!isModalOpen) return;
        setLoadingUnits(true);
        
        Promise.all([
            fetch("/api/manufacturing/finished-goods/units").then(res => res.json()),
            fetch("/api/manufacturing/finished-goods/brands").then(res => res.json()),
            fetch("/api/manufacturing/finished-goods/categories").then(res => res.json())
        ])
        .then(([unitsData, brandsData, categoriesData]) => {
            setUnits(unitsData || []);
            if (unitsData && unitsData.length > 0) {
                setFormUom(unitsData[0].unit_id);
            }
            setBrandsList((brandsData || []).map((b: any) => ({ value: String(b.brand_id), label: b.brand_name })));
            setCategoriesList((categoriesData || []).map((c: any) => ({ value: String(c.category_id), label: c.category_name })));
        })
        .catch(err => {
            console.error("Failed to load raw material metadata:", err);
            toast.error("Failed to load options metadata");
        })
        .finally(() => {
            setLoadingUnits(false);
        });
    }, [isModalOpen]);

    const isItemPkg = (name: string) => {
        const lower = name.toLowerCase();
        return lower.includes("box") || lower.includes("bottle") || lower.includes("cap") || lower.includes("sticker") || lower.includes("packaging");
    };

    const handleCreateBrandOnTheFly = async (name: string) => {
        try {
            const res = await fetch("/api/manufacturing/finished-goods/brands", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ brand_name: name })
            });
            if (!res.ok) throw new Error("Failed to create brand");
            const data = await res.json();
            const newBrand = data.brand;
            if (newBrand) {
                setBrandsList(prev => [...prev, { value: String(newBrand.brand_id), label: newBrand.brand_name }]);
                setFormBrand(String(newBrand.brand_id));
                toast.success(`Brand "${name}" created on the fly`);
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to create brand");
        }
    };

    const handleCreateCategoryOnTheFly = async (name: string) => {
        try {
            const res = await fetch("/api/manufacturing/finished-goods/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category_name: name })
            });
            if (!res.ok) throw new Error("Failed to create category");
            const data = await res.json();
            const newCat = data.category;
            if (newCat) {
                setCategoriesList(prev => [...prev, { value: String(newCat.category_id), label: newCat.category_name }]);
                setFormCategory(String(newCat.category_id));
                toast.success(`Category "${name}" created on the fly`);
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to create category");
        }
    };

    const filtered = rawMaterials.filter(m => {
        const matchesSearch = m.product_name.toLowerCase().includes(search.toLowerCase()) ||
            m.product_code?.toLowerCase().includes(search.toLowerCase());
        
        if (!matchesSearch) return false;
        
        const isPkg = isItemPkg(m.product_name);
        if (typeFilter === "raw") return !isPkg;
        if (typeFilter === "pkg") return isPkg;
        return true;
    });

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

    const handleToggleSupplier = (supplierId: number) => {
        if (selectedSupplierIds.includes(supplierId)) {
            setSelectedSupplierIds(selectedSupplierIds.filter(id => id !== supplierId));
        } else {
            setSelectedSupplierIds([...selectedSupplierIds, supplierId]);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            toast.error("Material Name is required");
            return;
        }
        if (!formCode.trim()) {
            toast.error("SKU / Product Code is required");
            return;
        }
        if (!formUom) {
            toast.error("Unit of Measurement is required");
            return;
        }
        if (!formCategory) {
            toast.error("Category is required");
            return;
        }

        setRegistering(true);
        const payload = {
            product_name: formName.trim(),
            product_code: formCode.trim().toUpperCase(),
            description: formDesc.trim() || undefined,
            unit_of_measurement: Number(formUom),
            cost_per_unit: parseFloat(formCost) || 0,
            density_factor: parseFloat(formDensity) || 1.0,
            price_per_unit: 0, // Default price to 0 for raw ingredients
            product_brand: formBrand ? Number(formBrand) : undefined,
            product_category: Number(formCategory)
        };

        const success = await onRegisterRawMaterial(payload, selectedSupplierIds);
        setRegistering(false);
        if (success) {
            setIsModalOpen(false);
            // Reset form
            setFormName("");
            setFormCode("");
            setFormDesc("");
            setFormCost("0.00");
            setFormDensity("1.000");
            setFormBrand("");
            setFormCategory("");
            setSelectedSupplierIds([]);
            setSupplierSearch("");
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

    const filteredSuppliers = suppliers.filter(s =>
        s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        s.supplier_shortcut?.toLowerCase().includes(supplierSearch.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 border p-4 rounded-xl">
                <div className="space-y-0.5">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 shrink-0">
                        <Layers className="h-4.5 w-4.5 text-primary" />
                        Raw Materials & Packaging Master Catalog ({filtered.length})
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Log incoming cargo, register raw materials, or inspect warehouse batches.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                    <div className="relative flex-1 sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search ingredients, packaging..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border rounded-lg text-xs bg-background outline-none focus:ring-1 focus:ring-primary font-medium"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold px-3 py-2 rounded-lg transition-all shadow-sm"
                    >
                        <Plus className="h-4 w-4" /> Register Item
                    </button>
                </div>
            </div>

            {/* Filter segments & Tooltip Note */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border px-4 py-3 rounded-xl">
                <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border text-[11px] font-bold">
                    <button
                        onClick={() => setTypeFilter("all")}
                        className={`px-3 py-1 rounded-md transition-all ${typeFilter === "all" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        All Items
                    </button>
                    <button
                        onClick={() => setTypeFilter("raw")}
                        className={`px-3 py-1 rounded-md transition-all ${typeFilter === "raw" ? "bg-background shadow-sm text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Raw Materials
                    </button>
                    <button
                        onClick={() => setTypeFilter("pkg")}
                        className={`px-3 py-1 rounded-md transition-all ${typeFilter === "pkg" ? "bg-background shadow-sm text-purple-500" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Packaging Items
                    </button>
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                    <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>Keyword auto-detection classifies items by name tag (box, bottle, cap, sticker, packaging).</span>
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
                                    No items found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map(m => {
                                const isExpanded = expandedProductId === m.product_id;
                                const isPkg = isItemPkg(m.product_name);

                                return (
                                    <React.Fragment key={m.product_id}>
                                        <tr 
                                            onClick={() => handleToggleExpand(m.product_id)}
                                            className="hover:bg-muted/10 cursor-pointer transition-all border-l-2 border-l-transparent hover:border-l-primary"
                                        >
                                            <td className="p-3 text-center">
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                            </td>
                                            <td className="p-3">
                                                <span className="font-semibold text-foreground block">{m.product_name}</span>
                                                <span className={`text-[8px] font-bold uppercase tracking-wider block mt-0.5 ${isPkg ? "text-purple-500" : "text-amber-500"}`}>
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

            {/* Registration Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card border rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] scale-in duration-200">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between border-b p-5 shrink-0">
                            <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                                <Layers className="h-5 w-5 text-primary" />
                                Register Raw Material / Packaging Item
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Material Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Soya Bean Oil (Pure Refined)"
                                        value={formName}
                                        onChange={e => {
                                            setFormName(e.target.value);
                                            // Auto-generate code if empty or based on initials
                                            if (!formCode) {
                                                const words = e.target.value.split(/\s+/).filter(Boolean);
                                                const initials = words.map(w => w[0]).join("").replace(/[^a-zA-Z]/g, "").toUpperCase();
                                                if (initials) {
                                                    setFormCode(`RM-${initials.substring(0, 5)}`);
                                                }
                                            }
                                        }}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-semibold text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">SKU / Product Code</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. RM-SOYA-01"
                                        value={formCode}
                                        onChange={e => setFormCode(e.target.value)}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono text-foreground font-bold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Base UOM</label>
                                    {loadingUnits ? (
                                        <div className="h-9 flex items-center justify-center border rounded-lg bg-background">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            value={formUom}
                                            onChange={e => setFormUom(Number(e.target.value))}
                                            className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary text-foreground font-semibold"
                                        >
                                            <option value="">-- Select UOM --</option>
                                            {units.map(u => (
                                                <option key={u.unit_id} value={u.unit_id}>
                                                    {u.unit_name} ({u.unit_shortcut})
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Brand (Optional)</label>
                                    <CreatableSelect
                                        options={brandsList}
                                        value={formBrand}
                                        onValueChange={setFormBrand}
                                        placeholder="Select Brand..."
                                        onCreateOption={handleCreateBrandOnTheFly}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Category (Required)</label>
                                    <CreatableSelect
                                        options={categoriesList}
                                        value={formCategory}
                                        onValueChange={setFormCategory}
                                        placeholder="Select Category..."
                                        onCreateOption={handleCreateCategoryOnTheFly}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Standard Landed Unit Cost (PHP)</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.0001"
                                        min="0"
                                        value={formCost}
                                        onChange={e => setFormCost(e.target.value)}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono font-bold text-foreground"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Density Factor (g/mL)</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.001"
                                        min="0.001"
                                        value={formDensity}
                                        onChange={e => setFormDensity(e.target.value)}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-mono font-bold text-foreground"
                                    />
                                </div>

                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Description</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Add raw material specifications, quality requirements, notes..."
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary font-medium text-foreground resize-none"
                                    />
                                </div>

                                <div className="col-span-2 space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Link Approved Suppliers / Vendors</label>
                                        <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                            {selectedSupplierIds.length} Linked
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Filter suppliers list..."
                                        value={supplierSearch}
                                        onChange={e => setSupplierSearch(e.target.value)}
                                        className="w-full rounded-lg border bg-background px-3 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-primary font-medium mb-1.5"
                                    />
                                    <div className="border rounded-lg bg-background p-2.5 max-h-[140px] overflow-y-auto divide-y divide-muted/30">
                                        {filteredSuppliers.length === 0 ? (
                                            <div className="text-center py-4 text-xs text-muted-foreground">No suppliers match search</div>
                                        ) : (
                                            filteredSuppliers.map(s => {
                                                const isChecked = selectedSupplierIds.includes(s.id);
                                                return (
                                                    <label 
                                                        key={s.id} 
                                                        className="flex items-center gap-2 py-1.5 hover:bg-muted/10 cursor-pointer select-none text-xs font-semibold text-foreground"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => handleToggleSupplier(s.id)}
                                                            className="rounded text-primary focus:ring-0 h-3.5 w-3.5"
                                                        />
                                                        <span>{s.supplier_name}</span>
                                                        {s.supplier_shortcut && (
                                                            <span className="text-[9px] text-muted-foreground font-mono">({s.supplier_shortcut})</span>
                                                        )}
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="border-t pt-4 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-extrabold px-4 py-2.5 rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={registering}
                                    className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-extrabold px-5 py-2.5 rounded-lg transition-all shadow-md inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {registering ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Saving Item...
                                        </>
                                    ) : "Save Material"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
