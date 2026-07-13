/* eslint-disable */
import React from "react";
import { ClipboardCheck, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RoutingTask, JobOrder, User, RouteOperatorRecord, QATemplate, QATemplateParameter } from "../types";

interface QAChecklistModalProps {
    qaModalOpen: boolean;
    setQaModalOpen: (val: boolean) => void;
    selectedTask: RoutingTask | null;
    selectedJobOrder: JobOrder | null;
    users: User[];
    routeOperators: RouteOperatorRecord[];
    qaTemplate: QATemplate | null;
    qaParameters: QATemplateParameter[];
    qaValues: Record<number, string>;
    setQaValues: (val: Record<number, string>) => void;
    qaInspectorId: string;
    setQaInspectorId: (val: string) => void;
    qaYieldQty: string;
    setQaYieldQty: (val: string) => void;
    qaComments: string;
    setQaComments: (val: string) => void;
    submittingQA: boolean;
    handleSubmitQA: (e: React.FormEvent) => void;
}

export function QAChecklistModal({
    qaModalOpen,
    setQaModalOpen,
    selectedTask,
    selectedJobOrder,
    users,
    routeOperators,
    qaTemplate,
    qaParameters,
    qaValues,
    setQaValues,
    qaInspectorId,
    setQaInspectorId,
    qaYieldQty,
    setQaYieldQty,
    qaComments,
    setQaComments,
    submittingQA,
    handleSubmitQA
}: QAChecklistModalProps) {
    const getUserLabel = (uId: number) => {
        const u = users.find((usr) => (usr.user_id || usr.id) === uId);
        if (!u) return `Operator #${uId}`;
        const fname = u.user_fname || u.first_name || "";
        const lname = u.user_lname || u.last_name || "";
        return `${fname} ${lname}`.trim() || `User #${uId}`;
    };

    return (
        <Dialog open={qaModalOpen} onOpenChange={setQaModalOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-amber-500" />
                        <span>Quality Assurance Gate: {selectedTask?.name}</span>
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Recipe template validation required. Fill out the inspection values. Failed critical checks will lock this Job Order.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmitQA} className="space-y-6 pt-2">
                    {/* Meta inspector field selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="qaInspector" className="font-semibold text-foreground">Inspected By</Label>
                            <select
                                id="qaInspector"
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={qaInspectorId}
                                onChange={(e) => setQaInspectorId(e.target.value)}
                            >
                                <option value="">Choose Inspector...</option>
                                {users.map((u) => (
                                    <option key={u.user_id || u.id} value={u.user_id || u.id}>
                                        {getUserLabel(u.user_id || u.id)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="qaYield" className="font-semibold text-foreground">Actual Yield / Processed Qty</Label>
                            <Input
                                id="qaYield"
                                type="number"
                                required
                                className="font-mono"
                                placeholder="Enter yield processed..."
                                value={qaYieldQty}
                                onChange={(e) => setQaYieldQty(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Parameter list loop */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold border-b pb-1.5 text-muted-foreground flex justify-between">
                            <span>RECIPE PARAMETERS AUDIT</span>
                            {qaTemplate && (
                                <span className="font-semibold text-primary">Template: {qaTemplate.template_name}</span>
                            )}
                        </h3>

                        <div className="space-y-4">
                            {qaParameters.map((param) => {
                                const val = qaValues[param.parameter_id] || "";
                                let isOutOfRange = false;

                                if (param.test_type === "Numeric" && val) {
                                    const num = parseFloat(val);
                                    if (!isNaN(num)) {
                                        if (param.min_value !== null && num < param.min_value) isOutOfRange = true;
                                        if (param.max_value !== null && num > param.max_value) isOutOfRange = true;
                                    }
                                }

                                return (
                                    <div key={param.parameter_id} className="p-4 border rounded-xl bg-muted/20 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                                    {param.test_name || param.parameter_name}
                                                    {param.is_critical && (
                                                        <Badge className="bg-destructive hover:bg-destructive text-white text-[9px] uppercase tracking-wide">
                                                            Critical Failure Lock
                                                        </Badge>
                                                    )}
                                                </h4>
                                                <span className="text-xs text-muted-foreground">
                                                    Type: <strong>{param.test_type}</strong>
                                                </span>
                                            </div>
                                            
                                            {/* Visual indicator badge inside item */}
                                            {val && (
                                                <Badge className={isOutOfRange ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}>
                                                    {isOutOfRange ? "OUT OF RANGE" : "IN RANGE / PASS"}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Dynamic input field depending on type */}
                                        {param.test_type === "Numeric" ? (
                                            <div className="space-y-1.5">
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    required
                                                    placeholder={`Target: ${param.target_value || "N/A"}`}
                                                    className="font-mono text-sm max-w-[200px]"
                                                    value={val}
                                                    onChange={(e) =>
                                                        setQaValues({
                                                            ...qaValues,
                                                            [param.parameter_id]: e.target.value
                                                        })
                                                    }
                                                />
                                                <span className="text-xs text-muted-foreground block font-medium">
                                                    Allowed Range limits: [{param.min_value ?? "-∞"} to {param.max_value ?? "+∞"}]
                                                </span>
                                            </div>
                                        ) : param.test_type === "Boolean" || param.test_type === "Yes/No" ? (
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-foreground">
                                                    <input
                                                        type="radio"
                                                        className="h-4 w-4 text-primary"
                                                        checked={val === "true"}
                                                        onChange={() =>
                                                            setQaValues({
                                                                ...qaValues,
                                                                [param.parameter_id]: "true"
                                                            })
                                                        }
                                                    />
                                                    Yes / Pass
                                                </label>
                                                <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-foreground">
                                                    <input
                                                        type="radio"
                                                        className="h-4 w-4 text-primary"
                                                        checked={val === "false"}
                                                        onChange={() =>
                                                            setQaValues({
                                                                ...qaValues,
                                                                [param.parameter_id]: "false"
                                                            })
                                                        }
                                                    />
                                                    No / Fail
                                                </label>
                                            </div>
                                        ) : (
                                            <Input
                                                type="text"
                                                required
                                                placeholder="Enter remarks value..."
                                                value={val}
                                                onChange={(e) =>
                                                    setQaValues({
                                                        ...qaValues,
                                                        [param.parameter_id]: e.target.value
                                                    })
                                                }
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* General Inspection Remarks comments */}
                    <div className="space-y-1.5">
                        <Label htmlFor="remarks" className="font-semibold text-foreground">Inspector Notes / Remarks</Label>
                        <Textarea
                            id="remarks"
                            placeholder="Enter general comments or details for the QA audit log file..."
                            className="min-h-[80px]"
                            value={qaComments}
                            onChange={(e) => setQaComments(e.target.value)}
                        />
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => setQaModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={submittingQA}
                            className="w-full sm:w-auto"
                        >
                            {submittingQA ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Submit QA Inspection
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
