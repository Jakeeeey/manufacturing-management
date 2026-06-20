import { NextResponse } from "next/server";

interface DirectusLotLog {
    id: number;
    product_id: number | { product_id: number } | null | undefined;
    quantity: number;
    source_type?: string;
    source_reference?: string;
    lot_number?: string;
    expiry_date?: string;
    created_on?: string;
    branch_id?: number;
    qa_status?: string;
    rejection_reason?: string;
    unit_cost?: number;
}

interface DirectusProductMin {
    product_id: number;
    product_name: string;
    product_code: string;
}

interface DirectusPurchaseOrderMin {
    purchase_order_id: number;
    purchase_order_no: string;
    reference: string;
    date_received: string;
    date_encoded: string;
    datetime: string;
}

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "test";

const headers: Record<string, string> = {
    "Content-Type": "application/json"
};
if (DIRECTUS_STATIC_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const productId = searchParams.get("productId");
        const action = searchParams.get("action");

        // Action: Fetch branches
        if (action === "branches") {
            const res = await fetch(`${DIRECTUS_URL}/items/branches?filter[isActive][_eq]=1&sort=branch_name&limit=100`, { headers, cache: "no-store" });
            if (!res.ok) throw new Error(`Directus error loading branches: ${res.status}`);
            const json = await res.json();
            return NextResponse.json(json.data);
        }

        // Action: Fetch FIFO Inventory for a product across all branches
        if (productId) {
            const res = await fetch(
                `${DIRECTUS_URL}/items/inventory_lots?filter[product_id][_eq]=${productId}&filter[quantity][_gt]=0&limit=150`,
                { headers }
            );
            if (!res.ok) throw new Error(`Directus error loading product receiving logs: ${res.status}`);
            const json = await res.json();
            
            const rawLogs = (json.data || []) as DirectusLotLog[];
            const productIds = rawLogs.map((r) => typeof r.product_id === "object" && r.product_id ? r.product_id.product_id : r.product_id).filter(Boolean);
            let products: DirectusProductMin[] = [];
            if (productIds.length > 0) {
                const prodUrl = `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&limit=-1`;
                const prodRes = await fetch(prodUrl, { headers, cache: "no-store" });
                if (prodRes.ok) {
                    products = (await prodRes.json()).data || [];
                }
            }

            const poMap: Record<string, DirectusPurchaseOrderMin> = {};
            if (rawLogs.length > 0) {
                const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order?limit=-1&fields=purchase_order_id,purchase_order_no,reference,date_received,date_encoded,datetime`, { headers });
                const poList = (poRes.ok ? (await poRes.json()).data || [] : []) as DirectusPurchaseOrderMin[];
                poList.forEach((po) => {
                    poMap[String(po.purchase_order_id)] = po;
                    if (po.purchase_order_no) {
                        poMap[String(po.purchase_order_no)] = po;
                    }
                });
            }

            const mapped = rawLogs.map((r) => {
                const rawProdId = typeof r.product_id === "object" && r.product_id ? r.product_id.product_id : r.product_id;
                const productObj = products.find((p) => Number(p.product_id) === Number(rawProdId)) || {
                    product_id: Number(rawProdId) || 0,
                    product_name: `Product ID: ${rawProdId}`,
                    product_code: `ID-${rawProdId}`
                };
                
                const poRef = r.source_reference || "";
                let cleanPoRef = poRef;
                if (poRef.startsWith("PO-")) {
                    cleanPoRef = poRef.substring(3);
                }
                const matchedPo = poMap[poRef] || poMap[cleanPoRef] || null;

                return {
                    line_id: r.id,
                    shipment_id: {
                        shipment_id: matchedPo ? matchedPo.purchase_order_id : (parseInt(cleanPoRef) || null),
                        reference_number: matchedPo ? (matchedPo.reference || matchedPo.purchase_order_no) : poRef,
                        date_received: matchedPo ? (matchedPo.date_received || r.created_on) : r.created_on,
                        created_at: matchedPo ? (matchedPo.date_encoded || matchedPo.datetime) : r.created_on
                    },
                    product_id: productObj,
                    quantity_received: Number(r.quantity || 0),
                    lot_number: r.lot_number || "LOT-N/A",
                    expiration_date: r.expiry_date,
                    branch_id: r.branch_id,
                    rejection_reason: "",
                    qa_status: r.qa_status || "Passed",
                    base_unit_cost_php: Number(r.unit_cost || 0),
                    allocated_expense_php: 0,
                    final_landed_unit_cost: Number(r.unit_cost || 0)
                };
            });

            return NextResponse.json(mapped);
        }

        // Action: Fetch FIFO Inventory for a branch
        if (branchId) {
            const res = await fetch(
                `${DIRECTUS_URL}/items/inventory_lots?filter[branch_id][_eq]=${branchId}&filter[quantity][_gt]=0&limit=150`,
                { headers }
            );
            if (!res.ok) throw new Error(`Directus error loading branch receiving logs: ${res.status}`);
            const json = await res.json();

            const rawLogs = (json.data || []) as DirectusLotLog[];
            const productIds = rawLogs.map((r) => typeof r.product_id === "object" && r.product_id ? r.product_id.product_id : r.product_id).filter(Boolean);
            let products: DirectusProductMin[] = [];
            if (productIds.length > 0) {
                const prodUrl = `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&limit=-1`;
                const prodRes = await fetch(prodUrl, { headers, cache: "no-store" });
                if (prodRes.ok) {
                    products = (await prodRes.json()).data || [];
                }
            }

            const poMap: Record<string, DirectusPurchaseOrderMin> = {};
            if (rawLogs.length > 0) {
                const poRes = await fetch(`${DIRECTUS_URL}/items/purchase_order?limit=-1&fields=purchase_order_id,purchase_order_no,reference,date_received,date_encoded,datetime`, { headers });
                const poList = (poRes.ok ? (await poRes.json()).data || [] : []) as DirectusPurchaseOrderMin[];
                poList.forEach((po) => {
                    poMap[String(po.purchase_order_id)] = po;
                    if (po.purchase_order_no) {
                        poMap[String(po.purchase_order_no)] = po;
                    }
                });
            }

            const mapped = rawLogs.map((r) => {
                const rawProdId = typeof r.product_id === "object" && r.product_id ? r.product_id.product_id : r.product_id;
                const productObj = products.find((p) => Number(p.product_id) === Number(rawProdId)) || {
                    product_id: Number(rawProdId) || 0,
                    product_name: `Product ID: ${rawProdId}`,
                    product_code: `ID-${rawProdId}`
                };
                
                const poRef = r.source_reference || "";
                let cleanPoRef = poRef;
                if (poRef.startsWith("PO-")) {
                    cleanPoRef = poRef.substring(3);
                }
                const matchedPo = poMap[poRef] || poMap[cleanPoRef] || null;

                return {
                    line_id: r.id,
                    shipment_id: {
                        shipment_id: matchedPo ? matchedPo.purchase_order_id : (parseInt(cleanPoRef) || null),
                        reference_number: matchedPo ? (matchedPo.reference || matchedPo.purchase_order_no) : poRef,
                        date_received: matchedPo ? (matchedPo.date_received || r.created_on) : r.created_on,
                        created_at: matchedPo ? (matchedPo.date_encoded || matchedPo.datetime) : r.created_on
                    },
                    product_id: productObj,
                    quantity_received: Number(r.quantity || 0),
                    lot_number: r.lot_number || "LOT-N/A",
                    expiration_date: r.expiry_date,
                    branch_id: r.branch_id,
                    rejection_reason: "",
                    qa_status: r.qa_status || "Passed",
                    base_unit_cost_php: Number(r.unit_cost || 0),
                    allocated_expense_php: 0,
                    final_landed_unit_cost: Number(r.unit_cost || 0)
                };
            });

            return NextResponse.json(mapped);
        }

        return NextResponse.json({ error: "Missing parameter branchId or action=branches" }, { status: 400 });
    } catch (e) {
        console.error("API Error in QA Receiving route:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { shipmentId, referenceNumber, branchId, lineItemUpdates } = body;

        if (!shipmentId || !branchId || !lineItemUpdates || !Array.isArray(lineItemUpdates)) {
            return NextResponse.json({ error: "Missing required fields (shipmentId, branchId, lineItemUpdates)" }, { status: 400 });
        }

        const branchIdNum = parseInt(branchId);

        // 1. Loop and apply line item updates & ledger entries
        for (const item of lineItemUpdates) {
            const qtyReceived = Number(item.quantity_received || 0);

            // Fetch PO product details first to get product ID and PO ID
            const popRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${item.line_id}`, { headers });
            if (!popRes.ok) throw new Error(`PO Product item ${item.line_id} not found.`);
            const pop = (await popRes.json()).data;
            const pId = pop.product_id;
            const poId = pop.purchase_order_id;

            // Check if receiving record already exists in inventory_lots
            const filterQuery = encodeURIComponent(JSON.stringify({
                _and: [
                    { source_type: { _eq: "procurement" } },
                    { source_reference: { _eq: String(poId) } },
                    { product_id: { _eq: pId } }
                ]
            }));
            const porRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${filterQuery}&limit=1`, { headers });
            const porList = porRes.ok ? (await porRes.json()).data || [] : [];

            const payload = {
                source_type: "procurement",
                source_reference: String(poId),
                product_id: pId,
                lot_number: item.lot_number || "LOT-N/A",
                expiry_date: item.expiration_date || null,
                quantity: qtyReceived,
                unit_cost: Number(item.final_landed_unit_cost || item.base_unit_cost_php || pop.unit_price || 0),
                branch_id: branchIdNum,
                created_on: new Date().toISOString(),
                qa_status: item.qa_status || "Passed"
            };

            if (porList.length > 0) {
                const recId = porList[0].id;
                const updateRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots/${recId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(payload)
                });
                if (!updateRes.ok) throw new Error(`Failed to update inventory lot ${recId}: ${updateRes.status} - ${await updateRes.text()}`);
            } else {
                const insertRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload)
                });
                if (!insertRes.ok) throw new Error(`Failed to insert inventory lot: ${insertRes.status} - ${await insertRes.text()}`);
            }

            // Mark PO product as received
            await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${item.line_id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ received: 1 })
            }).catch(err => console.error("Failed to update PO product received status:", err));

            // Insert into product_ledger if quantity_received > 0
            if (qtyReceived > 0) {
                const ledgerPayload = {
                    branchId: branchIdNum,
                    productId: pId,
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
                    const errorText = await ledgerRes.text();
                    console.error(`Ledger record failed for product ID ${pId}:`, errorText);
                    throw new Error(`Failed to log product ${pId} into ledger: ${errorText}`);
                }
            }
        }

        // 2. Transition PO status to Received
        const statusRes = await fetch(`${DIRECTUS_URL}/items/purchase_order/${shipmentId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                inventory_status: 6, // Received
                date_received: new Date().toISOString().split('T')[0]
            })
        });

        if (!statusRes.ok) {
            throw new Error(`Failed to update PO header status: ${statusRes.status}`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error submitting QA Receiving:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to process QA receiving" }, { status: 500 });
    }
}
