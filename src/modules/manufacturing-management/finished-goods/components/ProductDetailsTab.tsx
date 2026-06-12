import React from "react";
import { Product, Brand, Category, Unit } from "../types";
import { CreatableSelect } from "./CreatableSelect";

interface ProductDetailsTabProps {
    editedDetails: Partial<Product>;
    handleDetailChange: (field: keyof Product, value: unknown) => void;
    selectedProduct: Product;
    units: Unit[];
    brands: Brand[];
    categories: Category[];
    handleCreateBrand: (name: string) => Promise<number | undefined>;
    handleCreateCategory: (name: string) => Promise<number | undefined>;
}

export const ProductDetailsTab: React.FC<ProductDetailsTabProps> = ({
    editedDetails,
    handleDetailChange,
    selectedProduct,
    units,
    brands,
    categories,
    handleCreateBrand,
    handleCreateCategory
}) => {
    // Map lists to searchable options
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

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">Basic Specifications</h2>
                    {selectedProduct.parentProduct && (
                        <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-500/20">
                            Parent Product
                        </span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">General identity and master records of this finished good.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Product Title</label>
                    <input 
                        type="text" 
                        value={editedDetails.title || ""} 
                        onChange={e => handleDetailChange("title", e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">SKU Code</label>
                    <input 
                        type="text" 
                        value={editedDetails.sku || ""} 
                        onChange={e => handleDetailChange("sku", e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Barcode / EAN</label>
                    <input 
                        type="text" 
                        value={editedDetails.barcode || ""} 
                        onChange={e => handleDetailChange("barcode", e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Base UOM</label>
                        <select 
                            value={editedDetails.baseUom || ""} 
                            onChange={e => handleDetailChange("baseUom", e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
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

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Expected Yield %</label>
                        <input 
                            type="number" 
                            step="0.1"
                            value={editedDetails.expectedYieldPercent || 0} 
                            onChange={e => handleDetailChange("expectedYieldPercent", parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Brand</label>
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

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Category</label>
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

                <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground">Product Description</label>
                    <textarea 
                        rows={3}
                        value={editedDetails.description || ""} 
                        onChange={e => handleDetailChange("description", e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary resize-none bg-background text-foreground"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Target Selling Price (PHP)</label>
                    <input 
                        type="number" 
                        step="0.01"
                        value={editedDetails.targetSellingPrice || 0} 
                        onChange={e => handleDetailChange("targetSellingPrice", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Density conversion factor (KG/L)</label>
                    <input 
                        type="number" 
                        step="0.001"
                        value={editedDetails.densityFactor !== undefined ? editedDetails.densityFactor : 1.0} 
                        onChange={e => handleDetailChange("densityFactor", parseFloat(e.target.value) || 1.0)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Custom Overhead Rate (PHP)</label>
                    <input 
                        type="number" 
                        step="0.01"
                        value={editedDetails.customOverhead || 0} 
                        onChange={e => handleDetailChange("customOverhead", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                    />
                </div>
            </div>
        </div>
    );
};
