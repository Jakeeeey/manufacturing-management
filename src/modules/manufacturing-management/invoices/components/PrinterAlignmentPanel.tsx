// src/modules/manufacturing-management/invoices/components/PrinterAlignmentPanel.tsx

import React, { useState, useEffect, useRef } from "react";
import { PrinterAlignmentSettings } from "../types";
import { Sliders, RotateCcw, Save, Move, HelpCircle, Plus, Trash2, Layout } from "lucide-react";
import { toast } from "sonner";

interface PrinterAlignmentPanelProps {
    alignment: PrinterAlignmentSettings;
    onSave: (settings: PrinterAlignmentSettings) => void;
    onReset: () => void;
}

interface SavedTemplate {
    name: string;
    settings: PrinterAlignmentSettings;
}

const TEMPLATES_STORAGE_KEY = "vos_invoice_print_templates";
const ACTIVE_TEMPLATE_KEY = "vos_invoice_active_template_name";

const defaultAlignmentSettings: PrinterAlignmentSettings = {
    topMargin: 15,
    leftMargin: 15,
    lineHeight: 6,
    fontSize: 10,
    offsets: {
        invoiceDate: { x: 140, y: 15 },
        invoiceNo: { x: 140, y: 22 },
        customerName: { x: 25, y: 30 },
        customerAddress: { x: 25, y: 37 },
        customerTin: { x: 25, y: 44 },
        terms: { x: 140, y: 44 },
        tableStart: { y: 58 },
        colQty: { x: 15 },
        colUnit: { x: 30 },
        colDescription: { x: 50 },
        colUnitPrice: { x: 130 },
        colAmount: { x: 160 },
        totalAmount: { x: 160, y: 115 }
    }
};

const prePrintedContinuousNarrow: PrinterAlignmentSettings = {
    topMargin: 10,
    leftMargin: 10,
    lineHeight: 5.5,
    fontSize: 9.5,
    offsets: {
        invoiceDate: { x: 130, y: 12 },
        invoiceNo: { x: 130, y: 18 },
        customerName: { x: 20, y: 25 },
        customerAddress: { x: 20, y: 31 },
        customerTin: { x: 20, y: 37 },
        terms: { x: 130, y: 37 },
        tableStart: { y: 50 },
        colQty: { x: 10 },
        colUnit: { x: 25 },
        colDescription: { x: 42 },
        colUnitPrice: { x: 120 },
        colAmount: { x: 150 },
        totalAmount: { x: 150, y: 100 }
    }
};

