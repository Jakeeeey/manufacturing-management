/* eslint-disable */
import React, { useState, useEffect } from "react";
import { Loader2, ArrowRight, ArrowLeft, Check, ShieldAlert, CheckCircle, Clock } from "lucide-react";
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
import { Branch } from "../types";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface CreateBufferJODialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    branches: Branch[];
    initialBranchId: number | null;
    onSuccess: () => void;
}

export function CreateBufferJODialog({
    isOpen,
    onOpenChange,
    branches,
    initialBranchId,
    onSuccess
}: CreateBufferJODialogProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Master list data
    const [products, setProducts] = useState<any[]>([]);
    const [versions, setVersions] = useState<any[]>([]);
    const [operators, setOperators] = useState<any[]>([]);

    // Form selection states
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [selectedVersionId, setSelectedVersionId] = useState<string>("");
    const [joNumber, setJoNumber] = useState("");
    const [targetQuantity, setTargetQuantity] = useState<number>(100);
    const [dueDate, setDueDate] = useState("");
    const [shiftOption, setShiftOption] = useState("8.0");
    const [remarks, setRemarks] = useState("");

    // Details loaded from version selection (BOM & Routings)
    const [routings, setRoutings] = useState<any[]>([]);
    const [components, setComponents] = useState<any[]>([]);
    const [inventories, setInventories] = useState<Record<number, any>>({});
    const [bomBaseQty, setBomBaseQty] = useState(1);
    const [subAssemblyBoms, setSubAssemblyBoms] = useState<Record<number, any[]>>({});
    const [printSelection, setPrintSelection] = useState<Record<string, boolean>>({});
    const [assignments, setAssignments] = useState<Record<number, number[]>>({});

    // Operator searching
    const [searchQuery, setSearchQuery] = useState("");

    const selectedBranch = branches.find((b) => String(b.id) === selectedBranchId);
    const selectedProduct = products.find((p) => String(p.product_id) === selectedProductId);

    const productOptions = products.map((prod) => ({
        value: String(prod.product_id),
        label: `${prod.product_name} (${prod.product_code})`
    }));

    // Initial load: active branch defaults & products list
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(1);
            setRoutings([]);
            setComponents([]);
            setInventories({});
            setAssignments({});
            setSearchQuery("");
            setSubAssemblyBoms({});
            setPrintSelection({});
            setSelectedProductId("");
            setSelectedVersionId("");
            setVersions([]);
            setRemarks("");

            // Setup default JO Code
            const code = `JO-BUF-${Math.floor(100000 + Math.random() * 900000)}`;
            setJoNumber(code);

            // Default due date to +7 days
            setDueDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

            // Set branch id
            if (initialBranchId) {
                setSelectedBranchId(String(initialBranchId));
            } else if (branches.length > 0) {
                setSelectedBranchId(String(branches[0].id));
            }

            // Load products
            setLoadingProducts(true);
            fetch("/api/manufacturing/finished-goods/products?excludeRollup=true")
                .then((r) => r.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        const active = data.filter((p: any) => (p.isActive === true || p.isActive === 1 || p.isActive === undefined) && Number(p.product_type) === 388);
                        setProducts(active);
                    }
                })
                .catch((err) => console.error("Error loading products:", err))
                .finally(() => setLoadingProducts(false));

            // Load operators
            fetch("/api/manufacturing/planning-engineering?action=users")
                .then((r) => r.json())
                .then((data) => setOperators(data || []))
                .catch((err) => console.error("Failed to fetch operators:", err));
        }
    }, [isOpen, initialBranchId, branches]);

    // Load versions when product is selected
    useEffect(() => {
        if (selectedProductId) {
            setLoadingVersions(true);
            setVersions([]);
            setSelectedVersionId("");
            fetch(`/api/manufacturing/finished-goods/versions?productId=${selectedProductId}`)
                .then((r) => r.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setVersions(data);
                        // Auto-select first active or fallback to first element
                        const active = data.find((v: any) => v.status === "Active" || v.is_active);
                        if (active) {
                            setSelectedVersionId(String(active.version_id));
                        } else if (data.length > 0) {
                            setSelectedVersionId(String(data[0].version_id));
                        }
                    }
                })
                .catch((err) => console.error("Failed to load versions:", err))
                .finally(() => setLoadingVersions(false));
        } else {
            setVersions([]);
            setSelectedVersionId("");
        }
    }, [selectedProductId]);

    // Load BOM & Routing details on Step 2
    useEffect(() => {
        if (isOpen && selectedProductId && selectedVersionId && currentStep === 2 && routings.length === 0) {
            const loadDetails = async () => {
                setLoadingDetails(true);
                try {
                    const url = `/api/manufacturing/planning-engineering?productId=${selectedProductId}&bomId=${selectedVersionId}`;
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
                    }
                } catch (err) {
                    console.error("Failed to load wizard details:", err);
                } finally {
                    setLoadingDetails(false);
                }
            };
            loadDetails();
        }
    }, [isOpen, selectedProductId, selectedVersionId, currentStep, selectedBranchId, routings.length]);

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
                    <title>MRP Procurement Request - Buffer JO Release Shortfall</title>
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

    const handleNextStep = () => {
        if (currentStep === 1) {
            if (!selectedProductId || !selectedVersionId) {
                toast.error("Please select a product and a recipe version.");
                return;
            }
            if (targetQuantity <= 0) {
                toast.error("Please enter a valid target quantity.");
                return;
            }
            if (!selectedBranchId) {
                toast.error("Please select a target branch.");
                return;
            }
            if (!joNumber.trim()) {
                toast.error("Please enter a Job Order Reference #.");
                return;
            }
        }
        setCurrentStep((prev) => prev + 1);
    };

    const handleConfirmRelease = async () => {
        if (!selectedProductId || !selectedBranchId) return;

        setSubmitting(true);
        try {
            const selectedVersion = versions.find((v) => String(v.version_id) === selectedVersionId);

            const payload = {
                jo: {
                    jo_id: joNumber,
                    product_id: Number(selectedProductId),
                    product_name: selectedProduct?.product_name || `Product #${selectedProductId}`,
                    quantity: Number(targetQuantity),
                    due_date: dueDate,
                    status: "Released", // releases directly with lot deduction
                    is_batched: false,
                    branch_id: Number(selectedBranchId),
                    shiftOption: shiftOption,
                    remarks: remarks || `Manual/Buffer production run`,
                    bom: {
                        version_id: selectedVersionId ? Number(selectedVersionId) : null
                    },
                    assignments: assignments,
                    products: [
                        {
                            product_id: Number(selectedProductId),
                            product_name: selectedProduct?.product_name || `Product #${selectedProductId}`,
                            quantity: Number(targetQuantity),
                            bom: {
                                version_id: selectedVersionId ? Number(selectedVersionId) : null
                            }
                        }
                    ]
                },
                salesOrderIds: [] // Bypasses sales order allocation logic
            };

            const res = await fetch("/api/manufacturing/planning-engineering", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to create Buffer Job Order.");
            }

            toast.success(`Buffer Job Order ${joNumber} released successfully!`);
            onOpenChange(false);
            onSuccess();
        } catch (err: any) {
            console.error("Error creating manual job order:", err);
            toast.error(err.message || "An error occurred during Job Order creation & release.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[620px] bg-background text-foreground border-border">
                <DialogHeader className="border-b border-border pb-3">
                    <DialogTitle className="text-lg font-bold flex items-center justify-between text-foreground">
                        <span>Create Buffer Job Order</span>
                        <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-semibold">
                            Step {currentStep} of 3
                        </span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs">
                        Create a forecasting/buffer production run directly without linked Sales Orders.
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

                <div className="py-2 space-y-4 max-h-[460px] overflow-y-auto px-1">
                    
                    {/* STEP 1: CONFIGURE HEADER PARAMETERS */}
                    {currentStep === 1 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                        Target Branch
                                    </label>
                                    <Select
                                        value={selectedBranchId}
                                        onValueChange={setSelectedBranchId}
                                    >
                                        <SelectTrigger className="h-9 font-semibold bg-card border-input text-foreground">
                                            <SelectValue placeholder="Select branch" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {branches.map((b) => (
                                                <SelectItem key={b.id} value={String(b.id)}>
                                                    {b.branch_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                        Job Order Reference #
                                    </label>
                                    <Input
                                        value={joNumber}
                                        onChange={(e) => setJoNumber(e.target.value)}
                                        className="h-9 font-semibold bg-card border-input text-foreground"
                                        placeholder="JO-BUF-XXXXXX"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                    Product SKU
                                </label>
                                {loadingProducts ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        Loading finished goods...
                                    </div>
                                ) : (
                                    <SearchableSelect
                                        options={productOptions}
                                        value={selectedProductId}
                                        onValueChange={setSelectedProductId}
                                        placeholder="Select Product SKU..."
                                        className="h-9 font-semibold"
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                        Recipe Version
                                    </label>
                                    {loadingVersions ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
                                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                            Loading recipes...
                                        </div>
                                    ) : (
                                        <Select
                                            value={selectedVersionId}
                                            onValueChange={setSelectedVersionId}
                                            disabled={!selectedProductId}
                                        >
                                            <SelectTrigger className="h-9 font-semibold bg-card border-input text-foreground">
                                                <SelectValue placeholder={selectedProductId ? "Select version" : "Select product first"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {versions.map((v) => (
                                                    <SelectItem key={v.version_id} value={String(v.version_id)}>
                                                        {v.version_name} ({v.status})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
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
                                </div>
                            </div>

                            {selectedProductId && versions.length === 0 && !loadingVersions && (
                                <div className="bg-amber-950/20 border border-amber-500/20 text-amber-400 rounded-xl p-3 text-xs flex gap-2 items-center">
                                    <ShieldAlert className="h-5 w-5 shrink-0" />
                                    <span>Warning: This product has no recipe versions configured. You cannot proceed without configuring a recipe version first.</span>
                                </div>
                            )}

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
                                    placeholder="Add planning/buffer notes here..."
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: TIME & MATERIAL SUFFICIENCY */}
                    {currentStep === 2 && (
                        <div className="space-y-4">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                                            <p className="text-xs text-muted-foreground/80 py-3 text-center">No raw material requirements specified.</p>
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
                                                                                <td className="p-2.5 pl-6 text-muted-foreground">
                                                                                    ↳ {cc.component_product_id?.product_name || `Product #${ccId}`}
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

                            {/* Operator Search Input */}
                            <div className="space-y-1">
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search operators by name or role..."
                                    className="h-9 text-xs bg-card border-input text-foreground placeholder:text-muted-foreground rounded-lg focus-visible:ring-primary"
                                />
                            </div>

                            {routings.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-3 text-center">No routing sequence steps defined.</p>
                            ) : (
                                <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
                                    {routings.map((route, index) => {
                                        const seq = Number(route.sequence_order);
                                        const assigned = assignments[seq] || [];
                                        const stepRunTime = targetQuantity * Number(route.run_time_hours || 0);

                                        // Filter operators dynamically based on search query
                                        const filteredOperators = operators.filter((op) => {
                                            const fullName = `${op.user_fname || op.first_name || ""} ${op.user_lname || op.last_name || ""}`.toLowerCase();
                                            const pos = (op.user_position || op.role || "").toLowerCase();
                                            const q = searchQuery.toLowerCase();
                                            return fullName.includes(q) || pos.includes(q);
                                        });

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
                                                        <span>Select Operators for this Workstation</span>
                                                        <span>{assigned.length} selected</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto border border-border/80 bg-background/80 p-2.5 rounded-xl">
                                                        {filteredOperators.length === 0 ? (
                                                            <div className="col-span-2 text-center text-xs text-muted-foreground py-4">
                                                                No operators match your search.
                                                            </div>
                                                        ) : (
                                                            filteredOperators.map((op) => {
                                                                const opId = Number(op.user_id || op.id);
                                                                const isAssigned = assigned.includes(opId);
                                                                const initials = `${op.user_fname?.[0] || ""}${op.user_lname?.[0] || ""}`.toUpperCase();

                                                                return (
                                                                    <div
                                                                        key={opId}
                                                                        onClick={() => handleToggleOperator(seq, opId)}
                                                                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer select-none transition-all duration-300 hover:scale-[1.01] ${
                                                                            isAssigned
                                                                                ? "bg-primary/15 border-primary shadow-lg shadow-primary/5 text-primary"
                                                                                : "bg-muted/60 border-border text-muted-foreground hover:border-border/80 hover:bg-accent"
                                                                        }`}
                                                                    >
                                                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                                                            isAssigned ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                                                        }`}>
                                                                            {initials || "OP"}
                                                                        </div>

                                                                        <div className="min-w-0 flex-1">
                                                                            <div className={`text-xs font-bold truncate ${isAssigned ? "text-foreground" : "text-foreground"}`}>
                                                                                {op.user_fname || op.first_name || ""} {op.user_lname || op.last_name || ""}
                                                                            </div>
                                                                            <div className="text-[9px] text-muted-foreground truncate mt-0.5">
                                                                                {op.user_position || op.role || "Operator"}
                                                                            </div>
                                                                        </div>

                                                                        <div className={`h-4.5 w-4.5 rounded-md border flex items-center justify-center transition-all ${
                                                                            isAssigned ? "bg-primary border-primary text-white" : "border-input bg-background"
                                                                        }`}>
                                                                            {isAssigned && <Check className="h-3 w-3 stroke-[3]" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                </div>

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
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                            className="text-muted-foreground hover:text-foreground h-8 hover:bg-accent"
                        >
                            Cancel
                        </Button>
                        {currentStep < 3 ? (
                            <Button
                                size="sm"
                                onClick={handleNextStep}
                                disabled={loadingDetails || !joNumber || targetQuantity <= 0 || !selectedProductId || !selectedVersionId}
                                className="bg-primary hover:bg-primary/90 text-white h-8 font-semibold shadow-lg shadow-primary/20"
                            >
                                Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleConfirmRelease}
                                disabled={submitting}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white h-8 font-semibold shadow-lg shadow-emerald-500/20"
                            >
                                {submitting ? (
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
