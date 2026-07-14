/* eslint-disable */
import React, { useState, useEffect, useCallback } from "react";
import {
    User,
    Clock,
    DollarSign,
    AlertTriangle,
    ClipboardCheck,
    Printer
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RoutingTask, JobOrder, User as UserType, RouteOperatorRecord } from "../types";
import { submitShiftRunLog, ShiftRunLogPayload } from "../services/production-api";
import { toast } from "sonner";

interface JobOrderShiftLogModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedJobOrder: JobOrder;
    sortedTasks: RoutingTask[];
    activeStep: RoutingTask | null;
    users: UserType[];
    allJobOperators: RouteOperatorRecord[];
    onSuccess?: () => void;
}

export function JobOrderShiftLogModal({
    open,
    onOpenChange,
    selectedJobOrder,
    sortedTasks,
    activeStep,
    users,
    allJobOperators,
    onSuccess
}: JobOrderShiftLogModalProps) {
    const [shiftName, setShiftName] = useState("Shift 1 - Day");
    const [productionDay, setProductionDay] = useState("1");
    const [shiftYieldQty, setShiftYieldQty] = useState("");
    const [shiftQAStatus, setShiftQAStatus] = useState<"Passed" | "QA Hold" | "Pending">("Pending");
    const [shiftMaterials, setShiftMaterials] = useState<any[]>([]);
    const [submittingShiftLog, setSubmittingShiftLog] = useState(false);
    const [insufficiencyError, setInsufficiencyError] = useState<string | null>(null);
    const [isInsufficiencyOpen, setIsInsufficiencyOpen] = useState(false);

    const totalPlannedHours = selectedJobOrder?.routing_tasks 
        ? selectedJobOrder.routing_tasks.reduce((sum, t) => sum + Number(t.planned_setup_hours || 0) + Number(t.planned_run_hours || 0), 0)
        : 0;
    const shiftHours = Number(selectedJobOrder?.shiftOption || 8);
    const estDays = Math.ceil(totalPlannedHours / shiftHours) || 1;

    const getUserLabel = (uId: number) => {
        const u = users.find((x) => (x.user_id || x.id) === uId);
        if (!u) return `Operator #${uId}`;
        const fname = u.user_fname || u.first_name || "";
        const lname = u.user_lname || u.last_name || "";
        return `${fname} ${lname}`.trim() || `User #${uId}`;
    };

    const getAvailableShifts = useCallback(() => {
        const hours = Number(selectedJobOrder?.shiftOption || 8);
        const options = [];
        if (hours > 0) {
            options.push({ value: "Shift 1 - Day", label: "Shift 1 - Day (6AM - 2PM)" });
        }
        if (hours > 8) {
            options.push({ value: "Shift 2 - Swing", label: "Shift 2 - Swing (2PM - 10PM)" });
        }
        if (hours > 16) {
            options.push({ value: "Shift 3 - Night", label: "Shift 3 - Night (10PM - 6AM)" });
        }
        options.push({ value: "Daily Summary", label: "Daily Summary / Continuous Run" });
        return options;
    }, [selectedJobOrder]);

    // Fetch full Job Order BOM materials when shift log modal opens
    useEffect(() => {
        if (open && selectedJobOrder && selectedJobOrder.order_id) {
            setShiftYieldQty("");
            setShiftQAStatus("Pending");
            setProductionDay("1");

            const available = getAvailableShifts();
            if (available.length > 0) {
                setShiftName(available[0].value);
            }

            // Fetch all BOM materials for the whole Job Order
            fetch(`/api/manufacturing/planning-engineering?action=job-materials&joId=${selectedJobOrder.order_id}&_t=${Date.now()}`)
                .then((res) => res.json())
                .then((data) => {
                    setShiftMaterials(data.map((m: any) => ({
                        ...m,
                        actual_qty: "0"
                    })));
                })
                .catch((err) => console.error("Error loading Job BOM materials for shift log:", err));
        }
    }, [open, selectedJobOrder, getAvailableShifts]);

    const groupedJobOperators = React.useMemo(() => {
        const groups: Record<number, {
            user_id: number;
            user_position: string;
            hourly_rate: number;
            total_logged_hours: number;
            is_running: boolean;
            active_session: any | null;
            latest_session: any;
            all_sessions: any[];
        }> = {};

        allJobOperators.forEach((op: any) => {
            const userId = op.user_id;
            const isRunning = op.started_at !== null && op.stopped_at === null;
            const hours = Number(op.actual_hours || 0);

            if (!groups[userId]) {
                groups[userId] = {
                    user_id: userId,
                    user_position: op.user_position || "",
                    hourly_rate: Number(op.hourly_rate || 150),
                    total_logged_hours: 0,
                    is_running: false,
                    active_session: null,
                    latest_session: op,
                    all_sessions: []
                };
            }

            const g = groups[userId];
            g.all_sessions.push(op);
            g.total_logged_hours += hours;

            if (isRunning) {
                g.is_running = true;
                g.active_session = op;
            }

            if (op.id > g.latest_session.id) {
                g.latest_session = op;
            }
        });

        return Object.values(groups);
    }, [allJobOperators]);

    const handleShiftYieldChange = (val: string) => {
        setShiftYieldQty(val);
        const qtyNum = Number(val) || 0;
        
        setShiftMaterials((prev) =>
            prev.map((m) => {
                const stdQty = Number(m.allocated_quantity || 0) / (Number(selectedJobOrder.quantity) || 1);
                const computed = stdQty * qtyNum;
                return {
                    ...m,
                    actual_qty: computed > 0 ? computed.toFixed(2) : "0"
                };
            })
        );
    };

    const handleShiftLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shiftYieldQty || Number(shiftYieldQty) <= 0) {
            toast.error("Please enter a valid yield quantity.");
            return;
        }

        setSubmittingShiftLog(true);
        try {
            const activeUser = allJobOperators.find(o => o.stopped_at === null);
            const fullShiftName = `Day ${productionDay} - ${shiftName}`;
            
            // Resolve which taskId to post under (use current active step, or the last sequence step)
            const targetTaskId = activeStep?.id || (sortedTasks.length > 0 ? sortedTasks[sortedTasks.length - 1].id : 0);

            const payload: ShiftRunLogPayload = {
                taskId: targetTaskId,
                joId: selectedJobOrder.order_id || 0,
                shiftName: fullShiftName,
                yieldQty: Number(shiftYieldQty),
                inspectorId: activeUser ? activeUser.user_id : null,
                qaStatus: "Pending",
                qaParameters: [],
                materialsConsumed: shiftMaterials.map((m) => ({
                    product_id: m.product_id,
                    actual_qty: Number(m.actual_qty || 0)
                }))
            };

            const res = await submitShiftRunLog(payload);
            if (res.success) {
                toast.success(`Shift closed successfully for ${fullShiftName}! Yield and materials inventory reconciled.`);
                onOpenChange(false);
                if (onSuccess) onSuccess();
            } else {
                if (res.isShortfall && res.error) {
                    setInsufficiencyError(res.error);
                    setIsInsufficiencyOpen(true);
                } else {
                    toast.error(res.error || "Failed to log shift run.");
                }
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to submit shift log.");
        } finally {
            setSubmittingShiftLog(false);
        }
    };

    const handlePrintShiftReport = () => {
        const fullShiftName = `Day ${productionDay} - ${shiftName}`;
        
        const operatorsHtml = groupedJobOperators.length === 0 
            ? "<tr><td colspan='2' style='text-align: center; font-style: italic; padding: 12px;'>No personnel logged on this shift.</td></tr>"
            : groupedJobOperators.map(op => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 13px;">${getUserLabel(op.user_id)}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; color: #555; font-size: 13px;">${op.user_position || "Shop Floor Tech"}</td>
                </tr>
            `).join("");

        const materialsHtml = shiftMaterials.length === 0
            ? "<tr><td colspan='4' style='text-align: center; font-style: italic; padding: 12px;'>No raw materials consumed.</td></tr>"
            : shiftMaterials.map(m => {
                const stdQty = Number(m.allocated_quantity || 0) / (Number(selectedJobOrder.quantity) || 1);
                const theoretical = stdQty * (Number(shiftYieldQty) || 0);
                const actual = Number(m.actual_qty || 0);
                const deviation = actual - theoretical;
                return `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; font-size: 13px;">${m.product_name}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; text-align: right; font-size: 13px;">${theoretical.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; text-align: right; font-weight: bold; font-size: 13px;">${actual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; text-align: right; color: ${deviation > 0 ? '#d9534f' : '#5cb85c'}; font-weight: bold; font-size: 13px;">${deviation > 0 ? '+' : ''}${deviation.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                `;
            }).join("");

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
            <head>
                <title>Shift Closure Report - JO #${selectedJobOrder.order_no || selectedJobOrder.jo_id}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        padding: 40px;
                        color: #222;
                        line-height: 1.5;
                    }
                    .header {
                        border-bottom: 2px solid #222;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                    }
                    .header h1 {
                        margin: 0 0 5px 0;
                        font-size: 26px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        font-weight: 800;
                    }
                    .header p {
                        margin: 0;
                        color: #666;
                        font-size: 13px;
                    }
                    .meta-grid {
                        display: grid;
                        grid-template-cols: 1.2fr 1fr;
                        gap: 20px;
                        margin-bottom: 30px;
                        background: #fcfcfc;
                        padding: 18px 24px;
                        border-radius: 8px;
                        border: 1px solid #e2e8f0;
                    }
                    .meta-item {
                        font-size: 14px;
                        line-height: 1.8;
                    }
                    .meta-item span {
                        font-weight: 600;
                        color: #4a5568;
                    }
                    .section-title {
                        font-size: 14px;
                        font-weight: 800;
                        text-transform: uppercase;
                        margin-top: 35px;
                        margin-bottom: 12px;
                        border-bottom: 1.5px solid #2d3748;
                        padding-bottom: 6px;
                        letter-spacing: 0.5px;
                        color: #2d3748;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 13px;
                        margin-bottom: 20px;
                    }
                    th {
                        background: #f7fafc;
                        text-align: left;
                        padding: 10px;
                        font-weight: 700;
                        border-bottom: 2px solid #e2e8f0;
                        text-transform: uppercase;
                        font-size: 11px;
                        color: #4a5568;
                        letter-spacing: 0.5px;
                    }
                    .footer {
                        margin-top: 80px;
                        display: grid;
                        grid-template-cols: 1fr 1fr;
                        gap: 50px;
                        font-size: 12px;
                    }
                    .sig-line {
                        margin-top: 50px;
                        border-top: 1.5px solid #a0aec0;
                        text-align: center;
                        padding-top: 6px;
                        font-weight: 600;
                        color: #4a5568;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Shift Run closure report</h1>
                    <p>Logged via Antigravity Manufacturing Management System</p>
                </div>
                
                <div class="meta-grid">
                    <div class="meta-item">
                        <div><span>Job Order No:</span> ${selectedJobOrder.order_no || `JO #${selectedJobOrder.jo_id}`}</div>
                        <div><span>Product Name:</span> ${selectedJobOrder.product_name}</div>
                    </div>
                    <div class="meta-item">
                        <div><span>Shift / Run Closing:</span> ${fullShiftName}</div>
                        <div><span>Yield Produced:</span> <strong style="font-size: 16px; color: #1a202c;">${Number(shiftYieldQty).toLocaleString()} pcs</strong></div>
                        <div><span>Date Printed:</span> ${new Date().toLocaleString()}</div>
                    </div>
                </div>

                <div class="section-title">Personnel Present for Shift (Whole Job Order)</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Name</th>
                            <th style="width: 50%;">Position / Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${operatorsHtml}
                    </tbody>
                </table>

                <div class="section-title">Raw Materials Reconciled Consumption</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40%;">Material Name</th>
                            <th style="width: 20%; text-align: right;">Theoretical Qty</th>
                            <th style="width: 20%; text-align: right;">Actual Consumed</th>
                            <th style="width: 20%; text-align: right;">Deviation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${materialsHtml}
                    </tbody>
                </table>

                <div class="footer">
                    <div>
                        <div class="sig-line">Operator Signature</div>
                    </div>
                    <div>
                        <div class="sig-line">Supervisor Authorization / Sign-Off</div>
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

    const hasInsufficiency = shiftMaterials.some(m => Number(m.actual_qty || 0) > Number(m.available_stock || 0));
    const isSubmitDisabled = submittingShiftLog || hasInsufficiency || !shiftYieldQty || Number(shiftYieldQty) <= 0 || !shiftName.trim();
    const isPrintDisabled = hasInsufficiency || !shiftYieldQty || Number(shiftYieldQty) <= 0 || !shiftName.trim();

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[1000px] bg-background border border-border/60 shadow-2xl rounded-2xl p-0 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-background p-6 border-b border-border/50">
                        <DialogHeader>
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                    <ClipboardCheck className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="font-bold text-lg tracking-tight text-foreground">
                                        End-of-Shift & Daily Run Closure
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                                        Verify shift parameters, reconcile material lot consumption ratios, and authorize quality release for Job Order #{selectedJobOrder?.order_no || selectedJobOrder?.jo_id}.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <form onSubmit={handleShiftLogSubmit} className="p-6 space-y-6 text-xs">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-6 space-y-5">
                                <div className="bg-muted/30 border border-border/80 rounded-xl p-4 space-y-4">
                                    <h4 className="font-bold text-foreground/90 uppercase tracking-wider text-[10px]">
                                        Shift Yield Metrics
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="productionDay" className="text-muted-foreground font-semibold">Production Day</Label>
                                            <select
                                                id="productionDay"
                                                value={productionDay}
                                                onChange={(e) => setProductionDay(e.target.value)}
                                                className="flex h-9 w-full rounded-lg border border-input bg-background text-foreground px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200"
                                            >
                                                {Array.from({ length: estDays }).map((_, i) => (
                                                    <option key={i + 1} value={i + 1}>Day {i + 1}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="shiftName" className="text-muted-foreground font-semibold">Shift Name</Label>
                                            <Input
                                                id="shiftName"
                                                type="text"
                                                value={shiftName}
                                                onChange={(e) => setShiftName(e.target.value)}
                                                className="h-9 bg-background border-input text-foreground text-xs focus-visible:ring-primary transition-all duration-200"
                                                placeholder="e.g. Shift A"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="shiftYield" className="text-muted-foreground font-semibold font-mono">Yield (pcs)</Label>
                                            <Input
                                                id="shiftYield"
                                                type="number"
                                                value={shiftYieldQty}
                                                onChange={(e) => handleShiftYieldChange(e.target.value)}
                                                className="h-9 bg-background border-input text-foreground text-xs font-bold font-mono focus-visible:ring-primary transition-all duration-200"
                                                placeholder="e.g. 15000"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-muted/30 border border-border/80 rounded-xl p-4 space-y-3">
                                    <h4 className="font-bold text-foreground/90 uppercase tracking-wider text-[10px]">
                                        Personnel Present for Shift (Whole Job Order)
                                    </h4>
                                    {groupedJobOperators.length === 0 ? (
                                        <div className="p-3 bg-background/50 rounded-lg text-muted-foreground text-center italic border border-border/50">
                                            No personnel logged on this shift.
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                            {groupedJobOperators.map((op) => (
                                                <div key={op.user_id} className="flex items-center justify-between p-2 bg-background border border-border rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1 bg-primary/10 rounded-md text-primary">
                                                            <User className="h-3.5 w-3.5" />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-foreground block text-xs">{getUserLabel(op.user_id)}</span>
                                                            <span className="text-[10px] text-muted-foreground block">{op.user_position || "Shop Floor Tech"}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="lg:col-span-6 space-y-5">
                                <div className="bg-muted/30 border border-border/80 rounded-xl p-4 space-y-4 h-full flex flex-col">
                                    <h4 className="font-bold text-foreground/90 uppercase tracking-wider text-[10px]">
                                        Raw Material Consumption Reconciliation
                                    </h4>

                                    {shiftMaterials.length === 0 ? (
                                        <div className="p-4 bg-background/50 rounded-lg text-muted-foreground text-center italic border border-border/50 flex-1 flex items-center justify-center">
                                            No raw materials pre-allocated for this workstation.
                                        </div>
                                    ) : (
                                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px] pr-1">
                                            {shiftMaterials.map((m, index) => {
                                                const stdQty = Number(m.allocated_quantity || 0) / (Number(selectedJobOrder.quantity) || 1);
                                                const theoretical = stdQty * (Number(shiftYieldQty) || 0);
                                                const actual = Number(m.actual_qty || 0);
                                                const deviationPercent = theoretical > 0 
                                                    ? Math.min(Math.max((actual / theoretical) * 100, 0), 200) 
                                                    : 100;
                                                const isExceeded = actual > theoretical * 1.05;
                                                const isInsufficient = actual > Number(m.available_stock || 0);

                                                return (
                                                    <div key={m.jo_material_id || m.id || index} className="p-3 bg-background rounded-lg border border-border/80 space-y-2">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-foreground truncate max-w-[200px]" title={m.product_name}>
                                                                    {m.product_name}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                                                    Available Stock: <strong className={isInsufficient ? "text-red-500 font-bold" : "text-foreground font-mono font-bold"}>{Number(m.available_stock || 0).toLocaleString()} {m.unit_shortcut}</strong>
                                                                </span>
                                                            </div>
                                                            <Badge
                                                                variant="outline"
                                                                className={`font-semibold text-[10px] px-1.5 py-0 ${
                                                                    isInsufficient
                                                                        ? "bg-red-500/10 text-red-600 border-red-500/20"
                                                                        : isExceeded 
                                                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                                                                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                                                }`}
                                                            >
                                                                {isInsufficient ? "Insufficient Stock" : isExceeded ? "Over-consumed" : "Normal Ratio"}
                                                            </Badge>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4 text-[11px] pt-1">
                                                            <div>
                                                                <span className="text-muted-foreground block text-[10px]">Theoretical Std Allocation</span>
                                                                <span className="font-bold text-foreground/80 font-mono">
                                                                    {theoretical.toFixed(2)} {m.unit_shortcut}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-muted-foreground block text-[10px]">Actual Consumed Log</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={m.actual_qty}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setShiftMaterials((prev) =>
                                                                                prev.map((item, idx) => idx === index ? { ...item, actual_qty: val } : item)
                                                                            );
                                                                        }}
                                                                        className={`h-6 w-20 text-right bg-background border-input px-1 py-0.5 font-bold font-mono text-[11px] ${
                                                                            isInsufficient ? "border-red-500 text-red-500 focus-visible:ring-red-500 font-bold" : ""
                                                                        }`}
                                                                    />
                                                                    <span className="text-muted-foreground font-medium">{m.unit_shortcut}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {theoretical > 0 && (
                                                            <div className="space-y-1 pt-1">
                                                                <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                                                                    <span>Standard Variance Threshold Limit</span>
                                                                    <span className={isExceeded ? "text-red-500 font-bold" : "text-emerald-500 font-bold"}>
                                                                        {deviationPercent.toFixed(0)}%
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full transition-all duration-300 ${
                                                                            isInsufficient ? "bg-red-500" : isExceeded ? "bg-red-500" : "bg-emerald-500"
                                                                        }`}
                                                                        style={{ width: `${deviationPercent}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t border-border/50 gap-2 flex items-center justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isPrintDisabled}
                                onClick={handlePrintShiftReport}
                                className="border-border hover:bg-muted text-foreground h-9 text-xs font-semibold px-4 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50"
                            >
                                <Printer className="h-4 w-4" /> Print Report
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="border-border hover:bg-muted text-foreground h-9 text-xs font-semibold px-4 transition-all duration-200"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitDisabled}
                                className="bg-primary hover:bg-primary/95 text-white font-bold h-9 text-xs px-5 shadow-md shadow-primary/10 hover:shadow-primary/20 transition-all duration-200 disabled:opacity-50"
                            >
                                {submittingShiftLog ? "Submitting Logs..." : "Submit & Reconcile Inventory"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isInsufficiencyOpen} onOpenChange={setIsInsufficiencyOpen}>
                <DialogContent className="sm:max-w-[480px] bg-background border border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
                    <div className="bg-red-500/10 dark:bg-red-950/20 p-5 border-b border-red-500/10">
                        <DialogHeader>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                <DialogTitle className="font-black text-base text-red-600 dark:text-red-400 tracking-tight">
                                    Ingredient Stock Shortfall Warning
                                </DialogTitle>
                            </div>
                            <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                                Raw materials in inventory are insufficient to balance standard yield consumption ratios.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-6 space-y-4 text-xs">
                        <div className="p-3 bg-red-500/5 dark:bg-red-950/10 border border-red-500/10 rounded-lg text-red-700 dark:text-red-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                            {insufficiencyError}
                        </div>
                        <p className="text-muted-foreground leading-normal">
                            Inventory quantities cannot go negative. Please consult your production supervisor or log an emergency stock adjustment to sync stock levels before reconciling.
                        </p>
                    </div>

                    <DialogFooter className="p-4 bg-muted/30 border-t border-border/50 gap-2 flex items-center justify-end">
                        <Button
                            onClick={() => setIsInsufficiencyOpen(false)}
                            className="bg-primary hover:bg-primary/95 text-white font-bold h-9 text-xs px-5 shadow-sm"
                        >
                            Acknowledge
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
