/* eslint-disable */
import React, { useState, useEffect } from "react";
import { RawMaterial, Supplier, RegisterRawMaterialPayload, PackagingVariant } from "../types";
import { Search, Layers, ChevronDown, ChevronUp, MapPin, Bookmark, AlertTriangle, Plus, X, Loader2, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreatableSelect } from "../../finished-goods/components/CreatableSelect";
import { fetchProductInventoryDetails } from "../services/procurement-api";

interface RawMaterialsMasterProps {
    rawMaterials: RawMaterial[];
    suppliers: Supplier[];
    loadingItems: boolean;
    onRegisterRawMaterial: (productDetails: RegisterRawMaterialPayload, supplierIds: number[], packagingVariants?: PackagingVariant[]) => Promise<boolean>;
    onUpdateRawMaterial: (productId: number, productDetails: RegisterRawMaterialPayload, supplierIds: number[], packagingVariants?: PackagingVariant[]) => Promise<boolean>;
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

export default function RawMaterialsMaster({
    rawMaterials,
    suppliers,
    loadingItems,
    onRegisterRawMaterial,
    onUpdateRawMaterial
}: RawMaterialsMasterProps) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState<"all" | "raw" | "pkg">("all");
    const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
    const [loadingBatches, setLoadingBatches] = useState(false);
    // disabled-lint-next-line @typescript-eslint/no-explicit-any
    const [productBatches, setProductBatches] = useState<any[]>([]);

