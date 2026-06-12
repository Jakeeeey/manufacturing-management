export interface Branch {
    id: number;
    branch_name: string;
    branch_code: string;
}

export interface Shipment {
    shipment_id: number;
    reference_number: string;
    status: string;
    total_php_value: string;
    created_at: string;
    supplier_id: any;
    date_received: string;
}

export interface Product {
    product_id: number;
    product_name: string;
    product_code: string;
    description: string;
    unit_of_measurement: any;
}

export interface ShipmentLineItem {
    line_id: number;
    shipment_id: any;
    product_id: any; // Can be object when queried with fields relation
    quantity_ordered: number;
    quantity_received: number;
    quantity_rejected: number;
    base_unit_cost_php: number;
    lot_number?: string;
    expiration_date?: string;
    branch_id?: number;
    rejection_reason?: string;
    qa_status?: string;
}

export interface InspectionRow {
    acceptedQty: number;
    lotNumber: string;
    expirationDate: string;
    rejectionReason: string;
    qaStatus: string;
    isPackaging: boolean;
}