export default function PrinterAlignmentPanel({
    alignment,
    onSave,
    onReset
}: PrinterAlignmentPanelProps) {
    const [templates, setTemplates] = useState<SavedTemplate[]>([]);
    const [selectedTemplateName, setSelectedTemplateName] = useState<string>("Custom Settings");
    const [newTemplateName, setNewTemplateName] = useState("");
    const [showSaveAsModal, setShowSaveAsModal] = useState(false);

    // Draggable element states
    const [draggingKey, setDraggingKey] = useState<string | null>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const dragInitialCoords = useRef({ x: 0, y: 0 });
    const scaleFactor = 1.67; // px per mm

    // Load templates on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedActive = localStorage.getItem(ACTIVE_TEMPLATE_KEY);
            const savedList = localStorage.getItem(TEMPLATES_STORAGE_KEY);
            
            let loadedTemplates: SavedTemplate[] = [];
            
            if (savedList) {
                try {
                    loadedTemplates = JSON.parse(savedList);
                } catch (e) {
                    console.error("Failed to parse saved templates list:", e);
                }
            }
            
            // Seed defaults if list is empty
            if (loadedTemplates.length === 0) {
                loadedTemplates = [
                    { name: "Standard Layout (Letter)", settings: defaultAlignmentSettings },
                    { name: "Continuous Feed (Narrow)", settings: prePrintedContinuousNarrow }
                ];
                localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(loadedTemplates));
            }
            
            setTemplates(loadedTemplates);
            if (savedActive) {
                setSelectedTemplateName(savedActive);
            } else {
                setSelectedTemplateName(loadedTemplates[0]?.name || "Standard Layout (Letter)");
            }
        }
    }, []);

    const handleFieldChange = (
        section: "global" | "offset",
        key: string,
        coord: "x" | "y" | null,
        value: number
    ) => {
        const updated = { ...alignment };
        
        if (section === "global") {
            // @ts-ignore
            updated[key] = value;
        } else if (section === "offset") {
            if (coord) {
                // @ts-ignore
                updated.offsets[key] = {
                    // @ts-ignore
                    ...updated.offsets[key],
                    [coord]: value
                };
            } else {
                // @ts-ignore
                updated.offsets[key] = {
                    // @ts-ignore
                    ...updated.offsets[key],
                    y: value // For tableStart which only has y
                };
            }
        }
        
        onSave(updated);
    };

    // Drag events
    const startDrag = (e: React.MouseEvent | React.TouchEvent, key: string) => {
        e.preventDefault();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        dragStartPos.current = { x: clientX, y: clientY };
        
        // Grab current coordinates
        let initialX = 0;
        let initialY = 0;
        
        if (key === "tableStart") {
            initialY = alignment.offsets.tableStart.y;
        } else if (key.startsWith("col")) {
            // @ts-ignore
            initialX = alignment.offsets[key].x;
        } else {
            // @ts-ignore
            initialX = alignment.offsets[key].x;
            // @ts-ignore
            initialY = alignment.offsets[key].y;
        }
        
        dragInitialCoords.current = { x: initialX, y: initialY };
        setDraggingKey(key);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingKey) return;
            
            const dx = e.clientX - dragStartPos.current.x;
            const dy = e.clientY - dragStartPos.current.y;
            
            // Convert pixels to mm
            const dxMm = dx / scaleFactor;
            const dyMm = dy / scaleFactor;
            
            const updated = { ...alignment };
            
            if (draggingKey === "tableStart") {
                const newY = Math.max(0, Math.round(dragInitialCoords.current.y + dyMm));
                updated.offsets.tableStart = { y: newY };
            } else if (draggingKey.startsWith("col")) {
                const newX = Math.max(0, Math.round(dragInitialCoords.current.x + dxMm));
                // @ts-ignore
                updated.offsets[draggingKey] = { x: newX };
            } else {
                const newX = Math.max(0, Math.round(dragInitialCoords.current.x + dxMm));
                const newY = Math.max(0, Math.round(dragInitialCoords.current.y + dyMm));
                // @ts-ignore
                updated.offsets[draggingKey] = { x: newX, y: newY };
            }
            
            onSave(updated);
        };

        const handleMouseUp = () => {
            if (draggingKey) {
                setDraggingKey(null);
                toast.success("Position calibrated!", { id: "drag-toast", duration: 1000 });
            }
        };

        if (draggingKey) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [draggingKey, alignment, onSave]);

    // Template Actions
    const handleTemplateSelect = (name: string) => {
        setSelectedTemplateName(name);
        const match = templates.find(t => t.name === name);
        if (match) {
            onSave(match.settings);
            if (typeof window !== "undefined") {
                localStorage.setItem(ACTIVE_TEMPLATE_KEY, name);
            }
            toast.success(`Switched to template: ${name}`);
        }
    };

    const handleSaveCurrentTemplate = () => {
        const idx = templates.findIndex(t => t.name === selectedTemplateName);
        if (idx !== -1) {
            const updatedTemplates = [...templates];
            updatedTemplates[idx] = { name: selectedTemplateName, settings: alignment };
            setTemplates(updatedTemplates);
            if (typeof window !== "undefined") {
                localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
            }
            toast.success(`Template "${selectedTemplateName}" updated successfully!`);
        } else {
            setShowSaveAsModal(true);
        }
    };

    const handleCreateTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTemplateName.trim()) return;
        
        // Prevent duplicate names
        if (templates.some(t => t.name.toLowerCase() === newTemplateName.trim().toLowerCase())) {
            toast.error("A template with this name already exists.");
            return;
        }

        const newTpl: SavedTemplate = {
            name: newTemplateName.trim(),
            settings: alignment
        };

        const updated = [...templates, newTpl];
        setTemplates(updated);
        setSelectedTemplateName(newTpl.name);
        setShowSaveAsModal(false);
        setNewTemplateName("");
        
        if (typeof window !== "undefined") {
            localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updated));
            localStorage.setItem(ACTIVE_TEMPLATE_KEY, newTpl.name);
        }
        
        toast.success(`Created template "${newTpl.name}"!`);
    };

    const handleDeleteTemplate = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Disallow deleting final standard templates
        if (name === "Standard Layout (Letter)" || name === "Continuous Feed (Narrow)") {
            toast.error("Standard system layouts cannot be deleted.");
            return;
        }

        const filtered = templates.filter(t => t.name !== name);
        setTemplates(filtered);
        
        // Switch fallback
        const nextActive = filtered[0]?.name || "Custom Settings";
        setSelectedTemplateName(nextActive);
        
        if (typeof window !== "undefined") {
            localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(filtered));
            localStorage.setItem(ACTIVE_TEMPLATE_KEY, nextActive);
        }

        if (filtered[0]) {
            onSave(filtered[0].settings);
        }
        
        toast.success(`Deleted template "${name}"`);
    };

    const inputClass = "w-full bg-background border border-input rounded-xl px-2.5 py-1.5 text-xs text-right focus:ring-1 focus:ring-primary outline-none";
    const labelClass = "text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1";

    return (
        <div className="flex flex-col min-h-0 min-w-0 flex-1 space-y-4">
            {/* Top Toolbar: Templates management */}
            <div className="border bg-card rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-2">
                    <Layout className="h-4 w-4 text-primary" />
                    <span className="text-xs font-black uppercase text-foreground">Layout Template:</span>
                    <select
                        value={selectedTemplateName}
                        onChange={(e) => handleTemplateSelect(e.target.value)}
                        className="bg-muted/50 border border-input text-xs rounded-xl px-3 py-1.5 font-bold outline-none cursor-pointer"
                    >
                        {templates.map((t, idx) => (
                            <option key={idx} value={t.name}>{t.name}</option>
                        ))}
                    </select>
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {/* Delete button (only show if not system standard) */}
                    {selectedTemplateName !== "Standard Layout (Letter)" && selectedTemplateName !== "Continuous Feed (Narrow)" && (
                        <button
                            type="button"
                            onClick={(e) => handleDeleteTemplate(selectedTemplateName, e)}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Layout
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowSaveAsModal(true)}
                        className="bg-card hover:bg-muted border px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Save As New
                    </button>

                    <button
                        type="button"
                        onClick={handleSaveCurrentTemplate}
                        className="bg-primary hover:bg-primary/95 text-primary-foreground border-none px-4.5 py-1.5 rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        <Save className="h-3.5 w-3.5" />
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 min-w-0 flex-1">
                {/* Left Controls Column */}
                <div className="lg:col-span-5 space-y-5 overflow-y-auto pr-2 h-full max-h-[66vh]">
                    {/* Global Settings */}
                    <div className="border rounded-xl p-4 bg-card space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <span className="text-xs font-black uppercase text-foreground flex items-center gap-1.5">
                                <Sliders className="h-4 w-4 text-primary" />
                                Global Sheet Layout
                            </span>
                            <button
                                type="button"
                                onClick={onReset}
                                className="text-[10px] text-muted-foreground hover:text-foreground font-bold flex items-center gap-1 border-none bg-transparent cursor-pointer"
                            >
                                <RotateCcw className="h-3 w-3" />
                                Reset to Defaults
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className={labelClass}>Top Margin (mm)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={alignment.topMargin}
                                    onChange={(e) => handleFieldChange("global", "topMargin", null, parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Left Margin (mm)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={alignment.leftMargin}
                                    onChange={(e) => handleFieldChange("global", "leftMargin", null, parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Row Height (mm)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={alignment.lineHeight}
                                    onChange={(e) => handleFieldChange("global", "lineHeight", null, parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Font Size (pt)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={alignment.fontSize}
                                    onChange={(e) => handleFieldChange("global", "fontSize", null, parseFloat(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Header Positions */}
                    <div className="border rounded-xl p-4 bg-card space-y-4">
                        <div className="border-b pb-2">
                            <span className="text-xs font-black uppercase text-foreground">Header Fields Coordinates</span>
                        </div>
                        
                        <div className="space-y-3 divide-y">
                            {/* Invoice Date */}
                            <div className="grid grid-cols-3 gap-2 items-center pt-2.5">
                                <span className="text-[10px] font-bold text-foreground">Invoice Date</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground">X:</span>
                                    <input
                                        type="number"
                                        value={alignment.offsets.invoiceDate.x}
                                        onChange={(e) => handleFieldChange("offset", "invoiceDate", "x", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground">Y:</span>
                                    <input
                                        type="number"
                                        value={alignment.offsets.invoiceDate.y}
                                        onChange={(e) => handleFieldChange("offset", "invoiceDate", "y", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            {/* Invoice No */}
                            <div className="grid grid-cols-3 gap-2 items-center pt-2.5">
                                <span className="text-[10px] font-bold text-foreground">Invoice No</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground">X:</span>
                                    <input
                                        type="number"
                                        value={alignment.offsets.invoiceNo.x}
                                        onChange={(e) => handleFieldChange("offset", "invoiceNo", "x", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground">Y:</span>
                                    <input
                                        type="number"
                                        value={alignment.offsets.invoiceNo.y}
                                        onChange={(e) => handleFieldChange("offset", "invoiceNo", "y", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            {/* Client Name */}
                            <div className="grid grid-cols-3 gap-2 items-center pt-2.5">
                                <span className="text-[10px] font-bold text-foreground">Customer Name</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground">X:</span>
                                    <input
                                        type="number"
                                        value={alignment.offsets.customerName.x}
                                        onChange={(e) => handleFieldChange("offset", "customerName", "x", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground">Y:</span>
                                    <input
                                        type="number"
                                        value={alignment.offsets.customerName.y}
                                        onChange={(e) => handleFieldChange("offset", "customerName", "y", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            {/* Terms */}
                            <div className="grid grid-cols-3 gap-2 items-center pt-2.5">
                                <span className="text-[10px] font-bold text-foreground">Terms</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground">X:</span>
                                    <input
                                        type="number"
                                        value={alignment.offsets.terms.x}
                                        onChange={(e) => handleFieldChange("offset", "terms", "x", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground">Y:</span>
                                    <input
                                        type="number"
                                        value={alignment.offsets.terms.y}
                                        onChange={(e) => handleFieldChange("offset", "terms", "y", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table & Total Positions */}
                    <div className="border rounded-xl p-4 bg-card space-y-4">
                        <div className="border-b pb-2">
                            <span className="text-xs font-black uppercase text-foreground">Table Columns & Totals</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className={labelClass}>Table Start Y (mm)</label>
                                <input
                                    type="number"
                                    value={alignment.offsets.tableStart.y}
                                    onChange={(e) => handleFieldChange("offset", "tableStart", null, parseInt(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Qty Col X (mm)</label>
                                <input
                                    type="number"
                                    value={alignment.offsets.colQty.x}
                                    onChange={(e) => handleFieldChange("offset", "colQty", "x", parseInt(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>UOM Col X (mm)</label>
                                <input
                                    type="number"
                                    value={alignment.offsets.colUnit.x}
                                    onChange={(e) => handleFieldChange("offset", "colUnit", "x", parseInt(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Description Col X (mm)</label>
                                <input
                                    type="number"
                                    value={alignment.offsets.colDescription.x}
                                    onChange={(e) => handleFieldChange("offset", "colDescription", "x", parseInt(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Unit Price Col X (mm)</label>
                                <input
                                    type="number"
                                    value={alignment.offsets.colUnitPrice.x}
                                    onChange={(e) => handleFieldChange("offset", "colUnitPrice", "x", parseInt(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Amount Col X (mm)</label>
                                <input
                                    type="number"
                                    value={alignment.offsets.colAmount.x}
                                    onChange={(e) => handleFieldChange("offset", "colAmount", "x", parseInt(e.target.value) || 0)}
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1 col-span-2 border-t pt-3 flex gap-2">
                                <div className="flex-1">
                                    <label className={labelClass}>Total Net X (mm)</label>
                                    <input
                                        type="number"
                                        value={alignment.offsets.totalAmount.x}
                                        onChange={(e) => handleFieldChange("offset", "totalAmount", "x", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className={labelClass}>Total Net Y (mm)</label>
                                    <input
                                        type="number"
                                        value={alignment.offsets.totalAmount.y}
                                        onChange={(e) => handleFieldChange("offset", "totalAmount", "y", parseInt(e.target.value) || 0)}
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Visual Calibration Sheet */}
                <div className="lg:col-span-7 flex flex-col h-full bg-slate-950/20 border border-muted rounded-2xl p-4 md:p-6 overflow-hidden min-w-0 select-none">
                    <div className="flex items-center justify-between shrink-0 mb-4">
                        <div>
                            <h4 className="text-xs font-black uppercase text-foreground">Drag & Drop Template Preview</h4>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Click & drag fields below to visually reposition them. (Scale: 1px = ~0.6mm)</p>
                        </div>
                        <span className="text-[9px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full font-bold">
                            Interactive Alignment
                        </span>
                    </div>

                    {/* Simulated Paper Sheets */}
                    <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-center items-start shadow-inner overflow-auto">
                        <div 
                            className="relative bg-white text-black shadow-lg border border-neutral-300 rounded shrink-0 overflow-hidden"
                            style={{
                                width: "358px", // ~215mm at scale
                                height: "465px", // ~279mm at scale
                                fontSize: `${alignment.fontSize * 0.6}pt`
                            }}
                        >
                            {/* Printable Area boundary guide */}
                            <div 
                                className="absolute border border-dashed border-primary/20 pointer-events-none"
                                style={{
                                    top: `${alignment.topMargin * 1.67}px`,
                                    left: `${alignment.leftMargin * 1.67}px`,
                                    right: `${alignment.leftMargin * 1.67}px`,
                                    bottom: `${alignment.topMargin * 1.67}px`
                                }}
                            />

                            {/* Draggable: Invoice Date */}
                            <div 
                                onMouseDown={(e) => startDrag(e, "invoiceDate")}
                                className={`absolute border border-dotted px-1 rounded transition-all cursor-move select-none ${
                                    draggingKey === "invoiceDate" 
                                        ? "border-primary bg-primary/10 text-primary scale-105 z-20" 
                                        : "border-rose-500/40 text-rose-600 hover:border-primary/80 hover:bg-primary/5"
                                }`}
                                style={{
                                    left: `${(alignment.leftMargin + alignment.offsets.invoiceDate.x) * 1.67}px`,
                                    top: `${(alignment.topMargin + alignment.offsets.invoiceDate.y) * 1.67}px`,
                                }}
                            >
                                June 18, 2026
                            </div>

                            {/* Draggable: Invoice No */}
                            <div 
                                onMouseDown={(e) => startDrag(e, "invoiceNo")}
                                className={`absolute border border-dotted px-1 rounded transition-all cursor-move select-none ${
                                    draggingKey === "invoiceNo" 
                                        ? "border-primary bg-primary/10 text-primary scale-105 z-20" 
                                        : "border-rose-500/40 text-rose-600 hover:border-primary/80 hover:bg-primary/5"
                                }`}
                                style={{
                                    left: `${(alignment.leftMargin + alignment.offsets.invoiceNo.x) * 1.67}px`,
                                    top: `${(alignment.topMargin + alignment.offsets.invoiceNo.y) * 1.67}px`,
                                }}
                            >
                                INV-10293
                            </div>

                            {/* Draggable: Customer Name */}
                            <div 
                                onMouseDown={(e) => startDrag(e, "customerName")}
                                className={`absolute border border-dotted px-1 rounded transition-all cursor-move select-none ${
                                    draggingKey === "customerName" 
                                        ? "border-primary bg-primary/10 text-primary scale-105 z-20" 
                                        : "border-emerald-500/40 text-emerald-600 hover:border-primary/80 hover:bg-primary/5"
                                }`}
                                style={{
                                    left: `${(alignment.leftMargin + alignment.offsets.customerName.x) * 1.67}px`,
                                    top: `${(alignment.topMargin + alignment.offsets.customerName.y) * 1.67}px`,
                                }}
                            >
                                ACME Corporation
                            </div>

                            {/* Draggable: Terms */}
                            <div 
                                onMouseDown={(e) => startDrag(e, "terms")}
                                className={`absolute border border-dotted px-1 rounded transition-all cursor-move select-none ${
                                    draggingKey === "terms" 
                                        ? "border-primary bg-primary/10 text-primary scale-105 z-20" 
                                        : "border-blue-500/40 text-blue-600 hover:border-primary/80 hover:bg-primary/5"
                                }`}
                                style={{
                                    left: `${(alignment.leftMargin + alignment.offsets.terms.x) * 1.67}px`,
                                    top: `${(alignment.topMargin + alignment.offsets.terms.y) * 1.67}px`,
                                }}
                            >
                                Net 30 Days
                            </div>

                            {/* Draggable table start line */}
                            <div 
                                onMouseDown={(e) => startDrag(e, "tableStart")}
                                className={`absolute left-0 right-0 border-t border-dashed transition-all cursor-row-resize ${
                                    draggingKey === "tableStart"
                                        ? "border-primary text-primary font-bold z-20 bg-primary/5"
                                        : "border-amber-500/40 hover:border-primary/80"
                                }`}
                                style={{
                                    top: `${(alignment.topMargin + alignment.offsets.tableStart.y) * 1.67}px`,
                                    height: "14px"
                                }}
                            >
                                <span className="text-[8px] bg-amber-500 text-white px-1 leading-none rounded pointer-events-none relative -top-3 left-2 font-mono">
                                    Table Start Y ({alignment.offsets.tableStart.y}mm)
                                </span>
                            </div>

                            {/* Simulated Table Data (X draggable columns) */}
                            {[0, 1].map((rowIdx) => {
                                const y = alignment.topMargin + alignment.offsets.tableStart.y + (rowIdx * alignment.lineHeight);
                                return (
                                    <React.Fragment key={rowIdx}>
                                        {/* Col: Qty */}
                                        <div 
                                            onMouseDown={rowIdx === 0 ? (e) => startDrag(e, "colQty") : undefined}
                                            className={`absolute px-1 select-none ${
                                                rowIdx === 0 ? "cursor-col-resize border border-dotted border-transparent hover:border-primary/40 hover:bg-primary/5 rounded" : ""
                                            }`}
                                            style={{
                                                left: `${(alignment.leftMargin + alignment.offsets.colQty.x) * 1.67}px`,
                                                top: `${y * 1.67}px`,
                                            }}
                                        >
                                            <span className={draggingKey === "colQty" && rowIdx === 0 ? "text-primary font-bold" : "text-slate-700 font-mono"}>
                                                {rowIdx === 0 ? "50" : "120"}
                                            </span>
                                        </div>

                                        {/* Col: UOM */}
                                        <div 
                                            onMouseDown={rowIdx === 0 ? (e) => startDrag(e, "colUnit") : undefined}
                                            className={`absolute px-1 select-none ${
                                                rowIdx === 0 ? "cursor-col-resize border border-dotted border-transparent hover:border-primary/40 hover:bg-primary/5 rounded" : ""
                                            }`}
                                            style={{
                                                left: `${(alignment.leftMargin + alignment.offsets.colUnit.x) * 1.67}px`,
                                                top: `${y * 1.67}px`,
                                            }}
                                        >
                                            <span className={draggingKey === "colUnit" && rowIdx === 0 ? "text-primary font-bold" : "text-slate-700 font-mono"}>
                                                PCS
                                            </span>
                                        </div>

                                        {/* Col: Description */}
                                        <div 
                                            onMouseDown={rowIdx === 0 ? (e) => startDrag(e, "colDescription") : undefined}
                                            className={`absolute px-1 select-none truncate max-w-[120px] ${
                                                rowIdx === 0 ? "cursor-col-resize border border-dotted border-transparent hover:border-primary/40 hover:bg-primary/5 rounded" : ""
                                            }`}
                                            style={{
                                                left: `${(alignment.leftMargin + alignment.offsets.colDescription.x) * 1.67}px`,
                                                top: `${y * 1.67}px`,
                                            }}
                                        >
                                            <span className={draggingKey === "colDescription" && rowIdx === 0 ? "text-primary font-bold" : "text-slate-700 font-mono"}>
                                                {rowIdx === 0 ? "Engine Oil 1L" : "Transmission Fluid"}
                                            </span>
                                        </div>

                                        {/* Col: Unit Price */}
                                        <div 
                                            onMouseDown={rowIdx === 0 ? (e) => startDrag(e, "colUnitPrice") : undefined}
                                            className={`absolute px-1 select-none text-right ${
                                                rowIdx === 0 ? "cursor-col-resize border border-dotted border-transparent hover:border-primary/40 hover:bg-primary/5 rounded" : ""
                                            }`}
                                            style={{
                                                left: `${(alignment.leftMargin + alignment.offsets.colUnitPrice.x) * 1.67}px`,
                                                top: `${y * 1.67}px`,
                                            }}
                                        >
                                            <span className={draggingKey === "colUnitPrice" && rowIdx === 0 ? "text-primary font-bold" : "text-slate-700 font-mono"}>
                                                {rowIdx === 0 ? "150.00" : "220.00"}
                                            </span>
                                        </div>

                                        {/* Col: Amount */}
                                        <div 
                                            onMouseDown={rowIdx === 0 ? (e) => startDrag(e, "colAmount") : undefined}
                                            className={`absolute px-1 select-none text-right ${
                                                rowIdx === 0 ? "cursor-col-resize border border-dotted border-transparent hover:border-primary/40 hover:bg-primary/5 rounded" : ""
                                            }`}
                                            style={{
                                                left: `${(alignment.leftMargin + alignment.offsets.colAmount.x) * 1.67}px`,
                                                top: `${y * 1.67}px`,
                                            }}
                                        >
                                            <span className={draggingKey === "colAmount" && rowIdx === 0 ? "text-primary font-bold" : "text-slate-700 font-mono"}>
                                                {rowIdx === 0 ? "7,500.00" : "26,400.00"}
                                            </span>
                                        </div>
                                    </React.Fragment>
                                );
                            })}

                            {/* Draggable: Total Amount */}
                            <div 
                                onMouseDown={(e) => startDrag(e, "totalAmount")}
                                className={`absolute border border-dotted px-1 rounded transition-all cursor-move select-none ${
                                    draggingKey === "totalAmount" 
                                        ? "border-primary bg-primary/10 text-primary scale-105 z-20" 
                                        : "border-violet-500/40 text-violet-600 font-extrabold hover:border-primary/80 hover:bg-primary/5"
                                }`}
                                style={{
                                    left: `${(alignment.leftMargin + alignment.offsets.totalAmount.x) * 1.67}px`,
                                    top: `${(alignment.topMargin + alignment.offsets.totalAmount.y) * 1.67}px`,
                                }}
                            >
                                ₱33,900.00
                            </div>
                        </div>
                    </div>

                    {/* Legend info */}
                    <div className="mt-4 p-3 bg-muted/20 border border-muted rounded-xl flex items-start gap-2.5 text-[10px] text-muted-foreground shrink-0 leading-relaxed">
                        <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                            <strong className="text-foreground block mb-0.5">Interactive Drag & Drop Guide:</strong>
                            1. Reposition **Header Fields** (Invoice Date, Invoice No, Customer, Terms) and **Total amount** by dragging them anywhere on the sheet.
                            2. Drag column items (e.g. Qty `50`, PCS, Product `Engine Oil`, Prices) horizontally to shift column paths left or right.
                            3. Adjust the **Table Start Y** line vertically to clear space for pre-printed headers.
                        </div>
                    </div>
                </div>
            </div>

            {/* Template Save As Modal */}
            {showSaveAsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="border bg-card rounded-2xl w-full max-w-sm shadow-xl p-5 space-y-4">
                        <div>
                            <h3 className="text-xs font-black text-foreground uppercase tracking-wide">Save Layout Template As</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Give your custom print calibration layout a name.</p>
                        </div>
                        
                        <form onSubmit={handleCreateTemplate} className="space-y-4">
                            <input
                                required
                                type="text"
                                placeholder="e.g. Continuous Feed 3-Ply Form"
                                value={newTemplateName}
                                onChange={(e) => setNewTemplateName(e.target.value)}
                                className="w-full bg-muted/40 border border-input rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSaveAsModal(false)}
                                    className="bg-card hover:bg-muted text-muted-foreground border px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="bg-primary hover:bg-primary/95 text-primary-foreground border-none px-4 py-2 rounded-xl text-xs font-black shadow transition-all cursor-pointer"
                                >
                                    Create Template
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
