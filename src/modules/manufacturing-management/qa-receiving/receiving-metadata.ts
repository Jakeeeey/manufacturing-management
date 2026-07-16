export interface ReceivingMetadataLine {
    productName: string;
    isPackaging: boolean;
    receivedQuantity: number;
    batchNumber: string;
    lotId: string;
    manufacturingDate: string;
    expirationDate: string;
}

export function validateReceivingMetadata(
    receiptNumber: string,
    branchId: string,
    lines: ReceivingMetadataLine[]
): string | null {
    const normalizedReceiptNumber = receiptNumber.trim();
    if (!normalizedReceiptNumber) return "Please enter the Receiving Ticket / DR Number.";
    if (normalizedReceiptNumber.length > 50) return "Receiving Ticket / DR Number cannot exceed 50 characters.";
    if (!Number.isInteger(Number(branchId)) || Number(branchId) <= 0) return "Please select a receiving warehouse branch.";

    for (const line of lines) {
        if (line.receivedQuantity === 0) continue;
        if (!line.batchNumber.trim()) return `Please enter Supplier Batch Number for: ${line.productName}`;
        if (line.batchNumber.trim().length > 50) return `Supplier Batch Number cannot exceed 50 characters for: ${line.productName}`;
        if (!Number.isInteger(Number(line.lotId)) || Number(line.lotId) <= 0) return `Please select a Storage Lot for: ${line.productName}`;

        if (!line.isPackaging && !line.manufacturingDate) {
            return `Manufacturing Date is mandatory for Raw Material: ${line.productName}`;
        }
        if (!line.isPackaging && !line.expirationDate) {
            return `Expiry Date is mandatory for Raw Material: ${line.productName}`;
        }
        if (line.manufacturingDate && line.expirationDate && line.manufacturingDate > line.expirationDate) {
            return `Manufacturing Date cannot be later than Expiry Date for: ${line.productName}`;
        }
    }

    return null;
}
