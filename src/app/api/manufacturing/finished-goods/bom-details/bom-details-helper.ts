import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { getBOMDetailsForVersion } from "../versions/versions-helper";

export { getBOMDetailsForVersion };

export async function updateProductVersionOverhead(versionId: number, customOverhead: number): Promise<boolean> {
    try {
        const res = await fetch(`${DIRECTUS_URL}/items/product_manufacturing_version/${versionId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ custom_overhead: customOverhead })
        });
        return res.ok;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed version overhead update:", e);
        return false;
    }
}

export async function saveActiveBOMDetails(versionId: number, expectedYield: number, baseQuantity: number = 1): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/product_manufacturing_version/${versionId}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ 
                expected_yield_percentage: expectedYield,
                base_quantity: baseQuantity
            })
        });
        return res.ok;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed saving version details:", e);
        return false;
    }
}

export async function syncRoutesAndBOM(versionId: number, routes: Record<string, unknown>[]): Promise<boolean> {
    try {
        // 1. Fetch existing routes in DB for this version
        const getUrl = `${DIRECTUS_URL}/items/manufacturing_routes?filter[version_id][_eq]=${versionId}&limit=-1`;
        const resGet = await fetch(getUrl, { headers, cache: "no-store" });
        if (!resGet.ok) throw new Error("Failed to fetch existing routes");
        const existingRoutes: { route_id: number }[] = (await resGet.json()).data || [];

        // 2. Identify routes to delete
        const uiRouteIds = new Set(routes.map(r => String(r.route_id || r.id || "")).filter(Boolean));
        const routesToDelete = existingRoutes.filter(e => !uiRouteIds.has(String(e.route_id)));

        for (const r of routesToDelete) {
            // Delete BOM components for this route first to avoid FK constraints
            const getBomsUrl = `${DIRECTUS_URL}/items/manufacturing_routes_bom?filter[route_id][_eq]=${r.route_id}&limit=-1`;
            const resBoms = await fetch(getBomsUrl, { headers, cache: "no-store" });
            const existingBoms: { id: number }[] = resBoms.ok ? (await resBoms.json()).data || [] : [];
            for (const b of existingBoms) {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom/${b.id}`, { method: "DELETE", headers });
            }
            // Delete route step itself
            await fetch(`${DIRECTUS_URL}/items/manufacturing_routes/${r.route_id}`, { method: "DELETE", headers });
        }

        // 3. Insert or Update routes from UI request
        for (const step of routes) {
            const stepId = step.route_id || step.id;
            const isNewRoute = !stepId || isNaN(Number(stepId));

            const routePayload = {
                version_id: versionId,
                work_center_id: step.work_center_id || null,
                operation_id: step.operation_id || step.operationId || null,
                sequence_order: Number(step.sequence_order || step.sequence || 0),
                setup_time_hours: Number(step.setup_time_hours || 0),
                run_time_hours: Number(step.run_time_hours || step.durationHours || 0),
                estimated_labor_cost: Number(step.estimated_labor_cost || step.laborFlatRate || 0),
                qa_template_id: step.qa_template_id || null
            };

            let finalRouteId: number;

            if (isNewRoute) {
                const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(routePayload)
                });
                if (!res.ok) throw new Error(`Failed to create route: ${res.status}`);
                const data = await res.json();
                finalRouteId = data.data.route_id;
            } else {
                finalRouteId = Number(stepId);
                const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes/${finalRouteId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(routePayload)
                });
                if (!res.ok) throw new Error(`Failed to update route ${finalRouteId}: ${res.status}`);
            }

            // Sync BOM items under this route step
            const uiBomItems = (step.bom_items || step.ingredients || []) as Record<string, unknown>[];
            
            // Get existing BOM items for this route in DB
            const bomsGetUrl = `${DIRECTUS_URL}/items/manufacturing_routes_bom?filter[route_id][_eq]=${finalRouteId}&limit=-1`;
            const resBomGet = await fetch(bomsGetUrl, { headers, cache: "no-store" });
            const existingBoms: { id: number }[] = resBomGet.ok ? (await resBomGet.json()).data || [] : [];

            const uiBomIds = new Set(uiBomItems.map((b: Record<string, unknown>) => String(b.id || "")).filter(Boolean));
            const bomsToDelete = existingBoms.filter(b => !uiBomIds.has(String(b.id)));

            // Delete removed BOM items
            for (const b of bomsToDelete) {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom/${b.id}`, { method: "DELETE", headers });
            }

            // Create or Update BOM items
            for (const bItem of uiBomItems) {
                const isNewBomItem = !bItem.id || isNaN(Number(bItem.id));
                const bomPayload = {
                    route_id: finalRouteId,
                    product_id: Number(bItem.product_id || bItem.productId || 0),
                    quantity_required: Number(bItem.quantity_required || bItem.quantity || 0),
                    unit_of_measurement: bItem.unit_of_measurement || bItem.uomId || bItem.uom || null,
                    wastage_factor_percentage: Number(bItem.wastage_factor_percentage || bItem.wastagePercent || 0)
                };

                if (isNewBomItem) {
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(bomPayload)
                    });
                } else {
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom/${bItem.id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify(bomPayload)
                    });
                }
            }
        }
        return true;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed syncing routes and BOM:", e);
        return false;
    }
}
