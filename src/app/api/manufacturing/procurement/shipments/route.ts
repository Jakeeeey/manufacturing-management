import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { 
    fetchIncomingShipments, 
    fetchShipmentLineItems, 
    createIncomingShipment,
    updateIncomingShipmentStatus,
    receiveIncomingShipment
} from "./shipments-helper";

async function getUserIdFromSession(): Promise<number | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token")?.value;
        if (token) {
            const parts = token.split(".");
            if (parts.length >= 2) {
                const base64Url = parts[1];
                let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                while (base64.length % 4) base64 += "=";
                const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
                const payload = JSON.parse(jsonPayload);
                const rawId = payload?.id || payload?.user_id || payload?.sub;
                if (rawId) {
                    const parsed = Number(rawId);
                    if (!isNaN(parsed)) return parsed;
                }
            }
        }
    } catch (e) {
        console.error("Failed to extract userId from session token:", e);
    }
    return null;
}

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
        const { shipmentData, lineItems, isReceiveLog, branchId } = body;

        const userId = await getUserIdFromSession();

        if (isReceiveLog) {
            if (!shipmentData || !shipmentData.shipment_id || !branchId || !lineItems) {
                return NextResponse.json({ error: "Missing required fields for receive transaction" }, { status: 400 });
            }
            const result = await receiveIncomingShipment(shipmentData.shipment_id, branchId, lineItems, userId);
            return NextResponse.json(result);
        }

        if (!shipmentData || !shipmentData.reference_number || !shipmentData.supplier_id || !lineItems) {
            return NextResponse.json({ error: "Missing required fields (reference_number, supplier_id, lineItems)" }, { status: 400 });
        }

        const result = await createIncomingShipment(shipmentData, lineItems, userId);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error creating incoming shipment:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to create shipment" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { shipmentId, status, lead_time_receiving, approvedPrices, action } = body;

        if (!shipmentId) {
            return NextResponse.json({ error: "Missing required field (shipmentId)" }, { status: 400 });
        }

        const userId = await getUserIdFromSession();

        if (action === "approve") {
            // Update PO header status to Approved (3) and ETA
            const poPayload = {
                inventory_status: 3,
                lead_time_receiving: lead_time_receiving || null,
                approver_id: userId || null,
                date_approved: new Date().toISOString()
            };
            const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(poPayload)
            });
            if (!poRes.ok) throw new Error("Failed to update PO status to Approved");

            // Sync Approved status to incoming_shipments
            await fetch(`${DIRECTUS_URL}/items/incoming_shipments/${shipmentId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ status: "Approved", lead_time_receiving: lead_time_receiving || null })
            }).catch(err => console.error("Failed to sync approved status to incoming_shipments:", err));

            // Update PO products with approved prices
            if (approvedPrices && typeof approvedPrices === "object") {
                const popRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_products?filter[purchase_order_id][_eq]=${shipmentId}&limit=-1`, { headers });
                const pops = (await popRes.json()).data || [];
                for (const pop of pops) {
                    const price = approvedPrices[pop.product_id];
                    if (price !== undefined) {
                        const totalAmt = Number(price) * Number(pop.ordered_quantity || 0);
                        await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${pop.purchase_order_product_id}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify({
                                approved_price: Number(price),
                                total_amount: totalAmt
                            })
                        });
                    }
                }
            }
            return NextResponse.json({ success: true });
        }

        if (!status) {
            return NextResponse.json({ error: "Missing status for standard update" }, { status: 400 });
        }

        const result = await updateIncomingShipmentStatus(parseInt(shipmentId), status, userId, lead_time_receiving);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error updating shipment status:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to update shipment status" }, { status: 500 });
    }
}
