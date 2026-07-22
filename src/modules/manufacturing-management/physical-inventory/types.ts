export type CountSheetStatus = "Draft" | "Committed" | "Cancelled";

export interface ProductDetails {
    id?: string | number;
    product_id?: string | number;
    product_code?: string;
    code?: string;
    product_name?: string;
    name?: string;
    unit_of_measurement?: {
        unit_shortcut?: string;
        unit_name?: string;
    } | null;
}

export interface RecipeVersionDetails {
    id?: string | number;
    version_id?: string | number;
    version_name?: string;
    version_code?: string;
    name?: string;
    product_id?: string | number | ProductDetails | null;
}

export interface StorageLotDetails {
    id?: string | number;
    lot_id?: string | number;
    lot_name?: string;
    name?: string;
}

export interface PhysicalInventoryLineItem {
    id: string;
    ph_id?: string;
    date_encoded?: string;
    product_id?: string | number | ProductDetails | null;
    product_code?: string;
    product_name?: string;
    sku_code?: string;
    sku_name?: string;
    version_id?: string | number | RecipeVersionDetails | null;
    lot_id?: string | number | StorageLotDetails | null; // Bin/Rack Location or Lot Identifier
    batch_no?: string;
    uom?: string;
    unit_of_measure?: string;
    unit_price: number;
    system_count: number;
    physical_count: number | null;
    variance?: number;
    difference_cost?: number;
    amount?: number;
    offset_match?: number | null;
    category_name?: string;
    vendor_name?: string;
    last_counted_by?: string;
    remarks?: string;
}

export interface PhysicalCountSheet {
    id: string;
    ph_no?: string;
    sheet_no?: string;
    date_encoded?: string;
    starting_date?: string;
    cutOff_date?: string;
    cutoff_date?: string;
    price_type?: string;
    stock_type?: string;
    branch_id: number | string;
    branch_name: string;
    category?: string;
    category_id?: number;
    vendor?: string;
    supplier_id?: number;
    status?: CountSheetStatus;
    isComitted?: boolean;
    is_committed?: boolean;
    committed_at?: string | null;
    committed_by?: string | null;
    isCancelled?: boolean;
    is_cancelled?: boolean;
    cancelled_at?: string | null;
    total_amount: number;
    created_by?: string;
    created_at?: string;
    encoder_id?: number;
    encoder_name?: string;
    remarks?: string;
    notes?: string;
    line_items: PhysicalInventoryLineItem[];
}

export interface CountSheetSummary {
    totalItems: number;
    totalItemsCount: number;
    countedItemsCount: number;
    totalSystemQty: number;
    totalPhysicalQty: number;
    netVarianceQty: number;
    surplusItemsCount: number;
    deficitItemsCount: number;
    matchedItemsCount: number;
    uncountedItemsCount: number;
    totalSurplusCost: number;
    surplusVarianceCost: number;
    totalDeficitCost: number;
    deficitVarianceCost: number;
    netVarianceCost: number;
}

export interface Branch {
    id?: number | string;
    branch_id?: number | string;
    branchName?: string;
    branch_name?: string;
    name?: string;
    title?: string;
    branchCode?: string;
    branch_code?: string;
}

export interface ProductType {
    inventoryTypeId?: string | number;
    typeName?: string;
    name?: string;
}

