import React from "react";
import { Loader2, Plus } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { SalesOrderDetail } from "../types";

interface DemandLinesTableProps {
    loadingOrders: boolean;
    salesOrderLines: SalesOrderDetail[];
    selectedDetailIds: number[];
    handleSelectAll: (checked: boolean) => void;
    handleSelectLine: (detailId: number, checked: boolean) => void;
}

export function DemandLinesTable({
    loadingOrders,
    salesOrderLines,
    selectedDetailIds,
    handleSelectAll,
    handleSelectLine
}: DemandLinesTableProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/10">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    Unfulfilled Demand Lines
                </CardTitle>
                <CardDescription className="text-xs">
                    Sales Order items awaiting production scheduling.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {loadingOrders ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                        <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
                            Loading lines...
                        </span>
                    </div>
                ) : salesOrderLines.length === 0 ? (
                    <div className="p-12 text-center text-xs text-muted-foreground font-semibold">
                        No unfulfilled demand found.
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-muted/5 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[40px] text-center">
                                        <Checkbox
                                            checked={
                                                salesOrderLines.length > 0 &&
                                                selectedDetailIds.length === salesOrderLines.length
                                            }
                                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                        />
                                    </TableHead>
                                    <TableHead className="font-bold text-xs">SO No.</TableHead>
                                    <TableHead className="font-bold text-xs">Product / Version</TableHead>
                                    <TableHead className="font-bold text-xs text-right">Qty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-border">
                                {salesOrderLines.map((line) => (
                                    <TableRow key={line.detail_id} className="hover:bg-muted/5">
                                        <TableCell className="py-2 text-center">
                                            <Checkbox
                                                checked={selectedDetailIds.includes(line.detail_id)}
                                                onCheckedChange={(checked) =>
                                                    handleSelectLine(line.detail_id, !!checked)
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="py-2 text-xs">
                                            <div className="font-bold text-foreground">
                                                {line.order_no}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                                {line.customer_name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 text-xs">
                                            <div className="font-semibold text-foreground truncate max-w-[150px]">
                                                {line.product_id?.product_name}
                                            </div>
                                            <div className="text-[10px] font-medium text-primary">
                                                Ver: {line.bom_version_name || "No Version"}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 text-right font-bold text-xs">
                                            {line.ordered_quantity.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
