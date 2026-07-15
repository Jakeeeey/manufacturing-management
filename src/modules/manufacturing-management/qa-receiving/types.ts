export interface Branch {
    id: number;
    branch_name: string;
    branch_code: string;
}

export interface StorageLot {
    lot_id: number;
    lot_name: string;
    inventory_type_id?: number | null;
    max_batch_capacity: number;
}

export interface Shipment {
    shipment_id: number;
    reference_number: string;
    status: string;
    total_php_value: string;
    created_at: string;
    supplier_id: unknown;
    date_received: string;
    branch_id?: number | null;
}

export interface Product {
    product_id: number;
    product_name: string;
    product_code: string;
    description: string;
    unit_of_measurement?: {
        unit_id: number;
        unit_shortcut: string;
        unit_name: string;
    } | null;
    unit_of_measurement_count?: number | null;
    parent_id?: number | null;
    product_image?: string | null;
}

export interface ShipmentLineItem {
    line_id: number;
    shipment_id: unknown;
    product_id: Product; // Can be object when queried with fields relation
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
    receivedQty: number | string;
    acceptedQty: number | string;
    boQty: number | string;
    batchNumber: string;
    lotId: string;
    expirationDate: string;
    rejectionReason: string;
    qaStatus: string;
    isPackaging: boolean;
}

export type QaSpecification = import("@/app/api/manufacturing/qa/_purchase-specification-domain").ProductQaSpecification;
export type QaSpecificationLoadStatus = "loading" | "loaded" | "error";

export interface QaSpecificationLoadState {
    status: QaSpecificationLoadStatus;
    specifications: QaSpecification[];
    error: string | null;
}

export type QaSpecificationReadings = Record<number, Record<number, string>>;

export interface FIFOBatch {
    lot_number: string;
    expiration_date?: string;
    reception_date: string;
    received_qty: number;
    shipment_ref: string;
}

export interface FIFOInventoryItem {
    product: {
        product_id: number;
        product_name: string;
        product_code: string;
    };
    isPackaging: boolean;
    totalQty: number;
    batches: FIFOBatch[];
}
