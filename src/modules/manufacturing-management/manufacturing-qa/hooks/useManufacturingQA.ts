// src/modules/manufacturing-management/manufacturing-qa/hooks/useManufacturingQA.ts

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { JobOrder, QALogEntry } from "../types";
import {
    fetchJobOrders,
    fetchQALogsHistory,
    submitQARoutingTaskVerification,
    releaseFinishedGoodsReceipt,
    updateJobOrderStatus,
    updateRoutingTask
} from "../services/qa-api";

export function useManufacturingQA(userId?: number) {
    const [activeTab, setActiveTab] = useState<"pending" | "history" | "released">("pending");
    const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
    const [qaHistory, setQaHistory] = useState<QALogEntry[]>([]);
    const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [finishedGoodsReceipts, setFinishedGoodsReceipts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedJO, setSelectedJO] = useState<JobOrder | null>(null);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    
    // Audit submission states
    const [submittingAudit, setSubmittingAudit] = useState(false);
    const [releasingGoods, setReleasingGoods] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [joData, historyData, prodRes, branchRes, fgRes] = await Promise.all([
                fetchJobOrders(),
                fetchQALogsHistory(),
                fetch("/api/manufacturing/finished-goods/products?limit=250"),
                fetch("/api/manufacturing/procurement/qa-receiving?action=branches"),
                fetch("/api/manufacturing/production/finished-goods")
            ]);

            setJobOrders(joData);
            
            // Format history data to resolve task references
            const taskMap = new Map<number, { task: any; jo: any }>();
            (joData || []).forEach((jo: any) => {
                const tasks = jo.routing_tasks || jo.routingTasks || [];
                tasks.forEach((t: any) => {
                    taskMap.set(Number(t.id), { task: t, jo });
                });
            });

            const formattedHistory: QALogEntry[] = (historyData || []).map((log: any) => {
                const taskId = typeof log.task_id === "object" && log.task_id !== null 
                    ? Number(log.task_id.id) 
                    : Number(log.task_id);

                const taskInfo = taskMap.get(taskId);
                const task = taskInfo?.task;
                const relatedJO = taskInfo?.jo;

                return {
                    id: log.id,
                    task_id: taskId,
                    jo_id: task?.jo_id || "Unknown",
                    task_name: task?.name || "Inspected Task",
                    product_name: relatedJO?.product_name || `Product ID ${relatedJO?.product_id || "N/A"}`,
                    expected_quantity: Number(log.expected_quantity || 0),
                    actual_quantity: Number(log.actual_quantity || 0),
                    deviation_quantity: Number(log.deviation_quantity || 0),
                    qa_status: log.qa_status || "Passed",
                    recorded_at: log.recorded_at,
                    comments: log.comments,
                    photos: log.photos
                };
            });
            setQaHistory(formattedHistory);

            if (prodRes.ok) {
                const prodJson = await prodRes.json();
                setCatalogProducts(prodJson || []);
            }
            if (branchRes.ok) {
                const branchJson = await branchRes.json();
                setBranches(branchJson || []);
            }
            if (fgRes.ok) {
                const fgJson = await fgRes.json();
                setFinishedGoodsReceipts(fgJson || []);
            }
        } catch (e: any) {
            console.error("Failed to load QA data:", e);
            toast.error(e.message || "Failed to sync quality control data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredJobOrders = useMemo(() => {
        // Only show ongoing, hold, completed proceed-status Job Orders that are active for QA
        const activeJOs = jobOrders.filter(jo => 
            ["Ongoing", "Proceed", "On Hold"].includes(jo.status)
        );

        if (!searchQuery.trim()) return activeJOs;

        const term = searchQuery.toLowerCase();
        return activeJOs.filter(jo => 
            jo.jo_id.toLowerCase().includes(term) ||
            jo.product_name.toLowerCase().includes(term) ||
            (jo.order_no && jo.order_no.toLowerCase().includes(term))
        );
    }, [jobOrders, searchQuery]);

    const filteredHistory = useMemo(() => {
        if (!searchQuery.trim()) return qaHistory;

        const term = searchQuery.toLowerCase();
        return qaHistory.filter(log => 
            log.jo_id.toLowerCase().includes(term) ||
            log.task_name.toLowerCase().includes(term) ||
            log.product_name.toLowerCase().includes(term) ||
            (log.comments && log.comments.toLowerCase().includes(term))
        );
    }, [qaHistory, searchQuery]);

    const completedBatches = useMemo(() => {
        const finishedJOs = jobOrders.filter(jo => jo.status === "Finished");

        const mapped = finishedJOs.map(jo => {
            const receipts = finishedGoodsReceipts.filter(r => r.jo_id === jo.jo_id);
            const totalYielded = receipts.reduce((sum, r) => sum + Number(r.quantity_produced || 0), 0);
            const lotCodes = receipts.map(r => r.lot_number).filter(Boolean).join(", ");
            const dateReleased = receipts[0]?.date_received || jo.due_date;

            return {
                jo_id: jo.jo_id,
                product_name: jo.product_name,
                expected_quantity: jo.quantity,
                actual_yielded: totalYielded || jo.quantity,
                variance: totalYielded ? (totalYielded - jo.quantity) : 0,
                lot_codes: lotCodes || "Migrated Release",
                date_released: dateReleased
            };
        });

        if (!searchQuery.trim()) return mapped;

        const term = searchQuery.toLowerCase();
        return mapped.filter(b => 
            b.jo_id.toLowerCase().includes(term) ||
            b.product_name.toLowerCase().includes(term) ||
            b.lot_codes.toLowerCase().includes(term)
        );
    }, [jobOrders, finishedGoodsReceipts, searchQuery]);

    const handleOpenAudit = (jo: JobOrder) => {
        setSelectedJO(jo);
        setIsAuditModalOpen(true);
    };

    const handleVerifyQATask = async (
        taskId: number,
        productId: number,
        expectedQty: number,
        actualQty: number,
        comments: string,
        photos: string[]
    ) => {
        if (!selectedJO) return;
        setSubmittingAudit(true);
        try {
            await submitQARoutingTaskVerification(
                taskId,
                productId,
                Number(selectedJO.branch_id),
                expectedQty,
                actualQty,
                comments,
                photos,
                userId ? Number(userId) : null
            );
            toast.success("Stage verification logged successfully!");
            
            // Refresh detailed select JO to fetch updated tasks
            const allJOs = await fetchJobOrders();
            setJobOrders(allJOs);
            const updatedJO = allJOs.find(j => j.jo_id === selectedJO.jo_id);
            if (updatedJO) {
                setSelectedJO(updatedJO);
            }
            loadData(); // Sync history
        } catch (e: any) {
            console.error("QA task submit error:", e);
            toast.error(e.message || "Failed to submit stage inspection.");
        } finally {
            setSubmittingAudit(false);
        }
    };

    const handleReleaseGoods = async (yieldQties: Record<number, number>, lotNumbers: Record<number, string>, expiryDates: Record<number, string>) => {
        if (!selectedJO) return;
        setReleasingGoods(true);
        try {
            const productsList = selectedJO.products && selectedJO.products.length > 0 
                ? selectedJO.products 
                : [{
                    product_id: selectedJO.product_id,
                    product_name: selectedJO.product_name,
                    quantity: selectedJO.quantity,
                    components: selectedJO.components,
                    allocation_results: selectedJO.allocationResults
                }];

            for (const p of productsList) {
                const prodId = Number(p.product_id);
                const catalogProduct = catalogProducts.find(cp => Number(cp.product_id) === prodId);
                const payload = {
                    joId: selectedJO.jo_id,
                    productId: prodId,
                    productName: p.product_name,
                    quantityProduced: yieldQties[prodId] !== undefined ? yieldQties[prodId] : p.quantity,
                    branchId: Number(selectedJO.branch_id),
                    lotNumber: lotNumbers[prodId] || `LOT-QA-${selectedJO.jo_id}-${prodId}`,
                    expirationDate: expiryDates[prodId] || new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().split("T")[0],
                    unitCost: catalogProduct?.cost_per_unit || 0,
                    componentsConsumed: p.allocation_results || p.components || []
                };

                await releaseFinishedGoodsReceipt(payload);
            }

            toast.success("All finished goods released to warehouse! Inventory updated successfully.");
            setIsAuditModalOpen(false);
            setSelectedJO(null);
            loadData();
        } catch (e: any) {
            console.error("Goods release error:", e);
            toast.error(e.message || "Failed to release finished goods to inventory.");
        } finally {
            setReleasingGoods(false);
        }
    };

    const handleStartRoutingTask = async (taskId: number) => {
        setSubmittingAudit(true);
        try {
            await updateRoutingTask(taskId, {
                status: "In Progress",
                started_at: new Date().toISOString()
            });
            toast.success("Routing stage started successfully!");
            
            // Refresh detailed select JO to fetch updated tasks
            const allJOs = await fetchJobOrders();
            setJobOrders(allJOs);
            if (selectedJO) {
                const updatedJO = allJOs.find(j => j.jo_id === selectedJO.jo_id);
                if (updatedJO) {
                    setSelectedJO(updatedJO);
                }
            }
            loadData(); // Sync history
        } catch (e: any) {
            console.error("Start stage error:", e);
            toast.error(e.message || "Failed to start stage.");
        } finally {
            setSubmittingAudit(false);
        }
    };

    return {
        activeTab,
        setActiveTab,
        jobOrders,
        loading,
        searchQuery,
        setSearchQuery,
        selectedJO,
        setSelectedJO,
        isAuditModalOpen,
        setIsAuditModalOpen,
        submittingAudit,
        releasingGoods,
        catalogProducts,
        branches,
        filteredJobOrders,
        filteredHistory,
        completedBatches,
        handleOpenAudit,
        handleVerifyQATask,
        handleStartRoutingTask,
        handleReleaseGoods,
        refresh: loadData
    };
}