    // Modal State & Mode
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<RawMaterial | null>(null); // null = Register, non-null = Edit
    const [saving, setSaving] = useState(false);
    const [units, setUnits] = useState<UnitOption[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(false);
    const [brandsList, setBrandsList] = useState<SelectOption[]>([]);
    const [categoriesList, setCategoriesList] = useState<SelectOption[]>([]);
    const [showValidationErrors, setShowValidationErrors] = useState(false);

    // Form fields
    const [formName, setFormName] = useState("");
    const [formCode, setFormCode] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [formUom, setFormUom] = useState<number | "">("");
    const [formDensity, setFormDensity] = useState("1.000");
    const [formBrand, setFormBrand] = useState("");
    const [formCategory, setFormCategory] = useState("");
    const [formProductType, setFormProductType] = useState<number>(389);
    const [formParentId, setFormParentId] = useState<string>("");
    const [formUomCount, setFormUomCount] = useState<string>("1");
    const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
    const [supplierSearch, setSupplierSearch] = useState("");
    const [packagingVariants, setPackagingVariants] = useState<Array<{ uomId: number | ""; count: string; codeSuffix: string }>>([]);

    const handleAddVariant = () => {
        setPackagingVariants([...packagingVariants, { uomId: formUom || "", count: "1", codeSuffix: "" }]);
    };

    const handleUpdateVariant = (index: number, field: string, value: any) => {
        const copy = [...packagingVariants];
        copy[index] = { ...copy[index], [field]: value };
        setPackagingVariants(copy);
    };

    const handleRemoveVariant = (index: number) => {
        setPackagingVariants(packagingVariants.filter((_, i) => i !== index));
    };

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
                // Only auto-select UOM if in Register mode
                if (!editingItem && unitsData && unitsData.length > 0) {
                    setFormUom(unitsData[0].unit_id);
                }
                // disabled-lint-next-line @typescript-eslint/no-explicit-any
                setBrandsList((brandsData || []).map((b: any) => ({ value: String(b.brand_id), label: b.brand_name })));
                // disabled-lint-next-line @typescript-eslint/no-explicit-any
                setCategoriesList((categoriesData || []).map((c: any) => ({ value: String(c.category_id), label: c.category_name })));
            })
            .catch(err => {
                console.error("Failed to load raw material metadata:", err);
                toast.error("Failed to load options metadata");
            })
            .finally(() => {
                setLoadingUnits(false);
            });
    }, [isModalOpen, editingItem]);

    // Reset/Populate form fields depending on Register/Edit mode
    useEffect(() => {
        if (!isModalOpen) {
            setEditingItem(null);
            setFormName("");
            setFormCode("");
            setFormDesc("");
            setFormDensity("1.000");
            setFormBrand("");
            setFormCategory("");
            setFormProductType(389);
            setFormParentId("");
            setFormUomCount("1");
            setSelectedSupplierIds([]);
            setSupplierSearch("");
            setShowValidationErrors(false);
            setPackagingVariants([]);
        } else if (editingItem) {
            setFormName(editingItem.product_name || "");
            setFormCode(editingItem.product_code || "");
            setFormDesc(editingItem.description || "");
            setFormUom(editingItem.unit_of_measurement?.unit_id || "");
            setFormDensity(String(editingItem.density_factor || "1.000"));
            setFormBrand(editingItem.product_brand ? String(editingItem.product_brand) : "");
            setFormCategory(editingItem.product_category ? String(editingItem.product_category) : "");
            setFormProductType(editingItem.product_type || 389);
            setFormParentId(editingItem.parent_id ? String(editingItem.parent_id) : "");
            setFormUomCount(editingItem.unit_of_measurement_count ? String(editingItem.unit_of_measurement_count) : "1");

            // Fetch linked suppliers for this item
            fetch(`/api/manufacturing/procurement/raw-materials?productId=${editingItem.product_id}`)
                .then(res => res.ok ? res.json() : [])
                .then(supplierIds => {
                    setSelectedSupplierIds(supplierIds || []);
                })
                .catch(err => console.error("Failed to load item suppliers:", err));
        }
    }, [isModalOpen, editingItem]);

    // Auto-generate child product code when parent, UOM, or UOM count changes
    useEffect(() => {
        if (formParentId && !editingItem) {
            const parentItem = rawMaterials.find(rm => String(rm.product_id) === String(formParentId));
            if (parentItem && parentItem.product_code) {
                const parentCode = parentItem.product_code;
                const uomShortcut = units.find(u => u.unit_id === Number(formUom))?.unit_shortcut || "UNIT";
                setFormCode(`${parentCode}-${uomShortcut.toUpperCase()}${formUomCount}`);
            }
        }
    }, [formParentId, formUom, formUomCount, rawMaterials, units, editingItem]);

    const isItemPkg = (item: RawMaterial) => {
        return Number(item.product_type) === 390;
    };

    const handleStartEdit = (item: RawMaterial) => {
        setEditingItem(item);
        setIsModalOpen(true);
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
            // disabled-lint-next-line @typescript-eslint/no-explicit-any
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
            // disabled-lint-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to create category");
        }
    };

    const filtered = rawMaterials.filter(m => {
        const matchesSearch = m.product_name.toLowerCase().includes(search.toLowerCase()) ||
            m.product_code?.toLowerCase().includes(search.toLowerCase());

        if (!matchesSearch) return false;

        const isPkg = isItemPkg(m);
        if (typeFilter === "raw") return !isPkg;
        if (typeFilter === "pkg") return isPkg;
        return true;
    });

    // UX Enhancement: Group child records directly beneath their parent records in tree list
    const sortedFiltered = React.useMemo(() => {
        const parents = filtered.filter(rm => !rm.parent_id);
        const children = filtered.filter(rm => !!rm.parent_id);

        const result: RawMaterial[] = [];
        parents.forEach(parent => {
            result.push(parent);
            const parentChildren = children.filter(child => Number(child.parent_id) === parent.product_id);
            result.push(...parentChildren);
        });

        // Add any orphans (children whose parents aren't matching current filters)
        children.forEach(child => {
            if (!result.some(r => r.product_id === child.product_id)) {
                result.push(child);
            }
        });

        return result;
    }, [filtered]);

    const handleToggleExpand = async (productId: number) => {
        if (expandedProductId === productId) {
            setExpandedProductId(null);
            setProductBatches([]);
            return;
        }

        setExpandedProductId(productId);
        setLoadingBatches(true);
        try {
            const data = await fetchProductInventoryDetails(productId);
            setProductBatches(data);
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : "Failed to load inventory details");
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

        // Validation Checks
        const isNameEmpty = !formName.trim();
        const isCodeEmpty = !formCode.trim();
        const isUomEmpty = !formUom;
        const isCategoryEmpty = !formCategory;
        const isDensityInvalid = !formDensity || parseFloat(formDensity) <= 0;
        const isUomCountInvalid = !formUomCount || Number(formUomCount) <= 0;

        if (isNameEmpty || isCodeEmpty || isUomEmpty || isCategoryEmpty || isDensityInvalid || isUomCountInvalid) {
            setShowValidationErrors(true);
            toast.error("Please fill out all mandatory fields correctly marked in red outline.");
            return;
        }

        // Uniqueness validation on Product Code (only if changed)
        const normalizedCode = formCode.trim().toUpperCase();
        const originalCode = editingItem?.product_code?.trim().toUpperCase() || "";
        const isCodeChanged = !editingItem || normalizedCode !== originalCode;

        if (isCodeChanged) {
            const codeExists = rawMaterials.some(rm => {
                if (editingItem && Number(rm.product_id) === Number(editingItem.product_id)) return false;
                return rm.product_code?.trim().toUpperCase() === normalizedCode;
            });

            if (codeExists) {
                setShowValidationErrors(true);
                toast.error(`The product code "${normalizedCode}" is already assigned. Please provide a unique product code.`);
                return;
            }
        }

        // Name uniqueness check (only if changed)
        const normalizedNewName = formName.trim().toLowerCase();
        const originalName = editingItem?.product_name?.trim().toLowerCase() || "";
        const isNameChanged = !editingItem || normalizedNewName !== originalName;

        if (isNameChanged) {
            const nameExists = rawMaterials.some(rm => {
                if (editingItem && Number(rm.product_id) === Number(editingItem.product_id)) return false;
                return rm.product_name.trim().toLowerCase() === normalizedNewName;
            });

            if (nameExists) {
                toast.error("A material with this name already exists. Please choose a unique name.");
                return;
            }
        }

        // Check variants validation
        const hasInvalidVariant = packagingVariants.some(v => !v.uomId || !v.count || parseFloat(v.count) <= 0);
        if (hasInvalidVariant) {
            toast.error("Please fill out all packaging variant fields with valid units and conversion counts.");
            return;
        }

        const selectedUomShortcut = units.find(u => u.unit_id === Number(formUom))?.unit_shortcut || "pcs";
        const variantsPayload = packagingVariants.map(v => {
            const vUomShortcut = units.find(u => u.unit_id === Number(v.uomId))?.unit_shortcut || "Unit";
            const cleanSuffix = v.codeSuffix.trim() || `${vUomShortcut.toUpperCase()}${v.count}`;
            return {
                product_name: `${formName.trim()} (${vUomShortcut} of ${v.count} ${selectedUomShortcut})`,
                product_code: `${normalizedCode}-${cleanSuffix}`,
                unit_of_measurement: Number(v.uomId),
                unit_of_measurement_count: parseFloat(v.count) || 1.0,
                density_factor: parseFloat(formDensity) || 1.0,
                product_brand: formBrand ? Number(formBrand) : undefined,
                product_category: formCategory ? Number(formCategory) : undefined,
                product_type: Number(formProductType),
            };
        });

        // Check variant code uniqueness
        for (const variant of variantsPayload) {
            const exists = rawMaterials.some(rm => rm.product_code?.trim().toUpperCase() === variant.product_code.toUpperCase());
            if (exists) {
                toast.error(`The packaging variant code "${variant.product_code}" already exists in the catalog.`);
                return;
            }
        }

        setSaving(true);
        const payload = {
            product_name: formName.trim(),
            product_code: normalizedCode,
            description: formDesc.trim() || undefined,
            unit_of_measurement: Number(formUom),
            density_factor: parseFloat(formDensity) || 1.0,
            product_brand: formBrand ? Number(formBrand) : undefined,
            product_category: formCategory ? Number(formCategory) : undefined,
            product_type: formProductType,
            parent_id: formParentId ? Number(formParentId) : null,
            unit_of_measurement_count: parseFloat(formUomCount) || 1.0
        };

        let success = false;
        if (editingItem) {
            success = await onUpdateRawMaterial(editingItem.product_id, payload, selectedSupplierIds, variantsPayload);
        } else {
            success = await onRegisterRawMaterial(payload, selectedSupplierIds, variantsPayload);
        }

        setSaving(false);
        if (success) {
            setIsModalOpen(false);
        }
    };

    // Group batches by branch name for rendering
    const groupedByBranch = React.useMemo(() => {
        const branchesMap: Record<string, {
            branchName: string;
            branchCode: string;
            // disabled-lint-next-line @typescript-eslint/no-explicit-any
            batches: any[];
            totalQty: number;
        }> = {};

        // disabled-lint-next-line @typescript-eslint/no-explicit-any
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

    // Helpers to display dynamic UOM conversion strings
    const selectedUomShortcut = React.useMemo(() => {
        return units.find(u => u.unit_id === Number(formUom))?.unit_shortcut || "Unit";
    }, [units, formUom]);

    const parentUomShortcut = React.useMemo(() => {
        if (!formParentId) return "";
        const parent = rawMaterials.find(rm => rm.product_id === Number(formParentId));
        return parent?.unit_of_measurement?.unit_shortcut || "Base Unit";
    }, [rawMaterials, formParentId]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-muted/20 border p-4 rounded-xl">
                <div className="space-y-0.5">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5 shrink-0">
                        <Layers className="h-4.5 w-4.5 text-primary" />
                        Raw Materials & Packaging Master Catalog ({sortedFiltered.length})
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
                            className="w-full pl-9 pr-8 py-2 border rounded-lg text-xs bg-background outline-none focus:ring-1 focus:ring-primary font-medium"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors hover:bg-muted rounded cursor-pointer"
                                title="Clear Search"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold px-3 py-2.5 rounded-lg transition-all shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
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
                        className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${typeFilter === "all" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        All Items
                    </button>
                    <button
                        onClick={() => setTypeFilter("raw")}
                        className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${typeFilter === "raw" ? "bg-background shadow-sm text-amber-600" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        Raw Materials
                    </button>
                    <button
                        onClick={() => setTypeFilter("pkg")}
                        className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${typeFilter === "pkg" ? "bg-background shadow-sm text-purple-600" : "text-muted-foreground hover:text-foreground"}`}
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
            <div className="border rounded-xl bg-card overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                    <thead>
                        <tr className="bg-muted/50 border-b">
                            <th className="p-3 w-10"></th>
                            <th className="p-3 font-semibold text-muted-foreground">Material Name</th>
                            <th className="p-3 font-semibold text-muted-foreground">Product Code</th>
                            <th className="p-3 font-semibold text-muted-foreground text-center">UOM</th>
                            <th className="p-3 font-semibold text-muted-foreground text-right">Density Factor</th>
                            <th className="p-3 font-semibold text-muted-foreground text-right font-bold text-foreground">Standard Landed Unit Cost (PHP)</th>
                            <th className="p-3 font-semibold text-muted-foreground text-right w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loadingItems ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        <span>Loading items...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : sortedFiltered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-muted-foreground">
                                    No items found.
                                </td>
                            </tr>
                        ) : (
                            sortedFiltered.map(m => {
                                const isExpanded = expandedProductId === m.product_id;
                                const isPkg = isItemPkg(m);
                                const isChild = !!m.parent_id;

                                // Compute tree connector and parent count details
                                let connector = "";
                                if (isChild) {
                                    const parentChildren = sortedFiltered.filter(c => Number(c.parent_id) === Number(m.parent_id));
                                    const childIndex = parentChildren.findIndex(c => c.product_id === m.product_id);
                                    const isLast = childIndex === parentChildren.length - 1;
                                    connector = isLast ? "└──" : "├──";
                                }

                                const childrenCount = !isChild
                                    ? rawMaterials.filter(c => Number(c.parent_id) === m.product_id).length
                                    : 0;

                                return (
                                    <React.Fragment key={m.product_id}>
                                        <tr
                                            onClick={() => handleToggleExpand(m.product_id)}
                                            className={`${isChild
                                                    ? "bg-muted/20 hover:bg-muted/40 border-l-4 border-l-primary/30"
                                                    : "bg-card hover:bg-muted/10 border-l-2 border-l-transparent hover:border-l-primary"
                                                } cursor-pointer transition-all border-b`}
                                        >
                                            <td className="p-3 text-center">
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    {isChild && (
                                                        <span className="text-primary/60 font-mono text-xs select-none font-bold mr-1">{connector}</span>
                                                    )}
                                                    <div>
                                                        <span className={`font-semibold block ${isChild ? "text-[11px] text-foreground/80" : "text-xs text-foreground"}`}>
                                                            {m.product_name}
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                            <span className={`text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${isPkg ? "text-purple-600 bg-purple-500/10" : "text-amber-600 bg-amber-500/10"}`}>
                                                                {isPkg ? "Packaging Item" : "Raw Material"}
                                                            </span>
                                                            {isChild && (
                                                                <span className="text-[8px] font-bold uppercase tracking-wider text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                                                    UOM factor: 1:{m.unit_of_measurement_count}
                                                                </span>
                                                            )}
                                                            {childrenCount > 0 && (
                                                                <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                                                    {childrenCount} variant{childrenCount > 1 ? "s" : ""}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
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
                                            <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEdit(m)}
                                                    className="px-2.5 py-1 text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/45 rounded-lg transition-all cursor-pointer"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Expandable FIFO Stock Breakdown */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={7} className="bg-muted/5 p-4 border-b">
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

            {/* Registration / Edit Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card border rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] scale-in duration-200">

                        {/* Header */}
                        <div className="flex items-center justify-between border-b p-5 shrink-0">
                            <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                                <Layers className="h-5 w-5 text-primary" />
                                {editingItem ? "Edit Raw Material / Packaging Item" : "Register Raw Material / Packaging Item"}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-all cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                        Material Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Soya Bean Oil (Pure Refined)"
                                        value={formName}
                                        onChange={e => {
                                            setFormName(e.target.value);
                                            // Auto-generate code in Register mode if empty or based on initials
                                            if (!editingItem && !formCode) {
                                                const words = e.target.value.split(/\s+/).filter(Boolean);
                                                const initials = words.map(w => w[0]).join("").replace(/[^a-zA-Z]/g, "").toUpperCase();
                                                if (initials) {
                                                    setFormCode(`RM-${initials.substring(0, 5)}`);
                                                }
                                            }
                                        }}
                                        className={`w-full rounded-lg border bg-background px-3.5 py-2.5 text-xs outline-none transition-all duration-200 font-semibold text-foreground ${showValidationErrors && !formName.trim()
                                                ? "border-red-500 focus:ring-2 focus:ring-red-100 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]"
                                                : "border-border focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            }`}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                        SKU / Product Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. RM-SOYA-01"
                                        value={formCode}
                                        onChange={e => setFormCode(e.target.value)}
                                        className={`w-full rounded-lg border bg-background px-3.5 py-2.5 text-xs outline-none transition-all duration-200 font-mono text-foreground font-bold ${showValidationErrors && !formCode.trim()
                                                ? "border-red-500 focus:ring-2 focus:ring-red-100 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]"
                                                : "border-border focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            }`}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                        Item Classification <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formProductType}
                                        onChange={e => setFormProductType(Number(e.target.value))}
                                        className="w-full rounded-lg border bg-background px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground font-semibold transition-all duration-200"
                                    >
                                        <option value={389}>Raw Materials</option>
                                        <option value={390}>Packaging Items</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                        Base UOM <span className="text-red-500">*</span>
                                    </label>
                                    {loadingUnits ? (
                                        <div className="h-10 flex items-center justify-center border rounded-lg bg-background">
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <select
                                            value={formUom}
                                            onChange={e => setFormUom(Number(e.target.value))}
                                            className={`w-full rounded-lg border bg-background px-3.5 py-2.5 text-xs outline-none transition-all duration-200 text-foreground font-semibold ${showValidationErrors && !formUom
                                                    ? "border-red-500 focus:ring-2 focus:ring-red-100 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]"
                                                    : "border-border focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                }`}
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
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <div className={showValidationErrors && !formCategory ? "ring-2 ring-red-500/25 rounded-lg border border-red-500" : ""}>
                                        <CreatableSelect
                                            options={categoriesList}
                                            value={formCategory}
                                            onValueChange={setFormCategory}
                                            placeholder="Select Category..."
                                            onCreateOption={handleCreateCategoryOnTheFly}
                                        />
                                    </div>
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
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                                        Density Factor (g/mL) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0.001"
                                        value={formDensity}
                                        onChange={e => setFormDensity(e.target.value)}
                                        className={`w-full rounded-lg border bg-background px-3.5 py-2.5 text-xs outline-none transition-all duration-200 font-mono font-bold text-foreground ${showValidationErrors && (!formDensity || parseFloat(formDensity) <= 0)
                                                ? "border-red-500 focus:ring-2 focus:ring-red-100 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]"
                                                : "border-border focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            }`}
                                    />
                                </div>

                                {/* Parent Product Selection */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Parent Product (Optional)</label>
                                    <select
                                        value={formParentId}
                                        onChange={e => {
                                            setFormParentId(e.target.value);
                                            if (!e.target.value) setFormUomCount("1");
                                        }}
                                        className="w-full rounded-lg border bg-background px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground font-semibold transition-all duration-200"
                                    >
                                        <option value="">-- No Parent (Base Material) --</option>
                                        {rawMaterials
                                            .filter(rm => {
                                                // Exclude self if editing
                                                if (editingItem && Number(rm.product_id) === Number(editingItem.product_id)) return false;
                                                // Only allow base items (items without parents themselves) to be parents
                                                return !rm.parent_id;
                                            })
                                            .map(rm => (
                                                <option key={rm.product_id} value={rm.product_id}>
                                                    {rm.product_name} ({rm.product_code})
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                {/* UOM Count / Stock Conversion factor - UX Enhanced */}
                                <div className="col-span-2 space-y-1.5 p-3.5 bg-primary/5 rounded-xl border border-primary/10">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] text-primary font-bold uppercase tracking-wider block">
                                            UOM Count (Conversion Factor) <span className="text-red-500">*</span>
                                        </label>
                                        {formParentId && (
                                            <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                                Active Stock Conversion
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.0001"
                                        value={formUomCount}
                                        onChange={e => setFormUomCount(e.target.value)}
                                        className={`w-full rounded-lg border bg-background px-3.5 py-2.5 text-xs outline-none transition-all duration-200 font-semibold text-foreground ${showValidationErrors && (!formUomCount || Number(formUomCount) <= 0)
                                                ? "border-red-500 focus:ring-2 focus:ring-red-100 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]"
                                                : "border-border focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                            }`}
                                        placeholder="e.g. 1"
                                    />

                                    {/* Dynamic visual preview of the formula */}
                                    <div className="mt-2.5 p-3 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-2 text-xs">
                                        <div className="flex flex-col items-center flex-1 bg-background p-1.5 rounded border border-border/50">
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase">1x Child Unit</span>
                                            <span className="font-extrabold text-foreground mt-0.5">{selectedUomShortcut}</span>
                                        </div>
                                        <div className="text-primary font-extrabold select-none">➔</div>
                                        <div className="flex flex-col items-center flex-1 bg-primary/5 p-1.5 rounded border border-primary/20">
                                            <span className="text-[9px] text-primary font-bold uppercase">Converted Value</span>
                                            <span className="font-black text-primary mt-0.5">
                                                {formUomCount || "1.0"} × {formParentId ? (parentUomShortcut || "Base Unit") : selectedUomShortcut}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Read-Only Standard Landed Cost during editing */}
                                {editingItem && (
                                    <div className="col-span-2 space-y-1.5 opacity-85">
                                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Standard Landed Unit Cost (PHP) [Read Only]</label>
                                        <input
                                            type="text"
                                            readOnly
                                            disabled
                                            value={`₱${editingItem.cost_per_unit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                            className="w-full rounded-lg border bg-muted px-3.5 py-2.5 text-xs font-mono font-bold text-muted-foreground cursor-not-allowed select-none"
                                        />
                                        <p className="text-[9px] text-muted-foreground">Standard Landed Unit Cost is dynamically computed and updated by the Cargo Landed Cost Engine.</p>
                                    </div>
                                )}

                                <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Description</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Add raw material specifications, quality requirements, notes..."
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                        className="w-full rounded-lg border bg-background px-3.5 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium text-foreground resize-none font-semibold transition-all duration-200"
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
                                        className="w-full rounded-lg border bg-background px-3.5 py-2 text-[11px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium mb-1.5 transition-all duration-200"
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
                                                            className="rounded text-primary focus:ring-0 h-4 w-4 cursor-pointer"
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

                                {/* Define Packaging Variants builder */}
                                {!formParentId && (
                                    <div className="col-span-2 space-y-3 p-4 bg-muted/20 border border-dashed rounded-xl mt-2 animate-in slide-in-from-top-1 duration-200">
                                        <div className="flex justify-between items-center border-b border-border/80 pb-2">
                                            <h4 className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <Layers className="h-3.5 w-3.5 text-primary" />
                                                Define Purchase Packaging Variants (Children Units)
                                            </h4>
                                            <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">
                                                {packagingVariants.length} Added
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-normal">
                                            Quickly register packages you buy (e.g. 25kg Bag, 500g Box) of this base ingredient. Suffix codes append to the parent code (e.g., parent code <code>{formCode || "CODE"}</code> + Suffix <code>BAG25</code> = <code>{formCode || "CODE"}-BAG25</code>).
                                        </p>

                                        {packagingVariants.map((v, vIdx) => (
                                            <div key={vIdx} className="grid grid-cols-12 gap-2 bg-background border p-2.5 rounded-lg relative items-end">
                                                <div className="col-span-4 space-y-1">
                                                    <label className="text-[8px] font-bold text-muted-foreground uppercase block">Packaging Unit (UOM)</label>
                                                    <select
                                                        value={v.uomId}
                                                        onChange={e => handleUpdateVariant(vIdx, "uomId", e.target.value === "" ? "" : Number(e.target.value))}
                                                        className="w-full rounded-md border bg-background px-2 py-1 text-[10px] outline-none h-8 font-semibold text-foreground"
                                                    >
                                                        <option value="">Select UOM...</option>
                                                        {units.map(u => (
                                                            <option key={u.unit_id} value={u.unit_id}>
                                                                {u.unit_name} ({u.unit_shortcut})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="col-span-4 space-y-1">
                                                    <label className="text-[8px] font-bold text-muted-foreground uppercase block">Conversion Count (Base Units)</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min="0.0001"
                                                        placeholder="e.g. 25"
                                                        value={v.count}
                                                        onChange={e => handleUpdateVariant(vIdx, "count", e.target.value)}
                                                        className="w-full rounded-md border bg-background px-2 py-1 text-[10px] outline-none h-8 font-semibold text-foreground"
                                                    />
                                                </div>

                                                <div className="col-span-3 space-y-1">
                                                    <label className="text-[8px] font-bold text-muted-foreground uppercase block">Suffix (e.g. BAG25)</label>
                                                    <input
                                                        type="text"
                                                        placeholder="BAG25"
                                                        value={v.codeSuffix}
                                                        onChange={e => handleUpdateVariant(vIdx, "codeSuffix", e.target.value.toUpperCase())}
                                                        className="w-full rounded-md border bg-background px-2 py-1 text-[10px] outline-none h-8 font-mono font-bold text-foreground"
                                                    />
                                                </div>

                                                <div className="col-span-1 flex justify-center pb-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveVariant(vIdx)}
                                                        className="text-muted-foreground hover:text-red-500 p-1 rounded hover:bg-muted/50 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {editingItem && (() => {
                                            const existingChildren = rawMaterials.filter(rm => Number(rm.parent_id) === editingItem.product_id);
                                            if (existingChildren.length === 0) return null;
                                            return (
                                                <div className="space-y-1.5 mt-2 bg-muted/10 p-2.5 rounded-lg border border-border/40">
                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Registered Child Packaging Units</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {existingChildren.map(c => (
                                                            <span key={c.product_id} className="text-[9px] bg-primary/10 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 select-none">
                                                                ↳ {c.product_name} <span className="opacity-60 font-mono">({c.product_code})</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <button
                                            type="button"
                                            onClick={handleAddVariant}
                                            className="w-full py-2 border border-dashed border-primary/30 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors cursor-pointer flex items-center justify-center gap-1"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Add Purchase Packaging Option
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="border-t pt-4 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-extrabold px-4 py-2.5 rounded-lg transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-extrabold px-5 py-2.5 rounded-lg transition-all shadow-md inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Saving Item...
                                        </>
                                    ) : editingItem ? "Update Material" : "Save Material"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
