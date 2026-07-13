/* eslint-disable */
import { DIRECTUS_URL, headers } from "./shared";

export async function getProductInventoryAndSafetyStock(productIds: number[], branchId?: number) {
    try {
        const prodFilter = productIds.length > 0 ? `&filter[product_id][_in]=${productIds.join(",")}` : "";
        const prodRes = await fetch(`${DIRECTUS_URL}/items/products?limit=-1${prodFilter}&fields=product_id,product_name,product_code,maintaining_quantity`, { headers });
        const products = prodRes.ok ? (await prodRes.json()).data || [] : [];

        const lotFilter = branchId 
            ? `&filter[branch_id][_eq]=${branchId}`
            : "";
        const lotsRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter[qa_status][_eq]=Passed&filter[quantity][_gt]=0&limit=-1${lotFilter}`, { headers });
        const lots = lotsRes.ok ? (await lotsRes.json()).data || [] : [];

        const onHandMap: Record<number, number> = {};
        lots.forEach((lot: any) => {
            const pId = Number(lot.product_id?.product_id || lot.product_id);
            if (pId) {
                onHandMap[pId] = (onHandMap[pId] || 0) + Number(lot.quantity || 0);
            }
        });

        return products.map((p: any) => {
            const onHand = onHandMap[p.product_id] || 0;
            const safetyStock = Number(p.maintaining_quantity || 0);
            return {
                product_id: p.product_id,
                product_name: p.product_name,
                product_code: p.product_code,
                on_hand: onHand,
                safety_stock: safetyStock
            };
        });
    } catch (e) {
        console.error("Error in getProductInventoryAndSafetyStock:", e);
        return [];
    }
}
