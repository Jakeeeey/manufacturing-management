import { NextResponse } from "next/server";
import {
    PURCHASE_ORDER_MODULE_PATHS,
    PurchaseOrderAuthorizationError,
    requirePurchaseOrderModuleAccess
} from "../../_auth";
import {
    getPurchaseOrderApprovalDetail,
    PurchaseOrderApprovalError,
    submitPurchaseOrderApproval
} from "../../_approval-service";
import { purchaseOrderApprovalSchema } from "../../_schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function routeError(error: unknown) {
    const status = error instanceof PurchaseOrderAuthorizationError
        ? error.status
        : error instanceof PurchaseOrderApprovalError
            ? error.status
            : 500;
    return NextResponse.json({
        error: (error as Error).message || "Purchase-order approval failed.",
        details: error instanceof PurchaseOrderApprovalError ? error.details : undefined
    }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid purchase-order ID." }, { status: 400 });
    try {
        await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.approval });
        return NextResponse.json({ data: await getPurchaseOrderApprovalDetail(id) });
    } catch (error) {
        return routeError(error);
    }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid purchase-order ID." }, { status: 400 });
    try {
        const parsed = purchaseOrderApprovalSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid approval action.", details: parsed.error.flatten() }, { status: 400 });
        }
        const actor = await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.approval });
        return NextResponse.json(await submitPurchaseOrderApproval(id, parsed.data, actor));
    } catch (error) {
        return routeError(error);
    }
}
