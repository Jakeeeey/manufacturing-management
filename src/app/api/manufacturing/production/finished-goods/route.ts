import { NextResponse } from "next/server";

interface LedgerEntry {
    id: number;
    documentNo: string;
    documentDate?: string;
    documentDescription?: string;
    productId: string | number;
    quantity: string | number;
    branchId: string | number;
    documentType?: string;
}

interface Product {
    product_id: number;
    product_name?: string;
    cost_per_unit?: string | number;
}

interface InventoryLot {
    id: number;
    lot_number: string;
    expiry_date?: string | null;
    unit_cost?: string | number;
    quantity?: string | number;
    created_on?: string;
}

interface ConsumeComponentBody {
    component_product_id?: string | number;
    product_id?: string | number;
    required?: string | number;
    quantity?: string | number;
    component_name?: string;
    product_name?: string;
}

interface ComponentConsumed {
    component_product_id: number;
    product_id?: string | number;
    required?: string | number;
    quantity?: string | number;
    scaledQuantity: number;
    component_name?: string;
    product_name?: string;
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
        const joId = searchParams.get("joId");

        // Fetch product ledger entries representing finished goods releases
        let ledgerUrl = `${DIRECTUS_URL}/items/product_ledger?filter[documentType][_eq]=QA Receive&filter[quantity][_gt]=0&limit=-1&sort=-id`;
        if (joId) {
            ledgerUrl += `&filter[documentNo][_eq]=${encodeURIComponent(joId)}`;
        }
        const ledgerRes = await fetch(ledgerUrl, { headers, cache: "no-store" });
        if (!ledgerRes.ok) {
            const errTxt = await ledgerRes.text();
            return NextResponse.json({ error: `Failed to fetch cloud product ledger: ${ledgerRes.status} - ${errTxt}` }, { status: ledgerRes.status });
        }
        const ledgerEntries = (await ledgerRes.json()).data || [];

