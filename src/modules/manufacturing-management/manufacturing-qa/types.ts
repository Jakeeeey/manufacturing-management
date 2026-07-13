/* eslint-disable */
export interface QALog {
    id: number;
    task_id: {
        jo_route_id: number;
        jo_id: string;
        operation_name?: string;
        name?: string;
        sequence_order: number;
        status: string;
        [key: string]: any;
    } | number | null;
    expected_quantity: number;
    actual_quantity: number;
    deviation_quantity: number;
    qa_status: "Passed" | "Failed";
    recorded_at: string;
    comments?: string;
    photos?: string | null;
}

export interface DispositionRecord {
    id: string;
    jo_id: string;
    task_id: string | number;
    task_name: string;
    product_name: string;
    expected_quantity: number;
    actual_quantity: number;
    failed_parameters: Array<{
        parameter_id: number;
        test_name: string;
        min_value?: number | null;
        max_value?: number | null;
        value?: any;
        is_failed: boolean;
        is_critical: boolean;
    }>;
    disposition_status: "Pending" | "Resolved";
    decision: "Release with Deviation" | "Rework" | "Scrap" | null;
    supervisor_comments: string;
    recorded_at: string;
    resolved_at: string | null;
    resolved_by: number | null;
}

export interface JobOrder {
    jo_id: string;
    product_id: number;
    product_name: string;
    quantity: number;
    due_date?: string | null;
    status: string;
    branch_id?: number | null;
    bom?: { version_id: number } | null;
    [key: string]: any;
}

export interface Branch {
    id?: number;
    branch_id?: number;
    name?: string;
    branch_name?: string;
}
