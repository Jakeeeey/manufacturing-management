import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { 
    DirectusBOM,
    DirectusBOMComponent,
    DirectusRouting,
    DirectusBOMComponentInput,
    DirectusRoutingStepInput
} from "@/modules/manufacturing-management/finished-goods/types";

import { fetchAllUnits } from "../units/units-helper";
import { fetchAllOperations } from "../operations/operations-helper";

/**
 * Crawls detailed BOM components and routings for a specific version.
 */
export async function getBOMDetailsForVersion(productId: number, versionId: number): Promise<{
    bom: DirectusBOM | null;
    components: DirectusBOMComponent[];
    routings: DirectusRouting[];
}> {
    try {
        const filter = encodeURIComponent(JSON.stringify({
            _and: [
                { product_id: { _eq: productId } },
                { version: { _eq: versionId } }
            ]
        }));
        
        const resBOM = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms?filter=${filter}&fields=*,version.*&limit=1`, { headers, cache: "no-store" });
        if (!resBOM.ok) return { bom: null, components: [], routings: [] };
        
        const bomData = await resBOM.json();
        const activeBOM: DirectusBOM = bomData.data?.[0];
        
        if (!activeBOM) return { bom: null, components: [], routings: [] };
        
        const compFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: activeBOM.bom_id } }));
        const resComp = await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components?filter=${compFilter}&limit=-1`, { headers, cache: "no-store" });
        const compJson = await resComp.json();
        const components: DirectusBOMComponent[] = compJson.data || [];
        
        const routFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: activeBOM.bom_id } }));
        const resRout = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings?filter=${routFilter}&sort=sequence_order&limit=-1`, { headers, cache: "no-store" });
        const routJson = await resRout.json();
        const routings: DirectusRouting[] = routJson.data || [];
        
        return { bom: activeBOM, components, routings };
    } catch (e) {
        console.error(`[Manufacturing Directus API] Error fetching BOM details for version ${versionId}:`, e);
        return { bom: null, components: [], routings: [] };
    }
}

/**
 * Updates product version custom overhead.
 */
export async function updateProductVersionOverhead(bomId: number, customOverhead: number): Promise<boolean> {
    try {
        const bomRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${bomId}`, { headers });
        if (!bomRes.ok) return false;
        const bomVersion = (await bomRes.json()).data?.version;
        if (!bomVersion) return false;
        const versionId = typeof bomVersion === "object" ? bomVersion.id : Number(bomVersion);
        
        const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_product_version/${versionId}`, {
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

/**
 * Updates active BOM metadata.
 */
export async function saveActiveBOMDetails(bomId: number, expectedYield: number): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/manufacturing_boms/${bomId}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ expected_yield_percentage: expectedYield })
        });
        return res.ok;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed saving BOM yield details:", e);
        return false;
    }
}

/**
 * Syncs BOM components.
 */
export async function syncBOMComponents(bomId: number, components: DirectusBOMComponentInput[], isNewBOM = false): Promise<boolean> {
    try {
        const units = await fetchAllUnits();
        if (isNewBOM) {
            for (const item of components) {
                let uomId = item.uomId;
                if (!uomId && item.uom) {
                    const matchedUnit = units.find(u => 
                        u.unit_shortcut?.toLowerCase() === String(item.uom).toLowerCase() ||
                        u.unit_name?.toLowerCase() === String(item.uom).toLowerCase()
                    );
                    if (matchedUnit) uomId = matchedUnit.unit_id;
                }
                const payload = {
                    bom_id: bomId,
                    component_product_id: item.productId,
                    quantity_required: item.quantity,
                    unit_of_measurement: uomId || null,
                    wastage_factor_percentage: item.wastagePercent,
                    component_type: item.type || "raw_material",
                    landed_cost: Number(item.landedCost) || 0
                };
                await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload)
                });
            }
            return true;
        }

        const getUrl = `${DIRECTUS_URL}/items/manufacturing_bom_components?filter[bom_id][_eq]=${bomId}&limit=-1`;
        const resGet = await fetch(getUrl, { headers, cache: "no-store" });
        if (!resGet.ok) throw new Error("Failed to fetch components");
        const existing: { component_id: number }[] = (await resGet.json()).data || [];
        const uiIds = new Set(components.map(item => String(item.id)));

        const toDelete = existing.filter(e => !uiIds.has(String(e.component_id)));
        for (const item of toDelete) {
            await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components/${item.component_id}`, {
                method: "DELETE",
                headers
            });
        }

        for (const item of components) {
            let uomId = item.uomId;
            if (!uomId && item.uom) {
                const matchedUnit = units.find(u => 
                    u.unit_shortcut?.toLowerCase() === String(item.uom).toLowerCase() ||
                    u.unit_name?.toLowerCase() === String(item.uom).toLowerCase()
                );
                if (matchedUnit) uomId = matchedUnit.unit_id;
            }
            const payload = {
                bom_id: bomId,
                component_product_id: item.productId,
                quantity_required: item.quantity,
                unit_of_measurement: uomId || null,
                wastage_factor_percentage: item.wastagePercent,
                component_type: item.type || "raw_material",
                landed_cost: Number(item.landedCost) || 0
            };
            const isNew = isNaN(Number(item.id));
            if (isNew) {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components`, { method: "POST", headers, body: JSON.stringify(payload) });
            } else {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components/${item.id}`, { method: "PATCH", headers, body: JSON.stringify(payload) });
            }
        }
        return true;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed syncing components:", e);
        return false;
    }
}

