import { NextResponse } from "next/server";

const DIRECTUS_URL = "http://goatedcodoer:8091";
const DIRECTUS_STATIC_TOKEN = "rTilKSsclzuQW8WfQWK1ba8wrD_LetNn";

const headers = {
    "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}`,
    "Content-Type": "application/json"
};

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const productId = searchParams.get("productId");
        const action = searchParams.get("action");

        // Action: Fetch branches
        if (action === "branches") {
            const res = await fetch(`${DIRECTUS_URL}/items/branches?filter[isActive][_eq]=1&sort=branch_name&limit=100`, { headers });
            if (!res.ok) throw new Error(`Directus error loading branches: ${res.status}`);
            const json = await res.json();
            return NextResponse.json(json.data);
        }

        // Action: Fetch FIFO Inventory for a product across all branches
        if (productId) {
            const res = await fetch(
                `${DIRECTUS_URL}/items/shipment_line_items?filter[product_id][_eq]=${productId}&filter[quantity_received][_gt]=0&fields=*,product_id.*,shipment_id.*,branch_id.*&limit=150`,
                { headers }
            );
            if (!res.ok) throw new Error(`Directus error loading product ledger: ${res.status}`);
            const json = await res.json();
            return NextResponse.json(json.data);
        }

        // Action: Fetch FIFO Inventory for a branch
        if (branchId) {
            const res = await fetch(
                `${DIRECTUS_URL}/items/shipment_line_items?filter[branch_id][_eq]=${branchId}&filter[quantity_received][_gt]=0&fields=*,product_id.*,shipment_id.*&limit=150`,
                { headers }
            );
            if (!res.ok) throw new Error(`Directus error loading ledger: ${res.status}`);
            const json = await res.json();
            return NextResponse.json(json.data);
        }

        return NextResponse.json({ error: "Missing parameter branchId or action=branches" }, { status: 400 });
    } catch (e: any) {
        console.error("API Error in QA Receiving route:", e);
        return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { shipmentId, referenceNumber, branchId, branchName, lineItemUpdates } = body;

        if (!shipmentId || !branchId || !lineItemUpdates || !Array.isArray(lineItemUpdates)) {
            return NextResponse.json({ error: "Missing required fields (shipmentId, branchId, lineItemUpdates)" }, { status: 400 });
        }

        const branchIdNum = parseInt(branchId);

        // 1. Loop and apply line item updates & ledger entries
        for (const item of lineItemUpdates) {
            const qtyReceived = Number(item.quantity_received || 0);

            // Update line item inspection data
            const updateRes = await fetch(`${DIRECTUS_URL}/items/shipment_line_items/${item.line_id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    quantity_received: qtyReceived,
                    quantity_rejected: Number(item.quantity_rejected || 0),
                    lot_number: item.lot_number || null,
                    expiration_date: item.expiration_date || null,
                    branch_id: branchIdNum,
                    rejection_reason: item.rejection_reason || null,
                    qa_status: item.qa_status
                })
            });

            if (!updateRes.ok) {
                throw new Error(`Failed to update line item ${item.line_id}: ${updateRes.status} - ${await updateRes.text()}`);
            }

            // Insert into product_ledger if quantity_received > 0
            if (qtyReceived > 0) {
                const ledgerPayload = {
                    branchId: branchIdNum,
                    productId: item.product_id,
                    quantity: qtyReceived,
                    documentType: "QA Receive",
                    documentNo: referenceNumber || "N/A",
                    documentDescription: `QA Inspection Batch: ${item.lot_number || "N/A"} (${item.qa_status})`,
                    documentDate: new Date().toISOString().split('T')[0]
                };

                const ledgerRes = await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(ledgerPayload)
                });

                if (!ledgerRes.ok) {
                    console.error(`Ledger record failed for product ID ${item.product_id}:`, await ledgerRes.text());
                }
            }
        }

        // 2. Transition shipment status to "Receiving (QA)"
        const statusRes = await fetch(`${DIRECTUS_URL}/items/incoming_shipments/${shipmentId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                status: "Received",
                date_received: new Date().toISOString().split('T')[0]
            })
        });

        if (!statusRes.ok) {
            throw new Error(`Failed to update shipment status: ${statusRes.status}`);
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("API Error submitting QA Receiving:", e);
        return NextResponse.json({ error: e.message || "Failed to process QA receiving" }, { status: 500 });
    }
}
