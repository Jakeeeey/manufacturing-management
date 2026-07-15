/* eslint-disable */
import React from "react";
import { Loader2, Printer, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClosedQAQueueProps {
    loadingJobOrders: boolean;
    closedJobOrders: any[];
    joSearch: string;
    setJoSearch: (val: string) => void;
    getBranchName: (branchId?: number | null) => string;
    handleReprintReceipt: (jo: any) => void;
}

export function ClosedQAQueue({
    loadingJobOrders,
    closedJobOrders,
    joSearch,
    setJoSearch,
    getBranchName,
    handleReprintReceipt
}: ClosedQAQueueProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h3 className="text-sm font-bold text-foreground">Completed Run Closures</h3>
                    <p className="text-xs text-muted-foreground">List of all finalized Job Orders and receipts recorded in the WMS ledger. Reprint closure slips here.</p>
                </div>
                <div className="relative w-full sm:w-[260px] shrink-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search JO # or product..."
                        className="pl-9 h-9 text-xs bg-background border-border text-foreground"
                        value={joSearch}
                        onChange={(e) => setJoSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="border border-border rounded-xl bg-card overflow-hidden">
                {loadingJobOrders ? (
                    <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" /> Loading completed runs...
                    </div>
                ) : closedJobOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-muted-foreground italic text-xs">
                        No completed runs found matching your search.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 border-b border-border">
                                <TableHead className="text-xs font-bold text-foreground">Job Order No</TableHead>
                                <TableHead className="text-xs font-bold text-foreground">Product</TableHead>
                                <TableHead className="text-xs font-bold text-foreground text-center">Target Qty</TableHead>
                                <TableHead className="text-xs font-bold text-foreground text-center">Produced Yield</TableHead>
                                <TableHead className="text-xs font-bold text-foreground">Target Branch</TableHead>
                                <TableHead className="text-xs font-bold text-foreground">Recipe Version</TableHead>
                                <TableHead className="text-xs font-bold text-foreground text-right pr-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {closedJobOrders.map((jo: any, idx: number) => {
                                const verName = jo.recipe_version_name || 
                                                jo.recipeVersionName || 
                                                jo.version_name || 
                                                jo.versionName || 
                                                ((jo.version_id || jo.versionId || jo.bom?.version_id || jo.bom?.versionId) 
                                                    ? `Version #${jo.version_id || jo.versionId || jo.bom?.version_id || jo.bom?.versionId}` 
                                                    : 'Active');

                                return (
                                    <TableRow key={jo.order_id || jo.id || idx} className="hover:bg-muted/30 border-b border-border/60">
                                        <TableCell className="font-mono font-bold text-xs">{jo.jo_id || `JO #${jo.order_id}`}</TableCell>
                                        <TableCell className="text-xs font-medium text-foreground py-3">
                                            {jo.product_name}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono text-center font-semibold text-muted-foreground">{Number(jo.quantity || 0).toLocaleString()} units</TableCell>
                                        <TableCell className="text-xs font-mono text-center font-bold text-emerald-500">{Number(jo.producedQty || jo.produced_quantity || 0).toLocaleString()} units</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{getBranchName(jo.branch_id)}</TableCell>
                                        <TableCell className="text-xs font-medium text-muted-foreground">{verName}</TableCell>
                                        <TableCell className="text-right pr-4">
                                            <Button 
                                                size="xs" 
                                                onClick={() => handleReprintReceipt(jo)}
                                                className="bg-primary hover:bg-primary/90 text-white font-bold h-7 text-[11px] gap-1 px-2.5"
                                            >
                                                <Printer className="h-3 w-3" /> Reprint Slip
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
