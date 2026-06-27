export interface Supplier {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string;
    tin_number?: string;
    phone_number?: string;
    email_address?: string;
    address?: string;
    city?: string;
    brgy?: string;
    state_province?: string;
    country?: string;
    postal_code?: string;
    contact_person?: string;
    payment_terms?: string;
    delivery_terms?: string;
    notes_or_comments?: string;
    isActive?: number;
}

export interface IncomingShipment {
    shipment_id: number;
    reference_number: string;
    supplier_id: number | Supplier;
    date_received: string | null;
    lead_time_receiving?: string | null;
    total_foreign_currency: number;
    exchange_rate: number;
    total_php_value: number;
    status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received";
    created_at?: string;
}

export interface ShipmentLineItem {
    line_id?: number;
    shipment_id: number;
    product_id: number | {
        product_id: number;
        product_name: string;
        product_code?: string;
        unit_of_measurement?: {
            unit_id: number;
            unit_shortcut: string;
            unit_name: string;
        };
    };
    quantity_ordered?: number;
    quantity_received?: number | null;
    base_unit_cost_php: number;
    allocated_expense_php: number;
    final_landed_unit_cost: number;
}

export interface ShipmentExpense {
    expense_id?: number;
    shipment_id: number;
    expense_type?: string;
    overhead_id?: number;
    amount_php: number;
    allocation_method: "By Value" | "By Weight" | "By Volume" | "Manual" | "Value" | "Weight" | "Volume";
}

export interface RawMaterial {
    product_id: number;
    parent_id?: number | null;
    product_code?: string;
    product_name: string;
    description?: string;
    barcode?: string;
    unit_of_measurement?: {
        unit_id: number;
        unit_shortcut: string;
        unit_name: string;
    };
    cost_per_unit: number;
    estimated_unit_cost: number;
    density_factor: number;
    product_category?: number | null;
    date_added?: string;
    last_updated?: string;
}

export interface LinkedProduct {
    id: number;
    supplier_id: number;
    product_id?: {
        id: number;
        product_code?: string;
        product_name?: string;
        description?: string;
        unit_of_measurement?: {
            id: number;
            uom_name?: string;
        };
    };
}

export interface PSGCItem {
    code: string;
    name: string;
}
