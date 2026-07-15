import { NextResponse } from "next/server";
import { fetchIncomingShipmentsPage } from "../procurement/shipments/shipments-helper";
import { POST as legacyCreate } from "../procurement/shipments/route";
import {
    PURCHASE_ORDER_MODULE_PATHS,
    PurchaseOrderAuthorizationError,
    requirePurchaseOrderModuleAccess
} from "./_auth";
import { purchaseOrderListQuerySchema } from "./_schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        await requirePurchaseOrderModuleAccess({ modulePaths: Object.values(PURCHASE_ORDER_MODULE_PATHS) });
        const values = Object.fromEntries(new URL(request.url).searchParams.entries());
        const parsed = purchaseOrderListQuerySchema.safeParse(values);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid purchase-order query.", details: parsed.error.flatten() }, { status: 400 });
        }
        return NextResponse.json(await fetchIncomingShipmentsPage(parsed.data));
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message || "Failed to load purchase orders." }, {
            status: error instanceof PurchaseOrderAuthorizationError ? error.status : 500
        });
    }
}

export async function POST(request: Request) {
    return legacyCreate(request);
}