/**
 * Syncs routing steps.
 */
export async function syncRoutingSteps(
    bomId: number,
    routings: DirectusRoutingStepInput[],
    versionId: number,
    isNewBOM = false
): Promise<boolean> {
    try {
        const validRoutings = routings.filter(r => {
            const hasName = String(r.name || "").trim() !== "";
            const computedCost = Number(r.laborFlatRate || 0) + (Number(r.machineHourlyRate || 0) * Number(r.durationHours || 0));
            return hasName || computedCost !== 0;
        });

        let finalVersionId = versionId;
        if (!finalVersionId || finalVersionId === 0) {
            const bomRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${bomId}`, { headers });
            if (bomRes.ok) {
                const bomVersion = (await bomRes.json()).data?.version;
                if (bomVersion) {
                    finalVersionId = typeof bomVersion === "object" ? bomVersion.id : Number(bomVersion);
                }
            }
        }

        const operations = await fetchAllOperations();

        if (isNewBOM) {
            for (const step of validRoutings) {
                const matchedOp = operations.find(o => o.operation_name.trim().toLowerCase() === String(step.name || "").trim().toLowerCase());
                const payload = {
                    bom_id: bomId,
                    version: finalVersionId,
                    sequence_order: step.sequence,
                    operation_name: step.name,
                    operation_id: matchedOp ? matchedOp.id : (step.operationId || null),
                    estimated_labor_cost: step.laborFlatRate,
                    estimated_overhead_cost: step.machineHourlyRate,
                    duration_hours: step.durationHours,
                    requires_qa: step.requiresQA || false
                };
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routings`, { method: "POST", headers, body: JSON.stringify(payload) });
            }
            return true;
        }

        const getUrl = `${DIRECTUS_URL}/items/manufacturing_routings?filter[bom_id][_eq]=${bomId}&limit=-1`;
        const resGet = await fetch(getUrl, { headers, cache: "no-store" });
        if (!resGet.ok) throw new Error("Failed to fetch routing steps");
        const existing: { routing_id: number }[] = (await resGet.json()).data || [];
        const uiIds = new Set(validRoutings.map(step => String(step.id)));

        const toDelete = existing.filter(e => !uiIds.has(String(e.routing_id)));
        for (const step of toDelete) {
            await fetch(`${DIRECTUS_URL}/items/manufacturing_routings/${step.routing_id}`, { method: "DELETE", headers });
        }

        for (const step of validRoutings) {
            const matchedOp = operations.find(o => o.operation_name.trim().toLowerCase() === String(step.name || "").trim().toLowerCase());
            const payload = {
                bom_id: bomId,
                version: finalVersionId,
                sequence_order: step.sequence,
                operation_name: step.name,
                operation_id: matchedOp ? matchedOp.id : (step.operationId || null),
                estimated_labor_cost: step.laborFlatRate,
                estimated_overhead_cost: step.machineHourlyRate,
                duration_hours: step.durationHours,
                requires_qa: step.requiresQA || false
            };
            const isNew = isNaN(Number(step.id));
            if (isNew) {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routings`, { method: "POST", headers, body: JSON.stringify(payload) });
            } else {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routings/${step.id}`, { method: "PATCH", headers, body: JSON.stringify(payload) });
            }
        }
        return true;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed syncing routings:", e);
        return false;
    }
}


