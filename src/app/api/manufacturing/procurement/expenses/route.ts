import { NextResponse } from "next/server";
import { 
    fetchShipmentExpenses, 
    processShipmentLandedCosts 
} from "./expenses-helper";
import { expenseAllocationSchema } from "../_schemas";
import {
    PURCHASE_ORDER_MODULE_PATHS,
    PurchaseOrderAuthorizationError,
    requirePurchaseOrderModuleAccess
} from "../../purchase-orders/_auth";

export async function GET(request: Request) {
    try {
        await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.expenses });
        const { searchParams } = new URL(request.url);
        const shipmentId = searchParams.get("shipmentId");

        if (!shipmentId) {
            return NextResponse.json({ error: "shipmentId is required" }, { status: 400 });
        }

        const expenses = await fetchShipmentExpenses(parseInt(shipmentId));
        return NextResponse.json(expenses);
    } catch (e) {
        console.error("API Error fetching shipment expenses:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch shipment expenses" }, {
            status: e instanceof PurchaseOrderAuthorizationError ? e.status : 500
        });
    }
}

export async function POST(request: Request) {
    try {
        await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.expenses });
        const parsed = expenseAllocationSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid expense allocation.", details: parsed.error.flatten() }, { status: 400 });
        }
        const { shipmentId, status, expenses, allocationMethod, lineItemUpdates } = parsed.data;

        const result = await processShipmentLandedCosts(
            shipmentId,
            status,
            expenses,
            allocationMethod,
            lineItemUpdates
        );
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error allocating shipment expenses:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to allocate shipment expenses" }, {
            status: e instanceof PurchaseOrderAuthorizationError ? e.status : 500
        });
    }
}
