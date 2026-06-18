"use client";

import React, { useState, useEffect, useMemo } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Cpu, Users, CheckCircle, Clock, Calendar, ArrowRight, Loader2, Sparkles, Scale, AlertTriangle, ShieldCheck, Play, Save, ChevronRight, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { JobOrder } from "../planning-engineering/types";

export default function ProductionWorkflowModule() {
    const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [users, setUsers] = useState<any[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    const [branches, setBranches] = useState<any[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedJoId, setSelectedJoId] = useState<string | null>(null);

    // Final receipt form states
    const [yieldQties, setYieldQties] = useState<Record<number, number>>({});
    const [lotNumbers, setLotNumbers] = useState<Record<number, string>>({});
    const [expiryDates, setExpiryDates] = useState<Record<number, string>>({});
    const [submittingReceipt, setSubmittingReceipt] = useState(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [completedReceipt, setCompletedReceipt] = useState<any[] | null>(null);

    // Helper: Trigger Printer Window for multiple completed products
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlePrintReceipt = (receipts: any[]) => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.error("Could not open print window. Please allow popups.");
            return;
        }

        const joId = receipts[0]?.joId || "N/A";
        const branchId = receipts[0]?.branchId || "N/A";

        const tableRows = receipts.map(receipt => `
            <tr>
                <td>#${receipt.productId}</td>
                <td>${receipt.productName}</td>
                <td><code>${receipt.lotNumber}</code></td>
                <td>${new Date(receipt.expirationDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}</td>
                <td style="text-align: right; font-weight: 700;">${Number(receipt.quantityProduced).toLocaleString()} PCS</td>
                <td style="text-align: right;">₱${Number(receipt.unitCost).toFixed(2)}</td>
                <td style="text-align: right; font-weight: 700;">₱${(Number(receipt.quantityProduced) * Number(receipt.unitCost)).toFixed(2)}</td>
            </tr>
        `).join("");

        const totalValue = receipts.reduce((sum, r) => sum + (Number(r.quantityProduced) * Number(r.unitCost)), 0);

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
                        cursor: pointer;
                        border: 1px solid #e2e8f0;
                    }
                    .btn-primary {
                        background-color: #10b981;
                        color: white;
                        border: none;
                    }
                    .btn-secondary {
                        background-color: white;
                        color: #475569;
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
                    <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
                    <button class="btn btn-primary" onclick="window.print()">Print Receipt</button>
                </div>
                
                <div class="header">
                    <div class="header-title">
                        <h1>PRODUCTION FINISHED RECEIPT</h1>
                        <p>VOS ERP • Manufacturing Execution & Shop Floor Controls</p>
                    </div>
                    <div class="badge">QA PASSED & POSTED</div>
                </div>

                <div class="meta-grid">
                    <div>
                        <div class="meta-item">
                            <span class="meta-label">Job Order:</span>
                            <span class="meta-value">${joId}</span>
                        </div>
                        <div class="meta-item" style="margin-top: 8px;">
                            <span class="meta-label">Warehouse Destination:</span>
                            <span class="meta-value">Branch ID ${branchId}</span>
                        </div>
                    </div>
                    <div>
                        <div class="meta-item">
                            <span class="meta-label">Date Completed:</span>
                            <span class="meta-value">${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                        </div>
                        <div class="meta-item" style="margin-top: 8px;">
                            <span class="meta-label">Total Product Items:</span>
                            <span class="meta-value">${receipts.length} Products</span>
                        </div>
                    </div>
                </div>

                <div class="table-title">Product details</div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Product Code</th>
                            <th>Description</th>
                            <th>Lot Number</th>
                            <th>Expiry Date</th>
                            <th style="text-align: right;">Yield Quantity</th>
                            <th style="text-align: right;">Unit Cost</th>
                            <th style="text-align: right;">Total Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <tr class="total-row">
                            <td colspan="4">GRAND TOTAL</td>
                            <td style="text-align: right;">${receipts.reduce((sum, r) => sum + Number(r.quantityProduced), 0).toLocaleString()} PCS</td>
                            <td></td>
                            <td style="text-align: right;">₱${totalValue.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer-sig">
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        Prepared By (Operator)
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        QA Inspector Sign-off
                    </div>
                    <div class="sig-box">
                        <div class="sig-line"></div>
                        Inventory Controller
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };



    // Fetch master data
    const loadData = async () => {
        setLoading(true);
        try {
            const [joRes, usersRes, branchesRes, productsRes] = await Promise.all([
                fetch("/api/manufacturing/planning-engineering"),
                fetch("/api/manufacturing/planning-engineering?action=users"),
                fetch("/api/manufacturing/procurement/qa-receiving?action=branches"),
                fetch("/api/manufacturing/finished-goods/products?limit=200")
            ]);

            if (joRes.ok) setJobOrders(await joRes.json());
            if (usersRes.ok) setUsers(await usersRes.json());
            if (branchesRes.ok) setBranches(await branchesRes.json());
            if (productsRes.ok) {
                const prodJson = await productsRes.json();
                setProducts(prodJson.data || prodJson);
            }
        } catch (e) {
            console.error("Failed to load production data:", e);
            toast.error("Failed to load production workspace data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Active Job Orders (Ongoing, Proceed, or On Hold)
    const activeJOs = useMemo(() => {
        return jobOrders.filter(jo => ["Ongoing", "Proceed", "On Hold"].includes(jo.status));
    }, [jobOrders]);

    // Selected Job Order detailed calculations
    const selectedJO = useMemo(() => {
        if (!selectedJoId) return null;
        return jobOrders.find(jo => jo.jo_id === selectedJoId) || null;
    }, [jobOrders, selectedJoId]);

    // Auto-calculate yield qties and expiration dates for all products in the selected JO
    useEffect(() => {
        if (selectedJO) {
            const productsList = selectedJO.products && selectedJO.products.length > 0 ? selectedJO.products : [selectedJO];
            
            const initialYields: Record<number, number> = {};
            const initialLots: Record<number, string> = {};
            const initialExpirations: Record<number, string> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
            productsList.forEach((p: any) => {
                const prodId = Number(p.product_id);
                initialYields[prodId] = p.quantity;
                initialLots[prodId] = `MFG-${selectedJO.jo_id}-${prodId}`;

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
    }, [selectedJO, products]);


    // Helper: Modify Job Order Status/Routings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleUpdateJO = async (joId: string, patch: any) => {
        try {
            const res = await fetch("/api/manufacturing/planning-engineering", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ joId, patch })
            });
            if (res.ok) {
                // Reload job orders list
                const refreshed = await fetch("/api/manufacturing/planning-engineering");
                if (refreshed.ok) setJobOrders(await refreshed.json());
            } else {
                throw new Error("Failed to update status");
            }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to update Job Order.");
        }
    };

    // Operator assignment on routing step
    const handleAssignPersonnelToTask = async (jo: JobOrder, productId: number, routingId: number, userId: string) => {
        const userObj = users.find(u => Number(u.user_id) === Number(userId));
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
                            assigned_personnel: userObj ? { 
                                id: userObj.user_id, 
                                name: `${userObj.user_fname} ${userObj.user_lname}`, 
                                position: userObj.user_position 
                            } : null 
                        };
                    }
                    return r;
                });
                return { ...p, routings: updatedRoutings };
            }
            return p;
        });

        // Use same endpoint to update sub-products routings
        await handleUpdateJO(jo.jo_id, { products: updatedProductsList });
        toast.success("Operator assigned to task step!");
    };

    // QA verify and complete step
    const handleVerifyQAForTask = async (jo: JobOrder, productId: number, routingId: number, qaStatus: "Passed" | "Pending") => {
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

    // Finalize JO Production Receipt (Multi-Product compliant)
    const handleSubmitFinishedReceipt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedJO) return;

        setSubmittingReceipt(true);
        try {
            const productsList = selectedJO.products && selectedJO.products.length > 0 ? selectedJO.products : [selectedJO];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const receiptPayloads: any[] = [];

            for (const p of productsList) {
                const prodId = Number(p.product_id);
                const catalogProduct = products.find(prod => Number(prod.product_id) === prodId);
                
                const payload = {
                    joId: selectedJO.jo_id,
                    productId: prodId,
                    productName: p.product_name,
                    quantityProduced: yieldQties[prodId] || p.quantity,
                    branchId: selectedJO.branch_id,
                    lotNumber: lotNumbers[prodId] || `MFG-${selectedJO.jo_id}-${prodId}`,
                    expirationDate: expiryDates[prodId] || new Date().toISOString().split("T")[0],
                    unitCost: catalogProduct?.cost_per_unit || 0,
                    componentsConsumed: p.allocationResults || p.allocation_results || p.components || []
                };

                
                const res = await fetch("/api/manufacturing/production/finished-goods", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || `Failed to submit finished goods receipt for ${p.product_name}.`);
                }
                
                receiptPayloads.push(payload);
            }

            toast.success(`Production receipt created for ${productsList.length} items! Yields pushed to FIFO inventory ledger.`);
            setCompletedReceipt(receiptPayloads);
            setSelectedJoId(null);
            loadData(); // reload all lists
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            toast.error(err.message || "Failed to finalize production.");
        } finally {
            setSubmittingReceipt(false);
        }
    };


    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">Loading Shop Floor Production Workspace...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* Left 1/3: Active Production Queue */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Cpu className="h-4.5 w-4.5 text-primary" />
                            Active Production Queue
                        </h3>
                        <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-primary/20">
                            {activeJOs.length} Active
                        </span>
                    </div>

                    <div className="space-y-3 max-h-[70dvh] overflow-y-auto pr-1">
                        {activeJOs.map(jo => {
                            const isSelected = selectedJoId === jo.jo_id;
                            
                            // Calculate step progress percentage
                            const productsList = jo.products && jo.products.length > 0 ? jo.products : [jo];
                            let totalSteps = 0;
                            let completedSteps = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                            productsList.forEach((p: any) => {
                                if (p.routings) {
                                    totalSteps += p.routings.length;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    completedSteps += p.routings.filter((r: any) => r.qa_status === "Passed").length;
                                }
                            });
                            const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                            return (
                                <button
                                    key={jo.jo_id}
                                    onClick={() => setSelectedJoId(jo.jo_id)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-3 cursor-pointer shadow-xs ${
                                        isSelected 
                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                            : "border-slate-800 bg-card hover:bg-slate-900/30"
                                    }`}
                                >
                                    <div className="flex justify-between items-start w-full">
                                        <div>
                                            <span className="font-extrabold text-foreground text-xs">{jo.jo_id}</span>
                                            <h4 className="text-[11px] font-bold text-foreground truncate max-w-[200px] mt-0.5">
                                                {jo.product_name}
                                            </h4>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                            jo.status === "Ongoing"
                                                ? "bg-sky-500/15 text-sky-500 border-sky-500/25"
                                                : jo.status === "Proceed"
                                                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/25"
                                                : "bg-amber-500/15 text-amber-500 border-amber-500/25"
                                        }`}>
                                            {jo.status === "Proceed" ? "Ready" : jo.status}
                                        </span>
                                    </div>

                                    {/* Progress meter */}
                                    <div className="w-full space-y-1.5 text-[10px]">
                                        <div className="flex justify-between text-muted-foreground font-semibold">
                                            <span>Route Steps Progress</span>
                                            <span>{completedSteps} / {totalSteps} Passed ({progressPercent}%)</span>
                                        </div>
                                        <div className="w-full bg-slate-850 rounded-full h-1.5 overflow-hidden">
                                            <div 
                                                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Footer details */}
                                    <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-slate-850">
                                        <span className="font-semibold text-foreground">{jo.quantity} PCS</span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5" /> Due: {jo.due_date}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}

                        {activeJOs.length === 0 && (
                            <div className="p-8 text-center border border-dashed rounded-xl bg-card">
                                <Cpu className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                                <span className="text-[11px] text-muted-foreground block">No ongoing production runs found.</span>
                                <span className="text-[9px] text-muted-foreground/60 block mt-1">Start workflow on job orders inside Operations Planning module.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right 2/3: Selected Workflow Operator Station */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedJO ? (
                        <div className="border border-slate-800 rounded-xl bg-card p-6 shadow-sm space-y-6 max-h-[75dvh] overflow-y-auto pr-2">
                            
                            {/* Card Header & Start Production Toggle */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-foreground text-sm">{selectedJO.jo_id}</span>
                                        <span className="text-[10px] text-muted-foreground font-semibold">Ref SO: {selectedJO.order_no}</span>
                                    </div>
                                    <h3 className="text-xs font-bold text-foreground mt-0.5">{selectedJO.product_name} ({selectedJO.quantity} PCS)</h3>
                                </div>

                                <div className="flex items-center gap-2">
                                    {selectedJO.status === "Proceed" && (
                                        <button
                                            onClick={() => handleUpdateJO(selectedJO.jo_id, { status: "Ongoing" })}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm border-none cursor-pointer flex items-center gap-1.5"
                                        >
                                            <Play className="h-3.5 w-3.5" /> Start Production Workflow
                                        </button>
                                    )}

                                    {selectedJO.status === "Ongoing" && (
                                        <button
                                            onClick={() => handleUpdateJO(selectedJO.jo_id, { status: "On Hold" })}
                                            className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm border-none cursor-pointer"
                                        >
                                            Pause / Hold
                                        </button>
                                    )}

                                    {selectedJO.status === "On Hold" && (
                                        <button
                                            onClick={() => handleUpdateJO(selectedJO.jo_id, { status: "Ongoing" })}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm border-none cursor-pointer"
                                        >
                                            Resume Production
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Job Order Routing steps timeline */}
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold uppercase text-muted-foreground block">
                                    Step Sequence Operations
                                </h4>

                                <div className="relative pl-4 border-l-2 border-primary/20 space-y-4">
                                    {(() => {
                                        const productsList = selectedJO.products && selectedJO.products.length > 0 ? selectedJO.products : [selectedJO];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        return productsList.flatMap((p: any) => {
                                            if (!p.routings) return [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            return p.routings.map((rout: any) => {
                                                const stepHours = (Number(rout.duration_hours) || 0) * Number(p.quantity);
                                                const isCompleted = rout.qa_status === "Passed";

                                                return (
                                                    <div key={rout.routing_id} className="relative space-y-2 bg-slate-950/20 border border-slate-800/60 rounded-lg p-4">
                                                        {/* Step indicator dot */}
                                                        <div className={`absolute -left-[22px] top-5 h-3.5 w-3.5 rounded-full border border-card flex items-center justify-center ${
                                                            isCompleted ? "bg-emerald-500 text-card" : "bg-slate-800"
                                                        }`}>
                                                            {isCompleted && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                                                        </div>

                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between font-bold text-foreground">
                                                                <span>Step {rout.sequence_order}: {rout.operation_name}</span>
                                                                <span className="text-muted-foreground">{stepHours.toFixed(1)} hrs total ({rout.duration_hours} hrs/unit)</span>
                                                            </div>

                                                            {/* Operator selection/display block */}
                                                            {selectedJO.status === "Ongoing" && !isCompleted ? (
                                                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-850">
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Assign Operator:</span>
                                                                    <select
                                                                        className="bg-background border rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                        value={rout.assigned_personnel?.id?.toString() || ""}
                                                                        onChange={(e) => handleAssignPersonnelToTask(selectedJO, p.product_id, rout.routing_id, e.target.value)}
                                                                    >
                                                                        <option value="">-- Choose Operator --</option>
                                                                        {users.map(u => (
                                                                            <option key={u.user_id} value={u.user_id}>{u.user_fname} {u.user_lname} ({u.user_position})</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] mt-2 pt-2 border-t border-slate-850 text-muted-foreground font-semibold flex items-center gap-1.5">
                                                                    <span>Assigned Worker:</span>
                                                                    {rout.assigned_personnel ? (
                                                                        <span className="bg-slate-800 text-foreground border border-slate-700 text-[9px] px-2 py-0.5 rounded">
                                                                            {rout.assigned_personnel.name} ({rout.assigned_personnel.position})
                                                                        </span>
                                                                    ) : (
                                                                        <span className="italic text-muted-foreground/50">None</span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Task status & QA verify button */}
                                                            {selectedJO.status === "Ongoing" && (
                                                                <div className="flex items-center justify-between border-t border-slate-850 pt-2 mt-2">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Task QA:</span>
                                                                        {isCompleted ? (
                                                                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 text-[9px] font-extrabold px-2 py-0.5 rounded border border-emerald-500/20 uppercase">
                                                                                <CheckCircle className="h-2.5 w-2.5" /> Passed
                                                                            </span>
                                                                        ) : (
                                                                            <span className="bg-amber-500/10 text-amber-600 text-[9px] font-extrabold px-2 py-0.5 rounded border border-amber-500/20 uppercase">
                                                                                Awaiting Completion
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {!isCompleted ? (
                                                                        <button
                                                                            onClick={() => handleVerifyQAForTask(selectedJO, p.product_id, rout.routing_id, "Passed")}
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold px-2 py-1 rounded shadow-sm border-none cursor-pointer flex items-center gap-1"
                                                                        >
                                                                            <CheckCircle className="h-2.5 w-2.5" /> QA Pass & Complete Step
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleVerifyQAForTask(selectedJO, p.product_id, rout.routing_id, "Pending")}
                                                                            className="bg-slate-800 hover:bg-slate-750 text-muted-foreground hover:text-foreground text-[9px] font-bold px-2 py-1 rounded border border-slate-700 cursor-pointer flex items-center gap-1"
                                                                        >
                                                                            Reset Step
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* Finalize finished goods panel (When all QA steps passed) */}
                            {(() => {
                                const productsList = selectedJO.products && selectedJO.products.length > 0 ? selectedJO.products : [selectedJO];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const allStepsCompleted = productsList.every((p: any) => 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    p.routings && p.routings.length > 0 && p.routings.every((r: any) => r.qa_status === "Passed")
                                );

                                if (!allStepsCompleted) {
                                    return (
                                        <div className="bg-slate-900/50 border border-slate-850 p-4 rounded-xl text-xs text-muted-foreground italic flex items-center gap-2">
                                            <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                                            <span>Completing all routing operations will unlock the final Finished Goods Receipt panel to pass items to stock.</span>
                                        </div>
                                    );
                                }

                                return (
                                    <form onSubmit={handleSubmitFinishedReceipt} className="bg-slate-950/40 border border-primary/20 rounded-xl p-5 space-y-4">
                                        <div className="border-b border-slate-850 pb-2">
                                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                                <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 animate-pulse" />
                                                Finalize Production Receipt (job_order_finished_goods)
                                            </h4>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                Generate the final yield batch for each product to increment branch inventory and close the Job Order.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {productsList.map((p: any) => {
                                                const prodId = Number(p.product_id);
                                                return (
                                                    <div key={prodId} className="border border-slate-850/70 bg-slate-900/10 p-4 rounded-xl space-y-3">
                                                        <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                                                            <span className="text-xs font-extrabold text-foreground">{p.product_name}</span>
                                                            <span className="text-[10px] text-muted-foreground bg-slate-800 px-2 py-0.5 rounded font-mono">ID: {prodId}</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                                            <div className="space-y-1">
                                                                <label className="text-muted-foreground font-bold block uppercase text-[9px]">Final Yield Qty (PCS)</label>
                                                                <input 
                                                                    type="number"
                                                                    value={yieldQties[prodId] || 0}
                                                                    onChange={e => setYieldQties(prev => ({ ...prev, [prodId]: Math.max(1, Number(e.target.value)) }))}
                                                                    required
                                                                    className="w-full bg-background border border-slate-800 rounded px-2.5 py-1 text-xs text-foreground font-bold focus:ring-1 focus:ring-primary outline-none"
                                                                />
                                                            </div>

                                                            <div className="space-y-1">
                                                                <label className="text-muted-foreground font-bold block uppercase text-[9px]">Lot Batch Number</label>
                                                                <input 
                                                                    type="text"
                                                                    value={lotNumbers[prodId] || ""}
                                                                    onChange={e => setLotNumbers(prev => ({ ...prev, [prodId]: e.target.value }))}
                                                                    required
                                                                    className="w-full bg-background border border-slate-800 rounded px-2.5 py-1 text-xs text-foreground font-bold focus:ring-1 focus:ring-primary outline-none"
                                                                />
                                                            </div>

                                                            <div className="space-y-1">
                                                                <label className="text-muted-foreground font-bold block uppercase text-[9px]">Computed Expiry Date</label>
                                                                <input 
                                                                    type="date"
                                                                    value={expiryDates[prodId] || ""}
                                                                    onChange={e => setExpiryDates(prev => ({ ...prev, [prodId]: e.target.value }))}
                                                                    required
                                                                    className="w-full bg-background border border-slate-800 rounded px-2.5 py-1 text-xs text-foreground font-bold focus:ring-1 focus:ring-primary outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submittingReceipt}
                                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-sm border-none transition-all cursor-pointer"
                                        >
                                            {submittingReceipt ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Generating Receipts...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="h-4 w-4" />
                                                    Complete Production & Pass All Products to Stock
                                                </>
                                            )}
                                        </button>
                                    </form>
                                );

                            })()}

                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center border border-slate-800 rounded-xl bg-card p-20 text-center space-y-4 shadow-xs">
                            <Cpu className="h-12 w-12 text-muted-foreground/35 animate-pulse" />
                            <div>
                                <h4 className="text-xs font-bold text-foreground">Select a Job Order</h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">Choose an active production run from the left panel to open the operator check-in station.</p>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Printable Receipt Dialog overlay */}
            {completedReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
                    <div className="bg-card border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Production Completed</h3>
                            </div>
                            <button 
                                onClick={() => setCompletedReceipt(null)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-850 border-none bg-transparent cursor-pointer"
                            >
                                <X className="h-4.5 w-4.5" />
                            </button>
                        </div>

                        {/* Body Summary (Multi-Product view) */}
                        <div className="p-6 space-y-4 text-xs text-foreground">
                            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-center">
                                <span className="text-[10px] text-emerald-500 font-extrabold uppercase tracking-widest block">POSTED TO STOCK LEDGER</span>
                                <span className="text-lg font-black text-white">{completedReceipt.length} Products Completed</span>
                                <span className="text-[10px] text-muted-foreground block">JO Ref: {completedReceipt[0]?.joId} • Destination Branch: {completedReceipt[0]?.branchId}</span>
                            </div>

                            <div className="space-y-2 max-h-[200px] overflow-y-auto border border-slate-850 rounded-xl p-3 bg-slate-950/30">
{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {completedReceipt.map((receipt: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-850/50 last:border-b-0">
                                        <div>
                                            <span className="font-bold block text-foreground truncate max-w-[280px]">{receipt.productName}</span>
                                            <span className="text-[9px] text-muted-foreground">Lot: {receipt.lotNumber} • Exp: {receipt.expirationDate}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-emerald-500 font-extrabold block text-xs">{receipt.quantityProduced.toLocaleString()} PCS</span>
                                            <span className="text-[9px] text-muted-foreground/60">₱{receipt.unitCost.toFixed(2)}/u</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer Options */}
                        <div className="border-t border-slate-800 px-6 py-4 flex gap-3 bg-slate-950/20">
                            <button
                                onClick={() => setCompletedReceipt(null)}
                                className="flex-1 py-2 text-xs font-bold text-muted-foreground hover:text-foreground rounded-lg hover:bg-slate-850 border border-slate-800 bg-transparent transition-all cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => handlePrintReceipt(completedReceipt)}
                                className="flex-1 py-2 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg border-none transition-all cursor-pointer shadow-md shadow-emerald-950/30"
                            >
                                <Printer className="h-4 w-4" />
                                Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

