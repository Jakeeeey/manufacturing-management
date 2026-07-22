// ─── Grouped Tree Node Types ──────────────────────────────────────────

export interface BatchReportEntry {
    lineId: number;
    productId: number;
    versionId?: number | null;
    versionName?: string | null;
    branchId: number;
    branchName: string;
    lotId: number | null;
    lotName: string;
    maxBatchCapacity: number;
    sourceDocumentNo: string;
    transactionType: string;
    batchNo: string;
    quantity: number;
    unitCost: number;
    qaStatus: string;
    remarks: string | null;
    expiryDate: string | null;
    createdOn: string | null;
}

// Level 3 Node for Finished Goods: Storage Lot Location under a Recipe Version
export interface LotReportNode {
    lotId: number | null;
    lotName: string;
    branchId: number;
    branchName: string;
    maxBatchCapacity: number;
    subtotalQuantity: number;
    batches: BatchReportEntry[];
}

// Level 2 Node for Finished Goods: Product Manufacturing Version
export interface VersionReportNode {
    versionId: number | null;
    versionName: string;
    subtotalQuantity: number;
    lots: LotReportNode[];
}

// Level 1 Node: Product Master
export interface ProductReportNode {
    productId: number;
    productName: string;
    productCode: string;
    uomShortcut: string;
    totalAvailable: number;
    versions?: VersionReportNode[]; // For Finished Goods (4-level hierarchy: Product ➔ Version ➔ Lot ➔ Batch)
    lots?: LotReportNode[];        // For Raw Materials & Packaging Items (3-level hierarchy: Product ➔ Lot ➔ Batch)
}

// ─── Raw Movement Entry (Matches BFF Response) ──────────────────────────

export interface MovementReportEntry {
    movement_id: number;
    product_id: number;
    version_id?: number;
    lot_id: number;
    branch_id: number;
    transaction_type_id: number;
    source_document_id: number;
    source_document_no?: string;
    batch_no: string;
    expiry_date?: string;
    manufacturing_date?: string;
    quantity: number; // Signed: positive for IN, negative for OUT
    created_by?: number;
    created_at: string;
    remarks?: string;
}

// ─── Filter Types ─────────────────────────────────────────────────────

export interface MovementFilters {
    productId: number | null;
    branchId: number | null;
    lotId: number | null;
    batchNo: string;
    startDate: string;
    endDate: string;
}

// ─── Legacy/BFF Types (Required to maintain compile-safety of backend routes) ──

export interface LotUtilization {
    lotId: number;
    lotName: string;
    inventoryType: string;
    currentStock: number;
    maxBatchCapacity: number;
    utilizationPercent: number;
}

export interface StockLedgerEntry {
    movementId: number;
    createdAt: string;
    sourceDocumentNo: string;
    batchNo: string;
    transactionType: string;
    direction: "IN" | "OUT" | "NEUTRAL";
    quantity: number;
    runningBalance: number;
    createdBy: string;
    remarks: string | null;
}

export interface StockLedgerFilters {
    productId: number | null;
    branchId: number | null;
    lotId: number | null;
    startDate: string;
    endDate: string;
}

export interface FEFOBatchEntry {
    productId: number;
    productName: string;
    productCode: string;
    batchNo: string;
    lotName: string;
    expiryDate: string;
    manufacturingDate: string;
    daysToExpiry: number;
    physicalAvailable: number;
    status: "Expired" | "Critical" | "Warning" | "Safe";
}

// ─── Shared Lookup Types ─────────────────────────────────────────────

export interface ProductLookup {
    productId: number;
    productName: string;
    productCode: string;
    productType?: number;
}

export interface BranchLookup {
    branchId: number;
    branchName: string;
}

export interface LotLookup {
    lotId: number;
    lotName: string;
    inventoryTypeName: string;
    maxBatchCapacity: number;
}

export interface TransactionTypeLookup {
    transactionTypeId: number;
    typeName: string;
    direction: "IN" | "OUT" | "NEUTRAL";
}
