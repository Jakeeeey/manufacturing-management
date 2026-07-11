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
            const branchMap: Record<number, { branch_name: string; branch_code: string }> = {};
            if (rawLogs.length > 0) {
                const [poRes, branchRes] = await Promise.all([
                    fetch(`${DIRECTUS_URL}/items/purchase_order?limit=-1&fields=purchase_order_id,purchase_order_no,reference,date_received,date_encoded,datetime`, { headers }),
                    fetch(`${DIRECTUS_URL}/items/branches?limit=-1`, { headers })
                ]);
                const poList = (poRes.ok ? (await poRes.json()).data || [] : []) as DirectusPurchaseOrderMin[];
                poList.forEach((po) => {
                    poMap[String(po.purchase_order_id)] = po;
                    if (po.purchase_order_no) {
                        poMap[String(po.purchase_order_no)] = po;
                    }
                });
                const branchList = branchRes.ok ? (await branchRes.json()).data || [] : [];
                branchList.forEach((b: { id: number; branch_name: string; branch_code: string }) => {
                    branchMap[Number(b.id)] = b;
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
                    branch_id: branchMap[Number(r.branch_id)] || { branch_name: `Branch ID ${r.branch_id}`, branch_code: `BR-${r.branch_id}` },
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

        // Resolve the bad branch that belongs to the SAME family as the receiving branch.
        // Branch code convention: "BHN" (good) → "BHN-BAD" (bad), "MAIN" → "MAIN-BAD", etc.
        // Fallback chain:
        //   1. Match by branch_code: receivingCode + "-BAD"
        //   2. Match by name: receiving branch name prefix + "Bad" keyword
        //   3. Any branch with a bad-order keyword in the name
        //   4. Hardcoded ID 182 (Bihon Bad Branch)
        let badOrderBranchId = 182;
        try {
            const branchesRes = await fetch(
                `${DIRECTUS_URL}/items/branches?limit=200&fields=id,branch_name,branch_code`,
                { headers, cache: "no-store" }
            );
            if (branchesRes.ok) {
                const allBranches: { id: number; branch_name: string; branch_code: string }[] =
                    (await branchesRes.json())?.data || [];

                const BAD_KEYWORDS = ["bad", "quarantine", "holding", "damaged"];
                const isBadBranch = (name: string, code: string) =>
                    BAD_KEYWORDS.some(k => name.toLowerCase().includes(k) || code.toLowerCase().includes(k));

                const receivingBranch = allBranches.find(b => Number(b.id) === branchIdNum);
                const receivingCode = (receivingBranch?.branch_code || "").toUpperCase();
                const receivingName = (receivingBranch?.branch_name || "").toLowerCase();

                const badBranches = allBranches.filter(b => isBadBranch(b.branch_name, b.branch_code));

                // Priority 1: exact code match — e.g. "BHN" → "BHN-BAD"
                const codeMatch = receivingCode
                    ? badBranches.find(b => b.branch_code.toUpperCase() === `${receivingCode}-BAD`)
                    : null;

                // Priority 2: name prefix match — e.g. "Bihon Branch" → "Bihon Bad Branch"
                // Take everything before the word "Branch" / "Hub" / etc. from the receiving name
                const namePrefix = receivingName.replace(/\b(branch|hub|warehouse|plant|store)\b.*/i, "").trim();
                const nameMatch = namePrefix
                    ? badBranches.find(b => b.branch_name.toLowerCase().startsWith(namePrefix))
                    : null;

                // Priority 3: any bad branch
                const anyBad = badBranches[0] ?? null;

                const resolved = codeMatch ?? nameMatch ?? anyBad;
                if (resolved) {
                    badOrderBranchId = Number(resolved.id);
                    console.log(`[QA Receiving] Bad branch resolved for "${receivingBranch?.branch_name}" → "${resolved.branch_name}" (ID ${resolved.id})`);
                }
            }
        } catch (err) {
            console.error("Error resolving co-located bad order branch, using fallback 182:", err);
        }

        // 1. Loop and apply line item updates & ledger entries
        for (const item of lineItemUpdates) {
            // qtyAccepted is the authoritative quantity to log as good stock.
            // It can exceed qtyReceived in over-acceptance scenarios (e.g., loose units
            // found during inspection that were not counted in the initial physical receive).
            const qtyAccepted = Number(item.quantity_accepted || 0);
            // BO qty is always the shortfall (non-negative) — guaranteed by the frontend.
            const qtyRejected = Number(item.quantity_rejected || 0);

            // Fetch PO product details first to get product ID and PO ID
            const popRes = await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${item.line_id}`, { headers });
            if (!popRes.ok) throw new Error(`PO Product item ${item.line_id} not found.`);
            const pop = (await popRes.json()).data;
            const pId = pop.product_id;
            const poId = pop.purchase_order_id;

            const saveInventoryLot = async (bId: number, qty: number, status: string, notes: string | null) => {
                const filterQuery = encodeURIComponent(JSON.stringify({
                    _and: [
                        { source_type: { _eq: "procurement" } },
                        { source_reference: { _eq: String(poId) } },
                        { product_id: { _eq: pId } },
                        { branch_id: { _eq: bId } }
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
                    quantity: qty,
                    unit_cost: Number(item.final_landed_unit_cost || item.base_unit_cost_php || pop.unit_price || 0),
                    branch_id: bId,
                    created_on: new Date().toISOString(),
                    qa_status: status,
                    rejection_reason: notes
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
            };

            // Save accepted stock to selected branch
            if (qtyAccepted > 0) {
                await saveInventoryLot(branchIdNum, qtyAccepted, item.qa_status || "Passed", null);

                // Insert into product_ledger for Good Stock
                const ledgerPayload = {
                    branchId: branchIdNum,
                    productId: pId,
                    quantity: qtyAccepted,
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
                    console.error(`Ledger record failed for product ID ${pId}:`, await ledgerRes.text());
                }

                // Write to purchase_order_receiving for Good Stock
                await fetch(`${DIRECTUS_URL}/items/purchase_order_receiving`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        purchase_order_id: poId,
                        product_id: pId,
                        received_quantity: qtyAccepted,
                        unit_price: pop.unit_price,
                        total_amount: qtyAccepted * Number(pop.unit_price || 0),
                        branch_id: branchIdNum,
                        receipt_no: `REC-${poId}-${Date.now()}`,
                        received_date: new Date().toISOString(),
                        isPosted: 1,
                        qa_status: item.qa_status || "Passed"
                    })
                }).catch(err => console.error("Failed to write Good Stock purchase_order_receiving log:", err));
            }

            // Save bad order stock to Bad Order branch
            if (qtyRejected > 0) {
                await saveInventoryLot(badOrderBranchId, qtyRejected, "Rejected", item.rejection_reason || null);

                // Insert into product_ledger for Bad Order Stock
                const ledgerPayload = {
                    branchId: badOrderBranchId,
                    productId: pId,
                    quantity: qtyRejected,
                    documentType: "QA Reject (BO)",
                    documentNo: referenceNumber || "N/A",
                    documentDescription: `QA Bad Order Batch: ${item.lot_number || "N/A"} (Remarks: ${item.rejection_reason || "None"})`,
                    documentDate: new Date().toISOString().split('T')[0]
                };

                const ledgerRes = await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(ledgerPayload)
                });
                if (!ledgerRes.ok) {
                    console.error(`Ledger record failed for bad order product ID ${pId}:`, await ledgerRes.text());
                }

                // Write to purchase_order_receiving for Bad Order Stock
                await fetch(`${DIRECTUS_URL}/items/purchase_order_receiving`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        purchase_order_id: poId,
                        product_id: pId,
                        received_quantity: qtyRejected,
                        unit_price: pop.unit_price,
                        total_amount: qtyRejected * Number(pop.unit_price || 0),
                        branch_id: badOrderBranchId,
                        receipt_no: `REC-${poId}-${Date.now()}`,
                        received_date: new Date().toISOString(),
                        isPosted: 1,
                        qa_status: "Rejected"
                    })
                }).catch(err => console.error("Failed to write Bad Order Stock purchase_order_receiving log:", err));
            }

            // Mark PO product as received
            await fetch(`${DIRECTUS_URL}/items/purchase_order_products/${item.line_id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ received: 1 })
            }).catch(err => console.error("Failed to update PO product received status:", err));
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
