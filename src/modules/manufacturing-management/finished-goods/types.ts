export interface BOMItem {
    id: string;
    productId?: number;
    name: string;
    type: "raw_material" | "sub_assembly" | "by_product";
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
