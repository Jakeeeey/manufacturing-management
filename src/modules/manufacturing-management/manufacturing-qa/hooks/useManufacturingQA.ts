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
        return found?.branch_name || found?.name || `Branch #${branchId}`;
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
            const isCompleted = status === "finished" || status === "completed" || status === "cancelled";
            const matchesSearch = jo.jo_id.toLowerCase().includes(joSearch.toLowerCase()) || 
                                  jo.product_name.toLowerCase().includes(joSearch.toLowerCase());
            return !isCompleted && matchesSearch;
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
        handleOpenYieldDialog,
        handleSubmitYieldClosing,
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
