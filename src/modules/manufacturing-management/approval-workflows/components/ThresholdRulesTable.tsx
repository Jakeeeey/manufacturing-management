"use client";

import React, { useState } from "react";
import { ThresholdRule } from "../types";
import { Sliders, Plus, Trash2, Edit, Check, X, ShieldAlert, Play, RefreshCw } from "lucide-react";

interface ThresholdRulesTableProps {
    rules: ThresholdRule[];
    onSaveRule: (rule: Partial<ThresholdRule>) => Promise<boolean>;
    onDeleteRule: (id: number) => Promise<boolean>;
    loading: boolean;
}

export function ThresholdRulesTable({
    rules,
    onSaveRule,
    onDeleteRule,
    loading
}: ThresholdRulesTableProps) {
    const [editingRule, setEditingRule] = useState<Partial<ThresholdRule> | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [simulatedMargin, setSimulatedMargin] = useState<string>("12");
    const [simulationResult, setSimulationResult] = useState<{
        triggered: boolean;
        rule?: ThresholdRule;
        message: string;
        actionClass: string;
    } | null>(null);

    // Form inputs state
    const [minMargin, setMinMargin] = useState<string>("");
    const [action, setAction] = useState<ThresholdRule["action"]>("require_approval");
    const [roleRequired, setRoleRequired] = useState<ThresholdRule["role_required"]>("Finance Manager");
    const [description, setDescription] = useState<string>("");
    const [isActive, setIsActive] = useState<boolean>(true);

    const handleOpenAdd = () => {
        setEditingRule(null);
        setMinMargin("");
        setAction("require_approval");
        setRoleRequired("Finance Manager");
        setDescription("");
        setIsActive(true);
        setShowModal(true);
    };

    const handleOpenEdit = (rule: ThresholdRule) => {
        setEditingRule(rule);
        setMinMargin(rule.min_margin.toString());
        setAction(rule.action);
        setRoleRequired(rule.role_required);
        setDescription(rule.description);
        setIsActive(rule.is_active);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const marginNum = parseFloat(minMargin);
        if (isNaN(marginNum) || marginNum < 0 || marginNum > 100) {
            alert("Please enter a valid margin percentage between 0 and 100.");
            return;
        }

        const payload: Partial<ThresholdRule> = {
            min_margin: marginNum,
            action,
            role_required: roleRequired,
            description,
            is_active: isActive
        };

        if (editingRule?.id) {
            payload.id = editingRule.id;
        }

        const success = await onSaveRule(payload);
        if (success) {
            setShowModal(false);
            setEditingRule(null);
        }
    };

    const handleToggleActive = async (rule: ThresholdRule) => {
        await onSaveRule({
            ...rule,
            is_active: !rule.is_active
        });
    };

    const handleRunSimulation = () => {
        const testMargin = parseFloat(simulatedMargin);
        if (isNaN(testMargin)) {
            setSimulationResult({
                triggered: false,
                message: "Please enter a valid numeric margin to test.",
                actionClass: "text-muted-foreground bg-muted/20"
            });
            return;
        }

        // Find the matching rules
        // Rules that are active and have min_margin greater than or equal to the test margin
        const activeRules = rules.filter(r => r.is_active);
        
        // Sort active rules in ascending order of min_margin to find the most strict limit triggered
        // e.g. if test margin is 8%, rules with min_margin 10% and 15% will trigger.
        // The most critical one is the one with highest min_margin or specific critical action.
        // Let's filter rules where testMargin < rule.min_margin
        const triggeredRules = activeRules
            .filter(r => testMargin < r.min_margin)
            .sort((a, b) => b.min_margin - a.min_margin); // highest margin threshold first

        if (triggeredRules.length === 0) {
            setSimulationResult({
                triggered: false,
                message: `Gross Margin of ${testMargin}% is within acceptable limits. No approvals required.`,
                actionClass: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200"
            });
            return;
        }

        // The most strict rule triggered (highest min_margin or auto_reject priority)
        // Auto-reject takes priority, then require_approval
        const rejectRule = triggeredRules.find(r => r.action === "auto_reject");
        const triggerRule = rejectRule || triggeredRules[0];

        let msg = "";
        let colorClass = "";

        if (triggerRule.action === "auto_reject") {
            msg = `CRITICAL ALERT: Margins below ${triggerRule.min_margin}% trigger AUTO-REJECTION. This order cannot be submitted.`;
            colorClass = "text-rose-700 bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200";
        } else if (triggerRule.action === "require_approval") {
            msg = `APPROVAL REQUIRED: Margins below ${triggerRule.min_margin}% trigger mandatory review. Required Role: ${triggerRule.role_required}.`;
            colorClass = "text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200";
        } else {
            msg = `WARNING FLAG: Margins below ${triggerRule.min_margin}% trigger a system alert but do not block submission.`;
            colorClass = "text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200";
        }

        setSimulationResult({
            triggered: true,
            rule: triggerRule,
            message: msg,
            actionClass: colorClass
        });
    };

    return (
        <div className="space-y-6">
            {/* Simulation Block */}
            <div className="rounded-xl border bg-card/60 p-5 shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Play className="size-5 text-indigo-500" />
                            Workflow Rules Simulator
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Test how different gross margin percentages trigger validation tiers and approval routing.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="w-full md:w-64">
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">
                            Simulated Gross Margin (%)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.1"
                                value={simulatedMargin}
                                onChange={(e) => setSimulatedMargin(e.target.value)}
                                className="w-full h-10 px-3 pr-10 border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="Enter margin e.g. 12"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                                %
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleRunSimulation}
                        className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                        Run Simulation
                    </button>
                </div>

                {simulationResult && (
                    <div className={`mt-4 p-4 rounded-lg border text-sm transition-all ${simulationResult.actionClass}`}>
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="size-5 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold">
                                    {simulationResult.triggered ? "Trigger Action Activated" : "Valid Status Clear"}
                                </p>
                                <p className="mt-1 text-xs opacity-90 leading-relaxed">
                                    {simulationResult.message}
                                </p>
                                {simulationResult.rule && (
                                    <div className="mt-2 text-[11px] font-mono opacity-80">
                                        Triggered Rule ID: {simulationResult.rule.id} | Limit: &lt; {simulationResult.rule.min_margin}%
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Rules Registry List */}
            <div className="rounded-xl border bg-card shadow-sm">
                <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="font-semibold text-lg flex items-center gap-2">
                            <Sliders className="size-5 text-primary" />
                            Validation Rules Registry
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Set up rules that intercept orders and route them to managers when gross margins fall below safety margins.
                        </p>
                    </div>

                    <button
                        onClick={handleOpenAdd}
                        disabled={loading}
                        className="px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow flex items-center justify-center gap-2 transition-colors shrink-0"
                    >
                        <Plus className="size-4" />
                        Add Rule Tier
                    </button>
                </div>

                {rules.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                        No threshold validation rules configured. Click Add Rule Tier to start.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    <th className="px-5 py-3">ID</th>
                                    <th className="px-5 py-3">Gross Margin Trigger</th>
                                    <th className="px-5 py-3">Action Type</th>
                                    <th className="px-5 py-3">Required Sign-Off</th>
                                    <th className="px-5 py-3">Description</th>
                                    <th className="px-5 py-3 text-center">Status</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {rules
                                    .sort((a, b) => b.min_margin - a.min_margin) // sort highest margins first
                                    .map((rule) => (
                                        <tr key={rule.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-5 py-4 font-mono text-xs">{rule.id}</td>
                                            <td className="px-5 py-4">
                                                <span className="font-semibold text-rose-600 dark:text-rose-400">
                                                    &lt; {rule.min_margin}%
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {rule.action === "auto_reject" && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                                        Auto Reject
                                                    </span>
                                                )}
                                                {rule.action === "require_approval" && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                                        Require Approval
                                                    </span>
                                                )}
                                                {rule.action === "flag_alert" && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                        Flag Alert
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 font-medium">{rule.role_required}</td>
                                            <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate" title={rule.description}>
                                                {rule.description || "-"}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <button
                                                    onClick={() => handleToggleActive(rule)}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                                        rule.is_active
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                                                            : "bg-muted text-muted-foreground border-border"
                                                    }`}
                                                >
                                                    {rule.is_active ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                                                    {rule.is_active ? "Active" : "Inactive"}
                                                </button>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenEdit(rule)}
                                                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                                                        title="Edit Rule"
                                                    >
                                                        <Edit className="size-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm("Are you sure you want to delete this rule tier?")) {
                                                                onDeleteRule(rule.id);
                                                            }
                                                        }}
                                                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded text-rose-500 hover:text-rose-700 transition-colors"
                                                        title="Delete Rule"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Dialog Form */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-card border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-5 border-b flex items-center justify-between">
                            <h3 className="font-semibold text-base">
                                {editingRule ? "Edit Rule Tier" : "Add Validation Rule Tier"}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Gross Margin Trigger Threshold (%)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        value={minMargin}
                                        onChange={(e) => setMinMargin(e.target.value)}
                                        className="w-full h-10 px-3 pr-10 border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="e.g. 15"
                                    />
                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                                        %
                                    </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                    Triggers when order margin is strictly less than this percentage.
                                </span>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Enforced Action
                                </label>
                                <select
                                    value={action}
                                    onChange={(e) => setAction(e.target.value as ThresholdRule["action"])}
                                    className="w-full h-10 px-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="flag_alert">Flag Warning Alert Only</option>
                                    <option value="require_approval">Require Manager Approval</option>
                                    <option value="auto_reject">Auto Reject Submission</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Required Sign-Off Role
                                </label>
                                <select
                                    value={roleRequired}
                                    onChange={(e) => setRoleRequired(e.target.value as ThresholdRule["role_required"])}
                                    className="w-full h-10 px-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="Finance Manager">Finance Manager</option>
                                    <option value="Sales Director">Sales Director</option>
                                    <option value="Director">Director</option>
                                    <option value="System Admin">System Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                    Internal Description / Explanation
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full p-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    placeholder="Explain the justification for this safety boundary..."
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="rule_is_active"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    className="rounded border-border focus:ring-0"
                                />
                                <label htmlFor="rule_is_active" className="text-sm font-semibold select-none">
                                    Activate this rule tier immediately
                                </label>
                            </div>

                            <div className="border-t pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 h-9 border rounded-lg text-xs font-medium hover:bg-muted"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow"
                                >
                                    {loading ? <RefreshCw className="size-3.5 animate-spin inline mr-1" /> : null}
                                    Save Rule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
