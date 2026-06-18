export interface Customer {
    id: number | string;
    customer_name: string;
    customer_code: string;
    isActive?: boolean;
}

export interface QuotationHeader {
    id: number;
    quote_number: string;
    customer_id: number | Customer | null;
    total_selling_price: number;
    total_simulated_cost: number;
    forex_rate_used: number;
    remarks?: string;
    quote_date?: string;
    status?: string;
    project_name?: string;
}

export interface QuotationSnapshotNode {
    id: number;
    product_id: number;
    version_id: number;
    node_name: string;
    node_type: string;
    quantity: number;
    uom: string;
    frozen_unit_cost_php: number;
    frozen_total_cost_php: number;
}

export interface CatalogProduct {
    product_id: number;
    product_name: string;
    product_code: string;
    price_per_unit: number;
    cost_per_unit: number;
    unit_of_measurement?: {
        unit_shortcut: string;
    };
    product_category?: unknown;
    parent_id?: {
        product_name: string;
    } | null;
    has_cogs?: boolean;
}

export interface SelectedQuoteProduct {
    product: CatalogProduct;
    priceTypePrice: number; // Preloaded price from price type
    agreedPrice: number; // User edited override price
    versionId?: number | null;
    versionName?: string | null;
}
