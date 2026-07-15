export type InvoiceReservationStatus = "Unallocated" | "Partial" | "Reserved";

export interface Branch {
    id: number;
    branchName: string;
    branchCode: string;
}

export interface InvoiceReservationAllocation {
    id: number;
    inventoryLotId: number;
    lotName: string;
    batchNo: string;
    expiryDate: string | null;
    quantity: number;
    status: string;
}

export interface InvoiceReservationDetail {
    detailId: number;
    productId: number;
    productName: string;
    productCode: string;
    requiredQuantity: number;
    reservedQuantity: number;
    shortageQuantity: number;
    allocations: InvoiceReservationAllocation[];
}

export interface InvoiceReservationSummary {
    invoiceId: number;
    invoiceNo: string;
    invoiceDate: string | null;
    customerName: string;
    branchId: number;
    totalDetails: number;
    fullyReservedDetails: number;
    requiredQuantity: number;
    reservedQuantity: number;
    status: InvoiceReservationStatus;
    details: InvoiceReservationDetail[];
}

export interface InvoiceReservationResponse {
    invoices: InvoiceReservationSummary[];
}

export interface InvoiceReservationActionResponse {
    message?: string;
}
