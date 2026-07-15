/* eslint-disable */
import { DIRECTUS_URL, headers } from "./shared";
import { getActiveVersionForProduct } from "../../finished-goods/versions/versions-helper";

export async function getProductInventoryAndSafetyStock(productIds: number[], branchId: number) {
    if (!branchId) {
        throw new Error("Missing required branchId in getProductInventoryAndSafetyStock");
    }
    try {
        const bId = Number(branchId);
        const prodFilter = productIds.length > 0 ? `&filter[product_id][_in]=${productIds.join(",")}` : "";
        const prodRes = await fetch(`${DIRECTUS_URL}/items/products?limit=-1${prodFilter}&fields=product_id,product_name,product_code,maintaining_quantity`, { headers, cache: "no-store" });
        const products = prodRes.ok ? (await prodRes.json()).data || [] : [];

        // 1. Fetch passed inventory lots to resolve QA status metadata
        const lotFilter = encodeURIComponent(JSON.stringify({
            _and: [
                ...(productIds.length > 0 ? [{ product_id: { _in: productIds } }] : []),
                { branch_id: { _eq: bId } },
                { qa_status: { _eq: "Passed" } }
            ]
        }));
        const lotsRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${lotFilter}&limit=-1`, { headers, cache: "no-store" });
        const lots = lotsRes.ok ? (await lotsRes.json()).data || [] : [];

        const passedLotsSet = new Set<string>(); // "product_id:lot_number"
        lots.forEach((lot: any) => {
            const pId = Number(lot.product_id?.product_id || lot.product_id);
            const lotNum = lot.lot_number || "LOT-N/A";
            if (pId) {
                passedLotsSet.add(`${pId}:${lotNum}`);
            }
        });

        // 2. Fetch inventory movements to calculate the true ledger stock
        const movFilter = encodeURIComponent(JSON.stringify({
            _and: [
                ...(productIds.length > 0 ? [{ product_id: { _in: productIds } }] : []),
                { branch_id: { _eq: bId } }
            ]
        }));
        const movRes = await fetch(`${DIRECTUS_URL}/items/inventory_movements?filter=${movFilter}&limit=-1`, { headers, cache: "no-store" });
        const movements = movRes.ok ? (await movRes.json()).data || [] : [];

        const movementStockMap = new Map<string, number>(); // "product_id:batch_no" -> sum of quantity
        movements.forEach((mov: any) => {
            const pId = Number(mov.product_id?.product_id || mov.product_id);
            const batchNo = mov.batch_no || "LOT-N/A";
            const qty = Number(mov.quantity || 0);

            if (pId) {
                const key = `${pId}:${batchNo}`;
                movementStockMap.set(key, (movementStockMap.get(key) || 0) + qty);
            }
        });

        // Compute onHand stock per product (summing only Passed lots)
        const onHandMap: Record<number, number> = {};
        lots.forEach((lot: any) => {
            const pId = Number(lot.product_id?.product_id || lot.product_id);
            if (pId) {
                onHandMap[pId] = (onHandMap[pId] || 0) + Number(lot.quantity || 0);
            }
        });

        // Resolve recommended lot numbers for raw materials
        const enrichedProducts = [];
        for (const p of products) {
            const pId = Number(p.product_id);
            const onHand = onHandMap[pId] || 0;
            const safetyStock = Number(p.maintaining_quantity || 0);

            // Check if it is a sub-assembly
            const activeVer = await getActiveVersionForProduct(pId);
            const isSubAssembly = activeVer && activeVer.version;

            let recommendedLots: any[] = [];
            if (!isSubAssembly) {
                const branchFilter = branchId ? `&filter[branch_id][_eq]=${branchId}` : "";
                const receiptsUrl = `${DIRECTUS_URL}/items/purchase_order_receiving?filter[product_id][_eq]=${pId}&filter[qa_status][_eq]=Passed&filter[is_reverted][_eq]=0&filter[received_quantity][_gt]=0${branchFilter}&sort=expiry_date`;
                
                const receiptsRes = await fetch(receiptsUrl, { headers, cache: "no-store" });
                const validReceipts = receiptsRes.ok ? (await receiptsRes.json()).data || [] : [];

                const receiptIds = validReceipts.map((r: any) => r.purchase_order_product_id).filter(Boolean);
                const reservationsMap: Record<number, number> = {};

                if (receiptIds.length > 0) {
                    try {
                        const resFilter = encodeURIComponent(JSON.stringify({
                            _and: [
                                { purchase_order_receiving_id: { _in: receiptIds } },
                                { jo_material_id: { job_order_id: { status: { _in: ["Planned", "Draft", "Released", "In Progress", "Ongoing", "Proceed", "On Hold"] } } } }
                            ]
                        }));
                        const resRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials_reservations?filter=${resFilter}&fields=purchase_order_receiving_id,reserved_quantity&limit=-1`, { headers, cache: "no-store" });
                        if (resRes.ok) {
                            const resData = (await resRes.json()).data || [];
                            resData.forEach((r: any) => {
                                const porId = Number(r.purchase_order_receiving_id);
                                if (porId) {
                                    reservationsMap[porId] = (reservationsMap[porId] || 0) + Number(r.reserved_quantity || 0);
                                }
                            });
                        }
                    } catch (err) {
                        console.error("Error fetching reservations for net-requirements:", err);
                    }
                }

                validReceipts.forEach((rec: any) => {
                    const lotNo = rec.lot_no || rec.batch_no || "LOT-N/A";
                    const physicalQty = movementStockMap.get(`${pId}:${lotNo}`) || 0;
                    const recId = Number(rec.purchase_order_product_id);
                    const alreadyReserved = reservationsMap[recId] || 0;
                    const netAvailable = Math.max(0, physicalQty - alreadyReserved);

                    if (netAvailable > 0) {
                        recommendedLots.push({
                            lot_no: lotNo,
                            available: netAvailable
                        });
                    }
                });
            } else {
                // If it is a sub-assembly, we can recommend its manufactured batches directly from lots!
                lots.forEach((lot: any) => {
                    const keyPId = Number(lot.product_id?.product_id || lot.product_id);
                    if (keyPId === pId && Number(lot.quantity || 0) > 0) {
                        recommendedLots.push({
                            lot_no: lot.lot_number,
                            available: Number(lot.quantity || 0)
                        });
                    }
                });
            }

            enrichedProducts.push({
                product_id: pId,
                product_name: p.product_name,
                product_code: p.product_code,
                on_hand: onHand,
                safety_stock: safetyStock,
                recommended_lots: recommendedLots
            });
        }

        return enrichedProducts;
    } catch (e) {
        console.error("Error in getProductInventoryAndSafetyStock:", e);
        return [];
    }
}
