export interface ThresholdRule {
    id: number;
    min_margin: number; // e.g. 15 for 15%
    action: "flag_alert" | "require_approval" | "auto_reject";
    role_required: "Director" | "System Admin" | "Finance Manager" | "Sales Director";
    description: string;
    is_active: boolean;
}

export interface ApprovalRequest {
    id: number;
    sales_order_id: number;
    sales_order_code: string;
    client_name: string;
    current_margin: number; // e.g. 12.5 for 12.5%
    status: "pending" | "approved" | "rejected";
    requested_by: string;
    requested_at: string;
    reviewed_by?: string;
    reviewed_at?: string;
    comments?: string;
}
