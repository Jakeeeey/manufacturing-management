import { NextResponse } from "next/server";

import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

// Types
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface DirectusProductVersion {
    id: number;
    product_id: number;
    version_name: string;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productIdStr = searchParams.get("productId");
        if (!productIdStr) {
            return NextResponse.json({ error: "Missing productId query parameter" }, { status: 400 });
        }
        const productId = parseInt(productIdStr);
        if (isNaN(productId)) {
            return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
        }

        const url = `${DIRECTUS_URL}/items/manufacturing_boms?filter[product_id][_eq]=${productId}&fields=*,version.*&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) throw new Error(`Directus failed to fetch versions: ${res.status}`);
        const json = await res.json();
        
        const versionsList = (json.data || []).map((b: Record<string, unknown> & { bom_id: number; bom_name?: string; is_active?: unknown; version?: { version_name?: string } | null }) => ({
            bom_id: b.bom_id,
            version_name: b.version?.version_name || b.bom_name || `BOM #${b.bom_id}`,
            is_active: !!b.is_active
        }));

        return NextResponse.json(versionsList);
    } catch (e) {
        console.error("API Error fetching versions:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch versions" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, baseBomId, expectedYield, bomName, versionName } = body;

        if (!productId || !versionName) {
            return NextResponse.json({ error: "Missing required fields (productId, versionName)" }, { status: 400 });
        }

        const numericProductId = parseInt(productId);
        const yieldPercent = Number(expectedYield) || 100;
        const bName = bomName || `BOM for product ${productId}`;

        if (baseBomId) {
            // Clone and register version
            let createdVersionId: number | null = null;
            let createdBomId: number | null = null;
            const createdComponents: number[] = [];
            const createdRoutings: number[] = [];
            const oldBomId = parseInt(baseBomId);

            try {
                // 1. Create product version
                const verRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_product_version`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        product_id: numericProductId,
                        version_name: versionName,
                        created_at: new Date().toISOString()
                    })
                });
                if (!verRes.ok) throw new Error(`Directus failed to create product version: ${verRes.status}`);
                const verJson = await verRes.json();
                createdVersionId = verJson.data?.id;

                const today = new Date().toISOString().split("T")[0];

                // 2. Deactivate old BOM
                await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${oldBomId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ is_active: false, valid_to: today })
                });

                // 3. Create new BOM
                const resNew = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        product_id: numericProductId,
                        bom_name: bName,
                        base_quantity: 1,
                        expected_yield_percentage: yieldPercent,
                        is_active: true,
                        version: createdVersionId,
                        valid_from: today
                    })
                });
                if (!resNew.ok) throw new Error(`Failed to create new active BOM version: ${resNew.status}`);
                const newBomJson = await resNew.json();
                const newBOM = newBomJson.data;
                createdBomId = newBOM.bom_id;

                // 4. Fetch components of old BOM
                const compFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: oldBomId } }));
                const resComp = await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components?filter=${compFilter}&limit=-1`, { headers, cache: "no-store" });
                if (resComp.ok) {
                    const compJson = await resComp.json();
                    const oldComponents = compJson.data || [];
                    for (const item of oldComponents) {
                        const resItem = await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                bom_id: createdBomId,
                                component_product_id: item.component_product_id,
                                quantity_required: item.quantity_required,
                                unit_of_measurement: item.unit_of_measurement || null,
                                wastage_factor_percentage: item.wastage_factor_percentage
                            })
                        });
                        if (resItem.ok) {
                            const itemData = await resItem.json();
                            createdComponents.push(itemData.data.component_id);
                        }
                    }
                }

                // 5. Fetch routing steps of old BOM
                const routFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: oldBomId } }));
                const resRout = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings?filter=${routFilter}&limit=-1`, { headers, cache: "no-store" });
                if (resRout.ok) {
                    const routJson = await resRout.json();
                    const oldRoutings = routJson.data || [];
                    for (const step of oldRoutings) {
                        const resStep = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                bom_id: createdBomId,
                                version: createdVersionId,
                                sequence_order: step.sequence_order,
                                operation_name: step.operation_name,
                                estimated_labor_cost: step.estimated_labor_cost,
                                estimated_overhead_cost: step.estimated_overhead_cost,
                                duration_hours: step.duration_hours
                            })
                        });
                        if (resStep.ok) {
                            const stepData = await resStep.json();
                            createdRoutings.push(stepData.data.routing_id);
                        }
                    }
                }

                return NextResponse.json({ success: true, bom: newBOM });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.error("Error cloning BOM, rolling back...", err);
                for (const id of createdRoutings) {
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_routings/${id}`, { method: "DELETE", headers }).catch(() => {});
                }
                for (const id of createdComponents) {
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components/${id}`, { method: "DELETE", headers }).catch(() => {});
                }
                if (createdBomId) {
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${createdBomId}`, { method: "DELETE", headers }).catch(() => {});
                }
                if (createdVersionId) {
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_product_version/${createdVersionId}`, { method: "DELETE", headers }).catch(() => {});
                }
                // Re-activate old BOM
                await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${oldBomId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ is_active: true, valid_to: null })
                }).catch(() => {});
                throw err;
            }
        } else {
            // Register initial version
            // 1. Create product version
            const verRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_product_version`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    product_id: numericProductId,
                    version_name: versionName,
                    created_at: new Date().toISOString()
                })
            });
            if (!verRes.ok) throw new Error(`Directus failed to create product version: ${verRes.status}`);
            const verJson = await verRes.json();
            const versionId = verJson.data?.id;

            // 2. Create BOM
            const bomRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    product_id: numericProductId,
                    bom_name: bName,
                    base_quantity: 1,
                    expected_yield_percentage: yieldPercent,
                    is_active: true,
                    version: versionId
                })
            });
            if (!bomRes.ok) {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_product_version/${versionId}`, { method: "DELETE", headers }).catch(() => {});
                throw new Error(`Directus failed to create BOM: ${bomRes.status}`);
            }
            const bomJson = await bomRes.json();
            return NextResponse.json({ success: true, bom: bomJson.data });
        }
    } catch (e) {
        console.error("API Error registering version:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to register version" }, { status: 500 });
    }
}