        // Fetch products and inventory lots to resolve names, lot number details and unit cost
        const [productsRes, porRes] = await Promise.all([
            fetch(`${DIRECTUS_URL}/items/products?limit=500&fields=product_id,product_name,cost_per_unit`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/inventory_lots?limit=500`, { headers, cache: "no-store" })
        ]);

        const products: Product[] = productsRes.ok ? (await productsRes.json()).data || [] : [];
        const porData: InventoryLot[] = porRes.ok ? (await porRes.json()).data || [] : [];

        const data = ledgerEntries.map((entry: LedgerEntry) => {
            const lotNumber = entry.documentDescription?.startsWith("MFG Run: ")
                ? entry.documentDescription.substring("MFG Run: ".length)
                : (entry.documentDescription || `MFG-${entry.documentNo}`);

            const matchedProduct = products.find((p: Product) => Number(p.product_id) === Number(entry.productId));
            const matchedPOR = porData.find((p: InventoryLot) => p.lot_number === lotNumber);

            return {
                id: entry.id,
                jo_id: entry.documentNo,
                product_id: Number(entry.productId),
                product_name: matchedProduct?.product_name || "Manufactured Good",
                quantity_produced: Number(entry.quantity),
                branch_id: Number(entry.branchId),
                lot_number: lotNumber,
                expiration_date: matchedPOR?.expiry_date || entry.documentDate || new Date().toISOString().split('T')[0],
                unit_cost: Number(matchedPOR?.unit_cost || matchedProduct?.cost_per_unit || 0),
                date_received: entry.documentDate ? `${entry.documentDate}T12:00:00.000Z` : new Date().toISOString()
            };
        });

        return NextResponse.json(data);
    } catch (e) {
        console.error("API Error in production finished-goods GET:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch finished goods receipts" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { joId, productId, productName, quantityProduced, branchId, lotNumber, expirationDate, unitCost, componentsConsumed, completeJobOrder = true } = body;

        if (!joId || !productId || !quantityProduced || !branchId) {
            return NextResponse.json({ error: "Missing required fields (joId, productId, quantityProduced, branchId)" }, { status: 400 });
        }

        const qty = Number(quantityProduced);
        const bId = Number(branchId);
        const pId = Number(productId);
        const finalLotNo = lotNumber || `MFG-${joId}`;
        const finalExpDate = expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Fetch planned quantity to scale raw material consumption dynamically based on actual yield vs planned yield
        let scaleFactor = 1;
        try {
            const joProdRes = await fetch(`${DIRECTUS_URL}/items/job_order_products?filter[jo_id][_eq]=${encodeURIComponent(joId)}&filter[product_id][_eq]=${pId}&limit=1`, { headers });
            if (joProdRes.ok) {
                const joProdData = (await joProdRes.json()).data || [];
                if (joProdData.length > 0) {
                    const plannedQty = Number(joProdData[0].quantity) || 0;
                    if (plannedQty > 0) {
                        scaleFactor = qty / plannedQty;
                        console.log(`[BFF Finished Goods] Dynamic scaling factor: ${scaleFactor} (Actual: ${qty}, Planned: ${plannedQty})`);
                    }
                }
            }
        } catch (scaleErr) {
            console.error("[BFF Finished Goods] Error calculating raw material scale factor:", scaleErr);
        }

        const scaledComponents: ComponentConsumed[] = (componentsConsumed && Array.isArray(componentsConsumed))
            ? componentsConsumed.map((comp: ConsumeComponentBody) => {
                const compId = Number(comp.component_product_id || comp.product_id);
                const baseQty = Number(comp.required || comp.quantity || 0);
                return {
                    ...comp,
                    component_product_id: compId,
                    scaledQuantity: baseQty * scaleFactor
                };
            })
            : [];

        // Strict Inventory Sufficiency Check for Consumed Components using cloud product ledger
        if (scaledComponents.length > 0) {
            const compIds = scaledComponents
                .map(c => c.component_product_id)
                .filter(id => !isNaN(id) && id > 0);

            if (compIds.length > 0) {
                const compIdsStr = compIds.join(",");
                let ledgerData: LedgerEntry[] = [];
                try {
                    const ledgerRes = await fetch(`${DIRECTUS_URL}/items/product_ledger?filter[productId][_in]=${compIdsStr}&filter[branchId][_eq]=${bId}&limit=-1`, { 
                        headers, 
                        cache: "no-store" 
                    });
                    if (ledgerRes.ok) {
                        ledgerData = (await ledgerRes.json()).data || [];
                    } else {
                        console.error("[BFF Finished Goods] Failed to fetch ledger items for stock checks:", await ledgerRes.text());
                    }
                } catch (ledgerErr) {
                    console.error("[BFF Finished Goods] Ledger stock check request failed:", ledgerErr);
                }

                // Map product ID to current accumulated stock
                const stockMap: Record<number, number> = {};
                compIds.forEach(id => {
                    stockMap[id] = 0;
                });

                ledgerData.forEach(entry => {
                    const pId = Number(entry.productId);
                    const entryQty = Number(entry.quantity) || 0;
                    if (stockMap[pId] !== undefined) {
                        stockMap[pId] += entryQty;
                    }
                });

                const insufficient: string[] = [];
                for (const comp of scaledComponents) {
                    const compId = comp.component_product_id;
                    const compQtyRequired = comp.scaledQuantity;
                    const compName = comp.component_name || comp.product_name || `Component #${compId}`;

                    if (compId && compQtyRequired > 0) {
                        const available = stockMap[compId] || 0;
                        if (available < compQtyRequired) {
                            insufficient.push(`${compName} (Needed: ${compQtyRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Available: ${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
                        }
                    }
                }

                if (insufficient.length > 0) {
                    return NextResponse.json({ 
                        error: `You have insufficient stock for: ${insufficient.join(", ")}` 
                    }, { status: 400 });
                }
            }
        }

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

        // 1. Automatically register finished goods into the decoupled inventory_lots collection
        try {
            const lotPayload = {
                product_id: pId,
                branch_id: bId,
                lot_number: finalLotNo,
                expiry_date: finalExpDate,
                quantity: qty,
                unit_cost: Number(unitCost || 0),
                qa_status: "Passed",
                source_type: "manufacturing",
                source_reference: joId,
                created_on: new Date().toISOString()
            };

            const lotRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots`, {
                method: "POST",
                headers,
                body: JSON.stringify(lotPayload)
            });

            if (!lotRes.ok) {
                const errTxt = await lotRes.text();
                console.error("[BFF Finished Goods] Failed to create cloud inventory lot record:", errTxt);
                return NextResponse.json({ error: `Failed to register lot in cloud: ${lotRes.status} - ${errTxt}` }, { status: 500 });
            }
        } catch (lotErr) {
            console.error("[BFF Finished Goods] Error creating inventory lot record:", lotErr);
            return NextResponse.json({ error: "Failed to register finished goods lot in cloud" }, { status: 500 });
        }

        // 2. Create positive product_ledger entry for produced item
        const ledgerPosRes = await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
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
        if (!ledgerPosRes.ok) {
            console.error("[BFF Finished Goods] Failed to create positive product ledger record:", await ledgerPosRes.text());
        }

        // 3. Create negative product_ledger entries for consumed components (Deductions) and update inventory_lots
        if (scaledComponents.length > 0) {
            for (const comp of scaledComponents) {
                const compId = comp.component_product_id;
                const compQtyRequired = comp.scaledQuantity;

                if (compId && compQtyRequired > 0) {
                    console.log(`[BFF Finished Goods] Deducting raw material product ID ${compId} (${compQtyRequired} units) consumed for JO ${joId}...`);
                    
                    const ledgerNegRes = await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            branchId: bId,
                            productId: compId,
                            quantity: -compQtyRequired,
                            documentType: "Production Consumption",
                            documentNo: joId,
                            documentDescription: `Consumed to produce: ${productName || "Finished Goods"}`,
                            documentDate: new Date().toISOString().split('T')[0]
                        })
                    });
                    if (!ledgerNegRes.ok) {
                        console.error(`[BFF Finished Goods] Failed to create deduction product ledger record for product ${compId}:`, await ledgerNegRes.text());
                    }

                    // Deduct from FIFO inventory lots
                    try {
                        const filterQuery = encodeURIComponent(JSON.stringify({
                            _and: [
                                { product_id: { _eq: compId } },
                                { branch_id: { _eq: bId } },
                                { quantity: { _gt: 0 } },
                                { qa_status: { _eq: "Passed" } }
                            ]
                        }));
                        const lotsRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${filterQuery}&sort=expiry_date,created_on&limit=-1`, { headers });
                        if (lotsRes.ok) {
                            const activeLots = (await lotsRes.json()).data || [];
                            
                            // Sort in JS to guarantee FIFO/FEFO (expiry date closest first, then oldest created first)
                            activeLots.sort((a: InventoryLot, b: InventoryLot) => {
                                if (a.expiry_date && b.expiry_date) {
                                    return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
                                }
                                if (a.expiry_date) return -1;
                                if (b.expiry_date) return 1;
                                return new Date(a.created_on || 0).getTime() - new Date(b.created_on || 0).getTime();
                            });

                            let remainingToDeduct = compQtyRequired;
                            for (const lot of activeLots) {
                                if (remainingToDeduct <= 0) break;
                                const available = Number(lot.quantity || 0);
                                const deduct = Math.min(available, remainingToDeduct);
                                
                                const newQty = available - deduct;
                                remainingToDeduct -= deduct;

                                const patchRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots/${lot.id}`, {
                                    method: "PATCH",
                                    headers,
                                    body: JSON.stringify({ quantity: newQty })
                                });
                                if (!patchRes.ok) {
                                    console.error(`[BFF Finished Goods] Failed to update quantity for lot ${lot.id}:`, await patchRes.text());
                                } else {
                                    console.log(`[BFF Finished Goods] Deducted ${deduct} units from lot ID ${lot.id} (lot number: ${lot.lot_number}). New quantity: ${newQty}`);
                                }
                            }
                        } else {
                            console.error(`[BFF Finished Goods] Failed to fetch active inventory lots for component ${compId}:`, await lotsRes.text());
                        }
                    } catch (lotDeductErr) {
                        console.error(`[BFF Finished Goods] Error during inventory lots deduction for component ${compId}:`, lotDeductErr);
                    }
                }
            }
        }

        // 2. Update the Job Order status to Finished in the database
        if (completeJobOrder) {
            try {
                await fetch(`${DIRECTUS_URL}/items/job_order/${encodeURIComponent(joId)}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ status: "Finished" })
                });
            } catch (joErr) {
                console.error("[BFF Finished Goods] Failed to update job order status to Finished:", joErr);
            }
        }

        // 3. Automatically transition related Sales Orders to "For Invoicing" (ready to be billed)
        if (completeJobOrder) {
            try {
                const josoRes = await fetch(`${DIRECTUS_URL}/items/job_order_sales_orders?filter[jo_id][_eq]=${encodeURIComponent(joId)}&limit=-1`, { headers });
                if (josoRes.ok) {
                    const linksResponse = await josoRes.json();
                    const links = linksResponse.data || [];
                    console.log(`[BFF Finished Goods] Found ${links.length} related Sales Orders for Job Order ${joId}`);
                    for (const link of links) {
                        const soId = link.order_id || link.sales_order_id;
                        if (soId) {
                            console.log(`[BFF Finished Goods] Auto-transitioning Sales Order ${soId} to For Invoicing`);
                            await fetch(`${DIRECTUS_URL}/items/sales_order/${soId}`, {
                                method: "PATCH",
                                headers,
                                body: JSON.stringify({ order_status: "For Invoicing" })
                            });
                        }
                    }
                } else {
                    console.error(`[BFF Finished Goods] Failed to fetch related Sales Orders for JO ${joId}: ${josoRes.status}`);
                }
            } catch (soErr) {
                console.error("[BFF Finished Goods] Error transitioning related Sales Orders status:", soErr);
            }
        }

        return NextResponse.json({ success: true, data: newReceipt });
    } catch (e) {
        console.error("API Error in production finished-goods POST:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to create finished goods receipt" }, { status: 500 });
    }
}
