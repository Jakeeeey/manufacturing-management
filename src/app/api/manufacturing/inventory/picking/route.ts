import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers, fetchJobOrders } from "@/app/api/manufacturing/directus-api";

interface PickItem {
    productId: number;
    lotNumber: string;
    quantity: number;
}

export async function GET() {
    try {
        // 1. Fetch all job orders
        const jobOrders = await fetchJobOrders();

        // Filter for Proceed (released) and Ongoing (in production) job orders
        const activeJOs = jobOrders.filter(jo => 
            jo.status === "Proceed" || jo.status === "Ongoing" || jo.status === "Finished"
        );

        if (activeJOs.length === 0) {
            return NextResponse.json([]);
        }

        // 2. Fetch all WIP ledger entries to determine if they've been picked
        const joIds = activeJOs.map(jo => jo.jo_id);
        const joIdsFilter = encodeURIComponent(JSON.stringify({
            _and: [
                { documentType: { _in: ["WIP Issue", "WIP Transfer"] } },
                { documentNo: { _in: joIds } }
            ]
        }));

        const ledgerRes = await fetch(`${DIRECTUS_URL}/items/product_ledger?filter=${joIdsFilter}&limit=-1`, {
            headers,
            cache: "no-store"
        });

        const ledgerEntries = ledgerRes.ok ? (await ledgerRes.json()).data || [] : [];

        // 3. Map picked status and picked items to each JO
        const result = activeJOs.map(jo => {
            const joLedger = ledgerEntries.filter((e: { documentNo: string }) => e.documentNo === jo.jo_id);
            const isPicked = joLedger.length > 0;

            const pickedItems = joLedger.map((e: { productId: number; quantity: number; documentDescription: string; created_date?: string }) => {
                const lotMatch = e.documentDescription?.match(/Picked Lot:\s*(.+)$/);
                const lotNo = lotMatch ? lotMatch[1] : "LOT-N/A";
                return {
                    productId: e.productId,
                    quantity: Math.abs(e.quantity),
                    lotNumber: lotNo,
                    datePicked: e.created_date || new Date().toISOString()
                };
            });

            return {
                jo_id: jo.jo_id,
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity,
                status: jo.status,
                branch_id: jo.branch_id,
                allocationResults: jo.allocation_results || jo.allocationResults || [],
                components: jo.components || [],
                isPicked,
                pickedItems
            };
        });

        return NextResponse.json(result);
    } catch (e) {
        console.error("[Picking API GET] Error:", e);
        return NextResponse.json(
            { error: (e as { message?: string }).message || "Failed to fetch picking lists" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { joId, branchId, items } = body;

        if (!joId || !branchId || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields (joId, branchId, items)" },
                { status: 400 }
            );
        }

        const bId = Number(branchId);

        // 1. Process each pick item
        for (const item of items as PickItem[]) {
            const pId = Number(item.productId);
            const qty = Number(item.quantity);
            const lotNo = item.lotNumber;

            if (isNaN(pId) || isNaN(qty) || qty <= 0 || !lotNo) {
                return NextResponse.json(
                    { error: `Invalid item parameters for product ID ${item.productId}` },
                    { status: 400 }
                );
            }

            // A. Deduct from inventory_lots
            const filterQuery = encodeURIComponent(JSON.stringify({
                _and: [
                    { product_id: { _eq: pId } },
                    { branch_id: { _eq: bId } },
                    { lot_number: { _eq: lotNo } }
                ]
            }));

            const lotRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${filterQuery}&limit=1`, {
                headers,
                cache: "no-store"
            });

            if (lotRes.ok) {
                const lots = (await lotRes.json()).data || [];
                if (lots.length > 0) {
                    const lot = lots[0];
                    const currentQty = Number(lot.quantity || 0);
                    const newQty = Math.max(0, currentQty - qty);

                    const updateRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots/${lot.id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({ quantity: newQty })
                    });

                    if (!updateRes.ok) {
                        console.error(`[Picking API] Failed to deduct quantity from lot ID ${lot.id}:`, await updateRes.text());
                    }
                } else {
                    console.warn(`[Picking API] Lot ${lotNo} not found for product ${pId} in branch ${bId}. Proceeding with ledger issue.`);
                }
            }

            // B. Create negative product_ledger entry (WIP Issue)
            const ledgerRes = await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    branchId: bId,
                    productId: pId,
                    quantity: -qty,
                    documentType: "WIP Issue",
                    documentNo: joId,
                    documentDescription: `Picked Lot: ${lotNo}`,
                    documentDate: new Date().toISOString().split("T")[0]
                })
            });

            if (!ledgerRes.ok) {
                const errTxt = await ledgerRes.text();
                throw new Error(`Failed to post WIP issue ledger record: ${ledgerRes.status} - ${errTxt}`);
            }
        }

        // 2. Transition Job Order status to "In Progress" if it is "Released" or "Proceed"
        try {
            const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders?filter[job_order_no][_eq]=${encodeURIComponent(joId)}&limit=1`, {
                headers,
                cache: "no-store"
            });
            if (joRes.ok) {
                const joData = (await joRes.json()).data?.[0];
                if (joData && (joData.status === "Released" || joData.status === "Proceed" || joData.status === "Planned" || joData.status === "Draft")) {
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joData.job_order_id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({ status: "In Progress" })
                    });
                }
            }
        } catch (joErr) {
            console.error("[Picking API] Failed to update job order status to In Progress:", joErr);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("[Picking API POST] Error:", e);
        return NextResponse.json(
            { error: (e as { message?: string }).message || "Failed to process materials pick" },
            { status: 500 }
        );
    }
}
