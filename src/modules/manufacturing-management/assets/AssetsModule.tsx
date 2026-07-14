"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Search, Edit, Trash2, Settings, Check, LayoutGrid, Image as ImageIcon, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AssetRecord, DepartmentRecord } from "@/modules/manufacturing-management/finished-goods/types";
import {
    fetchAssets,
    createAsset,
    saveAsset,
    deleteAsset,
    fetchDepartments,
    fetchItems,
    createItem,
    fetchItemTypes,
    fetchItemClassifications,
    createItemType,
    createItemClassification
} from "@/modules/manufacturing-management/finished-goods/services/finished-goods-api";
import { Button } from "@/components/ui/button";
import { CreatableSelect } from "../finished-goods/components/CreatableSelect";

// Added specific types to replace `any`
export interface CatalogItem {
    id: number;
    item_name: string;
    item_code?: string;
}

export interface ItemType {
    id: number;
    type_name: string;
}

export interface ItemClassification {
    id: number;
    classification_name: string;
}

export default function AssetsModule() {
    const [assets, setAssets] = useState<AssetRecord[]>([]);
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [departments, setDepartments] = useState<DepartmentRecord[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);

    // Form inputs
    const [itemImage, setItemImage] = useState("");
    const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState("1");
    const [rfidCode, setRfidCode] = useState("");
    const [barcode, setBarcode] = useState("");
    const [serial, setSerial] = useState("");
    const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
    const [costPerItem, setCostPerItem] = useState("0");
    const [condition, setCondition] = useState<AssetRecord["condition"]>("Good");
    const [lifeSpan, setLifeSpan] = useState("");
    const [isActiveWarning, setIsActiveWarning] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [dateAcquired, setDateAcquired] = useState("");

    // Searchable dropdown state in modal
    const [itemSearch, setItemSearch] = useState("");
    const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
    const [deptSearch, setDeptSearch] = useState("");
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

    // Sub-modal state for registering new item
    const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [selectedItemTypeId, setSelectedItemTypeId] = useState("");
    const [selectedItemClassId, setSelectedItemClassId] = useState("");
    const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
    const [itemClassifications, setItemClassifications] = useState<ItemClassification[]>([]);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageFilename, setImageFilename] = useState("");

    const loadData = async () => {
        setLoading(true);
        try {
            const [assetList, itemList, deptList, typesList, classList] = await Promise.all([
                fetchAssets(),
                fetchItems().catch(() => []),
                fetchDepartments().catch(() => []),
                fetchItemTypes().catch(() => []),
                fetchItemClassifications().catch(() => [])
            ]);
            setAssets(assetList);
            setItems(itemList);
            setDepartments(deptList);
            setItemTypes(typesList);
            setItemClassifications(classList);
        } catch (e) {
            console.error("Failed to load assets data:", e);
            toast.error("Failed to load assets data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filtered Assets list
    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const query = searchQuery.toLowerCase();

            // Resolve item name with strict type cast
            let itemName = "";
            if (asset.item_id && typeof asset.item_id === "object") {
                itemName = (asset.item_id as unknown as CatalogItem).item_name || "";
            } else {
                const found = items.find(i => i.id === asset.item_id);
                itemName = found ? found.item_name : "";
            }

            // Resolve department name with strict type cast
            let deptName = "";
            if (asset.department && typeof asset.department === "object") {
                deptName = (asset.department as unknown as DepartmentRecord).department_name || "";
            } else {
                const found = departments.find(d => d.department_id === asset.department);
                deptName = found ? found.department_name : "";
            }

            const matchesName = itemName.toLowerCase().includes(query);
            const matchesSerial = (asset.serial || "").toLowerCase().includes(query);
            const matchesBarcode = (asset.barcode || "").toLowerCase().includes(query);
            const matchesRfid = (asset.rfid_code || "").toLowerCase().includes(query);
            const matchesCond = (asset.condition || "").toLowerCase().includes(query);
            const matchesDept = deptName.toLowerCase().includes(query);

            return matchesName || matchesSerial || matchesBarcode || matchesRfid || matchesCond || matchesDept;
        });
    }, [assets, searchQuery, items, departments]);

    const handleOpenCreateModal = () => {
        setEditingAsset(null);
        setItemImage("");
        setImageFilename("");
        setSelectedItemId(null);
        setQuantity("1");
        setRfidCode("");
        setBarcode("");
        setSerial("");
        setSelectedDeptId(null);
        setCostPerItem("0");
        setCondition("Good");
        setLifeSpan("");
        setIsActiveWarning(false);
        setIsActive(true);
        setDateAcquired(new Date().toISOString().substring(0, 10));

        setItemSearch("");
        setDeptSearch("");
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (asset: AssetRecord) => {
        setEditingAsset(asset);
        setItemImage(asset.item_image || "");
        setImageFilename("");

        const itemId = asset.item_id && typeof asset.item_id === "object" ? (asset.item_id as unknown as CatalogItem).id : (typeof asset.item_id === 'number' ? asset.item_id : null);
        setSelectedItemId(itemId);

        setQuantity(asset.quantity !== null && asset.quantity !== undefined ? String(asset.quantity) : "1");
        setRfidCode(asset.rfid_code || "");
        setBarcode(asset.barcode || "");
        setSerial(asset.serial || "");

        const deptId = asset.department && typeof asset.department === "object" ? (asset.department as unknown as DepartmentRecord).department_id : (typeof asset.department === 'number' ? asset.department : null);
        setSelectedDeptId(deptId);

        setCostPerItem(asset.cost_per_item !== null && asset.cost_per_item !== undefined ? String(asset.cost_per_item) : "0");
        setCondition(asset.condition || "Good");
        setLifeSpan(asset.life_span !== null && asset.life_span !== undefined ? String(asset.life_span) : "");
        setIsActiveWarning(Boolean(asset.is_active_warning));
        setIsActive(Boolean(asset.is_active));

        if (asset.date_acquired) {
            setDateAcquired(asset.date_acquired.substring(0, 10));
        } else {
            setDateAcquired("");
        }

        // Search text setups
        const matchedItem = items.find(i => i.id === itemId);
        setItemSearch(matchedItem ? matchedItem.item_name : "");

        const matchedDept = departments.find(d => d.department_id === deptId);
        setDeptSearch(matchedDept ? matchedDept.department_name : "");

        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemId) {
            toast.error("Please select an inventory item.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                item_image: itemImage.trim() || null,
                item_id: selectedItemId,
                quantity: parseInt(quantity) || 1,
                rfid_code: rfidCode.trim() || null,
                barcode: barcode.trim() || null,
                serial: serial.trim() || null,
                department: selectedDeptId,
                cost_per_item: parseFloat(costPerItem) || 0,
                condition: condition || "Good",
                life_span: lifeSpan.trim() ? parseInt(lifeSpan) : null,
                is_active_warning: isActiveWarning,
                is_active: isActive,
                date_acquired: dateAcquired || null
            };

            let success = false;
            if (editingAsset) {
                const res = await saveAsset(editingAsset.id, payload);
                success = res.success;
            } else {
                const res = await createAsset(payload);
                success = res.success;
            }

            if (success) {
                toast.success(editingAsset ? "Asset updated successfully!" : "Asset registered successfully!");
                setIsModalOpen(false);
                await loadData();
            }
        } catch (e) {
            console.error("Failed to save asset:", e);
            const error = e instanceof Error ? e : new Error(String(e));
            toast.error(error.message || "Failed to save asset");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this asset record?")) return;
        try {
            const res = await deleteAsset(id);
            if (res.success) {
                toast.success("Asset deleted successfully!");
                await loadData();
            }
        } catch (e) {
            console.error("Failed to delete asset:", e);
            toast.error("Failed to delete asset record");
        }
    };

    const handleOpenNewItemSubModal = () => {
        setNewItemName("");
        setSelectedItemTypeId("");
        setSelectedItemClassId("");
        setIsNewItemModalOpen(true);
    };

    const handleCreateItemSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedItemName = newItemName.trim();
        if (!trimmedItemName) {
            toast.error("Item name is required.");
            return;
        }

        if (!selectedItemTypeId) {
            toast.error("Item Type is required.");
            return;
        }

        if (!selectedItemClassId) {
            toast.error("Item Classification is required.");
            return;
        }

        const isDuplicateItem = items.some(item =>
            item.item_name?.trim().toLowerCase() === trimmedItemName.toLowerCase()
        );

        if (isDuplicateItem) {
            toast.error("Item name already exists. Please choose a unique name.");
            return;
        }

        try {
            const res = await createItem({
                item_name: trimmedItemName,
                item_type: selectedItemTypeId ? Number(selectedItemTypeId) : undefined,
                item_classification: selectedItemClassId ? Number(selectedItemClassId) : undefined
            });

            if (res.success && res.item) {
                toast.success(`Successfully registered item "${trimmedItemName}"!`);
                setItems(prev => [res.item, ...prev]);
                setSelectedItemId(res.item.id);
                setItemSearch(res.item.item_name);
                setIsNewItemModalOpen(false);
            }
        } catch (err) {
            console.error("Failed to create item:", err);
            const error = err instanceof Error ? err : new Error(String(err));
            toast.error(error.message || "Failed to register item");
        }
    };

    const handleCreateItemType = async (name: string) => {
        try {
            const res = await createItemType(name);
            if (res.success && res.type) {
                toast.success(`Successfully registered item type "${name}"!`);
                setItemTypes(prev => [...prev, res.type]);
                setSelectedItemTypeId(String(res.type.id));
            }
        } catch (err) {
            console.error("Failed to create item type:", err);
            toast.error("Failed to create item type");
        }
    };

    const handleCreateItemClassification = async (name: string) => {
        try {
            const res = await createItemClassification(name);
            if (res.success && res.classification) {
                toast.success(`Successfully registered item classification "${name}"!`);
                setItemClassifications(prev => [...prev, res.classification]);
                setSelectedItemClassId(String(res.classification.id));
            }
        } catch (err) {
            console.error("Failed to create item classification:", err);
            toast.error("Failed to create item classification");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            
            const fileData = await uploadRes.json();
            const fileId = fileData?.data?.id;
            if (fileId) {
                const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
                setItemImage(`${baseUrl}/assets/${fileId}`);
                setImageFilename(file.name);
                toast.success("Image uploaded successfully");
            }
        } catch (err) {
            console.error("Failed to upload image:", err);
            toast.error("Failed to upload image");
        } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    };

    // Calculate Total Cost dynamically
    const calculatedTotal = useMemo(() => {
        const qty = parseInt(quantity) || 0;
        const cost = parseFloat(costPerItem) || 0;
        return qty * cost;
    }, [quantity, costPerItem]);

    // Filter items
    const filteredItems = useMemo(() => {
        if (!itemSearch.trim()) return items;
        const search = itemSearch.toLowerCase();
        return items.filter(i =>
            (i.item_name || "").toLowerCase().includes(search) ||
            (i.item_code || "").toLowerCase().includes(search)
        );
    }, [items, itemSearch]);

    // Filter departments
    const filteredDepts = useMemo(() => {
        if (!deptSearch.trim()) return departments;
        const search = deptSearch.toLowerCase();
        return departments.filter(d =>
            d.department_name.toLowerCase().includes(search)
        );
    }, [departments, deptSearch]);

    const typeOptions = useMemo(() => itemTypes.map(t => ({ value: String(t.id), label: t.type_name })), [itemTypes]);
    const classificationOptions = useMemo(() => itemClassifications.map(c => ({ value: String(c.id), label: c.classification_name })), [itemClassifications]);

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary animate-spin" style={{ animationDuration: "25s" }} /> Asset &amp; Equipment Management
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Track operational factory floor machinery, costs, lifespans, and physical conditions.</p>
                </div>
                <Button
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md shadow-primary/20"
                >
                    <Plus className="h-4 w-4" /> Register Equipment / Asset
                </Button>
            </div>

            {/* Filter and search block */}
            <div className="flex items-center gap-4 bg-muted/10 p-3 rounded-lg border border-border/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-70" />
                    <input
                        type="text"
                        placeholder="Search by asset name, serial, barcode, RFID code, or condition..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pl-10 pr-3 rounded-lg border border-muted bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Assets Table view */}
            <div className="overflow-x-auto rounded-xl border border-muted/50 bg-card text-card-foreground shadow-sm">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-3 text-muted-foreground">
                        <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full" />
                        <span className="text-xs font-medium">Loading Assets &amp; Equipment list...</span>
                    </div>
                ) : filteredAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground">
                        <LayoutGrid className="h-12 w-12 text-muted/30 mb-2" />
                        <span className="text-sm font-semibold">No Assets registered</span>
                        <p className="text-xs max-w-xs mt-1">Register assets to link mixing vats, packing equipment, or other industrial machinery.</p>
                    </div>
                ) : (
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="bg-muted/10 border-b border-muted/50 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                                <th className="p-4 pl-6 w-[8%]">Image</th>
                                <th className="p-4">Item Name</th>
                                <th className="p-4">Qty</th>
                                <th className="p-4">Cost per Item</th>
                                <th className="p-4">Total Cost</th>
                                <th className="p-4">Serial / Barcode / RFID</th>
                                <th className="p-4">Department</th>
                                <th className="p-4">Condition</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center w-[12%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssets.map(asset => {
                                // Get item name
                                let itemName = "Unknown Item";
                                if (asset.item_id && typeof asset.item_id === "object") {
                                    itemName = (asset.item_id as unknown as CatalogItem).item_name || "Unknown Item";
                                } else {
                                    const found = items.find(i => i.id === asset.item_id);
                                    itemName = found ? found.item_name : "Unknown Item";
                                }

                                // Get department name
                                let deptName = "";
                                if (asset.department && typeof asset.department === "object") {
                                    deptName = (asset.department as unknown as DepartmentRecord).department_name || "";
                                } else {
                                    const found = departments.find(d => d.department_id === asset.department);
                                    deptName = found ? found.department_name : "";
                                }

                                return (
                                    <tr key={asset.id} className="border-b border-muted/40 hover:bg-muted/5 transition-colors">
                                        <td className="p-4 pl-6 align-middle">
                                            {asset.item_image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={asset.item_image}
                                                    alt={itemName}
                                                    className="w-10 h-10 object-cover rounded-md border border-border"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-muted/20 border border-dashed rounded-md flex items-center justify-center text-muted-foreground/40">
                                                    <ImageIcon className="h-4 w-4" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 align-middle font-semibold text-foreground text-sm">
                                            {itemName}
                                        </td>
                                        <td className="p-4 align-middle text-muted-foreground font-medium">
                                            {asset.quantity || 1}
                                        </td>
                                        <td className="p-4 align-middle text-muted-foreground font-medium">
                                            ₱{(asset.cost_per_item || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 align-middle text-foreground font-bold">
                                            ₱{(asset.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-4 align-middle text-muted-foreground">
                                            <div className="flex flex-col gap-0.5 text-[11px]">
                                                {asset.serial && <div><span className="font-semibold text-foreground">S/N:</span> {asset.serial}</div>}
                                                {asset.barcode && <div><span className="font-semibold text-foreground">Barcode:</span> {asset.barcode}</div>}
                                                {asset.rfid_code && <div><span className="font-semibold text-foreground">RFID:</span> {asset.rfid_code}</div>}
                                                {!asset.serial && !asset.barcode && !asset.rfid_code && <span className="italic opacity-50">No codes linked</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle">
                                            {deptName ? (
                                                <span className="bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded font-medium">
                                                    {deptName}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/50 italic">None</span>
                                            )}
                                        </td>
                                        <td className="p-4 align-middle">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${asset.condition === "Good" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                                                asset.condition === "Bad" ? "bg-destructive/10 text-destructive border border-destructive/20" :
                                                    asset.condition === "Under Maintenance" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                                                        "bg-muted text-muted-foreground border"
                                                }`}>
                                                {asset.condition || "Good"}
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${Boolean(asset.is_active)
                                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                : "bg-destructive/10 text-destructive border border-destructive/20"
                                                }`}>
                                                {Boolean(asset.is_active) ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenEditModal(asset)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(asset.id)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Custom Create / Edit Modal popup */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card border border-border/85 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-muted/20">
                            <div className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary" />
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        {editingAsset ? "Edit Asset / Equipment" : "Register Asset / Equipment"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">Log machinery specs, costs, location department, and condition.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors px-3 py-1.5 hover:bg-muted rounded-lg"
                            >
                                Close
                            </button>
                        </div>

                        {/* Modal Form Body */}
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                            {/* Searchable dropdown: Item Select */}
                            <div className="space-y-1 relative">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block">Catalog Item <span className="text-red-500">*</span></label>
                                    <button
                                        type="button"
                                        onClick={handleOpenNewItemSubModal}
                                        className="text-[10px] text-primary hover:underline font-bold"
                                    >
                                        + New Item
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        placeholder="Search item name or code..."
                                        value={itemSearch}
                                        onChange={e => {
                                            setItemSearch(e.target.value);
                                            setIsItemDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsItemDropdownOpen(true)}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                    {selectedItemId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedItemId(null);
                                                setItemSearch("");
                                            }}
                                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground font-bold"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>

                                {isItemDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsItemDropdownOpen(false)} />
                                        <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg bg-card border border-border shadow-lg py-1 z-20 text-xs">
                                            {filteredItems.length === 0 ? (
                                                <div className="px-3 py-2 text-muted-foreground italic">No matching catalog items found.</div>
                                            ) : (
                                                filteredItems.map(item => {
                                                    const label = item.item_name;
                                                    return (
                                                        <button
                                                            key={item.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedItemId(item.id);
                                                                setItemSearch(label);
                                                                setIsItemDropdownOpen(false);
                                                            }}
                                                            className="w-full text-left px-3 py-2 hover:bg-muted text-foreground flex items-center justify-between"
                                                        >
                                                            <span>{label}</span>
                                                            {selectedItemId === item.id && <Check className="h-3.5 w-3.5 text-primary" />}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Searchable dropdown: Department */}
                            <div className="space-y-1 relative">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Owner Department</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search department name..."
                                        value={deptSearch}
                                        onChange={e => {
                                            setDeptSearch(e.target.value);
                                            setIsDeptDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsDeptDropdownOpen(true)}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                    {selectedDeptId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedDeptId(null);
                                                setDeptSearch("");
                                            }}
                                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground font-bold"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>

                                {isDeptDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsDeptDropdownOpen(false)} />
                                        <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg bg-card border border-border shadow-lg py-1 z-20 text-xs">
                                            {filteredDepts.length === 0 ? (
                                                <div className="px-3 py-2 text-muted-foreground italic">No matching departments found.</div>
                                            ) : (
                                                filteredDepts.map(dept => {
                                                    const label = dept.department_name;
                                                    return (
                                                        <button
                                                            key={dept.department_id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedDeptId(dept.department_id);
                                                                setDeptSearch(label);
                                                                setIsDeptDropdownOpen(false);
                                                            }}
                                                            className="w-full text-left px-3 py-2 hover:bg-muted text-foreground flex items-center justify-between"
                                                        >
                                                            <span>{label}</span>
                                                            {selectedDeptId === dept.department_id && <Check className="h-3.5 w-3.5 text-primary" />}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Quantity and cost per item */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Cost per Item (₱)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={costPerItem}
                                        onChange={e => setCostPerItem(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Calculated Total Cost */}
                            <div className="bg-muted/10 p-3 rounded-lg border border-border/50 flex justify-between items-center text-xs">
                                <span className="font-bold text-muted-foreground uppercase">Estimated Total Cost:</span>
                                <span className="font-extrabold text-foreground text-sm">₱{calculatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                            </div>

                            {/* Condition and Lifespan */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Physical Condition</label>
                                    <select
                                        value={condition || "Good"}
                                        onChange={e => setCondition(e.target.value as AssetRecord["condition"])}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    >
                                        <option value="Good">Good</option>
                                        <option value="Bad">Bad</option>
                                        <option value="Under Maintenance">Under Maintenance</option>
                                        <option value="Discontinued">Discontinued</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Useful Lifespan (Months)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 60"
                                        value={lifeSpan}
                                        onChange={e => setLifeSpan(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Date Acquired & Image URL */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Date Acquired</label>
                                    <input
                                        type="date"
                                        value={dateAcquired}
                                        onChange={e => setDateAcquired(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Image Upload</label>
                                    <label className={`w-full flex items-center h-[38px] rounded-lg border border-border bg-background overflow-hidden cursor-pointer focus-within:ring-1 focus-within:ring-primary transition-all ${uploadingImage ? "opacity-50 cursor-not-allowed" : ""}`}>
                                        <div className="flex items-center justify-center gap-2 h-full px-3 bg-muted border-r border-border hover:bg-muted/80 transition-colors shrink-0">
                                            {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                            <span className="text-xs font-semibold">{uploadingImage ? "Uploading..." : ""}</span>
                                        </div>
                                        <span className="text-sm text-muted-foreground truncate px-3 flex-1">
                                            {imageFilename ? imageFilename : (itemImage ? "Image attached" : "No file chosen")}
                                        </span>
                                        <input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={handleImageUpload} />
                                    </label>
                                </div>
                            </div>

                            {/* Codes: Serial, Barcode, RFID */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Serial Number</label>
                                    <input
                                        type="text"
                                        placeholder="S/N Code"
                                        value={serial}
                                        onChange={e => setSerial(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Barcode</label>
                                    <input
                                        type="text"
                                        placeholder="Barcode"
                                        value={barcode}
                                        onChange={e => setBarcode(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">RFID Code</label>
                                    <input
                                        type="text"
                                        placeholder="RFID RFID"
                                        value={rfidCode}
                                        onChange={e => setRfidCode(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Warnings and Status Toggles */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={isActiveWarning}
                                        onChange={(e) => setIsActiveWarning(e.target.checked)}
                                        className="h-4.5 w-4.5 rounded border-muted bg-background text-primary focus:ring-0"
                                    />
                                    Active Warning Flag
                                </label>
                                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="h-4.5 w-4.5 rounded border-muted bg-background text-primary focus:ring-0"
                                    />
                                    Is Active &amp; operational
                                </label>
                            </div>

                            {/* Modal Footer Actions */}
                            <div className="flex justify-end gap-3 pt-3 border-t shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-border rounded-lg text-xs font-semibold hover:bg-muted transition-colors text-muted-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-lg text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20 flex items-center gap-1.5"
                                >
                                    {saving && (
                                        <div className="h-3 w-3 animate-spin border border-current border-t-transparent rounded-full" />
                                    )}
                                    {saving ? "Saving..." : "Save Equipment"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Sub-modal: Register New Item */}
            {isNewItemModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-visible flex flex-col animate-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/10 shrink-0">
                            <h4 className="text-sm font-bold text-foreground">Register New Catalog Item</h4>
                            <button
                                type="button"
                                onClick={() => setIsNewItemModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground text-xs font-semibold px-2 py-1 hover:bg-muted rounded"
                            >
                                Cancel
                            </button>
                        </div>
                        {/* Body Form */}
                        <form onSubmit={handleCreateItemSubmit} className="p-5 space-y-4 text-xs">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Item Name <span className="text-destructive">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Soya Press Machine Model X"
                                    value={newItemName}
                                    onChange={e => setNewItemName(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Item Type <span className="text-destructive">*</span></label>
                                <CreatableSelect
                                    variant="inline"
                                    options={typeOptions}
                                    value={selectedItemTypeId}
                                    onValueChange={setSelectedItemTypeId}
                                    placeholder="Select or type to create Item Type"
                                    onCreateOption={handleCreateItemType}
                                    popoverClassName="z-[70]"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Item Classification <span className="text-destructive">*</span></label>
                                <CreatableSelect
                                    variant="inline"
                                    options={classificationOptions}
                                    value={selectedItemClassId}
                                    onValueChange={setSelectedItemClassId}
                                    placeholder="Select or type to create Item Classification"
                                    onCreateOption={handleCreateItemClassification}
                                    popoverClassName="z-[70]"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsNewItemModalOpen(false)}
                                    className="px-3 py-1.5 border border-border rounded text-xs font-semibold hover:bg-muted transition-colors text-muted-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded text-xs transition-all shadow"
                                >
                                    Create Item
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}