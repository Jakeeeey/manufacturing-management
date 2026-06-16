import React from "react";
import { Product, Brand, Category, Unit, ProductClass, ProductSegment, ProductSection } from "../types";
import { CreatableSelect } from "./CreatableSelect";
import { 
    Tag, 
    Layers, 
    Scale, 
    Calendar, 
    Image, 
    DollarSign, 
    Package, 
    FileText, 
    Activity,
    GitBranch,
    Sliders
} from "lucide-react";

interface ProductDetailsTabProps {
    editedDetails: Partial<Product>;
    handleDetailChange: (field: keyof Product, value: unknown) => void;
    selectedProduct: Product;
    units: Unit[];
    brands: Brand[];
    categories: Category[];
    classes: ProductClass[];
    segments: ProductSegment[];
    sections: ProductSection[];
    handleCreateBrand: (name: string) => Promise<number | undefined>;
    handleCreateCategory: (name: string) => Promise<number | undefined>;
    handleCreateClass: (name: string) => Promise<number | undefined>;
    handleCreateSegment: (name: string) => Promise<number | undefined>;
    handleCreateSection: (name: string) => Promise<number | undefined>;
    products: Product[];
}

export const ProductDetailsTab: React.FC<ProductDetailsTabProps> = ({
    editedDetails,
    handleDetailChange,
    selectedProduct,
    units,
    brands,
    categories,
    classes,
    segments,
    sections,
    handleCreateBrand,
    handleCreateCategory,
    handleCreateClass,
    handleCreateSegment,
    handleCreateSection,
    products
}) => {
    const [uploadingImage, setUploadingImage] = React.useState(false);

    const parentOptions = React.useMemo(() => {
        return products
            .filter((p) => p.id !== selectedProduct.id && !p.parent_id)
            .map((p) => ({
                value: String(p.id),
                label: `${p.title} (${p.sku}) - ${p.baseUom}`
            }));
    }, [products, selectedProduct.id]);

    const isParent = !selectedProduct.parent_id;
    
    const familyChildren = React.useMemo(() => {
        return products.filter(p => String(p.parent_id) === String(selectedProduct.id));
    }, [products, selectedProduct.id]);
    
    const parentProductObj = React.useMemo(() => {
        if (!selectedProduct.parent_id) return null;
        return products.find(p => String(p.id) === String(selectedProduct.parent_id)) || null;
    }, [products, selectedProduct.parent_id]);
    
    const siblingProducts = React.useMemo(() => {
        if (!selectedProduct.parent_id) return [];
        return products.filter(p => String(p.parent_id) === String(selectedProduct.parent_id));
    }, [products, selectedProduct.parent_id]);

    const brandOptions = React.useMemo(() => {
        return brands.map((b) => ({
            value: String(b.brand_id),
            label: b.brand_name
        }));
    }, [brands]);

    const categoryOptions = React.useMemo(() => {
        return categories.map((c) => ({
            value: String(c.category_id),
            label: c.category_name
        }));
    }, [categories]);

    const segmentOptions = React.useMemo(() => {
        return segments.map((s) => ({
            value: String(s.segment_id),
            label: s.segment_name
        }));
    }, [segments]);

    const classOptions = React.useMemo(() => {
        return classes.map((c) => ({
            value: String(c.class_id),
            label: c.class_name
        }));
    }, [classes]);

    const sectionOptions = React.useMemo(() => {
        return sections.map((s) => ({
            value: String(s.section_id),
            label: s.section_name
        }));
    }, [sections]);

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" /> Product Details
                    </h2>
                    {selectedProduct.parentProduct && (
                        <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            Parent Product
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">Manage hierarchy, measurements, and cost metrics for this finished good.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Identity & Classification Card */}
                <div className="bg-card/55 border border-border/80 rounded-xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary/80" /> Identity & Classification
                    </h3>
                    
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Product Title</label>
                            <input 
                                type="text" 
                                value={editedDetails.title || ""} 
                                onChange={e => handleDetailChange("title", e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">SKU / Code</label>
                                <input 
                                    type="text" 
                                    value={editedDetails.sku || ""} 
                                    onChange={e => handleDetailChange("sku", e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Barcode / EAN</label>
                                <input 
                                    type="text" 
                                    value={editedDetails.barcode || ""} 
                                    onChange={e => handleDetailChange("barcode", e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Brand</label>
                                <CreatableSelect
                                    options={brandOptions}
                                    value={editedDetails.product_brand ? String(editedDetails.product_brand) : ""}
                                    onValueChange={(val) => handleDetailChange("product_brand", val ? Number(val) : undefined)}
                                    placeholder="Select brand..."
                                    onCreateOption={async (name) => {
                                        const newId = await handleCreateBrand(name);
                                        if (newId) handleDetailChange("product_brand", newId);
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Category</label>
                                <CreatableSelect
                                    options={categoryOptions}
                                    value={editedDetails.product_category ? String(editedDetails.product_category) : ""}
                                    onValueChange={(val) => handleDetailChange("product_category", val ? Number(val) : undefined)}
                                    placeholder="Select category..."
                                    onCreateOption={async (name) => {
                                        const newId = await handleCreateCategory(name);
                                        if (newId) handleDetailChange("product_category", newId);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Parent Product (Optional)</label>
                            <select
                                value={editedDetails.parent_id ? String(editedDetails.parent_id) : ""}
                                onChange={e => handleDetailChange("parent_id", e.target.value ? Number(e.target.value) : null)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                            >
                                <option value="">None (This is a parent product)</option>
                                {parentOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Segment</label>
                                <CreatableSelect
                                    options={segmentOptions}
                                    value={editedDetails.product_segment ? String(editedDetails.product_segment) : ""}
                                    onValueChange={(val) => handleDetailChange("product_segment", val ? Number(val) : undefined)}
                                    placeholder="Segment..."
                                    onCreateOption={async (name) => {
                                        const newId = await handleCreateSegment(name);
                                        if (newId) handleDetailChange("product_segment", newId);
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Class</label>
                                <CreatableSelect
                                    options={classOptions}
                                    value={editedDetails.product_class ? String(editedDetails.product_class) : ""}
                                    onValueChange={(val) => handleDetailChange("product_class", val ? Number(val) : undefined)}
                                    placeholder="Class..."
                                    onCreateOption={async (name) => {
                                        const newId = await handleCreateClass(name);
                                        if (newId) handleDetailChange("product_class", newId);
                                    }}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Section</label>
                                <CreatableSelect
                                    options={sectionOptions}
                                    value={editedDetails.product_section ? String(editedDetails.product_section) : ""}
                                    onValueChange={(val) => handleDetailChange("product_section", val ? Number(val) : undefined)}
                                    placeholder="Section..."
                                    onCreateOption={async (name) => {
                                        const newId = await handleCreateSection(name);
                                        if (newId) handleDetailChange("product_section", newId);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Product Image</label>
                            <div className="flex items-center gap-4 border border-dashed border-border rounded-xl p-4 bg-muted/5 hover:bg-muted/10 transition-all">
                                {editedDetails.product_image ? (
                                    <div className="relative group w-20 h-20 rounded-lg overflow-hidden border bg-background flex items-center justify-center">
                                        <img 
                                            src={`${process.env.NEXT_PUBLIC_DIRECTUS_URL || "http://vtc:8074"}/assets/${editedDetails.product_image}`} 
                                            alt="Preview" 
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                if (target.src.includes("/assets/")) {
                                                    // Fallback if not a UUID
                                                    target.src = "/placeholder-image.png";
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const oldId = editedDetails.product_image;
                                                handleDetailChange("product_image", undefined);
                                                if (oldId && oldId.length > 10) {
                                                    try {
                                                        await fetch(`/api/manufacturing/files?id=${oldId}`, { method: "DELETE" });
                                                    } catch (err) {
                                                        console.error("Failed to delete file", err);
                                                    }
                                                }
                                            }}
                                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-all uppercase"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-20 h-20 rounded-lg bg-muted/20 border flex items-center justify-center text-muted-foreground/45">
                                        <Image className="h-6 w-6" />
                                    </div>
                                )}
                                
                                <div className="flex-1 space-y-1">
                                    <p className="text-xs font-medium text-foreground">
                                        {editedDetails.product_image ? "Image uploaded successfully" : "Select a product image"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">PNG, JPG, or WEBP up to 5MB</p>
                                    <label className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-foreground px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all">
                                        <span>{uploadingImage ? "Uploading..." : "Choose File"}</span>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            disabled={uploadingImage}
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setUploadingImage(true);
                                                try {
                                                    const formData = new FormData();
                                                    formData.append("file", file);
                                                    const uploadRes = await fetch("/api/manufacturing/files", {
                                                        method: "POST",
                                                        body: formData
                                                    });
                                                    if (!uploadRes.ok) throw new Error("Upload failed");
                                                    const json = await uploadRes.json();
                                                    const newFileId = json?.data?.id;
                                                    if (newFileId) {
                                                        handleDetailChange("product_image", newFileId);
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                    alert("Failed to upload image");
                                                } finally {
                                                    setUploadingImage(false);
                                                }
                                            }}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Product Description</label>
                            <textarea 
                                rows={2}
                                value={editedDetails.description || ""} 
                                onChange={e => handleDetailChange("description", e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary resize-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Physical Specifications & Lifespan Card */}
                <div className="space-y-6">
                    <div className="bg-card/55 border border-border/80 rounded-xl p-5 shadow-sm space-y-4">
                        <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
                            <Scale className="h-4 w-4 text-primary/80" /> Measurements & Physicals
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Base UOM</label>
                                <select 
                                    value={editedDetails.baseUom || ""} 
                                    onChange={e => handleDetailChange("baseUom", e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                >
                                    {units.length > 0 ? (
                                        units.map((u) => (
                                            <option key={u.unit_id} value={u.unit_shortcut}>
                                                {u.unit_name} ({u.unit_shortcut})
                                            </option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="L">Liter (L)</option>
                                            <option value="KG">Kilogram (KG)</option>
                                            <option value="PCS">Piece (PCS)</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">UOM Count (Pack Multiplier)</label>
                                <input 
                                    type="number" 
                                    value={editedDetails.unit_of_measurement_count || ""} 
                                    onChange={e => {
                                        const valStr = e.target.value;
                                        const valNum = valStr ? Number(valStr) : undefined;
                                        handleDetailChange("unit_of_measurement_count", valNum);
                                        
                                        if (valNum !== undefined && editedDetails.parent_id) {
                                            const parent = products.find(p => String(p.id) === String(editedDetails.parent_id));
                                            if (parent) {
                                                handleDetailChange("targetSellingPrice", (parent.targetSellingPrice || 0) * valNum);
                                                if (parent.cost_per_unit) {
                                                    handleDetailChange("cost_per_unit", parent.cost_per_unit * valNum);
                                                }
                                            }
                                        }
                                    }}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Density Factor (KG/L)</label>
                                <input 
                                    type="number" 
                                    step="0.001"
                                    value={editedDetails.densityFactor !== undefined ? editedDetails.densityFactor : 1.0} 
                                    onChange={e => handleDetailChange("densityFactor", parseFloat(e.target.value) || 1.0)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Expected Yield %</label>
                                <div className="relative">
                                    <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        value={editedDetails.expectedYieldPercent || 0} 
                                        onChange={e => handleDetailChange("expectedYieldPercent", parseFloat(e.target.value) || 0)}
                                        className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1 col-span-2">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                    <Calendar className="h-3 w-3 text-muted-foreground" /> Shelf Life (Days)
                                </label>
                                <input 
                                    type="number" 
                                    value={editedDetails.product_shelf_life || ""} 
                                    onChange={e => handleDetailChange("product_shelf_life", e.target.value ? Number(e.target.value) : undefined)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    placeholder="e.g. 365"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Financial Configurations Card */}
                    <div className="bg-card/55 border border-border/80 rounded-xl p-5 shadow-sm space-y-4">
                        <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary/80" /> Financials & Overheads
                        </h3>
                        
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1 col-span-3">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Cost Per Unit (₱)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={editedDetails.cost_per_unit || ""} 
                                    onChange={e => handleDetailChange("cost_per_unit", e.target.value ? parseFloat(e.target.value) : undefined)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>

                            <div className="space-y-1 col-span-3">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Target Selling Price (₱)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={editedDetails.targetSellingPrice || 0} 
                                    onChange={e => handleDetailChange("targetSellingPrice", parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>

                            <div className="space-y-1 col-span-3">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase">Custom Overhead Rate (₱)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={editedDetails.customOverhead || 0} 
                                    onChange={e => handleDetailChange("customOverhead", parseFloat(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Family Tree Card */}
                <div className="bg-card/55 border border-border/80 rounded-xl p-5 shadow-sm space-y-4 md:col-span-2">
                    <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-primary/80" /> Product Family Tree
                    </h3>
                    <div className="space-y-4">
                        {isParent ? (
                            <div className="space-y-3">
                                {/* Parent Node */}
                                <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-lg p-3">
                                    <Package className="h-4 w-4 text-primary" />
                                    <div>
                                        <p className="text-xs font-bold text-primary">{selectedProduct.title} (Parent)</p>
                                        <p className="text-[10px] text-muted-foreground">SKU: {selectedProduct.sku || "N/A"} • Base UOM: {selectedProduct.baseUom}</p>
                                    </div>
                                </div>
                                
                                {/* Connector & Children */}
                                <div className="pl-4 ml-5 border-l-2 border-dashed border-border/80 py-1 space-y-2">
                                    {familyChildren.length > 0 ? (
                                        familyChildren.map(child => (
                                            <div key={child.id} className="flex items-center gap-2 bg-muted/45 border border-border/40 rounded-lg p-2.5 hover:bg-muted/65 transition-all">
                                                <Sliders className="h-3.5 w-3.5 text-muted-foreground/60" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-semibold text-foreground truncate">{child.title}</p>
                                                    <p className="text-[9px] text-muted-foreground">SKU: {child.sku || "N/A"} • Variant UOM: {child.baseUom}</p>
                                                </div>
                                                <div className="text-[11px] font-bold text-foreground bg-muted px-2 py-0.5 rounded">
                                                    ₱{child.targetSellingPrice.toFixed(2)}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg bg-muted/10 text-muted-foreground">
                                            <p className="text-[11px] font-medium italic">No child configurations registered for this parent yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Parent Node */}
                                {parentProductObj && (
                                    <div className="flex items-center gap-2.5 bg-muted/50 border border-border rounded-lg p-3">
                                        <Package className="h-4 w-4 text-muted-foreground/80" />
                                        <div>
                                            <p className="text-xs font-bold text-foreground">{parentProductObj.title} (Parent)</p>
                                            <p className="text-[10px] text-muted-foreground">SKU: {parentProductObj.sku || "N/A"} • Base UOM: {parentProductObj.baseUom}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Connector & Sibling Variants */}
                                <div className="pl-4 ml-5 border-l-2 border-dashed border-border/80 py-1 space-y-2">
                                    {siblingProducts.map(sibling => {
                                        const isCurrent = sibling.id === selectedProduct.id;
                                        return (
                                            <div 
                                                key={sibling.id} 
                                                className={`flex items-center gap-2 border p-2.5 rounded-lg transition-all ${
                                                    isCurrent 
                                                        ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10" 
                                                        : "bg-muted/30 border-border/40 hover:bg-muted/50"
                                                }`}
                                            >
                                                <Sliders className={`h-3.5 w-3.5 ${isCurrent ? "text-primary" : "text-muted-foreground/60"}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[11px] font-semibold truncate ${isCurrent ? "text-primary" : "text-foreground"}`}>
                                                        {sibling.title} {isCurrent && <span className="text-[9px] font-bold text-primary/80 uppercase ml-1">(Current)</span>}
                                                    </p>
                                                    <p className="text-[9px] text-muted-foreground">SKU: {sibling.sku || "N/A"} • Variant UOM: {sibling.baseUom}</p>
                                                </div>
                                                <div className="text-[11px] font-bold text-foreground bg-muted px-2 py-0.5 rounded">
                                                    ₱{sibling.targetSellingPrice.toFixed(2)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

