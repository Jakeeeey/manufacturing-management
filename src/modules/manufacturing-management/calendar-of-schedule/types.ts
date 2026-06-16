export interface JobOrder {
    jo_id: string;
    order_no: string;
    product_id: number;
    product_name: string;
    quantity: number;
    due_date: string;
    status: "Draft" | "Shortage" | "Proceed" | "Ongoing" | "Finished" | "On Hold" | "Cancelled";
    is_batched?: boolean;
    bom?: any;
    routings?: any[];
}

export interface IncomingShipment {
    shipment_id: number;
    reference_number: string;
    shipper: string;
    carrier: string;
    estimated_delivery_date: string;
    actual_delivery_date?: string;
    status: string;
    notes?: string;
}
