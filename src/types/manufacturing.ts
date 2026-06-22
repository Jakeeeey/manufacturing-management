// src/types/manufacturing.ts

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

export interface DirectusProductPerSupplier {
    id: number;
    supplier_id: number;
    product_id: DirectusProduct & {
        unit_of_measurement?: {
            unit_id: number;
            unit_name: string;
            unit_shortcut: string;
            sku_code?: string | null;
        } | null;
    };
}

export interface DirectusSupplier {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string | null;
    isActive?: boolean;
}

export interface DirectusShipment {
    shipment_id?: number;
    reference_number: string;
    supplier_id: number | Record<string, unknown>;
    date_received: string | null;
    lead_time_receiving?: string | null;
    total_foreign_currency: number;
    exchange_rate: number;
    total_php_value: number;
    status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received";
    created_at?: string;
}

export interface DirectusShipmentLineItem {
    line_id?: number;
    shipment_id: number;
    product_id: number | Record<string, unknown>;
    quantity_received: number;
    base_unit_cost_php: number;
    allocated_expense_php: number;
    final_landed_unit_cost: number;
}

export interface DirectusShipmentExpense {
    expense_id?: number;
    shipment_id: number;
    expense_type: string;
    amount_php: number;
    allocation_method: "Value" | "Weight" | "Volume";
}

export interface DirectusJobOrder {
    jo_id: string;
    due_date?: string | null;
    status: string;
    is_batched: boolean;
    procurement_status: string;
    branch_id?: number | null;
    assigned_personnel?: unknown;
    shift_option?: string | null;
    daily_breakdown?: unknown;
    product_id?: number | null;
    product_name?: string | null;
    quantity?: number;
    bom?: unknown;
    components?: unknown;
    routings?: unknown;
    allocation_results?: unknown;
    products?: {
        product_id?: number | null;
        product_name?: string | null;
        quantity?: number;
        bom?: unknown;
        components?: unknown;
        routings?: unknown;
        allocation_results?: unknown;
    }[];
    sales_orders?: unknown[];
    [key: string]: unknown;
}
