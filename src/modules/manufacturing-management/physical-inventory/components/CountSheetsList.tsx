"use client";

import React, { useState, useMemo } from "react";
import {
    Search,
    Plus,
    Building2,
    Edit3,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { PhysicalCountSheet, Branch } from "../types";
import { formatCurrency, formatDate } from "../utils";
import SearchableSelect, { SelectOption } from "./SearchableSelect";

interface CountSheetsListProps {
    countSheets: PhysicalCountSheet[];
    branches?: Branch[];
    onOpenNewModal?: () => void;
    onCreateNew?: () => void;
    onSelectSheetToEdit?: (sheet: PhysicalCountSheet) => void;
    onSelectSheet?: (sheet: PhysicalCountSheet) => void;
    onOpenCommitModal?: (sheet: PhysicalCountSheet) => void;
    onCommitSheet?: (sheet: PhysicalCountSheet) => void;
    onCancelSheet: (sheetId: string) => void;
}

function parseBufferOrBool(val: unknown): boolean {
    if (val === true || val === 1 || val === "1") return true;
    if (val === false || val === 0 || val === "0" || val === null || val === undefined) return false;
    if (typeof val === "object" && val !== null) {
        const obj = val as { data?: unknown };
        if (Array.isArray(obj.data) && obj.data.length > 0) {
            return Number(obj.data[0]) === 1;
        }
        if (typeof obj.data === "number") {
            return obj.data === 1;
        }
    }
    return false;
}

export default function CountSheetsList({
    countSheets,
    branches = [],
    onOpenNewModal,
    onCreateNew,
    onSelectSheetToEdit,
    onSelectSheet,
    onOpenCommitModal,
    onCommitSheet,
    onCancelSheet
}: CountSheetsListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "Draft" | "Committed" | "Cancelled">("all");
    const [branchFilter, setBranchFilter] = useState<string | number>("all");

    const handleSelect = onSelectSheetToEdit || onSelectSheet;
    const handleCommit = onOpenCommitModal || onCommitSheet;
    const handleCreate = onOpenNewModal || onCreateNew;

    // Build branch options for SearchableSelect
    const branchOptions: SelectOption[] = useMemo(() => {
        const list: SelectOption[] = [{ value: "all", label: "All Facilities / Branches" }];
        (branches || []).forEach(b => {
            const bId = b.id || b.branch_id || 0;
            const bName = b.branchName || b.branch_name || b.name || `Branch #${bId}`;
            const bCode = b.branchCode || b.branch_code || "";
            list.push({
                value: bId,
                label: bName,
                sublabel: bCode ? `Code: ${bCode}` : undefined
            });
        });
        return list;
    }, [branches]);

    // Filter count sheets
    const filteredSheets = useMemo(() => {
        return countSheets.filter(sheet => {
            const query = searchQuery.toLowerCase().trim();
            const phNo = (sheet.ph_no || sheet.sheet_no || "").toLowerCase();
            const bName = (sheet.branch_name || "").toLowerCase();
            const stock = (sheet.stock_type || "").toLowerCase();
            const remarks = (sheet.remarks || sheet.notes || "").toLowerCase();

            const matchesQuery = !query ||
                phNo.includes(query) ||
                bName.includes(query) ||
                stock.includes(query) ||
                remarks.includes(query);

            if (!matchesQuery) return false;

            const isCommitted = parseBufferOrBool(sheet.isComitted) || parseBufferOrBool(sheet.is_committed) || sheet.status === "Committed";
            const isCancelled = parseBufferOrBool(sheet.isCancelled) || parseBufferOrBool(sheet.is_cancelled) || sheet.status === "Cancelled";
            const currentStatus = isCommitted ? "Committed" : isCancelled ? "Cancelled" : "Draft";

            const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;
            const matchesBranch = branchFilter === "all" || String(sheet.branch_id) === String(branchFilter);

            return matchesStatus && matchesBranch;
        });
    }, [countSheets, searchQuery, statusFilter, branchFilter]);

    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            {/* Control & Filter Bar */}
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                {/* Search & Select Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by Sheet #, branch, notes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-9 rounded-xl border border-input bg-background pl-9 pr-3 text-xs focus:ring-2 focus:ring-primary outline-hidden"
                        />
                    </div>

                    {/* Searchable Branch Filter */}
                    <div className="w-full sm:w-60">
                        <SearchableSelect
                            options={branchOptions}
                            value={branchFilter}
                            onChange={(val) => setBranchFilter(val)}
                            placeholder="Filter by facility..."
                            searchPlaceholder="Search facility branch..."
                            icon={<Building2 className="h-4 w-4" />}
                        />
                    </div>
                </div>

                {/* Status Tabs & New Button */}
                <div className="flex items-center gap-3 justify-between sm:justify-end w-full md:w-auto">
                    {/* Status Tabs */}
                    <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border text-xs">
                        {(["all", "Draft", "Committed", "Cancelled"] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all ${
                                    statusFilter === s
                                        ? "bg-background text-foreground shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {handleCreate && (
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl transition-all"
                        >
                            <Plus className="h-4 w-4" />
                            New Count Sheet
                        </button>
                    )}
                </div>
            </div>

            {/* Datagrid Table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                            <tr>
                                <th className="p-3">Sheet Reference #</th>
                                <th className="p-3">Facility Branch</th>
                                <th className="p-3">Cutoff Date</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Items Counted</th>
                                <th className="p-3 text-right">Total Net Amount</th>
                                <th className="p-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 font-medium">
                            {filteredSheets.length > 0 ? (
                                filteredSheets.map(sheet => {
                                    const isCommitted = parseBufferOrBool(sheet.isComitted) || parseBufferOrBool(sheet.is_committed) || sheet.status === "Committed";
                                    const isCancelled = parseBufferOrBool(sheet.isCancelled) || parseBufferOrBool(sheet.is_cancelled) || sheet.status === "Cancelled";
                                    const statusLabel = isCommitted ? "Committed" : isCancelled ? "Cancelled" : "Draft";

                                    return (
                                        <tr key={sheet.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3">
                                                <div className="font-bold text-foreground font-mono">#{sheet.ph_no || sheet.sheet_no}</div>
                                                <div className="text-[10px] text-muted-foreground">{formatDate(sheet.date_encoded)}</div>
                                            </td>
                                            <td className="p-3 font-semibold text-foreground">
                                                {sheet.branch_name}
                                            </td>
                                            <td className="p-3 text-muted-foreground">
                                                {formatDate(sheet.cutOff_date)}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    isCommitted
                                                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                                        : isCancelled
                                                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                                }`}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-foreground">
                                                {(sheet.line_items || []).length} SKUs
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-foreground">
                                                {formatCurrency(sheet.total_amount || 0)}
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {handleSelect && (
                                                        <button
                                                            onClick={() => handleSelect(sheet)}
                                                            className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-all"
                                                            title="View / Edit Count Sheet"
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}

                                                    {!isCommitted && !isCancelled && handleCommit && (
                                                        <button
                                                            onClick={() => handleCommit(sheet)}
                                                            className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-all"
                                                            title="Commit to Ledger"
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}

                                                    {!isCommitted && !isCancelled && (
                                                        <button
                                                            onClick={() => onCancelSheet(sheet.id)}
                                                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-all"
                                                            title="Cancel Sheet"
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-muted-foreground text-xs">
                                        No physical count sheets found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
