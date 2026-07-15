import { cookies } from "next/headers";
import { procurementDirectusFetch } from "../procurement/_directus";
import type { ApprovalStage } from "./_domain";

const ACCESS_TOKEN_COOKIE = "vos_access_token";

export const PURCHASE_ORDER_MODULE_PATHS = {
    procurement: "/mm/incoming-shipments",
    approval: "/mm/approval",
    receiving: "/mm/qa-receiving"
} as const;

export type PurchaseOrderModulePath = typeof PURCHASE_ORDER_MODULE_PATHS[keyof typeof PURCHASE_ORDER_MODULE_PATHS];

export class PurchaseOrderAuthorizationError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
    }
}

interface RelationRecord {
    id?: unknown;
}

interface DirectusUserRecord {
    user_id?: unknown;
    role_id?: number | RelationRecord | null;
    role?: unknown;
    isAdmin?: unknown;
}

interface ModuleAccessRecord {
    module_id?: { base_path?: unknown } | number | null;
}

interface ApprovalPermissionRecord {
    approval_stage?: unknown;
    can_reject?: unknown;
}

export interface AuthorizedPurchaseOrderUser {
    userId: number;
    roleId: number | null;
    admin: boolean;
    modulePath: PurchaseOrderModulePath;
    approvalStage: ApprovalStage | null;
    canReject: boolean;
}

function positiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function relationId(value: DirectusUserRecord["role_id"]): number | null {
    if (typeof value === "number") return positiveInteger(value);
    return value && typeof value === "object" ? positiveInteger(value.id) : null;
}

async function responseData<T>(response: Response, message: string): Promise<T> {
    if (!response.ok) throw new PurchaseOrderAuthorizationError(503, message);
    const body = await response.json();
    return body.data as T;
}

export async function requirePurchaseOrderModuleAccess(options: {
    modulePath: PurchaseOrderModulePath;
    approvalStage?: ApprovalStage;
    requireReject?: boolean;
}): Promise<AuthorizedPurchaseOrderUser> {
    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
    if (!token) throw new PurchaseOrderAuthorizationError(401, "Authentication is required.");

    const springBase = process.env.SPRING_API_BASE_URL?.replace(/\/$/, "");
    if (!springBase) throw new PurchaseOrderAuthorizationError(500, "Authentication service is not configured.");

    let authResponse: Response;
    try {
        authResponse = await fetch(`${springBase}/auth/me`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            cache: "no-store"
        });
    } catch {
        throw new PurchaseOrderAuthorizationError(503, "Authentication service is unavailable.");
    }
    if (authResponse.status === 401 || authResponse.status === 403) {
        throw new PurchaseOrderAuthorizationError(401, "Your session is invalid or has expired.");
    }
    if (!authResponse.ok) throw new PurchaseOrderAuthorizationError(503, "Authentication service is unavailable.");

    const authenticated = await authResponse.json();
    const userId = positiveInteger(authenticated?.id);
    if (!userId) throw new PurchaseOrderAuthorizationError(401, "Unable to verify the current user.");

    const accessParams = new URLSearchParams({
        "filter[user_id][_eq]": String(userId),
        fields: "module_id.base_path",
        limit: "-1"
    });
    const [userResponse, accessResponse] = await Promise.all([
        procurementDirectusFetch(`/items/user/${userId}?fields=user_id,role_id.id,role,isAdmin`),
        procurementDirectusFetch(`/items/user_access_modules?${accessParams.toString()}`)
    ]);
    const user = await responseData<DirectusUserRecord>(userResponse, "Unable to verify the current user role.");
    const accessRows = await responseData<ModuleAccessRecord[]>(accessResponse, "Unable to verify module access.");
    const roleId = relationId(user.role_id);
    const admin = authenticated?.admin === true
        || authenticated?.isAdmin === true
        || user.role === "ADMIN"
        || user.isAdmin === true
        || Number(user.isAdmin) === 1;
    const hasModule = accessRows.some(row =>
        row.module_id && typeof row.module_id === "object" && row.module_id.base_path === options.modulePath
    );
    if (!admin && !hasModule) {
        throw new PurchaseOrderAuthorizationError(403, "You do not have access to this purchase-order module.");
    }

    if (!options.approvalStage || admin) {
        return {
            userId,
            roleId,
            admin,
            modulePath: options.modulePath,
            approvalStage: options.approvalStage || null,
            canReject: admin
        };
    }
    const permissionParams = new URLSearchParams({
        "filter[_or][0][user_id][_eq]": String(userId),
        "filter[_or][1][role_id][_eq]": String(roleId || 0),
        "filter[approval_stage][_eq]": options.approvalStage,
        "filter[is_active][_eq]": "1",
        fields: "approval_stage,can_reject",
        limit: "1"
    });
    const permissionResponse = await procurementDirectusFetch(
        `/items/purchase_order_approval_role_permissions?${permissionParams.toString()}`
    );
    const permissions = await responseData<ApprovalPermissionRecord[]>(
        permissionResponse,
        "Unable to verify purchase-order approval permissions."
    );
    const permission = permissions[0];
    if (!permission || permission.approval_stage !== options.approvalStage) {
        throw new PurchaseOrderAuthorizationError(403, `You are not configured for ${options.approvalStage} approval.`);
    }
    const canReject = permission.can_reject === true || Number(permission.can_reject) === 1;
    if (options.requireReject && !canReject) {
        throw new PurchaseOrderAuthorizationError(403, "Your role cannot reject purchase orders.");
    }

    return {
        userId,
        roleId,
        admin,
        modulePath: options.modulePath,
        approvalStage: options.approvalStage,
        canReject
    };
}
