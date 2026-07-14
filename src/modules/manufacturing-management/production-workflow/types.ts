/* eslint-disable */
export interface OperatorAssignment {
    id: number;
    task_id: number;
    user_id: number;
    hourly_rate: number;
    logged_hours: number;
    is_team_lead?: boolean;
    started_at?: string | null;
    stopped_at?: string | null;
}

export interface RoutingTask {
    id: number;
    jo_id: string;
    routing_id: number;
    name: string;
    sequence_order: number;
    status: "Pending" | "Ongoing" | "Completed" | "QA Hold" | "Skipped" | string;
    planned_setup_hours: number;
    planned_run_hours: number;
    actual_setup_hours: number;
    actual_run_hours: number;
    estimated_labor_cost: number;
    actual_labor_cost: number;
    completed_at: string | null;
    requires_qa: number; // 0 or 1
    assignments: OperatorAssignment[];
    qa_logs: any[];
    bom_items?: {
        product_id: number;
        product_name: string;
        qty_per_unit: number;
        total_needed: number;
        unit_shortcut: string;
    }[];
}

export interface JobOrder {
    jo_id: string;
    order_id?: number;
    order_no?: string;
    product_id: number;
    product_name: string;
    quantity: number;
    due_date: string;
    status: "Draft" | "Proceed" | "Ongoing" | "Finished" | "On Hold" | string;
    branch_id: number;
    routing_tasks?: RoutingTask[];
    routingTasks?: RoutingTask[];
    parentJobOrderId?: number | null;
    parent_job_order_id?: number | null;
    version_name?: string;
    shiftOption?: string;
    producedQty?: number;
}

export interface User {
    user_id: number;
    id: number;
    first_name?: string;
    last_name?: string;
    user_fname?: string;
    user_lname?: string;
    user_position?: string;
    position?: string;
    hourly_rate?: number;
    rate?: number;
}

export interface RouteOperatorRecord {
    id: number;
    jo_id: string;
    routing_id: number;
    task_id: number;
    user_id: number;
    started_at: string | null;
    stopped_at: string | null;
    actual_hours: number;
    hourly_rate: number;
    labor_cost: number;
    user_name?: string;
    user_position?: string;
}

export interface QATemplateParameter {
    parameter_id: number;
    template_id: number;
    parameter_name?: string;
    test_name?: string;
    test_type: "Numeric" | "Boolean" | "Yes/No" | "Text" | string;
    min_value: number | null;
    max_value: number | null;
    target_value: string | null;
    is_critical: boolean | number;
}

export interface QATemplate {
    template_id: number;
    template_name: string;
    description: string | null;
    is_active: boolean;
}
