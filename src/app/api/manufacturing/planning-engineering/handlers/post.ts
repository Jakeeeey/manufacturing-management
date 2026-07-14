/* eslint-disable */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createJobOrder } from "../planning-helper";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { getActiveVersionForProduct } from "../../finished-goods/versions/versions-helper";

export async function handlePOST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === "direct-allocate") {
            const { branchId, productId, recipeVersionId, lines } = body;

            if (!branchId || !productId || !recipeVersionId || !lines || !Array.isArray(lines) || lines.length === 0) {
                return NextResponse.json({ error: "Missing required fields (branchId, productId, recipeVersionId, lines)" }, { status: 400 });
            }

            // 1. Fetch Passed inventory lots with quantity > 0
            const lotFilter = encodeURIComponent(JSON.stringify({
                _and: [
                    { product_id: { _eq: Number(productId) } },
                    { branch_id: { _eq: Number(branchId) } },
                    { qa_status: { _eq: "Passed" } },
                    { quantity: { _gt: 0 } }
                ]
            }));
            const lotsRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${lotFilter}&limit=-1`, { headers, cache: "no-store" });
            if (!lotsRes.ok) {
                const errTxt = await lotsRes.text();
                return NextResponse.json({ error: `Failed to fetch inventory lots: ${lotsRes.status} - ${errTxt}` }, { status: 500 });
            }
            const lots = (await lotsRes.json()).data || [];

            // 2. Trace lot's recipe version
            const mfgLots = lots.filter((lot: any) => lot.source_type === "manufacturing" && lot.source_reference);
            const joNos = Array.from(new Set(mfgLots.map((lot: any) => lot.source_reference)));
            const joMap = new Map<string, number>();

            if (joNos.length > 0) {
                const joFilter = encodeURIComponent(JSON.stringify({
                    job_order_no: { _in: joNos }
                }));
                const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders?filter=${joFilter}&fields=job_order_no,version_id&limit=-1`, { headers, cache: "no-store" });
                if (joRes.ok) {
                    const jos = (await joRes.json()).data || [];
                    jos.forEach((jo: any) => {
                        if (jo.job_order_no && jo.version_id) {
                            joMap.set(jo.job_order_no, Number(jo.version_id));
                        }
                    });
                }
            }

            // Get product's active standard version
            const { version: activeVersion } = await getActiveVersionForProduct(Number(productId));
            const activeVersionId = activeVersion ? Number(activeVersion.version_id) : null;

            // Filter candidate lots matching target recipeVersionId
            const matchingLots = lots.filter((lot: any) => {
                const resolvedVersionId = lot.source_type === "manufacturing" && lot.source_reference
                    ? (joMap.get(lot.source_reference) || activeVersionId)
                    : activeVersionId;
                return resolvedVersionId === Number(recipeVersionId);
            });

            // FIFO sorting
            matchingLots.sort((a: any, b: any) => {
                if (a.expiry_date && b.expiry_date) {
                    const timeDiff = new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
                    if (timeDiff !== 0) return timeDiff;
                } else if (a.expiry_date) {
                    return -1;
                } else if (b.expiry_date) {
                    return 1;
                }
                const dateA = a.created_on ? new Date(a.created_on).getTime() : 0;
                const dateB = b.created_on ? new Date(b.created_on).getTime() : 0;
                if (dateA !== dateB) return dateA - dateB;
                return Number(a.id) - Number(b.id);
            });

            const totalRequested = lines.reduce((sum: number, l: any) => sum + Number(l.ordered_quantity || 0), 0);
            const totalAvailable = matchingLots.reduce((sum: number, lot: any) => sum + Number(lot.quantity || 0), 0);

            if (totalAvailable < totalRequested) {
                return NextResponse.json({
                    error: `Insufficient stock of the correct recipe version. Available: ${totalAvailable}, Requested: ${totalRequested}`
                }, { status: 400 });
            }

            // Deduct quantities
            let remainingToDeduct = totalRequested;
            const lotDeductions: Array<{ lotNumber: string; quantity: number }> = [];

            for (const lot of matchingLots) {
                if (remainingToDeduct <= 0) break;
                const available = Number(lot.quantity || 0);
                if (available <= 0) continue;
                const deduct = Math.min(available, remainingToDeduct);
                const newQty = available - deduct;
                remainingToDeduct -= deduct;

                const patchRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots/${lot.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ quantity: newQty })
                });
                if (!patchRes.ok) {
                    const errTxt = await patchRes.text();
                    return NextResponse.json({ error: `Failed to deduct lot: ${patchRes.status} - ${errTxt}` }, { status: 500 });
                }

                lotDeductions.push({
                    lotNumber: lot.lot_number,
                    quantity: deduct
                });
            }

            // Apportion and update Sales Order Detail lines and create negative product_ledger entries
            let deductionIdx = 0;
            let deductionRemaining = lotDeductions.length > 0 ? lotDeductions[0].quantity : 0;

            for (const line of lines) {
                const detailId = Number(line.detail_id || line.id);
                const detailRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details/${detailId}`, { headers, cache: "no-store" });
                if (!detailRes.ok) continue;
                const detailData = (await detailRes.json()).data;
                if (!detailData) continue;

                const orderedQty = Number(detailData.ordered_quantity || 0);
                const unitPrice = Number(detailData.unit_price || 0);

                // Update detail
                const patchDetailRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details/${detailId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                        allocated_quantity: orderedQty,
                        allocated_amount: orderedQty * unitPrice
                    })
                });
                if (!patchDetailRes.ok) {
                    console.error(`Failed to update detail ${detailId}`);
                }

                const parentOrderId = detailData.order_id;
                let parentOrderNo = "";
                if (parentOrderId) {
                    const parentSoRes = await fetch(`${DIRECTUS_URL}/items/sales_order/${parentOrderId}`, { headers, cache: "no-store" });
                    if (parentSoRes.ok) {
                        const parentSo = (await parentSoRes.json()).data;
                        parentOrderNo = parentSo?.order_no || "";
                    }
                }

                let lineRemaining = orderedQty;
                while (lineRemaining > 0 && deductionIdx < lotDeductions.length) {
                    const currentLotDeduction = lotDeductions[deductionIdx];
                    const take = Math.min(lineRemaining, deductionRemaining);

                    const ledgerRes = await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            branchId: Number(branchId),
                            productId: Number(productId),
                            quantity: -take,
                            documentType: "Sales Order Issue",
                            documentNo: parentOrderNo || `SO-${parentOrderId}`,
                            documentDescription: `Direct Allocation Lot: ${currentLotDeduction.lotNumber}`,
                            documentDate: new Date().toISOString().split("T")[0]
                        })
                    });
                    if (!ledgerRes.ok) {
                        console.error("Failed to post ledger entry:", await ledgerRes.text());
                    }

                    lineRemaining -= take;
                    deductionRemaining -= take;
                    if (deductionRemaining <= 0) {
                        deductionIdx++;
                        if (deductionIdx < lotDeductions.length) {
                            deductionRemaining = lotDeductions[deductionIdx].quantity;
                        }
                    }
                }

                // Check parent order fully allocated status
                if (parentOrderId) {
                    const allDetailsRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details?filter[order_id][_eq]=${parentOrderId}&limit=-1`, { headers, cache: "no-store" });
                    if (allDetailsRes.ok) {
                        const allDetails = (await allDetailsRes.json()).data || [];
                        const allFullyAllocated = allDetails.every((d: any) => {
                            const ordered = Number(d.ordered_quantity || 0);
                            const alloc = Number(d.allocated_quantity || 0);
                            return alloc >= ordered;
                        });

                        const newStatus = allFullyAllocated ? "For Invoicing" : "For Picking";
                        await fetch(`${DIRECTUS_URL}/items/sales_order/${parentOrderId}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify({ order_status: newStatus })
                        });
                    }
                }
            }

            return NextResponse.json({ success: true });
        }

        const { jo, salesOrderIds } = body;

        if (!jo || !jo.jo_id) {
            return NextResponse.json({ error: "Missing job order configuration" }, { status: 400 });
        }

        // Get logged in user ID from secure access token cookie
        let encoderId: number | null = null;
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
                        if (!isNaN(parsed)) {
                            encoderId = parsed;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Error decoding user token in JO creation:", err);
        }

        // Map camelCase from frontend to snake_case for Directus database
        const dbPayload = {
            jo_id: jo.jo_id,
            order_id: jo.order_id || null,
            order_no: jo.order_no || null,
            product_id: jo.product_id,
            product_name: jo.product_name,
            quantity: jo.quantity,
            due_date: jo.due_date,
            status: jo.status || "Draft",
            is_batched: !!jo.is_batched,
            bom: jo.bom || null,
            components: jo.components || null,
            routings: jo.routings || null,
            allocation_results: jo.allocationResults || null,
            procurement_status: jo.procurementStatus || "Idle",
            branch_id: jo.branch_id || null,
            shift_option: jo.shiftOption || "8",
            daily_breakdown: jo.dailyBreakdown || null,
            created_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, -1) + "+08:00",
            created_by: encoderId,
            parent_job_order_id: jo.parentJobOrderId || jo.parent_job_order_id || null,
            assignments: jo.assignments || null,
            // disabled-lint-next-line @typescript-eslint/no-explicit-any
            products: jo.products ? jo.products.map((p: any) => ({
                product_id: p.product_id,
                product_name: p.product_name,
                quantity: p.quantity,
                bom: p.bom || null,
                components: p.components || null,
                routings: p.routings || null,
                allocation_results: p.allocationResults || null
            })) : null
        };

        const result = await createJobOrder(dbPayload, salesOrderIds);
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("API Error in planning-engineering POST:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to create Job Order" }, { status: 500 });
    }
}
