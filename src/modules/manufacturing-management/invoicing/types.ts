export interface InvoicingCandidate {
    order_id: number;
    order_no: string;
    po_no: string;
    customer_code: string;
    customer_name: string;
    branch_id: number;
    branch_name?: string;
    order_status: string;
    order_date: string;
    net_amount?: number;
    total_amount?: number;
    details: InvoicingLine[];
}

export interface InvoicingLine {
    detail_id: number;
    product_id: number | { product_id: number; product_name: string; product_code: string; uom?: string };
    ordered_quantity: number;
    unit_price: number;
    net_amount: number;
    bom_version_name?: string;
}

export interface CreateInvoicePayload {
    salesOrderId: number;
    invoiceNo: string;
    invoiceTypeId: number;
    invoiceDate: string;
    dueDate: string;
    remarks?: string;
}

export interface ReceiptType {
    id: number;
    type: string;
    isOfficial: boolean;
    maxLength: number;
}

export interface CreatedInvoiceResult {
    invoiceId: number;
    invoiceNo: string;
    transactionStatus: "Prepared";
    reservationCount: number;
}

export interface PrintableInvoiceLine {
    detailId: number;
    productCode: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discountAmount: number;
    grossAmount: number;
    netAmount: number;
}

export interface PrintableInvoice {
    invoiceId: number;
    invoiceNo: string;
    invoiceDate: string;
    dueDate: string;
    transactionStatus: string;
    receiptType: ReceiptType;
    orderNo: string;
    poNo: string;
    customerName: string;
    storeName: string;
    customerTin: string;
    customerAddress: string;
    salesmanName: string;
    paymentTermName: string;
    lines: PrintableInvoiceLine[];
    totals: { gross: number; discount: number; vat: number; net: number };
}

export interface CustomerGroup {
    customer_code: string;
    customer_name: string;
    order_count: number;
    total_amount: number;
    orders: InvoicingCandidate[];
}

export interface InvoicingFilters {
    search: string;
    customerCode: string;
    branchId: string;
    dateFrom: string;
    dateTo: string;
}
