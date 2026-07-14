/* eslint-disable */
import React from "react";
import { Loader2, ClipboardCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface FinalQAReleasesProps {
    lots: any[];
    lotsProducts: any[];
    loadingFinalQA: boolean;
    isFinalReleaseOpen: boolean;
    setIsFinalReleaseOpen: (open: boolean) => void;
    selectedLot: any | null;
    inspectedQty: string;
    setInspectedQty: (val: string) => void;
    defectQty: string;
    setDefectQty: (val: string) => void;
    microbiologicalStatus: "Pending" | "Passed" | "Failed";
    setMicrobiologicalStatus: (val: "Pending" | "Passed" | "Failed") => void;
    packagingSealPassed: boolean;
    setPackagingSealPassed: (val: boolean) => void;
    labelCompliancePassed: boolean;
    setLabelCompliancePassed: (val: boolean) => void;
    overallDisposition: "Approved" | "Quarantined" | "Rejected";
    setOverallDisposition: (val: "Approved" | "Quarantined" | "Rejected") => void;
    coaRefNo: string;
    setCoaRefNo: (val: string) => void;
    finalRemarks: string;
    setFinalRemarks: (val: string) => void;
    handleOpenFinalReleaseDialog: (lot: any) => void;
    handleSubmitFinalRelease: () => void;
    actionLoading: boolean;
}

export function FinalQAReleases({
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
    handleSubmitFinalRelease,
    actionLoading
}: FinalQAReleasesProps) {

    // Filter to show only finished goods lots
    const fgLots = React.useMemo(() => {
        return lots;
    }, [lots]);

    const getProductName = (productId: number) => {
        const prod = lotsProducts.find(p => Number(p.product_id) === Number(productId));
        return prod?.product_name || `Product #${productId}`;
    };

    if (loadingFinalQA) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border bg-card shadow-sm">
                <div className="p-4 border-b">
                    <h3 className="font-bold text-base">Finished Goods & Sub-Assembly Lot Releases</h3>
                    <p className="text-xs text-muted-foreground">Perform microbiological analyses, packaging seal audits, and publish COAs to unlock stock lots for shipping or production consumption.</p>
                </div>

                {fgLots.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground italic text-sm">
                        No inventory lots found in the system.
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Product Name</TableHead>
                                <TableHead className="font-mono text-xs">Lot Number</TableHead>
                                <TableHead className="text-xs font-mono">Stock Qty</TableHead>
                                <TableHead className="text-xs">Expiry Date</TableHead>
                                <TableHead className="text-xs text-center">WMS QA Status</TableHead>
                                <TableHead className="text-xs text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fgLots.map((lot) => {
                                const status = lot.qa_status || "Pending";
                                return (
                                    <TableRow key={lot.line_id || lot.id || lot.lot_id}>
                                        <TableCell className="text-xs font-semibold text-foreground">
                                            <div className="flex flex-col gap-1">
                                                <span>{getProductName(lot.product_id)}</span>
                                                {(() => {
                                                    const prod = lotsProducts.find(p => Number(p.product_id) === Number(lot.product_id));
                                                    return prod?.is_finished_good ? (
                                                        <Badge variant="secondary" className="w-fit text-[8px] py-0 px-1 font-bold leading-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            Finished Good
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="w-fit text-[8px] py-0 px-1 font-bold leading-none border-blue-500/30 text-blue-400">
                                                            Sub-Assembly
                                                        </Badge>
                                                    );
                                                })()}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground font-bold">{lot.lot_number}</TableCell>
                                        <TableCell className="text-xs font-mono font-bold">
                                            {Number(lot.quantity_received || lot.quantity || 0).toLocaleString()}{" "}
                                            {(() => {
                                                const prod = lotsProducts.find(p => Number(p.product_id) === Number(lot.product_id));
                                                return prod?.is_finished_good ? "packs" : "pcs";
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{lot.expiration_date ? new Date(lot.expiration_date).toLocaleDateString() : "No Expiry"}</TableCell>
                                        <TableCell className="text-xs text-center">
                                            {status === "Passed" ? (
                                                <Badge className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold">
                                                    Released (Passed)
                                                </Badge>
                                            ) : status === "Failed" ? (
                                                <Badge className="bg-red-950 text-red-400 border border-red-500/30 font-bold">
                                                    Rejected (Failed)
                                                </Badge>
                                            ) : status === "QA Hold" || status === "Quarantined" ? (
                                                <Badge className="bg-amber-950 text-amber-400 border border-amber-500/30 font-bold animate-pulse">
                                                    Quarantined (Hold)
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/5">
                                                    Pending final QA
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                size="xs" 
                                                variant={status === "Passed" ? "outline" : "default"}
                                                onClick={() => handleOpenFinalReleaseDialog(lot)}
                                                className="font-bold h-7 text-[11px]"
                                            >
                                                {status === "Passed" ? "Inspect / Print COA" : "Release Audit"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* DIALOG: Record Final Batch QA Release & COA */}
            <Dialog open={isFinalReleaseOpen} onOpenChange={setIsFinalReleaseOpen}>
                <DialogContent className="sm:max-w-[480px] bg-background border border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary font-bold text-base">
                            <ClipboardCheck className="h-5 w-5" /> Finished Goods QA release inspection
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs">
                            Validate microbiological, physical and packaging criteria to release finished lot {selectedLot?.lot_number}.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={(e) => { e.preventDefault(); handleSubmitFinalRelease(); }} className="space-y-4 py-2 text-xs">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Inspected Quantity */}
                            <div className="space-y-1.5">
                                <Label htmlFor="inspected" className="text-foreground font-bold font-mono">Inspected Quantity (units)</Label>
                                <Input
                                    id="inspected"
                                    type="number"
                                    value={inspectedQty}
                                    onChange={(e) => setInspectedQty(e.target.value)}
                                    className="h-9 bg-background border-border text-foreground text-xs focus-visible:ring-primary font-bold font-mono"
                                    required
                                />
                            </div>

                            {/* Defect Quantity */}
                            <div className="space-y-1.5">
                                <Label htmlFor="defect" className="text-foreground font-bold font-mono">Defect Quantity (units)</Label>
                                <Input
                                    id="defect"
                                    type="number"
                                    value={defectQty}
                                    onChange={(e) => setDefectQty(e.target.value)}
                                    className="h-9 bg-background border-border text-foreground text-xs focus-visible:ring-primary font-bold font-mono"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Microbiological Status */}
                            <div className="space-y-1.5">
                                <Label htmlFor="microbio" className="text-foreground font-bold">Microbiological Analysis</Label>
                                <select
                                    id="microbio"
                                    value={microbiologicalStatus}
                                    onChange={(e) => setMicrobiologicalStatus(e.target.value as any)}
                                    className="flex h-9 w-full rounded-md border border-border bg-background text-foreground px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                >
                                    <option value="Passed">Passed (Coliforms/Yeast Clean)</option>
                                    <option value="Pending">Pending Lab Culturing</option>
                                    <option value="Failed">Failed (Contamination detected)</option>
                                </select>
                            </div>

                            {/* COA Reference No */}
                            <div className="space-y-1.5">
                                <Label htmlFor="coa" className="text-foreground font-bold font-mono">Certificate of Analysis (COA) #</Label>
                                <Input
                                    id="coa"
                                    value={coaRefNo}
                                    onChange={(e) => setCoaRefNo(e.target.value)}
                                    className="h-9 bg-background border-border text-foreground text-xs focus-visible:ring-primary font-bold font-mono"
                                    placeholder="e.g. COA-12345"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Overall Disposition */}
                            <div className="space-y-1.5">
                                <Label htmlFor="disposition" className="text-foreground font-bold">Overall Lot Disposition</Label>
                                <select
                                    id="disposition"
                                    value={overallDisposition}
                                    onChange={(e) => setOverallDisposition(e.target.value as any)}
                                    className="flex h-9 w-full rounded-md border border-border bg-background text-foreground px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                >
                                    <option value="Approved">Approved (Release to WMS)</option>
                                    <option value="Quarantined">Quarantine Hold (Audit Lock)</option>
                                    <option value="Rejected">Rejected (Scrap/Rework)</option>
                                </select>
                            </div>

                            {/* Compliance gates */}
                            <div className="space-y-2 flex flex-col justify-end pb-1 pl-1">
                                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-foreground font-semibold">
                                    <input 
                                        type="checkbox" 
                                        checked={packagingSealPassed}
                                        onChange={(e) => setPackagingSealPassed(e.target.checked)}
                                        className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
                                    />
                                    Packaging Seal Audit Passed
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-foreground font-semibold">
                                    <input 
                                        type="checkbox" 
                                        checked={labelCompliancePassed}
                                        onChange={(e) => setLabelCompliancePassed(e.target.checked)}
                                        className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
                                    />
                                    Label & Expiry Print Correct
                                </label>
                            </div>
                        </div>

                        {/* Final Remarks */}
                        <div className="space-y-1.5">
                            <Label htmlFor="finalRemarks" className="text-foreground font-bold">Microbiological & Sensory release notes</Label>
                            <textarea
                                id="finalRemarks"
                                value={finalRemarks}
                                onChange={(e) => setFinalRemarks(e.target.value)}
                                className="flex min-h-[60px] w-full rounded-md border border-border bg-background text-foreground px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                                placeholder="Write final microbiological logs, metals check findings, or batch packaging notes..."
                            />
                        </div>

                        <DialogFooter className="pt-2 border-t border-border gap-2 flex items-center justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsFinalReleaseOpen(false)}
                                className="border-border hover:bg-muted text-foreground h-8 text-xs font-semibold"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={actionLoading}
                                className="bg-primary hover:bg-primary/95 text-white font-bold h-8 text-xs px-4"
                            >
                                {actionLoading ? "Saving Release..." : "Save & Release Lot"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
