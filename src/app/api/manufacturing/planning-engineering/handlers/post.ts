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

        if (action === "release-draft") {
            const { joId } = body;
            if (!joId) {
                return NextResponse.json({ error: "Missing joId parameter" }, { status: 400 });
            }

            // 1. Fetch Job Order Header
            const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joId}?fields=job_order_id,job_order_no,product_id,version_id,target_quantity,status,branch_id,remarks,created_by`, { headers, cache: "no-store" });
            if (!joRes.ok) {
                return NextResponse.json({ error: `Job Order not found: ${joId}` }, { status: 404 });
            }
            const joData = (await joRes.ok ? (await joRes.json()).data : null);
            if (!joData) {
                return NextResponse.json({ error: `Job Order not found: ${joId}` }, { status: 404 });
            }

            if (joData.status !== "Draft" && joData.status !== "Planned" && joData.status !== "Planning") {
                return NextResponse.json({ error: "Only Draft or Planned Job Orders can be released." }, { status: 400 });
            }

            // 2. Fetch Job Order Materials Worksheet
            const matsRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials?filter[job_order_id][_eq]=${joData.job_order_id}&limit=-1`, { headers, cache: "no-store" });
            const mats = matsRes.ok ? (await matsRes.json()).data || [] : [];

            // 3. For each material in the worksheet, try to reserve any remaining shortfall
            let allRequirementsMet = true;
            const shortfallsList = [];

            for (const mat of mats) {
                const compProductId = Number(mat.product_id);
                const allocatedQty = Number(mat.allocated_quantity || 0);
                const reservedQty = Number(mat.reserved_quantity || 0);
                const needed = allocatedQty - reservedQty;

                if (needed <= 0) continue;

                // FIFO/FEFO Allocation directly from purchase_order_receiving
                if (!joData.branch_id) {
                    return NextResponse.json({ error: "Job Order has no branch assigned" }, { status: 400 });
                }
                const branchId = Number(joData.branch_id);
                const branchFilter = `&filter[branch_id][_eq]=${branchId}`;
                const receiptsUrl = `${DIRECTUS_URL}/items/purchase_order_receiving?filter[product_id][_eq]=${compProductId}&filter[qa_status][_eq]=Passed&filter[is_reverted][_eq]=0&filter[received_quantity][_gt]=0${branchFilter}&sort=expiry_date`;
                
                const receiptsRes = await fetch(receiptsUrl, { headers });
                const validReceipts = receiptsRes.ok ? (await receiptsRes.json()).data || [] : [];
                
                const receiptIds = validReceipts.map((r: any) => r.purchase_order_product_id).filter(Boolean);
                const reservationsMap: Record<number, number> = {};

                if (receiptIds.length > 0) {
                    try {
                        const resFilter = encodeURIComponent(JSON.stringify({
                            _and: [
                                { purchase_order_receiving_id: { _in: receiptIds } },
                                { jo_material_id: { job_order_id: { status: { _in: ["Proceed", "Ongoing", "On Hold"] } } } }
                            ]
                        }));
                        const resRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials_reservations?filter=${resFilter}&fields=purchase_order_receiving_id,reserved_quantity&limit=-1`, { headers });
                        if (resRes.ok) {
                            const reservationsData = (await resRes.json()).data || [];
                            reservationsData.forEach((r: any) => {
                                const porId = Number(r.purchase_order_receiving_id);
                                if (porId) {
                                    reservationsMap[porId] = (reservationsMap[porId] || 0) + Number(r.reserved_quantity || 0);
                                }
                            });
                        }
                    } catch (err) {
                        console.error("Error fetching material reservations:", err);
                    }
                }

                // Fetch physical inventory lots
                const lotQueryFilter = encodeURIComponent(JSON.stringify({
                    _and: [
                        { product_id: { _eq: compProductId } },
                        { branch_id: { _eq: branchId } },
                        { source_type: { _eq: "procurement" } }
                    ]
                }));
                const physicalLotsRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${lotQueryFilter}&limit=-1`, { headers });
                const physicalLots = physicalLotsRes.ok ? (await physicalLotsRes.json()).data || [] : [];

                let newlyReservedQty = 0;
                const newAllocations = [];

                for (const rec of validReceipts) {
                    if (newlyReservedQty >= needed) break;

                    const matchedLot = physicalLots.find((l: any) => 
                        String(l.source_reference) === String(rec.purchase_order_id) && 
                        (l.lot_number === rec.lot_no || l.lot_number === rec.batch_no || (l.lot_number === "LOT-N/A" && !rec.lot_no && !rec.batch_no))
                    );
                    const physicalQty = matchedLot ? Number(matchedLot.quantity || 0) : 0;
                    const recId = Number(rec.purchase_order_product_id);
                    const alreadyReserved = reservationsMap[recId] || 0;
                    const netAvailable = Math.max(0, physicalQty - alreadyReserved);

                    if (netAvailable <= 0) continue;

                    const currentNeeded = needed - newlyReservedQty;
                    const taken = Math.min(netAvailable, currentNeeded);

                    if (taken > 0) {
                        newlyReservedQty += taken;
                        newAllocations.push({
                            purchase_order_receiving_id: recId,
                            allocated: taken
                        });
                    }
                }

                // Save new allocations/reservations
                if (newlyReservedQty > 0) {
                    for (const alloc of newAllocations) {
                        const reservationPayload = {
                            product_id: compProductId,
                            jo_material_id: mat.jo_material_id || mat.id,
                            purchase_order_receiving_id: alloc.purchase_order_receiving_id,
                            reserved_quantity: alloc.allocated,
                            actual_used_quantity: 0,
                            created_by: joData.created_by ? Number(joData.created_by) : null
                        };
                        await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials_reservations`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify(reservationPayload)
                        }).catch(err => console.error("Error creating materials reservation row during draft release:", err));
                    }

                    // Update parent requirements row's reserved_quantity
                    const updatedReservedQty = reservedQty + newlyReservedQty;
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials/${mat.jo_material_id || mat.id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({ reserved_quantity: updatedReservedQty })
                    }).catch(err => console.error("Failed to update parent reserved quantity:", err));
                }

                const finalReservedQty = reservedQty + newlyReservedQty;
                if (finalReservedQty < allocatedQty) {
                    allRequirementsMet = false;
                    // Fetch product name for detail report
                    const productRes = await fetch(`${DIRECTUS_URL}/items/products/${compProductId}?fields=product_name`, { headers });
                    const prodName = productRes.ok ? (await productRes.json()).data?.product_name || `Product #${compProductId}` : `Product #${compProductId}`;
                    shortfallsList.push({
                        name: prodName,
                        shortage: allocatedQty - finalReservedQty
                    });
                }
            }

            if (allRequirementsMet || body.forceRelease === true) {
                // Change status to Released
                const patchRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joData.job_order_id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ status: "Released" })
                });
                if (patchRes.ok) {
                    return NextResponse.json({ 
                        success: true, 
                        message: allRequirementsMet 
                            ? "Job Order released successfully." 
                            : "Job Order forcibly released with material shortfalls." 
                    });
                } else {
                    return NextResponse.json({ error: "Failed to update Job Order status to Released." }, { status: 500 });
                }
            } else {
                const shortfallMsg = shortfallsList.map(s => `${s.name} (Shortfall: ${s.shortage.toFixed(2)} units)`).join("; ");
                return NextResponse.json({
                    success: false,
                    error: `Still insufficient raw materials to release: ${shortfallMsg}`
                }, { status: 400 });
            }
        }

        if (action === "reserve-lot") {
            const { joId, materialId, productId, receivingId, qty, isSubAssembly } = body;
            if (!joId || !materialId || !productId || !qty) {
                return NextResponse.json({ error: "Missing parameters for reservation." }, { status: 400 });
            }

            if (isSubAssembly) {
                // Update parent requirement row directly
                const matRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials/${materialId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ reserved_quantity: Number(qty) })
                });
                if (!matRes.ok) {
                    const errTxt = await matRes.text();
                    return NextResponse.json({ error: `Failed to update sub-assembly reservation: ${errTxt}` }, { status: 500 });
                }
                return NextResponse.json({ success: true, message: "Sub-assembly successfully reserved from manufacturing stock." });
            }

            if (!receivingId) {
                return NextResponse.json({ error: "Missing receivingId for raw material reservation." }, { status: 400 });
            }

            // Create reservation entry
            const reservationPayload = {
                product_id: Number(productId),
                jo_material_id: Number(materialId),
                purchase_order_receiving_id: Number(receivingId),
                reserved_quantity: Number(qty),
                actual_used_quantity: 0
            };

            const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials_reservations`, {
                method: "POST",
                headers,
                body: JSON.stringify(reservationPayload)
            });

            if (!res.ok) {
                const errTxt = await res.text();
                return NextResponse.json({ error: `Failed to save materials reservation: ${errTxt}` }, { status: 500 });
            }

            // Update parent requirement row
            const matRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials/${materialId}`, { headers });
            if (matRes.ok) {
                const matData = (await matRes.json()).data;
                const newReserved = Number(matData.reserved_quantity || 0) + Number(qty);
                await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials/${materialId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ reserved_quantity: newReserved })
                });
            }

            return NextResponse.json({ success: true, message: "Material successfully reserved from lot." });
        }

        if (action === "unreserve-lot") {
            const { joId, materialId, reservationId, isSubAssembly } = body;
            if (!joId || !materialId) {
                return NextResponse.json({ error: "Missing parameters for unreservation." }, { status: 400 });
            }

            if (isSubAssembly) {
                // Set reserved_quantity to 0 directly
                const matRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials/${materialId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ reserved_quantity: 0 })
                });
                if (!matRes.ok) {
                    const errTxt = await matRes.text();
                    return NextResponse.json({ error: `Failed to clear sub-assembly reservation: ${errTxt}` }, { status: 500 });
                }
                return NextResponse.json({ success: true, message: "Sub-assembly reservation successfully cleared." });
            }

            if (!reservationId) {
                return NextResponse.json({ error: "Missing reservationId for raw material unreservation." }, { status: 400 });
            }

            // Fetch the reservation row to get the quantity being unreserved
            const resUrl = `${DIRECTUS_URL}/items/manufacturing_job_order_materials_reservations/${reservationId}`;
            const resRes = await fetch(resUrl, { headers });
            if (!resRes.ok) {
                return NextResponse.json({ error: "Reservation record not found." }, { status: 404 });
            }
            const resData = (await resRes.json()).data;
            const unreservedQty = Number(resData.reserved_quantity || 0);

            // Delete the reservation row
            const delRes = await fetch(resUrl, { method: "DELETE", headers });
            if (!delRes.ok) {
                return NextResponse.json({ error: "Failed to delete reservation." }, { status: 500 });
            }

            // Update parent requirement row
            const matRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials/${materialId}`, { headers });
            if (matRes.ok) {
                const matData = (await matRes.json()).data;
                const newReserved = Math.max(0, Number(matData.reserved_quantity || 0) - unreservedQty);
                await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials/${materialId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ reserved_quantity: newReserved })
                });
            }

            return NextResponse.json({ success: true, message: "Material successfully unreserved." });
        }

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
            // Helper function to resolve or create master lot in the lots table
            const resolveMasterLotId = async (name: string, typeId: number) => {
                let lotId = 49; // Default fallback to a valid existing lot ID (e.g. 49) instead of 1
                const mappedTypeId = typeId === 1 ? 390 : 389;
                try {
                    const lotQuery = encodeURIComponent(JSON.stringify({ lot_name: { _eq: name } }));
                    const lotLookupRes = await fetch(`${DIRECTUS_URL}/items/lots?filter=${lotQuery}&limit=1`, { headers, cache: "no-store" });
                    const lotLookup = lotLookupRes.ok ? (await lotLookupRes.json()).data || [] : [];
                    if (lotLookup.length > 0) {
                        lotId = lotLookup[0].lot_id;
                    } else {
                        const createLotRes = await fetch(`${DIRECTUS_URL}/items/lots`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                lot_name: name,
                                inventory_type_id: mappedTypeId,
                                max_batch_capacity: 100000,
                                created_by: 24
                            })
                        });
                        if (createLotRes.ok) {
                            lotId = (await createLotRes.json()).data.lot_id;
                        } else {
                            console.error(`Failed to create master lot ${name}:`, await createLotRes.text());
                        }
                    }
                } catch (err) {
                    console.error(`Error resolving master lot ID for ${name}:`, err);
                }
                return lotId;
            };

            let deductionIdx = 0;
            let deductionRemaining = lotDeductions.length > 0 ? lotDeductions[0].quantity : 0;

            const parentOrderIdsToUpdate = new Set<number>();

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
                    parentOrderIdsToUpdate.add(Number(parentOrderId));
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

                    // Write negative shipment/issue movement to inventory_movements ledger
                    try {
                        const masterLotId = await resolveMasterLotId(currentLotDeduction.lotNumber, 2); // 2 = Finished Goods
                        const physicalLot = matchingLots.find((l: any) => l.lot_number === currentLotDeduction.lotNumber);
                        const movementPayload = {
                            product_id: Number(productId),
                            lot_id: masterLotId,
                            branch_id: Number(branchId),
                            transaction_type_id: 4, // Sales Order Issue / Dispatch
                            source_document_id: physicalLot ? physicalLot.id : 0,
                            source_document_no: parentOrderNo || `SO-${parentOrderId}`,
                            batch_no: currentLotDeduction.lotNumber,
                            expiry_date: physicalLot ? physicalLot.expiry_date : null,
                            manufacturing_date: physicalLot && physicalLot.created_on ? physicalLot.created_on.split("T")[0] : null,
                            quantity: -take, // negative for issue
                            created_by: 24,
                            remarks: `Direct Allocation Shipment for Sales Order ${parentOrderNo || `SO-${parentOrderId}`}`
                        };
                        const movRes = await fetch(`${DIRECTUS_URL}/items/inventory_movements`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify(movementPayload)
                        });
                        if (!movRes.ok) {
                            console.error("Failed to post negative inventory movement for Sales Order Issue:", await movRes.text());
                        }
                    } catch (movErr) {
                        console.error("Error posting negative inventory movement for Sales Order Issue:", movErr);
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
            }

            // Check and update affected parent orders status
            for (const parentOrderId of parentOrderIdsToUpdate) {
                const allDetailsRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details?filter[order_id][_eq]=${parentOrderId}&limit=-1`, { headers, cache: "no-store" });
                if (allDetailsRes.ok) {
                    const allDetails = (await allDetailsRes.json()).data || [];
                    console.log(`[Diagnostic] checking parentOrderId ${parentOrderId}, lines count: ${lines.length}`);
                    const allFullyAllocated = allDetails.every((d: any) => {
                        const detailIdVal = Number(d.detail_id || d.id);
                        const isBeingAllocated = lines.some((l: any) => Number(l.detail_id || l.id) === detailIdVal);
                        const ordered = Number(d.ordered_quantity || 0);
                        const alloc = Number(d.allocated_quantity || 0);
                        const result = isBeingAllocated || alloc >= ordered;
                        console.log(`[Diagnostic] Detail ID: ${detailIdVal}, isBeingAllocated: ${isBeingAllocated}, ordered: ${ordered}, alloc: ${alloc}, line result: ${result}`);
                        return result;
                    });
                    console.log(`[Diagnostic] final allFullyAllocated: ${allFullyAllocated}`);

                    const newStatus = allFullyAllocated ? "For Invoicing" : "For Picking";
                    console.log(`[BFF Direct Allocate] Transitioning SO ${parentOrderId} to status: ${newStatus}`);
                    const updateStatusRes = await fetch(`${DIRECTUS_URL}/items/sales_order/${parentOrderId}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({ 
                            order_status: newStatus,
                            for_invoicing_at: newStatus === "For Invoicing" ? new Date().toISOString() : undefined
                        })
                    });
                    if (!updateStatusRes.ok) {
                        console.error(`Failed to update parent Sales Order ${parentOrderId} status to ${newStatus}:`, await updateStatusRes.text());
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
