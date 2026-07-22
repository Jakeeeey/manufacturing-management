"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    X,
    Building2,
    Calendar,
    Layers,
    DollarSign,
    FileText,
    Sparkles,
    Loader2
} from "lucide-react";
import { PRICE_TYPES } from "../mock-data";
import SearchableSelect, { SelectOption } from "./SearchableSelect";
import { fetchProductTypes } from "../services/physical-inventory-api";
import { Branch, ProductType } from "../types";

interface NewCountSheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: { branch_id: number; cutoff_date: string; remarks?: string; stock_type?: string }) => Promise<void>;
    branches?: Branch[];
    productTypes?: ProductType[];
    isSubmitting?: boolean;
}

export default function NewCountSheetModal({
    isOpen,
    onClose,
    onSubmit,
    branches = [],
    productTypes: initialProductTypes = [],
    isSubmitting = false
}: NewCountSheetModalProps) {
    const [fetchedProductTypes, setFetchedProductTypes] = useState<ProductType[]>(initialProductTypes);
    const [branchId, setBranchId] = useState<string | number>(() => {
        if (branches.length > 0) {
            return branches[0].id || branches[0].branch_id || "1";
        }
        return "1";
    });
    const [cutoffDate, setCutoffDate] = useState(() => {
        const today = new Date();
        return today.toISOString().slice(0, 16); // format YYYY-MM-THH:mm
    });
    const [stockType, setStockType] = useState<string | number>("");
    const [priceType, setPriceType] = useState<string | number>(PRICE_TYPES[0]);
    const [notes, setNotes] = useState("");

    // Fetch product types from DB if not passed
    useEffect(() => {
        if (isOpen && fetchedProductTypes.length === 0) {
            fetchProductTypes().then(types => {
                setFetchedProductTypes(types);
                if (types.length > 0 && !stockType) {
                    setStockType(types[0].typeName || types[0].name || types[0].inventoryTypeId || "");
                }
            });
        }
    }, [isOpen, fetchedProductTypes.length, stockType]);

    // Build branch options for SearchableSelect
    const branchOptions: SelectOption[] = useMemo(() => {
        if (!branches || branches.length === 0) {
            return [{ value: "1", label: "Main Factory Branch" }];
        }
        return branches.map((b) => {
            const bId = b.id || b.branch_id || 0;
            const bName = b.branchName || b.branch_name || b.name || b.title || "Facility Branch";
            const bCode = b.branchCode || b.branch_code || "";
            return {
                value: bId,
                label: bCode ? `${bName} (${bCode})` : bName
            };
        });
    }, [branches]);

    // Build stock type options from product_type database records (names only)
    const stockOptions: SelectOption[] = useMemo(() => {
        if (!fetchedProductTypes || fetchedProductTypes.length === 0) {
            return [
                { value: "Finished Goods", label: "Finished Goods" },
                { value: "Raw Materials", label: "Raw Materials" },
                { value: "Packaging Materials", label: "Packaging Materials" }
            ];
        }
        return fetchedProductTypes.map((pt) => {
            const pName = pt.typeName || pt.name || "Product Stock Type";
            return {
                value: pName,
                label: pName
            };
        });
    }, [fetchedProductTypes]);

    const priceOptions: SelectOption[] = useMemo(() => {
        return PRICE_TYPES.map(p => ({ value: p, label: p }));
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit({
            branch_id: Number(branchId) || 1,
            cutoff_date: new Date(cutoffDate).toISOString(),
            stock_type: String(stockType || "Finished Goods"),
            remarks: notes
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2.5 rounded-xl text-primary border border-primary/20">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground">Initialize Count Sheet</h3>
                            <p className="text-xs text-muted-foreground">Snapshot live database stock levels for physical count audit</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                    {/* Branch Facility Searchable Combobox */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            Target Branch / Factory Facility <span className="text-rose-500">*</span>
                        </label>
                        <SearchableSelect
                            options={branchOptions}
                            value={branchId}
                            onChange={(val) => setBranchId(val)}
                            placeholder="Search & select facility branch..."
                            searchPlaceholder="Type branch name to search..."
                            disabled={isSubmitting}
                            icon={<Building2 className="h-4 w-4" />}
                            required
                        />
                    </div>

                    {/* Cutoff Date & Time */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Inventory Cutoff Date & Time <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            value={cutoffDate}
                            onChange={(e) => setCutoffDate(e.target.value)}
                            disabled={isSubmitting}
                            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                            required
                        />
                        <span className="text-[10px] text-muted-foreground block">
                            System count snapshots will sum all ledger entries in <code className="text-primary font-mono">inventory_movements</code> up to this date.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Stock Classification (from product_type database table) */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                                Stock Type
                            </label>
                            <SearchableSelect
                                options={stockOptions}
                                value={stockType}
                                onChange={(val) => setStockType(val)}
                                placeholder="Select product stock type..."
                                searchPlaceholder="Search product type name..."
                                disabled={isSubmitting}
                                icon={<Layers className="h-4 w-4" />}
                            />
                        </div>

                        {/* Price Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-primary" />
                                Valuation Price Type
                            </label>
                            <SearchableSelect
                                options={priceOptions}
                                value={priceType}
                                onChange={(val) => setPriceType(val)}
                                placeholder="Select price type..."
                                searchPlaceholder="Search price type..."
                                disabled={isSubmitting}
                                icon={<DollarSign className="h-4 w-4" />}
                            />
                        </div>
                    </div>

                    {/* Remarks / Notes */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            Audit Purpose & Remarks
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={isSubmitting}
                            placeholder="e.g. End-of-month inventory reconciliation audit"
                            rows={3}
                            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground font-semibold text-xs rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-sm transition-all hover:scale-[1.01] disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Snapshotting Database...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Initialize & Snapshot Stock
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
