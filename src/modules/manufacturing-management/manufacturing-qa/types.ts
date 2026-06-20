// src/modules/manufacturing-management/manufacturing-qa/types.ts

export interface QALogEntry {
    id: number;
    task_id: number;
    jo_id: string;
    task_name: string;
    product_name: string;
    expected_quantity: number;
    actual_quantity: number;
    deviation_quantity: number;
    qa_status: "Passed" | "Failed";
    recorded_at: string;
    comments?: string;
    photos?: string[] | null;
}

export interface JobOrderRoutingTask {
    id: number;
    jo_id: string;
    routing_id: number;
    name: string;
    sequence_order: number;
    status: "Pending" | "In Progress" | "Completed";
    started_at?: string | null;
    completed_at?: string | null;
    completed_by?: number | null;
    requires_qa?: boolean;
}

export interface JobOrderProduct {
    product_id: number;
    product_name: string;
    quantity: number;
    routings?: any[];
    components?: any[];
    allocation_results?: any[];
}

export interface JobOrder {
    jo_id: string;
    product_id: number;
    product_name: string;
    quantity: number;
    due_date: string;
    status: "Draft" | "Shortage" | "Proceed" | "Ongoing" | "Finished" | "On Hold" | "Cancelled";
    branch_id?: number;
    products?: JobOrderProduct[];
    routing_tasks?: JobOrderRoutingTask[];
    [key: string]: any;
}
