/* eslint-disable */
import { DIRECTUS_URL, headers, getJobOrderIdByNo } from "./shared";

export async function updateJobOrder(joId: string, patchData: Record<string, any>): Promise<{ success: boolean }> {
    return modifyJobOrder(joId, patchData);
}

export async function modifyJobOrder(joId: string, patchData: Record<string, any>): Promise<{ success: boolean }> {
    try {
        const joInfo = await getJobOrderIdByNo(joId);
        if (!joInfo) throw new Error(`Job Order not found: ${joId}`);
        const joIdInt = joInfo.id;

        const headerPatch: Record<string, any> = {};

        // Extract products updates if any
        let productsPatchList = patchData.products;
        if (productsPatchList && Array.isArray(productsPatchList) && productsPatchList.length > 0) {
            const firstP = productsPatchList[0];
            if (firstP.product_id !== undefined) headerPatch.product_id = Number(firstP.product_id);
            if (firstP.quantity !== undefined) headerPatch.target_quantity = Number(firstP.quantity);
            const vId = firstP.bom?.version || firstP.bom?.version_id;
            if (vId !== undefined) headerPatch.version_id = Number(vId);
        }

        // Map incoming fields to new schema fields
        if (patchData.status !== undefined) {
            let mappedStatus = patchData.status;
            if (patchData.status === "Shortage") mappedStatus = "Draft";
            else if (patchData.status === "Proceed") mappedStatus = "Released";
            else if (patchData.status === "Ongoing") mappedStatus = "In Progress";
            else if (patchData.status === "Finished") mappedStatus = "Completed";
            headerPatch.status = mappedStatus;
        }
        if (patchData.due_date !== undefined) headerPatch.end_date = patchData.due_date;
        if (patchData.remarks !== undefined) headerPatch.remarks = patchData.remarks;
        if (patchData.quantity !== undefined) headerPatch.target_quantity = Number(patchData.quantity);
        if (patchData.product_id !== undefined) headerPatch.product_id = Number(patchData.product_id);
        if (patchData.created_by !== undefined) headerPatch.created_by = Number(patchData.created_by);
        
        // Patch header
        if (Object.keys(headerPatch).length > 0) {
            const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joIdInt}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(headerPatch)
            });
            if (!res.ok) throw new Error(`Failed to patch job_order header: ${res.status}`);

            // Automatically pass finished goods to inventory if JO is finalized
            if (headerPatch.status === "Finished" || headerPatch.status === "Completed") {
                try {
                    const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joIdInt}`, { headers });
                    if (joRes.ok) {
                        const joData = (await joRes.json()).data;
                        if (joData) {
                            const bId = joData.branch_id ? Number(joData.branch_id) : null;
                            const qty = Number(joData.target_quantity || 0);
                            const lotNo = `MFG-${joId}`;
                            const expDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                            
                            // 1. Create inventory_lots record
                            const lotRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots`, {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    product_id: joData.product_id,
                                    branch_id: bId,
                                    lot_number: lotNo,
                                    expiry_date: expDate,
                                    quantity: qty,
                                    unit_cost: 0,
                                    qa_status: "Passed",
                                    source_type: "manufacturing",
                                    source_reference: joId,
                                    created_on: new Date().toISOString()
                                })
                            });

                            if (!lotRes.ok) {
                                console.error("[Manufacturing Directus API] Failed to create inventory lot record:", await lotRes.text());
                            }
                            
                            // 2. Create a product_ledger entry
                            await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    branchId: bId,
                                    productId: joData.product_id,
                                    quantity: qty,
                                    documentType: "QA Receive",
                                    documentNo: joId,
                                    documentDescription: `MFG Run: ${lotNo}`,
                                    documentDate: new Date().toISOString().split('T')[0]
                                })
                            });
                        }
                    }
                } catch (err) {
                    console.error("[Manufacturing Directus API] Failed to auto-pass finished goods to inventory:", err);
                }
            }
        }

        return { success: true };
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to update job order:", e);
        throw e;
    }
}
