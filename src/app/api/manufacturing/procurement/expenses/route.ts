import { NextResponse } from "next/server";
import { 
    fetchShipmentExpenses, 
    processShipmentLandedCosts 
} from "@/modules/manufacturing-management/services/manufacturing-service";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const shipmentId = searchParams.get("shipmentId");

        if (!shipmentId) {
            return NextResponse.json({ error: "shipmentId is required" }, { status: 400 });
        }

        const expenses = await fetchShipmentExpenses(parseInt(shipmentId));
        return NextResponse.json(expenses);
    } catch (e) {
        console.error("API Error fetching shipment expenses:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch shipment expenses" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { shipmentId, status, expenses, allocationMethod, lineItemUpdates } = body;

        if (!shipmentId || !status || !expenses || !allocationMethod) {
            return NextResponse.json({ error: "Missing required fields (shipmentId, status, expenses, allocationMethod)" }, { status: 400 });
        }

        const result = await processShipmentLandedCosts(
            parseInt(shipmentId),
            status,
            expenses,
            allocationMethod,
            lineItemUpdates
        );
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error allocating shipment expenses:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to allocate shipment expenses" }, { status: 500 });
    }
}
