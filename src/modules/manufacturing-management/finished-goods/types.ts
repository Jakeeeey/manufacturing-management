export interface BOMItem {
    id: string;
    productId?: number;
    name: string;
    type: "raw_material" | "packaging" | "sub_assembly" | "by_product" | "finished_good";
    quantity: number;
    uom: string;
    uomId?: number;
    wastagePercent: number;
    landedCost: number;
    densityFactor?: number;
    isForeign?: boolean;
    currency?: "PHP" | "USD";
    originalPrice?: number | null;
}


export interface RoutingStep {
    id: string;
    sequence: number;
    name: string;
    operationId?: number;
    laborFlatRate: number;
    machineHourlyRate: number;
    durationHours: number;
    requiresQA?: boolean;
}


export interface Product {
    id: string;
    sku: string;
    title: string;
    description: string;
    barcode: string;
    baseUom: string;
    expectedYieldPercent: number;
    targetSellingPrice: number;
    parentProduct?: boolean;
    parent_id?: number | null;
    bom: BOMItem[];
    routings: RoutingStep[];
    densityFactor?: number;
    product_brand?: number;
    product_category?: number;
    product_class?: number;
    product_segment?: number;
    product_section?: number;
    product_shelf_life?: number;
    cost_per_unit?: number;
    unit_of_measurement_count?: number;
    product_image?: string;
    customOverhead?: number;
    has_versions?: boolean;
    production_capacity_per_hour?: number;
}

export interface Supplier {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string | null;
}

export interface Supplier {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string | null;
}

export interface Brand {
    brand_id: number;
    brand_name: string;
    sku_code?: string | null;
}

export interface Category {
    category_id: number;
    category_name: string;
    sku_code?: string | null;
}

export interface ProductClass {
    class_id: number;
    class_name: string;
}

export interface ProductSegment {
    segment_id: number;
    segment_name: string;
}

export interface ProductSection {
    section_id: number;
    section_name: string;
}

export interface Unit {
    unit_id: number;
    unit_name: string;
    unit_shortcut: string;
}

export interface ProductVersion {
    id: number;
    product_id: number;
    version_name: string;
    is_active?: boolean;
}

export interface ProductOverhead {
    id: string;
    overheadId: number;
    overheadName: string;
    amount: number;
}

export interface BFFCatalogProduct {
    product_id: number;
    product_name: string;
    product_code?: string | null;
    description?: string | null;
    barcode?: string | null;
    unit_of_measurement?: {
        unit_id: number;
        unit_shortcut: string;
    } | null;
    density_factor?: number | string | null;
    price_per_unit?: number | string | null;
    cost_per_unit?: number | string | null;
    parent_id?: number | null;
    product_brand?: number | null;
    product_category?: number | null;
    product_class?: number | null;
    product_segment?: number | null;
    product_section?: number | null;
    product_shelf_life?: number | null;
    unit_of_measurement_count?: number | null;
    product_image?: string | null;
    product_type?: number;
    has_versions?: boolean;
    production_capacity_per_hour?: number | null;
}

export interface OperationType {
    id: number;
    operation_name: string;
}

export interface OverheadType {
    id: number;
    overhead_name: string;
}

// ─── Directus API-layer types (used by API route helpers) ───────────────────

export interface DirectusProductCurrencyProfile {
    id: number;
    product_id: number;
    is_foreign_sourced: boolean;
    purchase_currency: "PHP" | "USD";
    purchase_price: number | null;
}

export interface DirectusProduct {
    product_id: number;
    product_name: string;
    product_code: string;
    description: string;
    unit_of_measurement: { unit_id: number; unit_name: string; unit_shortcut: string } | null;
    cost_per_unit: number;
    price_per_unit: number;
    barcode?: string | null;
    parent_id?: number | null;
    density_factor?: number | null;
    production_capacity_per_hour?: number | null;
    has_versions?: boolean;
    currency_profile?: DirectusProductCurrencyProfile | null;
}

export interface DirectusBOM {
    bom_id: number;
    product_id: number;
    bom_name: string;
    base_quantity: number;
    expected_yield_percentage: number;
    is_active: boolean;
    version: { id: number; version_name: string; created_at?: string } | number | null;
    valid_from?: string;
    valid_to?: string;
}

export interface DirectusUnit {
    unit_id: number;
    unit_name: string;
    unit_shortcut: string;
}

export interface DirectusBOMComponent {
    component_id: number;
    bom_id: number;
    component_product_id: number;
    quantity_required: number;
    unit_of_measurement: { unit_id: number; unit_name: string; unit_shortcut: string } | null;
    wastage_factor_percentage: number;
    component_type: "raw_material" | "sub_assembly" | "by_product";
    landed_cost?: number | null;
}

export interface DirectusOperation {
    id: number;
    operation_name: string;
}

export interface DirectusRouting {
    routing_id: number;
    bom_id: number;
    operation_name: string;
    operation_id?: number | null;
    estimated_labor_cost: number;
    estimated_overhead_cost: number;
    duration_hours: number;
    sequence_order: number;
    requires_qa?: boolean;
}

export interface DirectusBOMComponentInput {
    id?: string | number;
    productId: number;
    quantity: number;
    uom?: string | null;
    uomId?: number | null;
    wastagePercent: number;
    type?: "raw_material" | "sub_assembly" | "by_product" | null;
    landedCost?: number | null;
}

export interface DirectusRoutingStepInput {
    id?: string | number;
    sequence: number;
    name: string;
    operationId?: number | null;
    laborFlatRate: number;
    machineHourlyRate: number;
    durationHours: number;
    requiresQA?: boolean;
}

export interface CostRollupResult {
    productId: number;
    productName: string;
    sku: string;
    bomId: number | null;
    bomVersion: string | number;
    materialsCost: number;
    routingsCost: number;
    yieldPercentage: number;
    totalBaseCost: number;
    targetSellingPrice: number;
    grossMarginPercent: number;
    costTree: CostNode[];
}

export interface CostNode {
    id: string;
    name: string;
    type: "ingredient" | "by_product" | "routing" | "sub_assembly";
    quantity: number;
    uom: string;
    unitCost: number;
    wastagePercent: number;
    totalCost: number;
    children?: CostNode[];
}

export interface DirectusProductVersion {
    id: number;
    product_id: number;
    version_name: string;
}
