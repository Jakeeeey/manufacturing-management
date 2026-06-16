import { NextResponse } from "next/server";
import { 
    fetchIncomingShipments, 
    fetchShipmentLineItems, 
    createIncomingShipment,
    updateIncomingShipmentStatus
} from "../../directus-api";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const shipmentId = searchParams.get("shipmentId");

        if (shipmentId) {
            const lineItems = await fetchShipmentLineItems(parseInt(shipmentId));
            return NextResponse.json(lineItems);
        }

        const shipments = await fetchIncomingShipments();
        return NextResponse.json(shipments);
    } catch (e) {
        console.error("API Error fetching shipments:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch shipments" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { shipmentData, lineItems } = body;

        if (!shipmentData || !shipmentData.reference_number || !shipmentData.supplier_id || !lineItems) {
            return NextResponse.json({ error: "Missing required fields (reference_number, supplier_id, lineItems)" }, { status: 400 });
        }

        const result = await createIncomingShipment(shipmentData, lineItems);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error creating incoming shipment:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to create shipment" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { shipmentId, status } = body;

        if (!shipmentId || !status) {
            return NextResponse.json({ error: "Missing required fields (shipmentId, status)" }, { status: 400 });
        }

        const result = await updateIncomingShipmentStatus(parseInt(shipmentId), status);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error updating shipment status:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to update shipment status" }, { status: 500 });
    }
}
