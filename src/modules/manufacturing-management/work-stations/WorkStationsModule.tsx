"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Search, Edit, DollarSign, Activity, Settings, Check, LayoutGrid, Image as ImageIcon, ChevronsLeft, ChevronsRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { WorkCenter, AssetRecord, DepartmentRecord } from "@/modules/manufacturing-management/finished-goods/types";
import { 
    fetchWorkCenters, 
    createWorkCenter, 
    saveWorkCenter, 
    fetchAssets, 
    fetchDepartments 
} from "@/modules/manufacturing-management/finished-goods/services/finished-goods-api";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { formatNumber } from "@/lib/utils";

export default function WorkStationsModule() {
    const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
    const [assets, setAssets] = useState<AssetRecord[]>([]);
    const [departments, setDepartments] = useState<DepartmentRecord[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWorkCenter, setEditingWorkCenter] = useState<WorkCenter | null>(null);

    // Form inputs
    const [wcName, setWcName] = useState("");
    const [overheadCost, setOverheadCost] = useState("0");
    const [capacity, setCapacity] = useState("0");
    const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
    const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(true);

    // Searchable dropdown state in modal
    const [assetSearch, setAssetSearch] = useState("");
    const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);
    const [deptSearch, setDeptSearch] = useState("");
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);

    // Formats Asset label to display in UI (hiding raw database IDs)
    const getAssetLabel = (asset: AssetRecord): string => {
        const name = typeof asset.item_id === 'object' ? asset.item_id?.item_name || "" : "";
        const serial = asset.serial || "";
        const condition = asset.condition || "";

        let label = name;
        if (!label) {
            label = serial || asset.barcode || "Equipment Asset";
        } else if (serial) {
            label = `${label} (Serial: ${serial})`;
        }
        if (condition) {
            label = `${label} - ${condition}`;
        }
        return label;
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [wcList, assetList, deptList] = await Promise.all([
                fetchWorkCenters(),
                fetchAssets().catch(() => []),
                fetchDepartments().catch(() => [])
            ]);
            setWorkCenters(wcList);
            setAssets(assetList);
            setDepartments(deptList);
        } catch (e) {
            console.error("Failed to load work stations data:", e);
            toast.error("Failed to load work stations data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filtered Work Centers list
    const filteredWorkCenters = useMemo(() => {
        return workCenters.filter(wc => {
            const query = searchQuery.toLowerCase();
            const matchesName = wc.work_center_name.toLowerCase().includes(query);
            const assetName = typeof wc.asset?.item_id === 'object' ? wc.asset?.item_id?.item_name || "" : "";
            const matchesAsset = assetName.toLowerCase().includes(query) ||
                                 wc.asset?.serial?.toLowerCase().includes(query) || 
                                 wc.asset?.barcode?.toLowerCase().includes(query);
            const matchesDept = wc.department?.department_name?.toLowerCase().includes(query);
            return matchesName || matchesAsset || matchesDept;
        });
    }, [workCenters, searchQuery]);

    // Reset page to 1 when search query, filter result length, or page size changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredWorkCenters.length, pageSize]);

    const totalPages = Math.ceil(filteredWorkCenters.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedWorkCenters = useMemo(() => {
        return filteredWorkCenters.slice(startIndex, startIndex + pageSize);
    }, [filteredWorkCenters, startIndex, pageSize]);

    const handleOpenCreateModal = () => {
        setEditingWorkCenter(null);
        setWcName("");
        setOverheadCost("0");
        setCapacity("0");
        setSelectedAssetId(null);
        setSelectedDeptId(null);
        setIsActive(true);
        setAssetSearch("");
        setDeptSearch("");
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (wc: WorkCenter) => {
        setEditingWorkCenter(wc);
        setWcName(wc.work_center_name);
        setOverheadCost(wc.overhead_cost_per_hour != null ? String(Number(wc.overhead_cost_per_hour)) : "0");
        setCapacity(wc.capacity_per_hour != null ? String(Math.round(Number(wc.capacity_per_hour))) : "0");
        setSelectedAssetId(wc.asset_id || null);
        setSelectedDeptId(wc.department_id || null);
        setIsActive(Boolean(wc.is_active));

        // Prepopulate searches (without prepending raw ID)
        const matchedAsset = assets.find(a => a.id === wc.asset_id);
        setAssetSearch(matchedAsset ? getAssetLabel(matchedAsset) : "");
        const matchedDept = departments.find(d => d.department_id === wc.department_id);
        setDeptSearch(matchedDept ? matchedDept.department_name : "");

        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = wcName.trim();
        if (!trimmedName) {
            toast.error("Work station name is required.");
            return;
        }

        const capacityNum = Number(capacity);
        if (isNaN(capacityNum) || !Number.isInteger(capacityNum) || capacityNum < 0) {
            toast.error("Capacity per hour must be a whole number greater than or equal to zero.");
            return;
        }

        const costNum = Number(overheadCost);
        if (isNaN(costNum) || costNum < 0) {
            toast.error("Overhead cost per hour must be a number greater than or equal to zero.");
            return;
        }

        const costStr = String(overheadCost);
        const decimalPart = costStr.split(".")[1];
        if (decimalPart && decimalPart.length > 3) {
            toast.error("Overhead cost per hour cannot have more than 3 decimal places.");
            return;
        }

        const isDuplicate = workCenters.some(wc => 
            wc.work_center_name?.trim().toLowerCase() === trimmedName.toLowerCase() &&
            wc.work_center_id !== editingWorkCenter?.work_center_id
        );

        if (isDuplicate) {
            toast.error("Work station name already exists. Please choose a unique name.");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                work_center_name: trimmedName,
                asset_id: selectedAssetId,
                department_id: selectedDeptId,
                overhead_cost_per_hour: parseFloat(overheadCost) || 0,
                capacity_per_hour: parseInt(capacity, 10) || 0,
                is_active: isActive
            };

            let success = false;
            if (editingWorkCenter) {
                const res = await saveWorkCenter(editingWorkCenter.work_center_id, payload);
                success = res.success;
            } else {
                const res = await createWorkCenter(payload);
                success = res.success;
            }

            if (success) {
                toast.success(editingWorkCenter ? "Work station updated successfully!" : "Work station created successfully!");
                setIsModalOpen(false);
                await loadData();
            }
        } catch (e) {
            console.error("Failed to save work station:", e);
            const error = e instanceof Error ? e : new Error(String(e));
            toast.error(error.message || "Failed to save work station");
        } finally {
            setSaving(false);
        }
    };

    // Auto-filter asset matches
    const filteredAssets = useMemo(() => {
        if (!assetSearch.trim()) return assets;
        const search = assetSearch.toLowerCase();
        return assets.filter(a => {
            const assetName = typeof a.item_id === 'object' ? a.item_id?.item_name || "" : "";
            return assetName.toLowerCase().includes(search) ||
                (a.serial || "").toLowerCase().includes(search) ||
                (a.barcode || "").toLowerCase().includes(search);
        });
    }, [assets, assetSearch]);

    // Auto-filter dept matches
    const filteredDepts = useMemo(() => {
        if (!deptSearch.trim()) return departments;
        const search = deptSearch.toLowerCase();
        return departments.filter(d => 
            d.department_name.toLowerCase().includes(search)
        );
    }, [departments, deptSearch]);

    return (
        <div className="flex flex-col gap-6 w-full">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" /> Work Stations &amp; Centers Master
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">Configure manufacturing lines, machinery associations, and standard capacity per hour.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline"
                        size="icon"
                        onClick={loadData}
                        disabled={loading}
                        className="h-9 w-9 border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                        title="Refresh Work Stations"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button 
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md shadow-primary/20"
                    >
                        <Plus className="h-4 w-4" /> Add Work Station
                    </Button>
                </div>
            </div>

            {/* Filter and search block */}
            <div className="flex items-center gap-4 bg-muted/10 p-3 rounded-lg border border-border/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-70" />
                    <input
                        type="text"
                        placeholder="Search by work station name, asset, or department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pl-10 pr-3 rounded-lg border border-muted bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Main Table view */}
            <div className="overflow-x-auto rounded-xl border border-muted/50 bg-card text-card-foreground shadow-sm">
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-3 text-muted-foreground">
                        <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full" />
                        <span className="text-xs font-medium">Loading Work Stations data...</span>
                    </div>
                ) : filteredWorkCenters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 text-center text-muted-foreground">
                        <LayoutGrid className="h-12 w-12 text-muted/30 mb-2" />
                        <span className="text-sm font-semibold">No Work Stations found</span>
                        <p className="text-xs max-w-xs mt-1">Click the &quot;Add Work Station&quot; button to register a workstation in the system.</p>
                    </div>
                ) : (
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="bg-muted/10 border-b border-muted/50 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                                <th className="p-4 pl-6">Work Station Name</th>
                                <th className="p-4">
                                    <DollarSign className="h-3.5 w-3.5 inline mr-0.5" /> Overhead Cost / Hour
                                </th>
                                <th className="p-4">
                                    <Activity className="h-3.5 w-3.5 inline mr-0.5" /> Capacity / Hour
                                </th>
                                <th className="p-4">Associated Asset</th>
                                <th className="p-4">Department</th>
                                <th className="p-4">Availability Status</th>
                                <th className="p-4 text-center w-[12%]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedWorkCenters.map(wc => (
                                <tr key={wc.work_center_id} className="border-b border-muted/40 hover:bg-muted/5 transition-colors">
                                    <td className="p-4 pl-6 align-middle font-semibold text-foreground text-sm">
                                        {wc.work_center_name}
                                    </td>
                                    <td className="p-4 align-middle text-muted-foreground font-medium">
                                        {new Intl.NumberFormat("en-PH", {
                                            style: "currency",
                                            currency: "PHP",
                                            minimumFractionDigits: 3,
                                            maximumFractionDigits: 3
                                        }).format(Number(wc.overhead_cost_per_hour) || 0)}
                                    </td>
                                    <td className="p-4 align-middle text-muted-foreground font-medium">
                                        {formatNumber(Number(wc.capacity_per_hour) || 0, "en-PH", 0)} units
                                    </td>
                                    <td className="p-4 align-middle text-muted-foreground">
                                        {wc.asset ? (() => {
                                            const assetName = typeof wc.asset.item_id === 'object' ? wc.asset.item_id?.item_name || "" : "";
                                            return (
                                                <div className="flex items-center gap-3">
                                                    {wc.asset.item_image ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img 
                                                            src={wc.asset.item_image} 
                                                            alt={assetName || "Asset"} 
                                                            className="w-10 h-10 object-cover rounded border border-border shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-muted/20 border border-dashed rounded flex items-center justify-center text-muted-foreground/30 shrink-0">
                                                            <ImageIcon className="h-4.5 w-4.5" />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-foreground">
                                                            {assetName || wc.asset.serial || wc.asset.barcode || "Asset"}
                                                        </span>
                                                        {assetName && wc.asset.serial && (
                                                            <span className="text-[10px] text-muted-foreground">Serial: {wc.asset.serial}</span>
                                                        )}
                                                        <span className="text-[10px] text-muted-foreground">Cond: {wc.asset.condition || "Good"}</span>
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            <span className="text-muted-foreground/50 italic">None linked</span>
                                        )}
                                    </td>
                                    <td className="p-4 align-middle text-muted-foreground">
                                        {(() => {
                                            const dept = departments.find(d => d.department_id === wc.department_id) || wc.department;
                                            return dept ? (
                                                <span className="bg-primary/5 text-primary border border-primary/10 px-2 py-0.5 rounded font-medium">
                                                    {dept.department_name}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground/50 italic">None mapped</span>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-4 align-middle">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                                            Boolean(wc.is_active) 
                                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                                                : "bg-destructive/10 text-destructive border border-destructive/20"
                                        }`}>
                                            {Boolean(wc.is_active) ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="p-4 align-middle text-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleOpenEditModal(wc)}
                                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination Controls */}
            {!loading && filteredWorkCenters.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 text-sm text-muted-foreground px-1">
                    <div className="flex items-center gap-2">
                        <span>Rows per page</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(val) => {
                                setPageSize(Number(val));
                            }}
                        >
                            <SelectTrigger className="w-[70px] h-8 bg-background border border-border text-foreground">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="bg-popover border border-border text-foreground">
                                {[10, 20, 30, 40, 50].map((size) => (
                                    <SelectItem key={size} value={String(size)}>
                                        {size}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="ml-2 font-medium">
                            Showing {filteredWorkCenters.length > 0 ? startIndex + 1 : 0}-
                            {Math.min(startIndex + pageSize, filteredWorkCenters.length)} of{" "}
                            {filteredWorkCenters.length} items
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="h-8 px-3 text-foreground"
                        >
                            Previous
                        </Button>
                        
                        <div className="flex items-center gap-1 px-2 font-semibold text-xs">
                            <span>Page</span>
                            <span className="text-foreground">{currentPage}</span>
                            <span>of</span>
                            <span>{totalPages || 1}</span>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="h-8 px-3 text-foreground"
                        >
                            Next
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Custom Create / Edit Modal popup */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-card border border-border/85 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-muted/20">
                            <div className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary animate-spin" style={{ animationDuration: "10s" }} />
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        {editingWorkCenter ? "Edit Work Station" : "Register Work Station"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">Specify machinery, line costs, capacity, and owner department.</p>
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
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                            {/* Work Center Name */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Work Station Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Mixing Vat Station #3"
                                    value={wcName}
                                    onChange={e => setWcName(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                />
                            </div>

                            {/* Cost and Capacity */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Overhead Cost / Hour (₱)</label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        required
                                        value={overheadCost}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === "" || /^\d*(\.\d{0,3})?$/.test(val)) {
                                                setOverheadCost(val);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (["-", "e", "E", "+"].includes(e.key)) {
                                                e.preventDefault();
                                            }
                                        }}
                                        onPaste={(e) => {
                                            const pasted = e.clipboardData.getData("text");
                                            if (/[^0-9.]/.test(pasted)) {
                                                e.preventDefault();
                                                return;
                                            }
                                            const parts = pasted.split(".");
                                            if (parts.length > 1 && parts[1].length > 3) {
                                                e.preventDefault();
                                            }
                                        }}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Capacity / Hour (Units)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        required
                                        value={capacity}
                                        onChange={e => setCapacity(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (["-", "e", "E", "+", "."].includes(e.key)) {
                                                e.preventDefault();
                                            }
                                        }}
                                        onPaste={(e) => {
                                            const pasted = e.clipboardData.getData("text");
                                            if (/[^0-9]/.test(pasted)) {
                                                e.preventDefault();
                                            }
                                        }}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                </div>
                            </div>

                            {/* Searchable dropdown: Asset / Equipment */}
                            <div className="space-y-1 relative">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Asset Equipment Association</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search asset or equipment serial..."
                                        value={assetSearch}
                                        onChange={e => {
                                            setAssetSearch(e.target.value);
                                            setIsAssetDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsAssetDropdownOpen(true)}
                                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all"
                                    />
                                    {selectedAssetId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedAssetId(null);
                                                setAssetSearch("");
                                            }}
                                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground font-bold"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>

                                {isAssetDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsAssetDropdownOpen(false)} />
                                        <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg bg-card border border-border shadow-lg py-1 z-20 text-xs">
                                            {filteredAssets.length === 0 ? (
                                                <div className="px-3 py-2 text-muted-foreground italic">No matching equipment found.</div>
                                            ) : (
                                                filteredAssets.map(asset => {
                                                    const label = getAssetLabel(asset);
                                                    return (
                                                        <button
                                                            key={asset.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedAssetId(asset.id);
                                                                setAssetSearch(label);
                                                                setIsAssetDropdownOpen(false);
                                                            }}
                                                            className="w-full text-left px-3 py-2 hover:bg-muted text-foreground flex items-center justify-between"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {asset.item_image ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img 
                                                                        src={asset.item_image} 
                                                                        alt={label} 
                                                                        className="w-7 h-7 object-cover rounded border border-border shrink-0"
                                                                    />
                                                                ) : (
                                                                    <div className="w-7 h-7 bg-muted/20 border border-dashed rounded flex items-center justify-center text-muted-foreground/30 shrink-0">
                                                                        <ImageIcon className="h-3.5 w-3.5" />
                                                                    </div>
                                                                )}
                                                                <span>{label}</span>
                                                            </div>
                                                            {selectedAssetId === asset.id && <Check className="h-3.5 w-3.5 text-primary" />}
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

                            {/* Status */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">Status</label>
                                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="h-4.5 w-4.5 rounded border-muted bg-background text-primary focus:ring-0"
                                    />
                                    Active &amp; Operational on Factory Floor
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
                                    {saving ? "Saving..." : "Save Work Station"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
