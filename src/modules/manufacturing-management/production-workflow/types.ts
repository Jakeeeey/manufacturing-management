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

export interface ComponentConsumption {
    component_product_id: number;
    component_name: string;
    product_name?: string;
    quantity: number;
    required?: number;
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
    componentsConsumed: ComponentConsumption[];
    completeJobOrder?: boolean;
    uom?: string;
}
