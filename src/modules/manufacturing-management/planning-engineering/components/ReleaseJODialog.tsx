/* eslint-disable */
import React, { useState, useEffect } from "react";
import { Loader2, ArrowRight, ArrowLeft, Check, UserPlus, ShieldAlert, CheckCircle, Clock } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Branch, SalesOrderDetail } from "../types";
import { OperatorSelect } from "./OperatorSelect";

interface ReleaseJODialogProps {
    isConfirmOpen: boolean;
    setIsConfirmOpen: (open: boolean) => void;
    selectedLines: SalesOrderDetail[];
    branches: Branch[];
    selectedBranchId: number | null;
    joNumber: string;
    setJoNumber: (val: string) => void;
    targetQuantity: number;
    setTargetQuantity: (val: number) => void;
    dueDate: string;
    setDueDate: (val: string) => void;
    shiftOption: string;
    setShiftOption: (val: string) => void;
    remarks: string;
    setRemarks: (val: string) => void;
    releasingJO: boolean;
    handleConfirmRelease: () => void;
    assignments: Record<number, number[]>;
    setAssignments: React.Dispatch<React.SetStateAction<Record<number, number[]>>>;
}

export function ReleaseJODialog({
    isConfirmOpen,
    setIsConfirmOpen,
    selectedLines,
    branches,
    selectedBranchId,
    joNumber,
    setJoNumber,
    targetQuantity,
    setTargetQuantity,
    dueDate,
    setDueDate,
    shiftOption,
    setShiftOption,
    remarks,
    setRemarks,
    releasingJO,
    handleConfirmRelease,
    assignments,
    setAssignments
}: ReleaseJODialogProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [hasLoadedDetails, setHasLoadedDetails] = useState(false);
    const [routings, setRoutings] = useState<any[]>([]);
    const [components, setComponents] = useState<any[]>([]);
    const [inventories, setInventories] = useState<Record<number, any>>({});
    const [operators, setOperators] = useState<any[]>([]);
    const [bomBaseQty, setBomBaseQty] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [subAssemblyBoms, setSubAssemblyBoms] = useState<Record<number, any[]>>({});
    const [printSelection, setPrintSelection] = useState<Record<string, boolean>>({});

    const selectedBranch = branches.find((b) => b.id === selectedBranchId);

    // Reset step on open/close
    useEffect(() => {
        if (!isConfirmOpen) {
            setCurrentStep(1);
            setRoutings([]);
            setComponents([]);
            setInventories({});
            setAssignments({});
            setSearchQuery("");
            setSubAssemblyBoms({});
            setPrintSelection({});
            setHasLoadedDetails(false);
        }
    }, [isConfirmOpen, setAssignments]);

    // Fetch master operators list once dialog opens
    useEffect(() => {
        if (isConfirmOpen) {
            fetch("/api/manufacturing/planning-engineering?action=users")
                .then((r) => r.json())
                .then((data) => setOperators(Array.isArray(data) ? data : []))
                .catch((err) => console.error("Failed to fetch operators:", err));
        }
    }, [isConfirmOpen]);

    // Fetch BOM & Routing details on Step 2
    useEffect(() => {
        if (isConfirmOpen && selectedLines.length > 0 && currentStep >= 2 && !hasLoadedDetails) {
            const loadDetails = async () => {
                setLoadingDetails(true);
                try {
                    const first = selectedLines[0];
                    const pId = first.product_id.product_id;
                    const bId = first.bom_version_id;
                    const url = `/api/manufacturing/planning-engineering?productId=${pId}&bomId=${bId || ""}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        setRoutings(data.routings || []);
                        const comps = data.components || [];
                        setComponents(comps);
                        if (data.bom) {
                            setBomBaseQty(Number(data.bom.base_quantity || 1));
                        }

                        // Recursively explode sub-assembly BOMs
                        const subComps = comps.filter((c: any) => c.component_product_id?.product_type === 388 || c.component_product_id?.is_finished_good);
                        const childBoms: Record<number, any[]> = {};
                        const childProductIds: number[] = [];

                        await Promise.all(subComps.map(async (sc: any) => {
                            const scId = sc.component_product_id?.product_id;
                            if (!scId) return;
                            try {
                                const subRes = await fetch(`/api/manufacturing/planning-engineering?productId=${scId}`);
                                if (subRes.ok) {
                                    const details = await subRes.json();
                                    const cList = details.components || [];
                                    childBoms[scId] = cList;
                                    cList.forEach((cc: any) => {
                                        const ccId = cc.component_product_id?.product_id;
                                        if (ccId) childProductIds.push(ccId);
                                    });
                                }
                            } catch (e) {
                                console.error("Failed to load sub-assembly BOM for", scId, e);
                            }
                        }));
                        setSubAssemblyBoms(childBoms);

                        // Merge all product IDs (parent + children) to query stock
                        const allProductIds = [
                            ...comps.map((c: any) => c.component_product_id?.product_id).filter(Boolean),
                            ...childProductIds
                        ];

                        // Fetch inventory stock for all components
                        if (allProductIds.length > 0) {
                            const stockUrl = `/api/manufacturing/planning-engineering?action=net-requirements&productIds=${allProductIds.join(",")}&branchId=${selectedBranchId || 1}`;
                            const stockRes = await fetch(stockUrl);
                            if (stockRes.ok) {
                                const stockData = await stockRes.json();
                                const stockMap: Record<number, any> = {};
                                stockData.forEach((s: any) => {
                                    stockMap[Number(s.product_id)] = s;
                                });
                                setInventories(stockMap);
                            }
                        }
                        setHasLoadedDetails(true);
                    }
                } catch (err) {
                    console.error("Failed to load wizard details:", err);
                } finally {
                    setLoadingDetails(false);
                }
            };
            loadDetails();
        }
    }, [isConfirmOpen, selectedLines, currentStep, selectedBranchId, hasLoadedDetails]);

    // Initialize default print selections for shortfalls
    useEffect(() => {
        const initialSelections: Record<string, boolean> = {};
        components.forEach((comp) => {
            const compProductId = comp.component_product_id?.product_id;
            const needed = (Number(comp.quantity_required) * (1 + (Number(comp.wastage_factor_percentage || 0) / 100))) * (targetQuantity / bomBaseQty);
            const available = compProductId ? (inventories[Number(compProductId)]?.on_hand || 0) : 0;
            const shortfall = Math.max(0, needed - available);

            if (shortfall > 0) {
                const isSubAssembly = comp.component_product_id?.product_type === 388 || comp.component_product_id?.is_finished_good;
                initialSelections[`parent-${compProductId}`] = !isSubAssembly;

                if (isSubAssembly) {
                    const children = subAssemblyBoms[Number(compProductId)] || [];
                    children.forEach((cc) => {
                        const ccId = cc.component_product_id?.product_id;
                        const ccNeeded = Number(cc.quantity_required) * shortfall;
                        const ccAvailable = ccId ? (inventories[Number(ccId)]?.on_hand || 0) : 0;
                        const ccShortfall = Math.max(0, ccNeeded - ccAvailable);
                        if (ccShortfall > 0) {
                            initialSelections[`child-${compProductId}-${ccId}`] = true;
                        }
                    });
                }
            }
        });
        setPrintSelection(initialSelections);
    }, [components, inventories, subAssemblyBoms, targetQuantity, bomBaseQty]);

    // Calculate time metrics
    const totalSetupHours = routings.reduce((sum, r) => sum + Number(r.setup_time_hours || 0), 0);
    const totalRunHours = (targetQuantity * routings.reduce((sum, r) => sum + Number(r.run_time_hours || 0), 0)) / bomBaseQty;
    const totalEstimatedHours = totalSetupHours + totalRunHours;

    const hasShortfalls = components.some((comp) => {
        const compProductId = comp.component_product_id?.product_id;
        const needed = (Number(comp.quantity_required) * (1 + (Number(comp.wastage_factor_percentage || 0) / 100))) * (targetQuantity / bomBaseQty);
        const available = compProductId ? (inventories[Number(compProductId)]?.on_hand || 0) : 0;
        return Math.max(0, needed - available) > 0;
    });

    const handlePrintProcurementRequest = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const dateStr = new Date().toLocaleDateString();
        const branchName = selectedBranch?.branch_name || "Main Branch";

        let tableRowsHtml = "";
        components.forEach((comp) => {
            const compProductId = comp.component_product_id?.product_id;
            const needed = (Number(comp.quantity_required) * (1 + (Number(comp.wastage_factor_percentage || 0) / 100))) * (targetQuantity / bomBaseQty);
            const available = compProductId ? (inventories[Number(compProductId)]?.on_hand || 0) : 0;
            const shortfall = Math.max(0, needed - available);
            const uom = comp.unit_of_measurement || "pcs";
            const isSubAssembly = comp.component_product_id?.product_type === 388 || comp.component_product_id?.is_finished_good;

            if (shortfall > 0 && printSelection[`parent-${compProductId}`]) {
                tableRowsHtml += `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">
                            ${comp.component_product_id?.product_name || `Product #${compProductId}`}
                            <div style="font-size: 10px; color: #666; font-weight: normal; margin-top: 2px;">
                                ${comp.component_product_id?.product_code || ""}
                            </div>
                        </td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${needed.toLocaleString(undefined, {maximumFractionDigits:2})} ${uom}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; color: #666;">${available.toLocaleString(undefined, {maximumFractionDigits:2})} ${uom}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold; color: #d32f2f;">${shortfall.toLocaleString(undefined, {maximumFractionDigits:2})} ${uom}</td>
                    </tr>
                `;
            }

            if (isSubAssembly && shortfall > 0) {
                const children = subAssemblyBoms[Number(compProductId)] || [];
                children.forEach((cc) => {
                    const ccId = cc.component_product_id?.product_id;
                    const ccNeeded = Number(cc.quantity_required) * shortfall;
                    const ccAvailable = ccId ? (inventories[Number(ccId)]?.on_hand || 0) : 0;
                    const ccShortfall = Math.max(0, ccNeeded - ccAvailable);
                    const ccUom = cc.unit_of_measurement || "pcs";

                    if (ccShortfall > 0 && printSelection[`child-${compProductId}-${ccId}`]) {
                        tableRowsHtml += `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; padding-left: 25px; color: #4b5563;">
                                    ↳ ${cc.component_product_id?.product_name || `Product #${ccId}`}
                                    <div style="font-size: 9px; color: #888; font-weight: normal; margin-top: 1px; padding-left: 12px;">
                                        Sub-ingredient for ${comp.component_product_id?.product_name} | Code: ${cc.component_product_id?.product_code || ""}
                                    </div>
                                </td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; color: #4b5563;">${ccNeeded.toLocaleString(undefined, {maximumFractionDigits:2})} ${ccUom}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; color: #888;">${ccAvailable.toLocaleString(undefined, {maximumFractionDigits:2})} ${ccUom}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold; color: #d32f2f;">${ccShortfall.toLocaleString(undefined, {maximumFractionDigits:2})} ${ccUom}</td>
                            </tr>
                        `;
                    }
                });
            }
        });

        const html = `
            <html>
                <head>
                    <title>MRP Procurement Request - JO Release Shortfall</title>
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 40px; line-height: 1.5; }
                        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                        .title { font-size: 24px; font-weight: 800; color: #111; text-transform: uppercase; letter-spacing: 0.5px; }
                        .meta-info { font-size: 12px; line-height: 1.6; text-align: right; }
                        .jo-summary { background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 30px; }
                        .jo-summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; font-size: 13px; }
                        .jo-summary-label { font-weight: bold; color: #555; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }
                        .jo-summary-value { font-weight: 700; color: #111; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 13px; }
                        th { background-color: #111; color: #fff; padding: 10px; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
                        .footer { border-top: 1px solid #ddd; padding-top: 20px; font-size: 11px; color: #777; display: flex; justify-content: space-between; }
                        .sign-line { margin-top: 50px; display: flex; justify-content: space-between; }
                        .sign-box { border-top: 1px dashed #333; width: 200px; text-align: center; padding-top: 5px; font-size: 12px; font-weight: bold; }
                        @media print {
                            body { margin: 20px; }
                            button { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <span style="font-size: 12px; font-weight: bold; color: #fff; background-color: #d32f2f; padding: 5px 10px; border-radius: 4px; text-transform: uppercase;">MRP Shortage Warning</span>
                        <button onclick="window.print()" style="padding: 8px 16px; background-color: #111; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Print Document</button>
                    </div>

                    <div class="header">
                        <div>
                            <div class="title">MRP Procurement Request</div>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">Generated by Quality & Production Planning Console</div>
                        </div>
                        <div class="meta-info">
                            <div><strong>Request Date:</strong> ${dateStr}</div>
                            <div><strong>Target Branch:</strong> ${branchName}</div>
                            <div><strong>Request ID:</strong> PR-${joNumber}-${Math.floor(1000 + Math.random() * 9000)}</div>
                        </div>
                    </div>

                    <div class="jo-summary">
                        <div class="jo-summary-grid">
                            <div>
                                <div class="jo-summary-label">Target Job Order</div>
                                <div class="jo-summary-value">${joNumber}</div>
                            </div>
                            <div>
                                <div class="jo-summary-label">Plan Output Quantity</div>
                                <div class="jo-summary-value">${targetQuantity.toLocaleString()} units</div>
                            </div>
                            <div>
                                <div class="jo-summary-label">Estimated Days</div>
                                <div class="jo-summary-value">${(totalEstimatedHours / (Number(shiftOption) || 8)).toFixed(1)} Days</div>
                            </div>
                        </div>
                    </div>

                    <h3 style="font-size: 15px; text-transform: uppercase; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 15px;">Shortfall Materials Checklist</h3>
                    <table>
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 10px;">Raw Material</th>
                                <th style="width: 20%; padding: 10px;">Total Needed</th>
                                <th style="width: 20%; padding: 10px;">On Hand Stock</th>
                                <th style="width: 20%; padding: 10px;">Shortfall (Required Buy)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>

                    <div class="sign-line">
                        <div class="sign-box">Prepared By (Planner)</div>
                        <div class="sign-box">Approved By (QA Manager)</div>
                        <div class="sign-box">Received By (Purchasing)</div>
                    </div>

                    <div class="footer" style="margin-top: 60px;">
                        <div>ERP Automated Material Requirements Planning (MRP)</div>
                        <div>Page 1 of 1</div>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    // Toggle operator assignment
    const handleToggleOperator = (seq: number, opId: number) => {
        setAssignments((prev) => {
            const current = prev[seq] || [];
            if (current.includes(opId)) {
                return { ...prev, [seq]: current.filter((id) => id !== opId) };
            } else {
                return { ...prev, [seq]: [...current, opId] };
            }
        });
    };

    return (
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <DialogContent className="sm:max-w-[620px] bg-background text-foreground border-border">
                <DialogHeader className="border-b border-border pb-3">
                    <DialogTitle className="text-lg font-bold flex items-center justify-between text-foreground">
                        <span>Release Production Run</span>
                        <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-semibold">
                            Step {currentStep} of 3
                        </span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                        Configure targets, verify component sufficiency, and dispatch tasks to operators.
                    </DialogDescription>
                </DialogHeader>

                {/* Progress Indicators */}
                <div className="flex items-center gap-1.5 px-1 py-1">
                    {[1, 2, 3].map((s) => (
                        <div
                            key={s}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                s <= currentStep ? "bg-primary" : "bg-muted"
                            }`}
                        />
                    ))}
                </div>

                {selectedLines.length > 0 && (
                    <div className="py-2 space-y-4 max-h-[460px] overflow-y-auto px-1">
                        
                        {/* STEP 1: CONFIGURE HEADER PARAMETERS */}
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <div className="bg-muted/50 border border-border/80 rounded-xl p-3 text-xs space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Target Product SKU:</span>
                                        <span className="font-bold text-foreground">{selectedLines[0].product_id.product_name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Recipe Version:</span>
                                        <span className="font-bold text-primary">{selectedLines[0].bom_version_name || "Default"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Target Branch:</span>
                                        <span className="font-semibold text-foreground">{selectedBranch?.branch_name}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                            Job Order Reference #
                                        </label>
                                        <Input
                                            value={joNumber}
                                            onChange={(e) => setJoNumber(e.target.value)}
                                            className="h-9 font-semibold bg-card border-input text-foreground"
                                            placeholder="JO-XXXXXX"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                            Target Production Quantity
                                        </label>
                                        <Input
                                            type="number"
                                            value={targetQuantity}
                                            onChange={(e) => setTargetQuantity(Math.max(1, Number(e.target.value)))}
                                            className="h-9 font-semibold bg-card border-input text-foreground"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Scale quantity up or down according to branch net requirements or batch sizing.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                                Due Date
                                            </label>
                                            <Input
                                                type="date"
                                                value={dueDate}
                                                onChange={(e) => setDueDate(e.target.value)}
                                                className="h-9 font-semibold bg-card border-input text-foreground"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                                Shift Option (Hours)
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                max="24"
                                                value={shiftOption}
                                                onChange={(e) => setShiftOption(e.target.value)}
                                                className="h-9 font-semibold bg-card border-input text-foreground font-mono"
                                                placeholder="e.g. 8.0"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                            Remarks
                                        </label>
                                        <Input
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            className="h-9 text-xs bg-card border-input text-foreground"
                                            placeholder="Add planning notes here..."
                                        />
                                    </div>
                                </div>
                            </div>
                        )}                        {/* STEP 2: TIME & MATERIAL SUFFICIENCY */}
                        {currentStep === 2 && (
                            <div className="space-y-4">
                                {loadingDetails ? (
                                    <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        <p className="text-xs text-muted-foreground font-medium">Analyzing BOM and routes...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Time Summary */}
                                        <div className="bg-card border border-border rounded-xl p-3.5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-primary">
                                                    <Clock className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-semibold text-foreground">Estimated Duration</h4>
                                                    <p className="text-[10px] text-muted-foreground">Computed from routing parameters</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lg font-black text-foreground">
                                                    {totalEstimatedHours.toFixed(1)} hrs
                                                    {Number(shiftOption) > 0 && (
                                                        <span className="text-xs text-muted-foreground font-bold ml-1.5">
                                                            (~{(totalEstimatedHours / Number(shiftOption)).toFixed(1)} Days)
                                                        </span>
                                                    )}
                                                </span>
                                                <div className="text-[9px] text-muted-foreground">
                                                    Setup: {totalSetupHours.toFixed(1)}h | Run: {totalRunHours.toFixed(1)}h
                                                </div>
                                            </div>
                                        </div>

                                        {/* Material Checklist */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                                                    Component Sufficiency Checklist
                                                </h4>
                                                {hasShortfalls && (
                                                    <Button
                                                        type="button"
                                                        onClick={handlePrintProcurementRequest}
                                                        variant="outline"
                                                        size="xs"
                                                        className="h-6 gap-1 bg-amber-500/10 dark:bg-amber-950/20 hover:bg-amber-500/20 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30 font-bold text-[10px]"
                                                    >
                                                        Print Procurement Request
                                                    </Button>
                                                )}
                                            </div>
                                            {components.length === 0 ? (
                                                <p className="text-xs text-muted-foreground py-3 text-center">No raw material requirements specified.</p>
                                            ) : (
                                                <div className="border border-border rounded-xl overflow-hidden">
                                                    <table className="w-full text-[11px] text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-muted text-muted-foreground border-b border-border font-bold uppercase tracking-wider text-[9px]">
                                                                <th className="p-2.5 w-8 text-center">PR</th>
                                                                <th className="p-2.5">Raw Material / Component</th>
                                                                <th className="p-2.5 text-center">Needed</th>
                                                                <th className="p-2.5 text-center">On Hand</th>
                                                                <th className="p-2.5 text-center">Shortfall</th>
                                                                <th className="p-2.5 text-right">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {components.map((comp, index) => {
                                                                const compProductId = comp.component_product_id?.product_id;
                                                                const needed = (Number(comp.quantity_required) * (1 + (Number(comp.wastage_factor_percentage || 0) / 100))) * (targetQuantity / bomBaseQty);
                                                                const available = compProductId ? (inventories[Number(compProductId)]?.on_hand || 0) : 0;
                                                                const shortfall = Math.max(0, needed - available);
                                                                const isSufficient = shortfall === 0;
                                                                const uom = comp.unit_of_measurement || "pcs";
                                                                const isSubAssembly = comp.component_product_id?.product_type === 388 || comp.component_product_id?.is_finished_good;
                                                                const children = subAssemblyBoms[Number(compProductId)] || [];

                                                                return (
                                                                    <React.Fragment key={`${compProductId || "null"}_${index}`}>
                                                                        <tr className="border-b border-border bg-card hover:bg-muted/40">
                                                                            <td className="p-2.5 text-center">
                                                                                {shortfall > 0 && (
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={!!printSelection[`parent-${compProductId}`]}
                                                                                        onChange={(e) => setPrintSelection(prev => ({
                                                                                            ...prev,
                                                                                            [`parent-${compProductId}`]: e.target.checked
                                                                                        }))}
                                                                                        className="h-3.5 w-3.5 rounded border-input bg-card text-primary focus:ring-primary cursor-pointer"
                                                                                    />
                                                                                )}
                                                                            </td>
                                                                            <td className="p-2.5">
                                                                                <div className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                                                                                    {comp.component_product_id?.category_name || "Uncategorized"}
                                                                                    {isSubAssembly && (
                                                                                        <span className="text-[7px] bg-sky-500/10 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-500/20 px-1 rounded-sm uppercase font-black">
                                                                                            Sub-Assembly
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="font-bold text-foreground">{comp.component_product_id?.product_name || `Product #${compProductId}`}</div>
                                                                                <div className="text-[9px] text-muted-foreground/80">{comp.component_product_id?.product_code || ""}</div>
                                                                                {inventories[Number(compProductId)]?.recommended_lots?.length > 0 && (
                                                                                    <div className="mt-1 space-y-0.5">
                                                                                        <div className="text-[7.5px] text-primary/80 font-bold uppercase tracking-wider">Recommended Lots:</div>
                                                                                        <div className="flex flex-wrap gap-1">
                                                                                            {inventories[Number(compProductId)].recommended_lots.slice(0, 3).map((lot: any, lIdx: number) => (
                                                                                                <span key={lIdx} className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded font-mono font-medium">
                                                                                                    {lot.lot_no} ({Number(lot.available).toFixed(0)})
                                                                                                </span>
                                                                                            ))}
                                                                                            {inventories[Number(compProductId)].recommended_lots.length > 3 && (
                                                                                                <span className="text-[8px] text-muted-foreground self-center">
                                                                                                    +{inventories[Number(compProductId)].recommended_lots.length - 3} more
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            <td className="p-2.5 text-center font-semibold text-foreground">
                                                                                {needed.toLocaleString(undefined, {maximumFractionDigits:2})} <span className="text-[9px] text-muted-foreground font-normal">{uom}</span>
                                                                            </td>
                                                                            <td className="p-2.5 text-center text-muted-foreground">
                                                                                {available.toLocaleString(undefined, {maximumFractionDigits:2})} <span className="text-[9px] text-muted-foreground font-normal">{uom}</span>
                                                                            </td>
                                                                            <td className={`p-2.5 text-center font-bold ${shortfall > 0 ? (isSubAssembly ? "text-sky-600 dark:text-sky-400" : "text-red-600 dark:text-red-400") : "text-muted-foreground/60"}`}>
                                                                                {shortfall > 0 ? (
                                                                                    <>
                                                                                        {shortfall.toLocaleString(undefined, {maximumFractionDigits:2})} <span className={`text-[9px] font-normal ${isSubAssembly ? "text-sky-600/60 dark:text-sky-400/60" : "text-red-600/60 dark:text-red-400/60"}`}>{uom}</span>
                                                                                    </>
                                                                                ) : "-"}
                                                                            </td>
                                                                            <td className="p-2.5 text-right">
                                                                                {isSubAssembly && shortfall > 0 ? (
                                                                                    <span className="inline-flex items-center gap-1 text-[8px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 uppercase tracking-wide">
                                                                                        Spawns Child JO
                                                                                    </span>
                                                                                ) : isSufficient ? (
                                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                                                        <CheckCircle className="h-2.5 w-2.5" /> Available
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                                                                        <ShieldAlert className="h-2.5 w-2.5" /> Purchase Req
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>

                                                                        {/* Indented child raw materials for Sub-Assemblies */}
                                                                        {isSubAssembly && shortfall > 0 && children.map((cc: any, subIndex: number) => {
                                                                            const ccId = cc.component_product_id?.product_id;
                                                                            const ccNeeded = Number(cc.quantity_required) * shortfall;
                                                                            const ccAvailable = ccId ? (inventories[Number(ccId)]?.on_hand || 0) : 0;
                                                                            const ccShortfall = Math.max(0, ccNeeded - ccAvailable);
                                                                            const ccUom = cc.unit_of_measurement || "pcs";
                                                                            const ccSufficient = ccShortfall === 0;

                                                                            return (
                                                                                <tr key={`child_${compProductId}_${ccId}_${subIndex}`} className="border-b border-border/50 bg-background/40 hover:bg-muted/20 text-[10px]">
                                                                                    <td className="p-2.5 text-center">
                                                                                        {ccShortfall > 0 && (
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={!!printSelection[`child-${compProductId}-${ccId}`]}
                                                                                                onChange={(e) => setPrintSelection(prev => ({
                                                                                                    ...prev,
                                                                                                    [`child-${compProductId}-${ccId}`]: e.target.checked
                                                                                                }))}
                                                                                                className="h-3 w-3 rounded border-input bg-card text-primary focus:ring-primary cursor-pointer"
                                                                                            />
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="p-2.5 pl-6">
                                                                                        <span className="text-muted-foreground/60 font-bold mr-1.5">↳</span>
                                                                                        <span className="font-semibold text-foreground">{cc.component_product_id?.product_name || `Product #${ccId}`}</span>
                                                                                        <span className="text-[8px] text-muted-foreground/80 ml-1.5 font-mono">({cc.component_product_id?.product_code || ""})</span>
                                                                                        {inventories[Number(ccId)]?.recommended_lots?.length > 0 && (
                                                                                            <div className="mt-1 pl-3 flex flex-wrap gap-1">
                                                                                                {inventories[Number(ccId)].recommended_lots.slice(0, 2).map((lot: any, lIdx: number) => (
                                                                                                    <span key={lIdx} className="text-[7.5px] bg-primary/10 text-primary/90 border border-primary/15 px-1 py-0 rounded font-mono">
                                                                                                        {lot.lot_no} ({Number(lot.available).toFixed(0)})
                                                                                                    </span>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="p-2.5 text-center text-muted-foreground">
                                                                                        {ccNeeded.toLocaleString(undefined, {maximumFractionDigits:2})} <span className="text-[8px] text-muted-foreground/60">{ccUom}</span>
                                                                                    </td>
                                                                                    <td className="p-2.5 text-center text-muted-foreground">
                                                                                        {ccAvailable.toLocaleString(undefined, {maximumFractionDigits:2})} <span className="text-[8px] text-muted-foreground/60">{ccUom}</span>
                                                                                    </td>
                                                                                    <td className={`p-2.5 text-center font-bold ${ccShortfall > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/60"}`}>
                                                                                        {ccShortfall > 0 ? ccShortfall.toLocaleString(undefined, {maximumFractionDigits:2}) : "-"}
                                                                                    </td>
                                                                                    <td className="p-2.5 text-right pr-4">
                                                                                        {ccSufficient ? (
                                                                                            <Badge variant="outline" className="h-5 text-[8px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border-emerald-500/20 py-0 px-1.5 font-bold">Stock OK</Badge>
                                                                                        ) : (
                                                                                            <Badge variant="outline" className="h-5 text-[8px] text-amber-600 dark:text-amber-400 bg-amber-500/5 border-amber-500/20 py-0 px-1.5 font-bold">MRP Shortfall</Badge>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* STEP 3: LABOR & OPERATOR ASSIGNMENT */}
                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider text-[10px]">
                                        Workstation Dispatching & Operator Assignment
                                    </h4>
                                    <div className="text-[10px] text-muted-foreground font-semibold bg-muted border border-border px-2 py-0.5 rounded-md">
                                        {Object.values(assignments).flat().length} Total Assignments
                                    </div>
                                </div>

                                {routings.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-3 text-center">No routing sequence steps defined.</p>
                                ) : (
                                    <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                                        {routings.map((route, index) => {
                                            const seq = Number(route.sequence_order);
                                            const assigned = assignments[seq] || [];
                                            const stepRunTime = targetQuantity * Number(route.run_time_hours || 0);

                                            return (
                                                <div key={`${route.routing_id || "route"}_${index}`} className="border border-border bg-card/20 rounded-xl p-4 space-y-3.5 hover:border-border/60 transition-all duration-300">
                                                    <div className="flex justify-between items-start border-b border-border/60 pb-2">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-md">
                                                                    Step {seq}0
                                                                </span>
                                                                <h5 className="text-xs font-bold text-foreground">{route.operation_name || "Production Operation"}</h5>
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Work Center: <span className="font-semibold text-foreground">{route.work_center_name || "Factory Work Center"}</span>
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full font-bold">
                                                                {stepRunTime.toFixed(1)} hrs needed
                                                            </span>
                                                            <div className="text-[9px] text-muted-foreground mt-1">
                                                                {assigned.length} Operator{assigned.length !== 1 ? "s" : ""} Assigned
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                                            <span>Assign Operators for this Workstation</span>
                                                        </div>
                                                        <OperatorSelect
                                                            operators={operators}
                                                            assignedIds={assigned}
                                                            onToggleOperator={(opId) => handleToggleOperator(seq, opId)}
                                                            placeholder="Select operators..."
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                )}

                <DialogFooter className="border-t border-border pt-3 gap-2 flex items-center justify-between sm:justify-between w-full">
                    <div>
                        {currentStep > 1 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentStep((prev) => prev - 1)}
                                className="border-input hover:bg-accent text-foreground h-8"
                            >
                                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsConfirmOpen(false)}
                            disabled={releasingJO}
                            className="text-muted-foreground hover:text-foreground h-8 hover:bg-accent"
                        >
                            Cancel
                        </Button>
                        {currentStep < 3 ? (
                            <Button
                                size="sm"
                                onClick={() => setCurrentStep((prev) => prev + 1)}
                                disabled={loadingDetails || !joNumber || targetQuantity <= 0}
                                className="bg-primary hover:bg-primary/90 text-white h-8 font-semibold shadow-lg shadow-primary/20"
                            >
                                Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleConfirmRelease}
                                disabled={releasingJO}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 font-semibold shadow-lg shadow-emerald-500/20"
                            >
                                {releasingJO ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Releasing...
                                    </>
                                ) : (
                                    "Confirm & Release"
                                )}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
