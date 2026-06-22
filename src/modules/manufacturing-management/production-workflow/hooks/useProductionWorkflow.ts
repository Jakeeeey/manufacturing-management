"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { JobOrder, ActiveAssigningTask, QaTaskInfo, FinishedGoodsReceiptPayload, ComponentConsumption } from "../types";
import {
    fetchJobOrders,
    fetchUsers,
    fetchBranches,
    fetchProducts,
    updateJobOrder,
    updateTaskAssignments,
    updateTaskQA,
    updateTaskStatus,
    createFinishedGoodsReceipt,
    uploadFile,
    deleteFile
} from "../services/production-api";

export function useProductionWorkflow() {
    const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [users, setUsers] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    const [branches, setBranches] = useState<any[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedJoId, setSelectedJoId] = useState<string | null>(null);
    const [assigningStepKeys, setAssigningStepKeys] = useState<Record<string, boolean>>({});
    const [selectedDayNum, setSelectedDayNum] = useState<number | null>(null);
    const [activeAssigningTask, setActiveAssigningTask] = useState<ActiveAssigningTask | null>(null);
    const [operatorSearchText, setOperatorSearchText] = useState("");

    // Search and Filter Queue States for Shop Floor operators
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Proceed" | "Ongoing" | "On Hold">("All");

    // QA Yield Modal States for Floor Operators
    const [showQADialog, setShowQADialog] = useState(false);
    const [qaTaskInfo, setQaTaskInfo] = useState<QaTaskInfo | null>(null);
    const [actualQty, setActualQty] = useState<string>("");
    const [qaComments, setQaComments] = useState<string>("");
    const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    // Final receipt form states
    const [yieldQties, setYieldQties] = useState<Record<number, number>>({});
    const [lotNumbers, setLotNumbers] = useState<Record<number, string>>({});
    const [expiryDates, setExpiryDates] = useState<Record<number, string>>({});
    const [submittingReceipt, setSubmittingReceipt] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [completedReceipt, setCompletedReceipt] = useState<any[] | null>(null);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setUploading(true);
        const files = Array.from(e.target.files);
        const uploadedIds = [...uploadedPhotos];

        for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);

            try {
                const fileData = await uploadFile(formData);
                const fileId = fileData?.data?.id;
                if (fileId) {
                    uploadedIds.push(fileId);
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error("Upload error:", err);
                toast.error(`Failed to upload ${file.name}`);
            }
        }

        setUploadedPhotos(uploadedIds);
        setUploading(false);
        e.target.value = "";
    };

    const handleRemovePhoto = async (id: string) => {
        try {
            await deleteFile(id);
            setUploadedPhotos(prev => prev.filter(x => x !== id));
            toast.success("Photo removed");
        } catch (err) {
            console.error("Delete error:", err);
            toast.error("Failed to delete photo");
        }
    };

    // Helper: Trigger Printer Window for multiple completed products
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlePrintReceipt = (receipts: any[]) => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.error("Could not open print window. Please allow popups.");
            return;
        }

        const joId = receipts[0]?.joId || "N/A";

        const tableRows = receipts.map(receipt => `
            <tr>
                <td>#${receipt.productId}</td>
                <td>${receipt.productName}</td>
                <td><code>${receipt.lotNumber}</code></td>
                <td>${new Date(receipt.expirationDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</td>
                <td style="text-align: right; font-weight: 700;">${Number(receipt.quantityProduced).toLocaleString()} ${receipt.uom || 'PCS'}</td>
                <td style="text-align: right;">₱${Number(receipt.unitCost).toFixed(2)}</td>
                <td style="text-align: right; font-weight: 700;">₱${(Number(receipt.quantityProduced) * Number(receipt.unitCost)).toFixed(2)}</td>
            </tr>
        `).join("");

        const totalValue = receipts.reduce((sum, r) => sum + (Number(r.quantityProduced) * Number(r.unitCost)), 0);

        // Get completed routing steps (routes finished)
        const completedRoutings = selectedJO && selectedJO.jo_id === joId
            ? (selectedJO.routing_tasks || []).filter((task: { status: string; name: string; completed_at?: string | null }) => task.status === "Completed")
            : [];
        
        const completedRoutingsHtml = completedRoutings.length > 0
            ? `
                <div style="margin-top: 25px; margin-bottom: 25px;">
                    <div class="table-title">Production Routes / Steps Finished</div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px;">
                        <ul style="margin: 0; padding-left: 20px; font-size: 11px; font-weight: 600; color: #334155; line-height: 1.6;">
                            ${completedRoutings.map((task: { status: string; name: string; completed_at?: string | null }) => `
                                <li>
                                    <span style="color: #0f172a;">${task.name}</span> 
                                    <span style="color: #64748b; font-weight: normal; font-size: 10px; margin-left: 8px;">
                                        (Completed ${task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A'})
                                    </span>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                </div>
            `
            : "";

        // Aggregate raw materials consumed
        const materialsMap: Record<string, { name: string; quantity: number; uom: string }> = {};
        receipts.forEach(receipt => {
            (receipt.componentsConsumed || []).forEach((comp: ComponentConsumption) => {
                const name = comp.component_name || comp.product_name || `Component #${comp.component_product_id}`;
                const key = `${comp.component_product_id || name}`;
                const qty = Number(comp.quantity || comp.required || 0);
                const catalogComp = products.find(prod => Number(prod.product_id) === Number(comp.component_product_id));
                const compUom = catalogComp?.unit_of_measurement?.unit_shortcut || catalogComp?.unit_of_measurement?.unit_name || "PCS";
                
                if (!materialsMap[key]) {
                    materialsMap[key] = { name, quantity: 0, uom: compUom };
                }
                materialsMap[key].quantity += qty;
            });
        });
        const materialsList = Object.values(materialsMap);

        const rawMaterialsHtml = materialsList.length > 0
            ? `
                <div style="margin-top: 25px; margin-bottom: 25px;">
                    <div class="table-title">Raw Materials Used / Consumed</div>
                    <table class="items-table" style="margin-bottom: 0;">
                        <thead>
                            <tr>
                                <th>Material Name / Description</th>
                                <th style="text-align: right; width: 150px;">Quantity Used</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${materialsList.map(mat => `
                                <tr>
                                    <td style="font-weight: 500;">${mat.name}</td>
                                    <td style="text-align: right; font-weight: 700; color: #b91c1c;">${Number(mat.quantity).toLocaleString()} ${mat.uom}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `
            : "";

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Production Finished Goods Receipt - ${joId}</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        color: #0f172a;
                        padding: 40px;
                        line-height: 1.5;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 20px;
                        margin-bottom: 25px;
                    }
                    .header-title h1 {
                        font-size: 20px;
                        font-weight: 800;
                        margin: 0;
                        color: #0f172a;
                        letter-spacing: -0.025em;
                    }
                    .header-title p {
                        font-size: 11px;
                        color: #64748b;
                        margin: 4px 0 0 0;
                        font-weight: 500;
                    }
                    .badge {
                        background-color: #10b981;
                        color: white;
                        font-size: 10px;
                        font-weight: 800;
                        padding: 4px 10px;
                        border-radius: 9999px;
                        text-transform: uppercase;
                    }
                    .meta-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                        margin-bottom: 30px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 16px;
                    }
                    .meta-item {
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                        border-bottom: 1px dashed #e2e8f0;
                        padding-bottom: 6px;
                    }
                    .meta-item:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }
                    .meta-label {
                        font-weight: 700;
                        color: #64748b;
                    }
                    .meta-value {
                        font-weight: 600;
                        color: #0f172a;
                    }
                    .table-title {
                        font-size: 12px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #475569;
                        margin-bottom: 10px;
                        letter-spacing: 0.05em;
                    }
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 40px;
                    }
                    .items-table th {
                        background-color: #f1f5f9;
                        border-bottom: 2px solid #cbd5e1;
                        color: #475569;
                        font-weight: 700;
                        text-align: left;
                        padding: 10px 12px;
                        font-size: 11px;
                        text-transform: uppercase;
                    }
                    .items-table td {
                        border-bottom: 1px solid #e2e8f0;
                        padding: 10px 12px;
                        font-size: 11px;
                    }
                    .total-row {
                        font-weight: 800;
                        background-color: #f8fafc;
                    }
                    .footer-sig {
                        margin-top: 60px;
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        gap: 40px;
                    }
                    .sig-box {
                        text-align: center;
                        font-size: 11px;
                        color: #64748b;
                        font-weight: 500;
                    }
                    .sig-line {
                        border-bottom: 1px solid #cbd5e1;
                        margin-bottom: 8px;
                        height: 45px;
                    }
                    .no-print {
                        display: flex;
                        justify-content: flex-end;
                        margin-bottom: 20px;
                        gap: 10px;
                    }
                    .btn {
                        padding: 8px 16px;
                        font-size: 12px;
                        font-weight: 700;
                        border-radius: 6px;
                        border: 1px solid #cbd5e1;
                        background-color: white;
                        cursor: pointer;
                    }
                    .btn-primary {
                        background-color: #0f172a;
                        color: white;
                        border-color: #0f172a;
                    }
                    @media print {
                        .no-print {
                            display: none;
                        }
                        body {
                            padding: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="no-print">
                    <button class="btn" onclick="window.close()">Close Window</button>
                    <button class="btn btn-primary" onclick="window.print()">Print Ticket</button>
                </div>
                <div class="header">
                    <div class="header-title">
                        <h1>FINISHED GOODS RECEIPT</h1>
                        <p>Inventory Allocation Entry • Posted to Ledger</p>
                    </div>
                    <span class="badge">Success</span>
                </div>
                <div class="meta-grid">
                    <div>
                        <div class="meta-item">
                            <span class="meta-label">Job Order Reference:</span>
                            <span class="meta-value">${joId}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Destination Branch:</span>
                            <span class="meta-value">${receipts[0]?.branchId || "N/A"}</span>
                        </div>
                    </div>
                    <div>
                        <div class="meta-item">
                            <span class="meta-label">Receipt Date:</span>
                            <span class="meta-value">${new Date().toLocaleString()}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Total Allocated Value:</span>
                            <span class="meta-value">₱${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
                <div class="table-title">Stock Details Ledger Entries</div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Product ID</th>
                            <th>Description / Variant</th>
                            <th>Batch Lot No.</th>
                            <th>Expiry Date</th>
                            <th style="text-align: right;">Qty Stocked</th>
                            <th style="text-align: right;">Unit Cost</th>
                            <th style="text-align: right;">Total Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <tr class="total-row">
                            <td colspan="4" style="text-align: right; text-transform: uppercase;">Total Output Posted</td>
                            <td style="text-align: right; font-weight: 800; border-top: 1px solid #cbd5e1;">${receipts.reduce((sum, r) => sum + Number(r.quantityProduced), 0).toLocaleString()} ${receipts[0]?.uom || 'PCS'}</td>
                            <td></td>
                            <td style="text-align: right; font-weight: 800; border-top: 1px solid #cbd5e1;">₱${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>
                
                ${rawMaterialsHtml}
                
                ${completedRoutingsHtml}

                <div class="footer-sig">
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        Operator Signature
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        QA Officer Sign-off
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        Warehouse Custodian
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // Helper: Modify Job Order Status/Routings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleUpdateJO = async (joId: string, patch: any) => {
        try {
            await updateJobOrder(joId, patch);
            const refreshedData = await fetchJobOrders();
            setJobOrders(refreshedData);
            return true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to update Job Order.");
            return false;
        }
    };

    // Fetch master data
    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [joJson, usersJson, branchesJson, productsJson] = await Promise.all([
                fetchJobOrders(),
                fetchUsers(),
                fetchBranches(),
                fetchProducts()
            ]);

            setJobOrders(joJson);
            setUsers(usersJson);
            setBranches(branchesJson);
            if (productsJson) {
                setProducts(productsJson.data || productsJson);
            }
        } catch (e) {
            console.error("Failed to load production data:", e);
            toast.error("Failed to load production workspace data.");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Active Job Orders (Ongoing, Proceed, or On Hold)
    const activeJOs = useMemo(() => {
        return jobOrders.filter(jo => ["Ongoing", "Proceed", "On Hold"].includes(jo.status));
    }, [jobOrders]);

    // Filtered Job Orders based on Operator search and status tabs
    const filteredJOs = useMemo(() => {
        return activeJOs.filter(jo => {
            const matchesSearch = 
                jo.jo_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (jo.product_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (jo.order_no || "").toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesStatus = 
                statusFilter === "All" ||
                (statusFilter === "Proceed" && jo.status === "Proceed") ||
                (statusFilter === "Ongoing" && jo.status === "Ongoing") ||
                (statusFilter === "On Hold" && jo.status === "On Hold");
            
            return matchesSearch && matchesStatus;
        });
    }, [activeJOs, searchQuery, statusFilter]);

    // Selected Job Order detailed calculations
    const selectedJO = useMemo(() => {
        if (!selectedJoId) return null;
        return jobOrders.find(jo => jo.jo_id === selectedJoId) || null;
    }, [jobOrders, selectedJoId]);

    useEffect(() => {
        if (selectedJO && selectedJO.dailyBreakdown && selectedJO.dailyBreakdown.length > 0) {
            const isValid = selectedJO.dailyBreakdown.some((d: { day: number }) => d.day === selectedDayNum);
            if (!isValid) {
                const firstActiveDay = selectedJO.dailyBreakdown.find((d: { status: string }) => d.status === "Ongoing") || 
                                       selectedJO.dailyBreakdown.find((d: { status: string }) => d.status === "Pending") || 
                                       selectedJO.dailyBreakdown[0];
                setSelectedDayNum(firstActiveDay.day);
            }
        } else {
            setSelectedDayNum(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedJoId, selectedJO]);

    const userWorkloads = useMemo(() => {
        const loads: Record<string, number> = {};
        users.forEach(u => {
            loads[String(u.user_id)] = 0;
        });

        jobOrders.forEach(jo => {
            const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity,
                routings: jo.routings
            }];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            productsList.forEach((p: any) => {
                if (!p.routings) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                p.routings.forEach((r: any) => {
                    const stepHours = (Number(r.duration_hours) || 0) * Number(p.quantity);
                    const relTask = jo.routing_tasks?.find(t => Number(t.routing_id) === Number(r.routing_id));
                    if (relTask?.assignments && relTask.assignments.length > 0) {
                        relTask.assignments.forEach(ass => {
                            const wId = String(ass.user_id);
                            if (loads[wId] !== undefined) {
                                  loads[wId] += stepHours;
                            }
                        });
                    } else {
                        const assigned = r.assigned_personnel;
                        if (assigned && (assigned.id || assigned.user_id)) {
                            const wId = String(assigned.id || assigned.user_id);
                            if (loads[wId] !== undefined) {
                                loads[wId] += stepHours;
                            }
                        }
                    }
                });
            });
        });
        return loads;
    }, [jobOrders, users]);

    // Auto-calculate yield qties and expiration dates for all products in the selected JO
    useEffect(() => {
        if (selectedJO) {
            const productsList = selectedJO.products && selectedJO.products.length > 0 ? selectedJO.products : [selectedJO];
            
            const initialYields: Record<number, number> = {};
            const initialLots: Record<number, string> = {};
            const initialExpirations: Record<number, string> = {};

            productsList.forEach((p: { product_id: number | string; quantity: number }) => {
                const prodId = Number(p.product_id);
                
                // Get target qty for today if a specific day is selected, fallback to total JO qty
                const dayObj = selectedDayNum 
                    ? selectedJO.dailyBreakdown?.find((d: { day: number }) => d.day === selectedDayNum)
                    : null;
                const targetQty = dayObj ? Number(dayObj.quantity) : p.quantity;
                
                initialYields[prodId] = targetQty;
                initialLots[prodId] = selectedDayNum
                    ? `MFG-${selectedJO.jo_id}-${prodId}-DAY${selectedDayNum}`
                    : `MFG-${selectedJO.jo_id}-${prodId}`;

                const catalogProduct = products.find(prod => Number(prod.product_id) === prodId);
                const shelfLife = catalogProduct?.product_shelf_life || 365;
                const exp = new Date();
                exp.setDate(exp.getDate() + Number(shelfLife));
                initialExpirations[prodId] = exp.toISOString().split("T")[0];
            });

            setYieldQties(initialYields);
            setLotNumbers(initialLots);
            setExpiryDates(initialExpirations);
        }
    }, [selectedJO, products, selectedDayNum]);

    const handleToggleOperatorForTask = async (
        jo: JobOrder,
        productId: number,
        routingId: number,
        userId: number,
        shouldAdd: boolean
    ) => {
        const stepKey = `${jo.jo_id}-${productId}-${routingId}`;
        const relTask = jo.routing_tasks?.find(t => Number(t.routing_id) === Number(routingId));
        if (!relTask) {
            toast.loading("Initializing routing execution tasks in database...", { id: "init-tasks" });
            try {
                await handleUpdateJO(jo.jo_id, { status: jo.status });
                toast.success("Tasks initialized! Please choose the operator again.", { id: "init-tasks" });
            } catch {
                toast.error("Failed to initialize execution tasks.", { id: "init-tasks" });
            }
            return;
        }

        setAssigningStepKeys(prev => ({ ...prev, [stepKey]: true }));
        const toastId = toast.loading(shouldAdd ? "Assigning operator..." : "Removing operator...");

        let currentAssignments = relTask.assignments ? [...relTask.assignments] : [];
        if (shouldAdd) {
            if (!currentAssignments.some(a => Number(a.user_id) === userId)) {
                currentAssignments.push({
                    id: 0,
                    task_id: relTask.id,
                    user_id: userId,
                    is_team_lead: currentAssignments.length === 0
                });
            }
        } else {
            currentAssignments = currentAssignments.filter(a => Number(a.user_id) !== userId);
        }

        try {
            const assignmentsPayload = currentAssignments.map(a => ({
                user_id: Number(a.user_id),
                is_team_lead: !!a.is_team_lead
            }));

            await updateTaskAssignments(relTask.id, assignmentsPayload);

            // Legacy JSON write-back
            const firstUser = users.find(u => Number(u.user_id) === Number(currentAssignments[0]?.user_id));
            const legacyAssigned = firstUser ? {
                id: firstUser.user_id,
                name: `${firstUser.user_fname} ${firstUser.user_lname}`,
                position: firstUser.user_position
            } : null;

            const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity,
                bom: jo.bom,
                components: jo.components,
                routings: jo.routings,
                allocationResults: jo.allocationResults
            }];

            const updatedProductsList = productsList.map(p => {
                if (Number(p.product_id) === Number(productId)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const updatedRoutings = (p.routings || []).map((r: any) => {
                        if (Number(r.routing_id) === Number(routingId)) {
                            return { 
                                ...r, 
                                assigned_personnel: legacyAssigned
                            };
                        }
                        return r;
                    });
                    return { ...p, routings: updatedRoutings };
                }
                return p;
            });

            const ok = await handleUpdateJO(jo.jo_id, { products: updatedProductsList });
            if (ok) {
                toast.success(shouldAdd ? "Operator assigned to task step!" : "Operator removed from task step.", { id: toastId });
            } else {
                toast.dismiss(toastId);
            }
        } catch (err) {
            console.error("[ProductionWorkflowModule] Failed to toggle task assignments relationally:", err);
            toast.error("Failed to update assignments in database.", { id: toastId });
        } finally {
            setAssigningStepKeys(prev => ({ ...prev, [stepKey]: false }));
        }
    };

    const handleVerifyQAForTask = async (
        jo: JobOrder,
        productId: number,
        routingId: number,
        qaStatus: "Passed" | "Pending",
        actualQty?: number,
        comments?: string,
        photos?: string[],
        skipQA = false
    ) => {
        if (selectedDayNum !== null) {
            const dayObj = jo.dailyBreakdown?.find((d: { day: number }) => d.day === selectedDayNum);
            const expectedQty = dayObj ? Number(dayObj.quantity) : jo.quantity;
            const actual = actualQty !== undefined ? actualQty : expectedQty;
            
            const updatedBreakdown = (jo.dailyBreakdown || []).map((day: { day: number; date: string; quantity: number; completed_steps?: number[]; qa_logs?: Record<string, { expected_quantity: number; actual_quantity: number; qa_status: string; comments: string; photos: string[]; completed_at?: string }>; status: string }) => {
                if (day.day === selectedDayNum) {
                    const completedSteps = day.completed_steps ? [...day.completed_steps] : [];
                    const qaLogs = day.qa_logs ? { ...day.qa_logs } : {};
                    
                    if (qaStatus === "Passed") {
                        if (!completedSteps.includes(Number(routingId))) {
                            completedSteps.push(Number(routingId));
                        }
                        qaLogs[String(routingId)] = {
                            expected_quantity: expectedQty,
                            actual_quantity: actual,
                            qa_status: "Passed",
                            comments: comments || "",
                            photos: photos || [],
                            completed_at: new Date().toISOString()
                        };
                    } else {
                        const index = completedSteps.indexOf(Number(routingId));
                        if (index > -1) {
                            completedSteps.splice(index, 1);
                        }
                        delete qaLogs[String(routingId)];
                    }
                    
                    let dayStatus = "Pending";
                    if (day.status === "Completed") {
                        dayStatus = "Completed";
                    } else if (completedSteps.length > 0) {
                        dayStatus = "Ongoing";
                    }
                    
                    return {
                        ...day,
                        completed_steps: completedSteps,
                        qa_logs: qaLogs,
                        status: dayStatus
                    };
                }
                return day;
            });
            
            const allDaysCompleted = updatedBreakdown.every((day: { status: string }) => day.status === "Completed");
            const parentJoPatch: Partial<JobOrder> = {
                dailyBreakdown: updatedBreakdown
            };
            if (allDaysCompleted) {
                parentJoPatch.status = "Finished";
            } else {
                const anyDayStarted = updatedBreakdown.some((day: { status: string }) => day.status === "Ongoing" || day.status === "Completed");
                if (anyDayStarted && jo.status !== "Ongoing") {
                    parentJoPatch.status = "Ongoing";
                }
            }
            
            const success = await handleUpdateJO(jo.jo_id, parentJoPatch);
            if (success) {
                toast.success(`Day ${selectedDayNum} step updated successfully.`);
            }
            return;
        }

        const relTask = jo.routing_tasks?.find(t => Number(t.routing_id) === Number(routingId));
        if (relTask) {
            try {
                if (qaStatus === "Passed") {
                    const expected = jo.quantity;
                    const actual = actualQty !== undefined ? actualQty : expected;
                    
                    if (!skipQA) {
                        await updateTaskQA(relTask.id, Number(productId), Number(jo.branch_id), {
                            expected_quantity: expected,
                            actual_quantity: actual,
                            qa_status: "Passed",
                            comments: comments || "",
                            photos: photos || []
                        });
                    }

                    await updateTaskStatus(relTask.id, "Completed", new Date().toISOString());
                } else {
                    await updateTaskStatus(relTask.id, "Pending", null);
                }
            } catch (err) {
                console.error("[ProductionWorkflow] Failed to update task QA relationally:", err);
                toast.error("Failed to update task status in database.");
            }
        }

        const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
            product_id: jo.product_id,
            product_name: jo.product_name,
            quantity: jo.quantity,
            bom: jo.bom,
            components: jo.components,
            routings: jo.routings,
            allocationResults: jo.allocationResults
        }];

        const updatedProductsList = productsList.map(p => {
            if (Number(p.product_id) === Number(productId)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updatedRoutings = (p.routings || []).map((r: any) => {
                    if (Number(r.routing_id) === Number(routingId)) {
                        return { 
                            ...r, 
                            qa_status: qaStatus, 
                            completed_at: qaStatus === "Passed" ? new Date().toISOString() : null 
                        };
                    }
                    return r;
                });
                return { ...p, routings: updatedRoutings };
            }
            return p;
        });

        await handleUpdateJO(jo.jo_id, { products: updatedProductsList });
        toast.success(qaStatus === "Passed" ? "Task step QA Cleared & Completed!" : "Task step status reset.");
    };

    const handleOpenQADialog = async (jo: JobOrder, productId: number, routingId: number, expected: number, taskName: string) => {
        const relTask = jo.routing_tasks?.find(t => Number(t.routing_id) === Number(routingId));
        if (!relTask) {
            toast.loading("Initializing routing execution tasks in database...", { id: "init-tasks" });
            try {
                await handleUpdateJO(jo.jo_id, { status: jo.status });
                toast.success("Tasks initialized! Please click QA Pass again.", { id: "init-tasks" });
            } catch {
                toast.error("Failed to initialize execution tasks.", { id: "init-tasks" });
            }
            return;
        }
        setQaTaskInfo({
            jo,
            productId,
            routingId,
            taskId: relTask.id,
            expected,
            taskName
        });
        setActualQty(expected.toString());
        setQaComments("");
        setUploadedPhotos([]);
        setShowQADialog(true);
    };

    const handleSubmitFinishedReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedJO) return;

        setSubmittingReceipt(true);
        try {
            const productsList = selectedJO.products && selectedJO.products.length > 0 ? selectedJO.products : [selectedJO];
            const receiptPayloads: FinishedGoodsReceiptPayload[] = [];

            // Determine if this is the final stocking that completes the whole Job Order
            const isLastDay = selectedDayNum !== null && selectedJO.dailyBreakdown
                ? selectedJO.dailyBreakdown.every((day: { day: number; status: string }) => 
                    day.day === selectedDayNum ? true : day.status === "Completed"
                  )
                : true;
            const completeJobOrder = selectedDayNum === null || isLastDay;

            for (const p of productsList) {
                const prodId = Number(p.product_id);
                const catalogProduct = products.find(prod => Number(prod.product_id) === prodId);
                
                // If in daily mode, we should deduct a fraction of components consumed corresponding to today's yield quantity
                const targetQty = selectedDayNum !== null && selectedJO.dailyBreakdown
                    ? (selectedJO.dailyBreakdown.find((d: { day: number; quantity: number }) => d.day === selectedDayNum)?.quantity || p.quantity)
                    : p.quantity;
                const actualYieldQty = yieldQties[prodId] || targetQty;
                const dailyRatio = p.quantity > 0 ? actualYieldQty / p.quantity : 1.0;

                const baseComponents = p.allocationResults || p.allocation_results || p.components || [];
                const dailyComponents = baseComponents.map((comp: { required?: number; quantity?: number; component_product_id: number; component_name: string; product_name?: string }) => {
                    const originalQty = Number(comp.required || comp.quantity || 0);
                    return {
                        ...comp,
                        required: Math.round(originalQty * dailyRatio * 100) / 100,
                        quantity: Math.round(originalQty * dailyRatio * 100) / 100
                    };
                });

                const uomName = catalogProduct?.unit_of_measurement?.unit_shortcut || catalogProduct?.unit_of_measurement?.unit_name || "PCS";
                const payload: FinishedGoodsReceiptPayload = {
                    joId: selectedJO.jo_id,
                    productId: prodId,
                    productName: p.product_name,
                    quantityProduced: actualYieldQty,
                    branchId: selectedJO.branch_id ?? "",
                    lotNumber: lotNumbers[prodId] || (selectedDayNum ? `MFG-${selectedJO.jo_id}-${prodId}-DAY${selectedDayNum}` : `MFG-${selectedJO.jo_id}-${prodId}`),
                    expirationDate: expiryDates[prodId] || new Date().toISOString().split("T")[0],
                    unitCost: catalogProduct?.cost_per_unit || 0,
                    componentsConsumed: dailyComponents,
                    completeJobOrder,
                    uom: uomName
                };

                await createFinishedGoodsReceipt(payload);
                
                receiptPayloads.push(payload);
            }

            // If we completed a daily run, we should update the daily run status in the database to Completed
            if (selectedDayNum !== null) {
                const totalYielded = productsList.reduce((sum: number, p: { product_id: number | string }) => {
                    const prodId = Number(p.product_id);
                    return sum + (yieldQties[prodId] || 0);
                }, 0);

                const updatedBreakdown = (selectedJO.dailyBreakdown || []).map((day: { day: number; date: string; quantity: number; status: string; actual_yield?: number }) => {
                    if (day.day === selectedDayNum) {
                        return {
                            ...day,
                            status: "Completed",
                            actual_yield: totalYielded || day.quantity
                        };
                    }
                    return day;
                });
                
                const parentJoPatch: Partial<JobOrder> = {
                    dailyBreakdown: updatedBreakdown
                };
                if (completeJobOrder) {
                    parentJoPatch.status = "Finished";
                }
                
                await handleUpdateJO(selectedJO.jo_id, parentJoPatch);
            }

            toast.success(
                completeJobOrder 
                    ? `Production receipt created for ${productsList.length} items! Job Order is Completed.`
                    : `Production receipt created for Day ${selectedDayNum}! Yields pushed to inventory.`
            );
            
            setCompletedReceipt(receiptPayloads);
            if (completeJobOrder) {
                setSelectedJoId(null);
                loadData(false);
            } else {
                loadData(true);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            toast.error(err.message || "Failed to finalize production.");
        } finally {
            setSubmittingReceipt(false);
        }
    };

    const productsList = useMemo(() => {
        if (!selectedJO) return [];
        return selectedJO.products && selectedJO.products.length > 0 ? selectedJO.products : [{
            product_id: selectedJO.product_id,
            product_name: selectedJO.product_name,
            quantity: selectedJO.quantity,
            bom: selectedJO.bom,
            components: selectedJO.components,
            routings: selectedJO.routings,
            allocationResults: selectedJO.allocationResults
        }];
    }, [selectedJO]);

    const allStepsCompleted = useMemo(() => {
        if (!selectedJO || productsList.length === 0) return false;
        return productsList.every((p: { routings?: Array<{ routing_id: number; qa_status?: string }> }) => 
            p.routings && p.routings.length > 0 && p.routings.every((r: { routing_id: number; qa_status?: string }) => {
                const relTask = selectedJO.routing_tasks?.find(t => Number(t.routing_id) === Number(r.routing_id));
                const taskQAStatus = relTask ? (relTask.status === "Completed" ? "Passed" : "Pending") : (r.qa_status || "Pending");
                
                if (selectedDayNum !== null) {
                    const dayObj = selectedJO.dailyBreakdown?.find((d: { day: number; completed_steps?: number[] }) => d.day === selectedDayNum);
                    return dayObj?.completed_steps?.includes(Number(r.routing_id)) || false;
                }
                return taskQAStatus === "Passed";
            })
        );
    }, [selectedJO, productsList, selectedDayNum]);

    return {
        jobOrders,
        users,
        products,
        loading,
        selectedJoId,
        setSelectedJoId,
        selectedJO,
        productsList,
        allStepsCompleted,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredJOs,
        activeJOs,
        selectedDayNum,
        setSelectedDayNum,
        activeAssigningTask,
        setActiveAssigningTask,
        assigningStepKeys,
        operatorSearchText,
        setOperatorSearchText,
        userWorkloads,
        showQADialog,
        setShowQADialog,
        qaTaskInfo,
        setQaTaskInfo,
        actualQty,
        setActualQty,
        qaComments,
        setQaComments,
        isQALoading: false,
        uploadedPhotos,
        setUploadedPhotos,
        uploading,
        yieldQties,
        setYieldQties,
        lotNumbers,
        setLotNumbers,
        expiryDates,
        setExpiryDates,
        submittingReceipt,
        completedReceipt,
        setCompletedReceipt,
        handlePhotoUpload,
        handleRemovePhoto,
        handleOpenQADialog,
        handlePrintReceipt,
        handleUpdateJO,
        handleToggleOperatorForTask,
        handleVerifyQAForTask,
        handleSubmitFinishedReceipt,
        loadData
    };
}
