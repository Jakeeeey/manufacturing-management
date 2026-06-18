import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "test";

const headers: Record<string, string> = {
    "Content-Type": "application/json"
};
if (DIRECTUS_STATIC_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
}

const FALLBACK_DIR = path.join(process.cwd(), "src/app/api/manufacturing/production/finished-goods");
const FALLBACK_FILE = path.join(FALLBACK_DIR, "fallback_db.json");

// Ensure fallback JSON file exists
function ensureFallbackFile() {
    if (!fs.existsSync(FALLBACK_DIR)) {
        fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    if (!fs.existsSync(FALLBACK_FILE)) {
        fs.writeFileSync(FALLBACK_FILE, JSON.stringify([], null, 2), "utf8");
    }
}

function getFallbackData() {
    ensureFallbackFile();
    try {
        const raw = fs.readFileSync(FALLBACK_FILE, "utf8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveFallbackData(data: any[]) {
    ensureFallbackFile();
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const joId = searchParams.get("joId");

        // Try querying Directus first
        try {
            let url = `${DIRECTUS_URL}/items/job_order_finished_goods?limit=-1&sort=-id`;
            if (joId) {
                url += `&filter[jo_id][_eq]=${encodeURIComponent(joId)}`;
            }
            const res = await fetch(url, { headers, cache: "no-store" });
            if (res.ok) {
                const json = await res.json();
                return NextResponse.json(json.data || []);
            }
        } catch (err) {
            console.warn("[BFF Finished Goods] Directus fetch failed, using fallback database.", err);
        }

        // Fallback to local file
        const data = getFallbackData();
        if (joId) {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            return NextResponse.json(data.filter((item: any) => item.jo_id === joId));
        }
        return NextResponse.json(data);
    } catch (e) {
        console.error("API Error in production finished-goods GET:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch finished goods receipts" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { joId, productId, productName, quantityProduced, branchId, lotNumber, expirationDate, unitCost, componentsConsumed } = body;

        if (!joId || !productId || !quantityProduced || !branchId) {
            return NextResponse.json({ error: "Missing required fields (joId, productId, quantityProduced, branchId)" }, { status: 400 });
        }

        const qty = Number(quantityProduced);
        const bId = Number(branchId);
        const pId = Number(productId);
        const finalLotNo = lotNumber || `MFG-${joId}`;
        const finalExpDate = expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const newReceipt = {
            id: Date.now(),
            jo_id: joId,
            product_id: pId,
            product_name: productName || "Manufactured Good",
            quantity_produced: qty,
            branch_id: bId,
            lot_number: finalLotNo,
            expiration_date: finalExpDate,
            unit_cost: Number(unitCost || 0),
            date_received: new Date().toISOString()
        };

        // 1. Try saving to Directus
        let savedToDirectus = false;
        try {
            const res = await fetch(`${DIRECTUS_URL}/items/job_order_finished_goods`, {
                method: "POST",
                headers,
                body: JSON.stringify(newReceipt)
            });
            if (res.ok) {
                savedToDirectus = true;
            }
        } catch (err) {
            console.warn("[BFF Finished Goods] Could not save to Directus, falling back to local file storage", err);
        }

        if (!savedToDirectus) {
            const data = getFallbackData();
            data.push(newReceipt);
            saveFallbackData(data);
        }

        // 2. Automatically sync to FIFO stock (shipment_line_items & product_ledger)
        try {
            // A. Create Inbound Shipment placeholder (satisfies DB schema requirement)
            const shipHeaderRes = await fetch(`${DIRECTUS_URL}/items/incoming_shipments`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    reference_number: joId,
                    status: "Received",
                    date_received: new Date().toISOString().split('T')[0],
                    branch_id: bId,
                    total_php_value: 0
                })
            });

            if (shipHeaderRes.ok) {
                const shipHeader = (await shipHeaderRes.json()).data;
                const shipmentId = shipHeader.shipment_id;

                // B. Create shipment_line_items record for produced item
                await fetch(`${DIRECTUS_URL}/items/shipment_line_items`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        shipment_id: shipmentId,
                        product_id: pId,
                        quantity_received: qty,
                        quantity_rejected: 0,
                        lot_number: finalLotNo,
                        expiration_date: finalExpDate,
                        branch_id: bId,
                        qa_status: "Passed",
                        base_unit_cost_php: Number(unitCost || 0),
                        allocated_expense_php: 0,
                        final_landed_unit_cost: Number(unitCost || 0)
                    })
                });

                // C. Create positive product_ledger entry for produced item
                await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        branchId: bId,
                        productId: pId,
                        quantity: qty,
                        documentType: "QA Receive",
                        documentNo: joId,
                        documentDescription: `MFG Run: ${finalLotNo}`,
                        documentDate: new Date().toISOString().split('T')[0]
                    })
                });

                // D. Create negative product_ledger entries for consumed components (Deductions)
                if (componentsConsumed && Array.isArray(componentsConsumed)) {
                    for (const comp of componentsConsumed) {
                        const compId = Number(comp.component_product_id || comp.product_id);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const compName = comp.component_name || comp.product_name || `Component ${compId}`;
                        const compQtyRequired = Number(comp.required || comp.quantity || 0);

                        if (compId && compQtyRequired > 0) {
                            console.log(`[BFF Finished Goods] Deducting raw material product ID ${compId} (${compQtyRequired} units) consumed for JO ${joId}...`);
                            
                            await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    branchId: bId,
                                    productId: compId,
                                    quantity: -compQtyRequired, // Negative quantity to represent stock consumption
                                    documentType: "Production Consumption",
                                    documentNo: joId,
                                    documentDescription: `Consumed to produce: ${productName || "Finished Goods"}`,
                                    documentDate: new Date().toISOString().split('T')[0]
                                })
                            });
                        }
                    }
                }
            }
        } catch (syncErr) {
            console.error("[BFF Finished Goods] Failed to sync to FIFO ledger:", syncErr);
        }


        // 3. Update the Job Order status to Finished in the database
        try {
            await fetch(`${DIRECTUS_URL}/items/job_order/${encodeURIComponent(joId)}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ status: "Finished" })
            });
        } catch (joErr) {
            console.error("[BFF Finished Goods] Failed to update job order status to Finished:", joErr);
        }

        return NextResponse.json({ success: true, data: newReceipt });
    } catch (e) {
        console.error("API Error in production finished-goods POST:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to create finished goods receipt" }, { status: 500 });
    }
}
