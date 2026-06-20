import { JobOrder } from "../planning-engineering/types";

export type { JobOrder };

export interface ActiveAssigningTask {
    jo: JobOrder;
    productId: number;
    routingId: number;
    operationName: string;
}

export interface QaTaskInfo {
    jo: JobOrder;
    productId: number;
    routingId: number;
    taskId: number;
    expected: number;
    taskName: string;
}

export interface FinishedGoodsReceiptPayload {
    joId: string;
    productId: number;
    productName: string;
    quantityProduced: number;
    branchId: number | string;
    lotNumber: string;
    expirationDate: string;
    unitCost: number;
    componentsConsumed: any[];
    completeJobOrder?: boolean;
    uom?: string;
}
