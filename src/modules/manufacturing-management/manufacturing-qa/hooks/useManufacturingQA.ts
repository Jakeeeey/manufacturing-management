/* eslint-disable */
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { QALog, DispositionRecord, JobOrder, Branch } from "../types";
import {
    fetchQALogs,
    fetchDispositions,
    fetchJobOrders,
    fetchBranchesList,
    fetchJobOrderMaterials,
    postFinishedGoodsReceipt,
    postSupervisorOverride,
    fetchDailyQAInspections,
    fetchFinalQAReleases,
    fetchYieldLedger,
    fetchInventoryLotsData,
    postDailyQAInspection,
    postFinalQARelease
} from "../services/qa-api";

export interface PrintReceiptData {
    jo_no: string;
    product_code: string;
    product_name: string;
    recipe_version: string;
    yield_qty: number;
    lot_number: string;
    expiry_date: string;
    branch_name: string;
    unit_cost: number;
}

export const printYieldClosingReceipt = (data: PrintReceiptData) => {
    if (typeof window === "undefined") return;
    const printWindow = window.open("", "_blank", "width=600,height=750");
    if (!printWindow) {
        toast.error("Popup blocker prevented auto-printing the receipt. Please enable popups.");
        return;
    }

    const totalCost = data.yield_qty * data.unit_cost;

    printWindow.document.write(`
        <html>
        <head>
            <title>FG Receipt - ${data.jo_no}</title>
            <style>
                body {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12px;
                    color: #000;
                    margin: 0;
                    padding: 20px;
                    line-height: 1.4;
                }
                .receipt {
                    border: 1px dashed #000;
                    padding: 15px;
                    max-width: 450px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px double #000;
                    padding-bottom: 10px;
                    margin-bottom: 15px;
                }
                .header h1 {
                    font-size: 16px;
                    margin: 0 0 5px 0;
                    text-transform: uppercase;
                }
                .header p {
                    margin: 0;
                    font-size: 10px;
                }
                .row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 6px;
                }
                .row.total {
                    border-top: 1px dashed #000;
                    border-bottom: 1px dashed #000;
                    padding: 8px 0;
                    font-weight: bold;
                    font-size: 14px;
                    margin-top: 15px;
                }
                .label {
                    font-weight: bold;
                }
                .value {
                    text-align: right;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 10px;
                }
                .sig-box {
                    margin-top: 25px;
                    display: flex;
                    justify-content: space-between;
                }
                .sig {
                    border-top: 1px solid #000;
                    width: 45%;
                    text-align: center;
                    padding-top: 5px;
                    font-size: 9px;
                    margin-top: 20px;
                }
                @media print {
                    body { padding: 0; }
                    .receipt { border: none; }
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h1>Finished Goods Receipt</h1>
                    <p>WMS LEDGER & RUN CLOSURE SLIP</p>
                    <p>Printed: ${new Date().toLocaleString()}</p>
                </div>

                <div class="row">
                    <span class="label">Job Order No:</span>
                    <span class="value">${data.jo_no}</span>
                </div>
                <div class="row">
                    <span class="label">Target Branch:</span>
                    <span class="value">${data.branch_name}</span>
                </div>
                <div class="row">
                    <span class="label">Product Code:</span>
                    <span class="value">${data.product_code}</span>
                </div>
                <div class="row" style="margin-bottom: 10px;">
                    <span class="label">Product Name:</span>
                    <span class="value" style="display: block; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.product_name}</span>
                </div>
                <div class="row">
                    <span class="label">Recipe Version:</span>
                    <span class="value">${data.recipe_version}</span>
                </div>
                
                <hr style="border: none; border-top: 1px dashed #000; margin: 12px 0;" />

                <div class="row">
                    <span class="label">Lot/Batch Number:</span>
                    <span class="value">${data.lot_number}</span>
                </div>
                <div class="row">
                    <span class="label">Expiration Date:</span>
                    <span class="value">${data.expiry_date}</span>
                </div>
                <div class="row">
                    <span class="label">Yield Produced:</span>
                    <span class="value" style="font-size: 13px; font-weight: bold;">${data.yield_qty.toLocaleString()} units</span>
                </div>
                <div class="row">
                    <span class="label">Landed Unit Cost:</span>
                    <span class="value">PHP ${data.unit_cost.toFixed(2)}</span>
                </div>

                <div class="row total">
                    <span class="label">TOTAL LOGGED COST:</span>
                    <span class="value">PHP ${totalCost.toFixed(2)}</span>
                </div>

                <div class="sig-box">
                    <div class="sig">QA Inspector Signature</div>
                    <div class="sig">Supervisor Authorization</div>
                </div>

                <div class="footer">
                    <p>*** End of Receipt ***</p>
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() { window.close(); };
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

export function useManufacturingQA() {
    // Tab State
    const [activeTab, setActiveTab] = useState("holds");

    // Data lists
    const [qaLogs, setQaLogs] = useState<QALog[]>([]);
    const [dispositions, setDispositions] = useState<DispositionRecord[]>([]);
    const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Loading states
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [loadingDispositions, setLoadingDispositions] = useState(false);
    const [loadingJobOrders, setLoadingJobOrders] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Search and filters
    const [logSearch, setLogSearch] = useState("");
    const [logStatusFilter, setLogStatusFilter] = useState("all");
    const [joSearch, setJoSearch] = useState("");

    // Yield Closing Dialog states
    const [selectedJO, setSelectedJO] = useState<JobOrder | null>(null);
    const [isYieldDialogOpen, setIsYieldDialogOpen] = useState(false);
    const [yieldQty, setYieldQty] = useState("");
    const [lotNumber, setLotNumber] = useState("");
    const [expiryDate, setExpiryDate] = useState("");
    const [unitCost, setUnitCost] = useState("");

    // Supervisor Override Dialog states
    const [selectedDisp, setSelectedDisp] = useState<DispositionRecord | null>(null);
    const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
    const [overrideDecision, setOverrideDecision] = useState<"Release with Deviation" | "Rework" | "Scrap">("Release with Deviation");
    const [overrideComments, setOverrideComments] = useState("");

    // Load QA Logs
    const loadQALogs = async () => {
        setLoadingLogs(true);
        try {
            const data = await fetchQALogs();
            setQaLogs(data);
        } catch (e) {
            console.error("QA Logs fetch error:", e);
            toast.error("Failed to retrieve quality checkpoint logs.");
        } finally {
            setLoadingLogs(false);
        }
    };

    // Load Dispositions
    const loadDispositions = async () => {
        setLoadingDispositions(true);
        try {
            const data = await fetchDispositions();
            setDispositions(data);
        } catch (e) {
            console.error("Dispositions fetch error:", e);
            toast.error("Failed to retrieve quarantine/holds list.");
        } finally {
            setLoadingDispositions(false);
        }
    };

    // Load Active Job Orders
    const loadJobOrders = async () => {
        setLoadingJobOrders(true);
        try {
            const data = await fetchJobOrders();
            setJobOrders(data);
        } catch (e) {
            console.error("Job Orders fetch error:", e);
            toast.error("Failed to retrieve active job orders.");
        } finally {
            setLoadingJobOrders(false);
        }
    };

    // Load Branches
    const loadBranches = async () => {
        try {
            const list = await fetchBranchesList();
            setBranches(list);
        } catch (e) {
            console.error("Branches load error:", e);
        }
    };

    // Daily Yield QA & Final release QA states
    const [yieldLedger, setYieldLedger] = useState<any[]>([]);
    const [dailyInspections, setDailyInspections] = useState<any[]>([]);
    const [qaTemplates, setQaTemplates] = useState<any[]>([]);
    const [qaParamValues, setQaParamValues] = useState<Record<number, string>>({});
    const [finalReleases, setFinalReleases] = useState<any[]>([]);
    const [lots, setLots] = useState<any[]>([]);
    const [lotsProducts, setLotsProducts] = useState<any[]>([]);
    const [loadingDailyQA, setLoadingDailyQA] = useState(false);
    const [loadingFinalQA, setLoadingFinalQA] = useState(false);

    // Recording Daily QA Dialog states
    const [isDailyAuditOpen, setIsDailyAuditOpen] = useState(false);
    const [selectedLedgerEntry, setSelectedLedgerEntry] = useState<any | null>(null);
    const [moisturePct, setMoisturePct] = useState("");
    const [acidityPh, setAcidityPh] = useState("");
    const [sensoryStatus, setSensoryStatus] = useState<"Passed" | "Failed">("Passed");
    const [weightCheckPassed, setWeightCheckPassed] = useState(true);
    const [dailyLabStatus, setDailyLabStatus] = useState<"Pending" | "Passed" | "Failed">("Passed");
    const [dailyActionTaken, setDailyActionTaken] = useState<"Released" | "Quarantined" | "Scrapped">("Released");
    const [dailyRemarks, setDailyRemarks] = useState("");
    const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
    const [routes, setRoutes] = useState<any[]>([]);

    // Recording Final QA release Dialog states
    const [isFinalReleaseOpen, setIsFinalReleaseOpen] = useState(false);
    const [selectedLot, setSelectedLot] = useState<any | null>(null);
    const [inspectedQty, setInspectedQty] = useState("");
    const [defectQty, setDefectQty] = useState("");
    const [microbiologicalStatus, setMicrobiologicalStatus] = useState<"Pending" | "Passed" | "Failed">("Passed");
    const [packagingSealPassed, setPackagingSealPassed] = useState(true);
    const [labelCompliancePassed, setLabelCompliancePassed] = useState(true);
    const [overallDisposition, setOverallDisposition] = useState<"Approved" | "Quarantined" | "Rejected">("Approved");
    const [coaRefNo, setCoaRefNo] = useState("");
    const [finalRemarks, setFinalRemarks] = useState("");

    // Imports from services are now at the top of the file

    const loadDailyQAData = async () => {
        setLoadingDailyQA(true);
        try {
            const ledger = await fetchYieldLedger();
            const inspections = await fetchDailyQAInspections();
            setYieldLedger(ledger);
            setDailyInspections(inspections);

            // Load QA templates list
            const res = await fetch("/api/manufacturing/qa?action=templates");
            if (res.ok) {
                const data = await res.json();
                setQaTemplates(data);
            }
        } catch (e) {
            console.error("Error loading daily QA data:", e);
        } finally {
            setLoadingDailyQA(false);
        }
    };

    const loadFinalQAData = async () => {
        setLoadingFinalQA(true);
        try {
            const releases = await fetchFinalQAReleases();
            const lotsData = await fetchInventoryLotsData();
            setFinalReleases(releases);
            setLots(lotsData.lots);
            setLotsProducts(lotsData.products);
        } catch (e) {
            console.error("Error loading final QA data:", e);
        } finally {
            setLoadingFinalQA(false);
        }
    };

    // Refresh all data
    const refreshAll = () => {
        loadQALogs();
        loadDispositions();
        loadJobOrders();
        loadDailyQAData();
        loadFinalQAData();
    };

    // Mount lifecycle
    useEffect(() => {
        refreshAll();
        loadBranches();
    }, []);

    // Resolve Branch Name from ID
    const getBranchName = (branchId?: number | null) => {
        if (!branchId) return "Main Branch";
        const found = branches.find(b => Number(b.branch_id || b.id) === Number(branchId));
        if (found) return found.branch_name || found.name || `Branch #${branchId}`;
        
        switch (Number(branchId)) {
            case 1:
            case 183: return "Main Branch";
            case 163: return "Urdaneta Branch";
            case 181: return "Bihon Branch";
            case 182: return "Bihon Bad Branch";
            default: return `Branch #${branchId}`;
        }
    };

    // Filtered QA Logs
    const filteredQALogs = useMemo(() => {
        return qaLogs.filter(log => {
            const joNo = typeof log.task_id === "object" ? log.task_id?.jo_id || "" : "";
            const stepName = typeof log.task_id === "object" ? log.task_id?.operation_name || log.task_id?.name || "" : "";
            const matchesSearch = joNo.toLowerCase().includes(logSearch.toLowerCase()) || 
                                  stepName.toLowerCase().includes(logSearch.toLowerCase()) ||
                                  (log.comments || "").toLowerCase().includes(logSearch.toLowerCase());
            
            const matchesStatus = logStatusFilter === "all" ? true : log.qa_status.toLowerCase() === logStatusFilter.toLowerCase();
            
            return matchesSearch && matchesStatus;
        });
    }, [qaLogs, logSearch, logStatusFilter]);

    // Active Pending Holds (Quarantined Job Orders)
    const pendingHolds = useMemo(() => {
        return dispositions.filter(d => d.disposition_status === "Pending");
    }, [dispositions]);

    // Filtered Active Job Orders (Awaiting yield closing)
    const activeJobOrders = useMemo(() => {
        return jobOrders.filter(jo => {
            const status = jo.status?.toLowerCase();
            const isCompleted = status === "finished" || status === "completed" || status === "cancelled" || status === "closed";
            const matchesSearch = jo.jo_id.toLowerCase().includes(joSearch.toLowerCase()) || 
                                  jo.product_name.toLowerCase().includes(joSearch.toLowerCase());
            return !isCompleted && matchesSearch;
        });
    }, [jobOrders, joSearch]);

    // Filtered Closed Job Orders (Completed/Closed runs)
    const closedJobOrders = useMemo(() => {
        return jobOrders.filter(jo => {
            const status = jo.status?.toLowerCase();
            const isCompleted = status === "finished" || status === "completed" || status === "closed";
            const matchesSearch = jo.jo_id.toLowerCase().includes(joSearch.toLowerCase()) || 
                                  jo.product_name.toLowerCase().includes(joSearch.toLowerCase());
            return isCompleted && matchesSearch;
        });
    }, [jobOrders, joSearch]);

    // Handle Open Yield Dialog
    const handleOpenYieldDialog = (jo: JobOrder) => {
        setSelectedJO(jo);
        setYieldQty(String(jo.quantity));
        setLotNumber(`MFG-${jo.jo_id}`);
        
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        setExpiryDate(nextYear.toISOString().split("T")[0]);
        
        setUnitCost("0");
        setIsYieldDialogOpen(true);
    };

    const handleReprintReceipt = (jo: JobOrder) => {
        if (!jo) return;
        const log = jo.yield_logs && jo.yield_logs.length > 0 ? jo.yield_logs[0] : null;
        
        const branchName = getBranchName(jo.branch_id);
        const verName = jo.recipe_version_name || 
                        jo.recipeVersionName || 
                        jo.version_name || 
                        jo.versionName || 
                        ((jo.version_id || jo.versionId || jo.bom?.version_id) 
                            ? `Version #${jo.version_id || jo.versionId || jo.bom?.version_id}` 
                            : 'Active');

        printYieldClosingReceipt({
            jo_no: jo.jo_id,
            product_code: jo.product_code || `PROD-${jo.product_id}`,
            product_name: jo.product_name,
            recipe_version: verName,
            yield_qty: log ? Number(log.yield_quantity || jo.producedQty || jo.produced_quantity || 0) : Number(jo.producedQty || jo.produced_quantity || jo.quantity || 0),
            lot_number: log ? (log.lot_number || log.lot_no || `MFG-${jo.jo_id}`) : `MFG-${jo.jo_id}`,
            expiry_date: log ? (log.expiry_date || "N/A") : "N/A",
            branch_name: branchName,
            unit_cost: log ? Number(log.unit_cost || 0) : 0
        });
    };

    // Submit Finished Goods Yield closing
    const handleSubmitYieldClosing = async () => {
        if (!selectedJO) return;
        if (!yieldQty || isNaN(Number(yieldQty)) || Number(yieldQty) <= 0) {
            toast.error("Please enter a valid yield quantity.");
            return;
        }

        setActionLoading(true);
        try {
            let componentsConsumed: Array<{
                component_product_id: number;
                required: number;
                quantity: number;
                component_name: string;
            }> = [];
            try {
                const materials = await fetchJobOrderMaterials(selectedJO.jo_id);
                componentsConsumed = materials.map((m: any) => ({
                    component_product_id: m.product_id,
                    required: m.quantity_required,
                    quantity: m.quantity_required,
                    component_name: m.product_name
                }));
            } catch (err) {
                console.warn("Failed to load materials for yield closing consumption:", err);
            }

            await postFinishedGoodsReceipt({
                joId: selectedJO.jo_id,
                productId: selectedJO.product_id,
                productName: selectedJO.product_name,
                quantityProduced: Number(yieldQty),
                branchId: selectedJO.branch_id || 1,
                lotNumber: lotNumber || `MFG-${selectedJO.jo_id}`,
                expirationDate: expiryDate || null,
                unitCost: Number(unitCost || 0),
                componentsConsumed: componentsConsumed,
                completeJobOrder: true
            });

            toast.success(`Job Order ${selectedJO.jo_id} successfully completed and WMS ledger receipted!`);
            setIsYieldDialogOpen(false);
            
            // Trigger auto print
            try {
                const branchName = getBranchName(selectedJO.branch_id);
                const verName = selectedJO.recipe_version_name || 
                                selectedJO.recipeVersionName || 
                                selectedJO.version_name || 
                                selectedJO.versionName || 
                                ((selectedJO.version_id || selectedJO.versionId || selectedJO.bom?.version_id) 
                                    ? `Version #${selectedJO.version_id || selectedJO.versionId || selectedJO.bom?.version_id}` 
                                    : 'Active');

                printYieldClosingReceipt({
                    jo_no: selectedJO.jo_id,
                    product_code: selectedJO.product_code || `PROD-${selectedJO.product_id}`,
                    product_name: selectedJO.product_name,
                    recipe_version: verName,
                    yield_qty: Number(yieldQty),
                    lot_number: lotNumber || `MFG-${selectedJO.jo_id}`,
                    expiry_date: expiryDate || "N/A",
                    branch_name: branchName,
                    unit_cost: Number(unitCost || 0)
                });
            } catch (printErr) {
                console.error("Auto print failed:", printErr);
            }

            refreshAll();
        } catch (e: any) {
            console.error("Yield closing error:", e);
            toast.error(e.message || "An error occurred during finished goods yield closing.");
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Open Supervisor Override Dialog
    const handleOpenOverrideDialog = (disp: DispositionRecord) => {
        setSelectedDisp(disp);
        setOverrideDecision("Release with Deviation");
        setOverrideComments("");
        setIsOverrideDialogOpen(true);
    };

    // Submit Supervisor Override resolution
    const handleSubmitOverride = async () => {
        if (!selectedDisp) return;
        if (!overrideComments.trim()) {
            toast.error("Please enter supervisor reasoning comments.");
            return;
        }

        setActionLoading(true);
        try {
            await postSupervisorOverride({
                action: "disposition",
                dispositionId: selectedDisp.id,
                decision: overrideDecision,
                supervisorComments: overrideComments.trim(),
                userId: 1
            });

            toast.success(`Hold resolved successfully: Quarantined Job Order updated to "${overrideDecision}"`);
            setIsOverrideDialogOpen(false);
            refreshAll();
        } catch (e: any) {
            console.error("Override submission error:", e);
            toast.error(e.message || "Failed to resolve quarantine hold.");
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Open Daily QA Dialog
    const handleOpenDailyAuditDialog = (ledgerEntry: any) => {
        setSelectedLedgerEntry(ledgerEntry);
        setMoisturePct("");
        setAcidityPh("");
        setSensoryStatus("Passed");
        setWeightCheckPassed(true);
        setDailyLabStatus("Passed");
        setDailyActionTaken("Released");
        setDailyRemarks("");
        setQaParamValues({}); // Reset dynamic parameter inputs

        const jo = jobOrders.find(
            (j) => 
                Number(j.order_id || j.job_order_id || j.id) === Number(ledgerEntry.job_order_id) ||
                j.jo_id === String(ledgerEntry.job_order_id)
        );
        const tasks = jo ? (jo.routing_tasks || jo.routingTasks || []) : [];
        setRoutes(tasks);

        // Find the first task that has NOT been audited yet for this ledger entry
        const audits = dailyInspections.filter((ins: any) => Number(ins.ledger_id) === Number(ledgerEntry.ledger_id || ledgerEntry.id));
        const pendingTask = tasks.find((t: any) => !audits.some((a: any) => Number(a.jo_route_id) === Number(t.id)));
        
        setSelectedRouteId(pendingTask ? (pendingTask.id || null) : (tasks.length > 0 ? (tasks[0].id || null) : null));

        setIsDailyAuditOpen(true);
    };

    // Submit Daily QA Inspection
    const handleSubmitDailyAudit = async () => {
        if (!selectedLedgerEntry) return;

        const jo = jobOrders.find(
            (j) => 
                Number(j.order_id || j.job_order_id || j.id) === Number(selectedLedgerEntry.job_order_id) ||
                j.jo_id === String(selectedLedgerEntry.job_order_id)
        );
        const tasks = jo ? (jo.routing_tasks || jo.routingTasks || []) : [];

        // Prepare the inspections array for all steps
        const inspectionsPayload = tasks.map((task: any) => {
            let activeParameters: any[] = [];
            if (task.qa_template_id) {
                const activeTemplate = qaTemplates.find((t: any) => Number(t.template_id) === Number(task.qa_template_id));
                if (activeTemplate) {
                    activeParameters = activeTemplate.parameters || [];
                }
            }

            // Map parameter values to payload format for this task
            const qaParametersPayload = activeParameters.map((param: any) => {
                const val = qaParamValues[param.parameter_id] || "";
                let isFailed = false;

                if (param.test_type === "Numeric" && val) {
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                        if (param.min_value !== null && num < Number(param.min_value)) isFailed = true;
                        if (param.max_value !== null && num > Number(param.max_value)) isFailed = true;
                    }
                } else if (param.test_type === "Boolean" || param.test_type === "Pass/Fail" || param.test_type === "Yes/No") {
                    if (val === "Fail" || val === "false" || val === "No") {
                        isFailed = true;
                    }
                }

                return {
                    parameter_id: param.parameter_id,
                    test_name: param.test_name,
                    value: val,
                    is_failed: isFailed,
                    remarks: isFailed ? "Out of specification range" : "In specification"
                };
            });

            // Auto-extract moisture and acidity pH for this step
            let resolvedMoisture = "";
            let resolvedAcidity = "";
            activeParameters.forEach((param: any) => {
                const val = qaParamValues[param.parameter_id];
                if (!val) return;
                const name = (param.test_name || "").toLowerCase();
                if (name.includes("moisture")) {
                    resolvedMoisture = val;
                } else if (name.includes("ph") || name.includes("acidity")) {
                    resolvedAcidity = val;
                }
            });

            // Determine sensory status/action taken per step
            const stepHasFailure = qaParametersPayload.some(p => p.is_failed);
            const stepSensoryStatus = stepHasFailure ? "Failed" : sensoryStatus;
            const stepActionTaken = stepHasFailure ? "Quarantined" : dailyActionTaken;
            const stepLabStatus = stepHasFailure ? "Failed" : dailyLabStatus;

            return {
                jobOrderId: selectedLedgerEntry.job_order_id,
                joRouteId: task.id,
                ledgerId: selectedLedgerEntry.id || selectedLedgerEntry.ledger_id,
                inspectorId: 1, // Default supervisor ID
                moisturePercentage: resolvedMoisture,
                acidityPh: resolvedAcidity,
                sensoryStatus: stepSensoryStatus,
                weightCheckPassed: 1,
                labStatus: stepLabStatus,
                actionTaken: stepActionTaken,
                remarks: stepHasFailure ? `[Critical Specs Failed] ${dailyRemarks}` : dailyRemarks,
                qaParameters: qaParametersPayload
            };
        });

        setActionLoading(true);
        try {
            await postDailyQAInspection(inspectionsPayload);

            toast.success("Daily yield QA checklist signed off successfully.");
            setIsDailyAuditOpen(false);
            refreshAll();
        } catch (e: any) {
            console.error("Daily QA submission error:", e);
            toast.error(e.message || "Failed to log daily QA inspection.");
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Open Final QA Release Dialog
    const handleOpenFinalReleaseDialog = (lot: any) => {
        setSelectedLot(lot);
        setInspectedQty(String(lot.quantity_received || lot.quantity || 0));
        setDefectQty("0");
        setMicrobiologicalStatus("Passed");
        setPackagingSealPassed(true);
        setLabelCompliancePassed(true);
        setOverallDisposition("Approved");
        setCoaRefNo(`COA-${lot.lot_number}`);
        setFinalRemarks("");
        setIsFinalReleaseOpen(true);
    };

    // Submit Final QA Release
    const handleSubmitFinalRelease = async () => {
        if (!selectedLot) return;

        setActionLoading(true);
        try {
            // Self-healing: Resolve correct Job Order ID from lot number
            const matchingJO = jobOrders.find(jo => selectedLot.lot_number?.includes(jo.jo_id));
            const resolvedJoId = matchingJO ? matchingJO.order_id || matchingJO.id || 0 : 0;

            await postFinalQARelease({
                jobOrderId: resolvedJoId,
                lotId: selectedLot.line_id || selectedLot.id || selectedLot.lot_id,
                inspectedQuantity: Number(inspectedQty),
                defectQuantity: Number(defectQty),
                microbiologicalStatus,
                packagingSealPassed,
                labelCompliancePassed,
                overallDisposition,
                coaReferenceNo: coaRefNo,
                approvedBy: 1, // Supervisor
                remarks: finalRemarks
            });

            toast.success(`Finished Goods Lot successfully released: ${overallDisposition}`);
            setIsFinalReleaseOpen(false);
            refreshAll();
        } catch (e: any) {
            console.error("Final QA release error:", e);
            toast.error(e.message || "Failed to record final QA lot release.");
        } finally {
            setActionLoading(false);
        }
    };

    return {
        activeTab,
        setActiveTab,
        qaLogs,
        dispositions,
        jobOrders,
        branches,
        loadingLogs,
        loadingDispositions,
        loadingJobOrders,
        actionLoading,
        logSearch,
        setLogSearch,
        logStatusFilter,
        setLogStatusFilter,
        joSearch,
        setJoSearch,
        selectedJO,
        isYieldDialogOpen,
        setIsYieldDialogOpen,
        yieldQty,
        setYieldQty,
        lotNumber,
        setLotNumber,
        expiryDate,
        setExpiryDate,
        unitCost,
        setUnitCost,
        selectedDisp,
        isOverrideDialogOpen,
        setIsOverrideDialogOpen,
        overrideDecision,
        setOverrideDecision,
        overrideComments,
        setOverrideComments,
        refreshAll,
        getBranchName,
        filteredQALogs,
        pendingHolds,
        activeJobOrders,
        closedJobOrders,
        handleOpenYieldDialog,
        handleSubmitYieldClosing,
        handleReprintReceipt,
        handleOpenOverrideDialog,
        handleSubmitOverride,

        // Daily Yield QA states & handlers
        yieldLedger,
        dailyInspections,
        loadingDailyQA,
        isDailyAuditOpen,
        setIsDailyAuditOpen,
        selectedLedgerEntry,
        moisturePct,
        setMoisturePct,
        acidityPh,
        setAcidityPh,
        sensoryStatus,
        setSensoryStatus,
        weightCheckPassed,
        setWeightCheckPassed,
        dailyLabStatus,
        setDailyLabStatus,
        dailyActionTaken,
        setDailyActionTaken,
        dailyRemarks,
        setDailyRemarks,
        handleOpenDailyAuditDialog,
        handleSubmitDailyAudit,
        selectedRouteId,
        setSelectedRouteId,
        routes,
        qaTemplates,
        qaParamValues,
        setQaParamValues,

        // Final QA states & handlers
        finalReleases,
        lots,
        lotsProducts,
        loadingFinalQA,
        isFinalReleaseOpen,
        setIsFinalReleaseOpen,
        selectedLot,
        inspectedQty,
        setInspectedQty,
        defectQty,
        setDefectQty,
        microbiologicalStatus,
        setMicrobiologicalStatus,
        packagingSealPassed,
        setPackagingSealPassed,
        labelCompliancePassed,
        setLabelCompliancePassed,
        overallDisposition,
        setOverallDisposition,
        coaRefNo,
        setCoaRefNo,
        finalRemarks,
        setFinalRemarks,
        handleOpenFinalReleaseDialog,
        handleSubmitFinalRelease
    };
}
