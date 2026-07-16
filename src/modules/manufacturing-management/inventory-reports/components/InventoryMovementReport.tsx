"use client";

import React, { useState } from "react";
import { 
    Search, RefreshCw, FileDown, Boxes, ChevronDown, ChevronRight, Loader2, Calendar, Layers, Package
} from "lucide-react";
import { 
    ProductReportNode, MovementFilters, ProductLookup, BranchLookup, LotLookup, BatchReportEntry 
} from "../types";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from "@/components/ui/table";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RawProduct, RawBatch } from "../services/inventory-reports-api";

interface InventoryMovementReportProps {
    filters: MovementFilters;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    loading: boolean;
    products: ProductLookup[];
    branches: BranchLookup[];
    lotsList: LotLookup[];
    loadMovements: () => Promise<void>;
    setSingleFilter: (key: keyof MovementFilters, value: unknown) => void;
    groupedData: ProductReportNode[];
    batches: RawBatch[];
    rawProducts: RawProduct[];
    activeProductType: number;
    setActiveProductType: (type: number) => void;
}

const getQAStatusBadgeStyles = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("pass")) {
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30";
    }
    if (s.includes("fail") || s.includes("hold")) {
        return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 dark:border-rose-500/30";
    }
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/30";
};

export default function InventoryMovementReport({
    filters,
    searchQuery,
    setSearchQuery,
    loading,
    products,
    branches,
    lotsList,
    loadMovements,
    setSingleFilter,
    groupedData,
    batches,
    rawProducts,
    activeProductType,
    setActiveProductType
}: InventoryMovementReportProps) {
    // Expansion states
    const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});

    // PDF Export Modal State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [pdfProductType, setPdfProductType] = useState<number>(388);
    const [pdfSearchQuery, setPdfSearchQuery] = useState("");
    const [pdfSelectedProductIds, setPdfSelectedProductIds] = useState<number[]>([]);
    const [pdfBranchId, setPdfBranchId] = useState<number | null>(null);
    const [pdfLotId, setPdfLotId] = useState<number | null>(null);
    const [pdfMfgDate, setPdfMfgDate] = useState<string>("");
    const [pdfExpiryDate, setPdfExpiryDate] = useState<string>("");

    // Filtered products list for main screen Product SKU dropdown
    const filteredProductsForMainScreen = React.useMemo(() => {
        return products.filter((p) => Number(p.productType) === activeProductType);
    }, [products, activeProductType]);

    // Active products shown inside PDF Export dialog checklist
    const activeProducts = React.useMemo(() => {
        return products.filter((p) => Number(p.productType) === pdfProductType);
    }, [products, pdfProductType]);

    // Filtered branches based on selected products in the modal
    const pdfActiveBranchIds = React.useMemo(() => {
        if (pdfSelectedProductIds.length === 0) return new Set<number>();
        return new Set(
            batches
                .filter(b => pdfSelectedProductIds.includes(b.product_id))
                .map(b => b.branch_id)
        );
    }, [batches, pdfSelectedProductIds]);

    const pdfActiveBranches = React.useMemo(() => {
        return branches.filter(b => pdfActiveBranchIds.has(b.branchId));
    }, [branches, pdfActiveBranchIds]);

    // Filtered lot locations based on selected products in the modal and selected branch
    const pdfLots = React.useMemo(() => {
        const filtered = batches.filter(b => 
            pdfSelectedProductIds.includes(b.product_id) &&
            (pdfBranchId === null || b.branch_id === pdfBranchId)
        );
        const uniqueLots = new Map<number, string>();
        filtered.forEach(b => {
            if (b.lot_id) {
                uniqueLots.set(Number(b.lot_id), b.lot_name || "Unassigned");
            }
        });
        return Array.from(uniqueLots.entries()).map(([id, name]) => ({
            lotId: id,
            lotName: name
        }));
    }, [batches, pdfSelectedProductIds, pdfBranchId]);

    // Reset Branch / Lot selection if they are no longer in the active lists
    React.useEffect(() => {
        if (pdfBranchId !== null && !pdfActiveBranchIds.has(pdfBranchId)) {
            setPdfBranchId(null);
            setPdfLotId(null);
        }
    }, [pdfActiveBranchIds, pdfBranchId]);

    React.useEffect(() => {
        const lotExists = pdfLots.some(l => l.lotId === pdfLotId);
        if (pdfLotId !== null && !lotExists) {
            setPdfLotId(null);
        }
    }, [pdfLots, pdfLotId]);

    const openExportModal = () => {
        setPdfProductType(activeProductType);
        setPdfBranchId(filters.branchId);
        setPdfLotId(filters.lotId);
        setPdfMfgDate(filters.startDate || "");
        setPdfExpiryDate(filters.endDate || "");

        const ids = products
            .filter((p) => Number(p.productType) === activeProductType)
            .map((p) => p.productId);

        setPdfSelectedProductIds(ids);
        setPdfSearchQuery("");
        setIsExportModalOpen(true);
    };

    const handlePdfProductTypeChange = (typeVal: number) => {
        setPdfProductType(typeVal);
        setPdfBranchId(null);
        setPdfLotId(null);

        const ids = products
            .filter((p) => Number(p.productType) === typeVal)
            .map((p) => p.productId);

        setPdfSelectedProductIds(ids);
    };

    const toggleProductRow = (productId: number) => {
        setExpandedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
    };

    const renderCapacityBar = (utilPercent: number) => {
        const clamped = Math.min(Math.max(utilPercent, 0), 100);
        let barColor = "hsl(var(--success))";
        if (clamped >= 90) barColor = "hsl(var(--destructive))";
        else if (clamped >= 70) barColor = "hsl(var(--warning))";
        else if (clamped >= 30) barColor = "hsl(var(--primary))";

        return (
            <div className="flex items-center gap-1.5 justify-end">
                <div className="bg-muted rounded-full h-1.5 w-12 overflow-hidden relative">
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${clamped}%`, backgroundColor: barColor }}
                    />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground w-8 text-left">{clamped.toFixed(1)}%</span>
            </div>
        );
    };

    const handleExportPdf = async () => {
        if (pdfSelectedProductIds.length === 0) {
            toast.warning("Please select at least one product to export.");
            return;
        }

        // 1. Filter raw batches based on modal-specific criteria
        const filteredBatches = batches.filter((b) => {
            if (!pdfSelectedProductIds.includes(b.product_id)) return false;
            if (pdfBranchId !== null && b.branch_id !== pdfBranchId) return false;
            if (pdfLotId !== null && b.lot_id !== pdfLotId) return false;

            // Product type filter matching selected product type
            const matchedProduct = rawProducts.find((p) => p.product_id === b.product_id);
            if (!matchedProduct || Number(matchedProduct.product_type) !== pdfProductType) return false;

            if (pdfMfgDate) {
                const createdDate = b.created_on ? b.created_on.split("T")[0] : null;
                if (createdDate !== pdfMfgDate) return false;
            }
            if (pdfExpiryDate) {
                const expDate = b.expiration_date ? b.expiration_date.split("T")[0] : null;
                if (expDate !== pdfExpiryDate) return false;
            }
            return true;
        });

        if (filteredBatches.length === 0) {
            toast.warning("No data found matching the selected PDF Export filters.");
            return;
        }

        // 2. Group filtered batches by Product ID
        const productNodesMap = new Map<number, ProductReportNode>();

        // Lookup maps
        const branchMap = new Map<number, string>();
        branches.forEach((b) => branchMap.set(b.branchId, b.branchName));

        const lotMap = new Map<number, LotLookup>();
        lotsList.forEach((l) => lotMap.set(l.lotId, l));

        const productUOMMap = new Map<number, string>();
        rawProducts.forEach((p) => {
            const uom = p.unit_of_measurement?.unit_shortcut || "units";
            productUOMMap.set(p.product_id, uom);
        });

        filteredBatches.forEach((b) => {
            let node = productNodesMap.get(b.product_id);
            if (!node) {
                const matchedProduct = rawProducts.find((p) => p.product_id === b.product_id);
                node = {
                    productId: b.product_id,
                    productName: matchedProduct?.product_name || `Product #${b.product_id}`,
                    productCode: matchedProduct?.product_code || `SKU-${b.product_id}`,
                    uomShortcut: productUOMMap.get(b.product_id) || "units",
                    totalAvailable: 0,
                    lots: []
                };
                productNodesMap.set(b.product_id, node);
            }

            const lotId = b.lot_id ? Number(b.lot_id) : null;
            const lotInfo = lotId !== null ? lotMap.get(lotId) : null;
            const maxCapacity = lotInfo?.maxBatchCapacity || 10;
            const quantity = Number(b.quantity_received || 0);
            const branchName = branchMap.get(b.branch_id) || `Branch #${b.branch_id}`;

            const lotEntry: BatchReportEntry = {
                lineId: b.line_id,
                productId: b.product_id,
                branchId: b.branch_id,
                branchName,
                lotId,
                lotName: b.lot_name || "Unassigned",
                maxBatchCapacity: maxCapacity,
                sourceDocumentNo: b.source_reference || "N/A",
                transactionType: b.transaction_type || (b.source_type ? String(b.source_type).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Legacy Stock"),
                batchNo: b.batch_no || b.lot_number || "LOT-N/A",
                quantity,
                unitCost: Number(b.final_landed_unit_cost || b.base_unit_cost_php || 0),
                qaStatus: b.qa_status || "Passed",
                remarks: b.remarks || b.rejection_reason || null,
                expiryDate: b.expiration_date || null,
                createdOn: b.created_on || null
            };

            node.lots.push(lotEntry);
        });

        const pdfGroupedData: ProductReportNode[] = [];
        productNodesMap.forEach((node) => {
            node.totalAvailable = node.lots.reduce((acc, lot) => acc + lot.quantity, 0);
            node.lots.sort((a, b) => {
                const branchCompare = a.branchName.localeCompare(b.branchName);
                if (branchCompare !== 0) return branchCompare;
                const lotCompare = a.lotName.localeCompare(b.lotName);
                if (lotCompare !== 0) return lotCompare;
                return a.batchNo.localeCompare(b.batchNo);
            });
            if (node.lots.length > 0) {
                pdfGroupedData.push(node);
            }
        });

        pdfGroupedData.sort((a, b) => a.productName.localeCompare(b.productName));

        const activeBranch = branches.find(b => b.branchId === pdfBranchId)?.branchName || "All Branches";
        toast.info("Generating report PDF...");

        try {
            // Instantiate Landscape Letter jsPDF directly to avoid modifying any files outside of this module
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            let currentY = 15;

            // Document Title
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("PRODUCT INVENTORY MOVEMENT BREAKDOWN REPORT", 10, currentY, { baseline: "top" });
            currentY += 6;

            // Meta Information Block
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);

            let selectedProductTypeName = "Finished Goods";
            if (pdfProductType === 389) selectedProductTypeName = "Raw Materials";
            else if (pdfProductType === 390) selectedProductTypeName = "Packaging Items";

            doc.text(`Branch: ${activeBranch} | Product Type: ${selectedProductTypeName}`, 10, currentY);
            doc.text(`Date Generated: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (PST)`, pageW - 10, currentY, { align: "right" });
            currentY += 5;

            const mfgFilterText = pdfMfgDate ? `Mfg Date = ${pdfMfgDate}` : "Mfg Date: Any";
            const expFilterText = pdfExpiryDate ? `Expiry Date = ${pdfExpiryDate}` : "Expiry Date: Any";
            doc.text(`${mfgFilterText} | ${expFilterText}`, 10, currentY);
            currentY += 8;

            // Render tables sequentially for each Product
            pdfGroupedData.forEach((prod) => {
                // Check page overflow before drawing product title (each product table header + title takes roughly 20mm)
                if (currentY > pageH - 30) {
                    doc.addPage();
                    currentY = 15; // Reset to page top margin
                }

                doc.setFontSize(8.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text(`Product: ${prod.productCode} - ${prod.productName} | Total Stock: ${prod.totalAvailable.toLocaleString("en-PH", { minimumFractionDigits: 2 })} ${prod.uomShortcut}`, 10, currentY, { baseline: "top" });
                currentY += 5;

                const tableRows: string[][] = [];
                prod.lots.forEach((lot) => {
                    const spaceUtil = lot.maxBatchCapacity > 0 ? `${((lot.quantity / lot.maxBatchCapacity) * 100).toFixed(1)}%` : "0.0%";
                    const cost = `PHP ${lot.unitCost.toFixed(2)}`;
                    const qty = lot.quantity.toLocaleString("en-PH", { minimumFractionDigits: 2 });
                    const mfgDate = lot.createdOn ? lot.createdOn.split("T")[0] : "—";
                    const expDate = lot.expiryDate || "—";
                    
                    tableRows.push([
                      lot.branchName,
                      lot.lotName,
                      spaceUtil,
                      lot.sourceDocumentNo,
                      lot.transactionType,
                      lot.batchNo,
                      qty,
                      cost,
                      lot.qaStatus,
                      mfgDate,
                      expDate
                    ]);
                });

                const printableW = pageW - 20; // 10mm margin on left and right
                // Total parts width = 238mm (excluding column 1 auto)
                // We allocate columns proportionally to fit landscape page widths perfectly
                const colWidth = (parts: number) => (parts / 268) * printableW;

                autoTable(doc, {
                    startY: currentY,
                    margin: { left: 10, right: 10 },
                    head: [["Branch", "Lot Location", "Space Util", "Source Doc", "Txn Type", "Batch No", "Qty", "Unit Cost", "QA Status", "Mfg Date", "Expiry Date"]],
                    body: tableRows,
                    theme: "grid",
                    headStyles: { fillColor: [255, 255, 255], textColor: [15, 23, 42], fontSize: 5, lineColor: [226, 232, 240], lineWidth: 0.1 },
                    bodyStyles: { fontSize: 4.5 },
                    columnStyles: {
                        0: { cellWidth: colWidth(28) },
                        1: { cellWidth: "auto" },
                        2: { cellWidth: colWidth(18), halign: "right" },
                        3: { cellWidth: colWidth(28) },
                        4: { cellWidth: colWidth(32) },
                        5: { cellWidth: colWidth(28) },
                        6: { cellWidth: colWidth(18), halign: "right" },
                        7: { cellWidth: colWidth(24), halign: "right" },
                        8: { cellWidth: colWidth(20), halign: "center" },
                        9: { cellWidth: colWidth(22), halign: "center" },
                        10: { cellWidth: colWidth(22), halign: "center" }
                    }
                });

                const lastAutoTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
                currentY = (lastAutoTable?.finalY ?? currentY) + 12;
            });

            // Draw page numbers over all pages
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100, 116, 139);
                doc.text(
                    `Page ${i} of ${pageCount}`,
                    pageW - 10,
                    pageH - 10,
                    { align: "right" }
                );
            }

            doc.save(`Product_Inventory_Movement_Breakdown_Report_${activeBranch.replace(/\s+/g, "_")}.pdf`);
            toast.success("PDF generated and downloaded successfully!");
            setIsExportModalOpen(false);
        } catch (error) {
            console.error("PDF generation failed:", error);
            toast.error("Failed to generate PDF report.");
        }
    };

    return (
        <div className="space-y-4">
            {/* Filter Panel */}
            <Card className="border border-border bg-card shadow-sm">
                <CardContent className="p-4 flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {/* Branch Selector */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Branch</label>
                            <SearchableSelect
                                options={[
                                    { value: "all", label: "All Branches" },
                                    ...branches.map((b) => ({ value: String(b.branchId), label: b.branchName }))
                                ]}
                                value={filters.branchId !== null ? String(filters.branchId) : "all"}
                                onValueChange={(val) => setSingleFilter("branchId", val === "all" ? null : Number(val))}
                                placeholder="All Branches"
                                className="h-9 bg-background border-border text-foreground font-normal hover:bg-muted/50 text-left justify-between w-full"
                            />
                        </div>

                        {/* Lot Location Selector */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Location Lot</label>
                            <SearchableSelect
                                options={[
                                    { value: "all", label: "All Locations" },
                                    ...lotsList.map((l) => ({ value: String(l.lotId), label: l.lotName }))
                                ]}
                                value={filters.lotId !== null ? String(filters.lotId) : "all"}
                                onValueChange={(val) => setSingleFilter("lotId", val === "all" ? null : Number(val))}
                                placeholder="All Locations"
                                className="h-9 bg-background border-border text-foreground font-normal hover:bg-muted/50 text-left justify-between w-full"
                            />
                        </div>

                        {/* Product Selector */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Product SKU</label>
                            <SearchableSelect
                                options={[
                                    { value: "all", label: "All Products" },
                                    ...filteredProductsForMainScreen.map((p) => ({ value: String(p.productId), label: `${p.productCode} - ${p.productName}` }))
                                ]}
                                value={filters.productId !== null ? String(filters.productId) : "all"}
                                onValueChange={(val) => setSingleFilter("productId", val === "all" ? null : Number(val))}
                                placeholder="All Products"
                                className="h-9 bg-background border-border text-foreground font-normal hover:bg-muted/50 text-left justify-between w-full"
                            />
                        </div>

                        {/* Connected Date Range Selector */}
                        <div className="flex flex-col gap-1.5 w-full col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-2">
                            <div className="flex items-center gap-2 w-full">
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Manufacturing Date</label>
                                    <div className="relative w-full">
                                        <input
                                            type="date"
                                            value={filters.startDate}
                                            onChange={(e) => setSingleFilter("startDate", e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-border bg-background pl-2.5 pr-8 py-1.5 text-[11px] sm:text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                            title="Manufacturing Date"
                                        />
                                        <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground/60" />
                                    </div>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0 font-medium select-none self-end pb-2.5">to</span>
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-xs font-semibold text-muted-foreground">Expiry Date</label>
                                    <div className="relative w-full">
                                        <input
                                            type="date"
                                            value={filters.endDate}
                                            onChange={(e) => setSingleFilter("endDate", e.target.value)}
                                            className="flex h-9 w-full rounded-md border border-border bg-background pl-2.5 pr-8 py-1.5 text-[11px] sm:text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                            title="Expiry Date"
                                        />
                                        <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground/60" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/50 pt-3 flex-wrap gap-2">
                        {/* Search Input for tree filtering */}
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                            <Input
                                placeholder="Search products or lots..."
                                className="pl-9 h-9 bg-background border border-border"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-9 gap-1.5" 
                                onClick={openExportModal}
                                disabled={loading}
                            >
                                <FileDown className="h-4 w-4" />
                                Export PDF
                            </Button>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-9 w-9" 
                                onClick={() => loadMovements()}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs Filter */}
            <div className="flex bg-muted/50 border border-border p-0.5 rounded-lg w-fit">
                <button
                    type="button"
                    onClick={() => setActiveProductType(388)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${activeProductType === 388 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                >
                    <Layers className="h-4 w-4" /> Finished Goods
                </button>
                <button
                    type="button"
                    onClick={() => setActiveProductType(389)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${activeProductType === 389 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                >
                    <Boxes className="h-4 w-4" /> Raw Materials
                </button>
                <button
                    type="button"
                    onClick={() => setActiveProductType(390)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 ${activeProductType === 390 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"}`}
                >
                    <Package className="h-4 w-4" /> Packaging Items
                </button>
            </div>

            {/* Tree Grid Layout */}
            <Card className="border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/40 border-b border-border">
                            <TableRow>
                                <TableHead className="w-[70%] pl-4">Product SKU / Storage Location & Batch</TableHead>
                                <TableHead className="w-[30%] pr-4 text-right">On-Hand Qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <span className="text-sm font-medium">Fetching inventory records...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : groupedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={2} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                            <Boxes className="h-12 w-12 text-muted-foreground/30 mb-2" />
                                            <span className="text-sm font-semibold">No inventory records found</span>
                                            <p className="text-xs max-w-xs mt-1">
                                                No lots match the selected filter criteria. Adjust filters or choose another branch.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                groupedData.map((prod) => {
                                    const isProdExpanded = !!expandedProducts[prod.productId];
                                    return (
                                        <React.Fragment key={prod.productId}>
                                            {/* LEVEL 1: Product Row */}
                                            <TableRow 
                                                className="group/prod cursor-pointer hover:bg-muted/30 transition-colors border-b border-border"
                                                onClick={() => toggleProductRow(prod.productId)}
                                            >
                                                <TableCell className="font-semibold text-foreground py-3 pl-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground/80 hover:text-foreground">
                                                            {isProdExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                        </span>
                                                        <Boxes className="h-4 w-4 text-primary/70 group-hover/prod:text-primary transition-colors" />
                                                        <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                                                            {prod.productCode}
                                                        </span>
                                                        <span className="text-sm">{prod.productName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-black text-right pr-4 text-sm">
                                                    {prod.totalAvailable.toLocaleString("en-PH", { minimumFractionDigits: 2 })} {prod.uomShortcut}
                                                </TableCell>
                                            </TableRow>

                                            {/* LEVEL 2: Physical Lot Breakdown */}
                                            {isProdExpanded && (
                                                <TableRow className="bg-muted/10 border-b border-border/20">
                                                    <TableCell colSpan={2} className="p-0 pl-10 pr-4">
                                                        <div className="py-3 overflow-hidden">
                                                            <div className="border border-border/60 rounded-lg bg-background overflow-hidden shadow-inner">
                                                                <Table>
                                                                    <TableHeader className="bg-muted/30 border-b border-border/40">
                                                                        <TableRow>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider pl-3">Branch</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider">Lot Location</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider text-right pr-4">Space Util %</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider pl-3">Source Doc No</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider">Txn Type</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider">Batch No</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider text-right">Qty</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider text-right">Unit Cost</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider text-center">QA Status</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider text-center">Mfg Date</TableHead>
                                                                            <TableHead className="text-[10px] font-bold h-7 py-1 uppercase tracking-wider text-center">Expiry Date</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody className="divide-y divide-border/20">
                                                                        {prod.lots.map((lot) => {
                                                                            const spaceUtil = lot.maxBatchCapacity > 0
                                                                                ? (lot.quantity / lot.maxBatchCapacity) * 100
                                                                                : 0;
                                                                            const cost = lot.unitCost;

                                                                            return (
                                                                                <TableRow key={lot.lineId} className="hover:bg-muted/10 transition-colors">
                                                                                    <TableCell className="text-xs py-2 pl-3 font-semibold text-muted-foreground">{lot.branchName}</TableCell>
                                                                                    <TableCell className="text-xs py-2 font-medium text-foreground">{lot.lotName}</TableCell>
                                                                                    <TableCell className="text-xs py-2 text-right font-bold text-muted-foreground pr-4">
                                                                                        {renderCapacityBar(spaceUtil)}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-xs py-2 pl-3 font-mono font-semibold text-foreground">{lot.sourceDocumentNo}</TableCell>
                                                                                    <TableCell className="text-xs py-2 text-muted-foreground font-medium">{lot.transactionType}</TableCell>
                                                                                    <TableCell className="text-xs py-2 font-mono text-muted-foreground">{lot.batchNo}</TableCell>
                                                                                    <TableCell className="text-xs py-2 text-right font-black text-foreground">
                                                                                        {lot.quantity.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-xs py-2 text-right font-bold text-muted-foreground">
                                                                                        ₱{cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-xs py-2 text-center">
                                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${getQAStatusBadgeStyles(lot.qaStatus)}`}>
                                                                                            {lot.qaStatus.toUpperCase()}
                                                                                        </span>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-xs py-2 text-center font-medium text-muted-foreground">
                                                                                        {lot.createdOn ? lot.createdOn.split("T")[0] : "—"}
                                                                                    </TableCell>
                                                                                    <TableCell className="text-xs py-2 text-center font-medium text-muted-foreground">
                                                                                        {lot.expiryDate || <span className="italic text-[10px] text-muted-foreground/60">No Expiry</span>}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            );
                                                                        })}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
                <DialogContent 
                    className="sm:max-w-[500px] border border-border bg-card p-5 shadow-lg rounded-lg"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="space-y-1 text-left">
                        <DialogTitle className="text-base font-bold text-foreground">Export PDF Options</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Select products and filters to customize the generated PDF report.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {/* Product Type Selection */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">Product Type</Label>
                            <SearchableSelect
                                options={[
                                    { value: "388", label: "Finished Goods" },
                                    { value: "389", label: "Raw Materials" },
                                    { value: "390", label: "Packaging Items" }
                                ]}
                                value={String(pdfProductType)}
                                onValueChange={(val) => handlePdfProductTypeChange(Number(val))}
                                placeholder="Select Product Type"
                                className="h-8 bg-background border-border text-foreground text-xs justify-between"
                            />
                        </div>

                        {/* Product Selection Checklist */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground">Product Selection</Label>
                            <Input
                                placeholder="Search products..."
                                value={pdfSearchQuery}
                                onChange={(e) => setPdfSearchQuery(e.target.value)}
                                className="h-8 text-xs bg-background border-border"
                            />
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="text-[10px] px-2 py-0.5 h-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => setPdfSelectedProductIds(activeProducts.map(p => p.productId))}
                                >
                                    Select All
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="text-[10px] px-2 py-0.5 h-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => setPdfSelectedProductIds([])}
                                >
                                    Clear All
                                </Button>
                            </div>
                            <div className="max-h-[140px] overflow-y-auto border border-border rounded-md p-2 bg-background/50 space-y-1">
                                {activeProducts
                                    .filter(p => 
                                        p.productName.toLowerCase().includes(pdfSearchQuery.toLowerCase()) || 
                                        p.productCode.toLowerCase().includes(pdfSearchQuery.toLowerCase())
                                    )
                                    .map(p => (
                                        <div key={p.productId} className="flex items-center gap-2 py-0.5">
                                            <Checkbox
                                                id={`pdf-prod-${p.productId}`}
                                                checked={pdfSelectedProductIds.includes(p.productId)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setPdfSelectedProductIds(prev => [...prev, p.productId]);
                                                    } else {
                                                        setPdfSelectedProductIds(prev => prev.filter(id => id !== p.productId));
                                                    }
                                                }}
                                            />
                                            <Label
                                                htmlFor={`pdf-prod-${p.productId}`}
                                                className="text-xs font-normal cursor-pointer select-none truncate text-foreground/80 hover:text-foreground"
                                            >
                                                {p.productCode} - {p.productName}
                                            </Label>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Branch & Lot Location selectors */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Branch</Label>
                                <SearchableSelect
                                    options={[
                                        { value: "all", label: "All Branches" },
                                        ...pdfActiveBranches.map((b) => ({ value: String(b.branchId), label: b.branchName }))
                                    ]}
                                    value={pdfBranchId !== null ? String(pdfBranchId) : "all"}
                                    onValueChange={(val) => {
                                        setPdfBranchId(val === "all" ? null : Number(val));
                                        setPdfLotId(null);
                                    }}
                                    placeholder="All Branches"
                                    className="h-8 bg-background border-border text-foreground text-xs justify-between"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Location Lot</Label>
                                <SearchableSelect
                                    options={[
                                        { value: "all", label: "All Locations" },
                                        ...pdfLots.map((l) => ({ value: String(l.lotId), label: l.lotName }))
                                    ]}
                                    value={pdfLotId !== null ? String(pdfLotId) : "all"}
                                    onValueChange={(val) => setPdfLotId(val === "all" ? null : Number(val))}
                                    placeholder="All Locations"
                                    className="h-8 bg-background border-border text-foreground text-xs justify-between"
                                />
                            </div>
                        </div>

                        {/* Date selectors */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Mfg Date</Label>
                                <div className="relative w-full">
                                    <input
                                        type="date"
                                        value={pdfMfgDate}
                                        onChange={(e) => setPdfMfgDate(e.target.value)}
                                        className="flex h-8 w-full rounded-md border border-border bg-background px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    />
                                    <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground/60" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground">Expiry Date</Label>
                                <div className="relative w-full">
                                    <input
                                        type="date"
                                        value={pdfExpiryDate}
                                        onChange={(e) => setPdfExpiryDate(e.target.value)}
                                        className="flex h-8 w-full rounded-md border border-border bg-background px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    />
                                    <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground/60" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-4 flex gap-2 justify-end border-t border-border/40 pt-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsExportModalOpen(false)}
                            className="h-8 text-xs px-3"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleExportPdf}
                            className="h-8 text-xs px-3 font-semibold"
                        >
                            Generate PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
