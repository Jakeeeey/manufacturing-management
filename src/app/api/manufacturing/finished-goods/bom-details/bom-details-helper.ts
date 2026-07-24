/* eslint-disable */
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { getBOMDetailsForVersion } from "../versions/versions-helper";
import {
    isMaterialType,
    isMaterialTypeCompatible,
    materialTypeFromProduct,
    MaterialType
} from "@/modules/manufacturing-management/finished-goods/material-types";

export { getBOMDetailsForVersion };

export class BOMValidationError extends Error {
    readonly code = "BOM_VALIDATION_ERROR";
    readonly details: Record<string, number | string>;

    constructor(message: string, details: Record<string, number | string>) {
        super(message);
        this.name = "BOMValidationError";
        this.details = details;
    }
}

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

export async function saveActiveBOMDetails(
    versionId: number,
    expectedYield: number,
    baseQuantity: number = 1,
    customOverhead: number = 0
): Promise<{ ok: boolean; error?: string }> {
    try {
        const url = `${DIRECTUS_URL}/items/product_manufacturing_version/${versionId}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                expected_yield_percentage: expectedYield,
                base_quantity: baseQuantity,
                custom_overhead: customOverhead
            })
        });
        if (!res.ok) {
            return { ok: false, error: `Directus version update failed (${res.status})` };
        }

        const verifyRes = await fetch(url, { headers, cache: "no-store" });
        if (!verifyRes.ok) {
            return { ok: false, error: "Directus version update could not be verified" };
        }

        const saved = (await verifyRes.json()).data || {};
        const valuesMatch = [
            ["expected yield", expectedYield, Number(saved.expected_yield_percentage)],
            ["base quantity", baseQuantity, Number(saved.base_quantity)],
            ["custom overhead", customOverhead, Number(saved.custom_overhead)]
        ].every(([, expected, actual]) => Number.isFinite(actual) && Math.abs(Number(expected) - Number(actual)) < 0.000001);

        if (!valuesMatch) {
            return {
                ok: false,
                error: "Directus did not persist the expected yield, base quantity, or custom overhead values"
            };
        }

        return { ok: true };
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed saving version details:", e);
        return { ok: false, error: "Failed to save version metadata in Directus" };
    }
}

export async function validateRoutesAndBOM(routes: any[]): Promise<void> {
    const bomRows = routes.flatMap((route: any, routeIndex: number) =>
            (route.bom_items || route.ingredients || []).map((item: any, rowIndex: number) => ({
                item,
                routeId: Number(route.route_id || route.id || 0),
                routeIndex,
                rowNumber: rowIndex + 1
            }))
        );
    const productIds = [...new Set(
            bomRows
                .map(({ item }) => Number(item.product_id || item.productId || 0))
                .filter(productId => Number.isFinite(productId) && productId > 0)
        )];

    const missingSelection = bomRows.find(({ item }) =>
            !isMaterialType(item.material_type) ||
            !Number.isFinite(Number(item.product_id || item.productId)) ||
            Number(item.product_id || item.productId) <= 0
        );
    if (missingSelection) {
            const materialTypeSelected = isMaterialType(missingSelection.item.material_type);
            throw new BOMValidationError(
                `Route ${missingSelection.routeId || missingSelection.routeIndex + 1}, BOM row ${missingSelection.rowNumber}: ${materialTypeSelected ? "select a material" : "select a Material Type"} before saving.`,
                {
                    routeId: missingSelection.routeId || missingSelection.routeIndex + 1,
                    rowNumber: missingSelection.rowNumber,
                    field: materialTypeSelected ? "product_id" : "material_type"
                }
            );
    }

    if (productIds.length > 0) {
            const productFilter = encodeURIComponent(JSON.stringify({ product_id: { _in: productIds } }));
            const [productsRes, versionsRes] = await Promise.all([
                fetch(`${DIRECTUS_URL}/items/products?filter=${productFilter}&fields=product_id,product_type&limit=-1`, { headers, cache: "no-store" }),
                fetch(`${DIRECTUS_URL}/items/product_manufacturing_version?filter=${productFilter}&fields=product_id&limit=-1`, { headers, cache: "no-store" })
            ]);
        if (!productsRes.ok || !versionsRes.ok) {
                throw new BOMValidationError("Unable to validate BOM material classifications.", { field: "product_id" });
        }

        const productData = (await productsRes.json()).data || [];
        const versionData = (await versionsRes.json()).data || [];
        const productMap = new Map<number, { product_type?: number | null }>(
                productData.map((product: { product_id?: number; product_type?: number | null }) => [
                    Number(product.product_id),
                    product
                ])
            );
        const versionedProductIds = new Set<number>(
                versionData
                    .map((version: { product_id?: number }) => Number(version.product_id))
                    .filter((productId: number) => Number.isFinite(productId) && productId > 0)
            );

        const mismatchedRow = bomRows.find(({ item }) => {
                const productId = Number(item.product_id || item.productId);
                const product = productMap.get(productId);
                const expectedType = product
                    ? materialTypeFromProduct(product.product_type, versionedProductIds.has(productId))
                    : null;
                return !product || !expectedType || !isMaterialTypeCompatible(
                    item.material_type as MaterialType,
                    product.product_type,
                    versionedProductIds.has(productId)
                );
            });
        if (mismatchedRow) {
                const productId = Number(mismatchedRow.item.product_id || mismatchedRow.item.productId);
                throw new BOMValidationError(
                    `Route ${mismatchedRow.routeId || mismatchedRow.routeIndex + 1}, BOM row ${mismatchedRow.rowNumber}: selected Material Type does not match the selected material.`,
                    {
                        routeId: mismatchedRow.routeId || mismatchedRow.routeIndex + 1,
                        rowNumber: mismatchedRow.rowNumber,
                        productId,
                        field: "material_type"
                    }
                );
        }
    }
}

export async function syncRoutesAndBOM(versionId: number, routes: any[], userId: number | null = null): Promise<boolean> {
    try {
        await validateRoutesAndBOM(routes);

        // 0. Fetch units to map shortcuts to IDs
        const resUnits = await fetch(`${DIRECTUS_URL}/items/units?limit=-1`, { headers, cache: "no-store" });
        const unitsList = resUnits.ok ? (await resUnits.json()).data || [] : [];
        const unitsMap = new Map<string, number>(unitsList.map((u: any) => [u.unit_shortcut.toLowerCase(), u.unit_id]));

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
            const isNewRoute = !stepId || isNaN(Number(stepId)) || Number(stepId) < 0;

            const routePayload = {
                version_id: versionId,
                work_center_id: step.work_center_id || null,
                operation_id: step.operation_id || step.operationId || null,
                sequence_order: Number(step.sequence_order || step.sequence || 0),
                setup_time_hours: Number(step.setup_time_hours || 0),
                run_time_hours: Number(step.run_time_hours || step.durationHours || 0),
                step_batch_size: Number(step.step_batch_size !== undefined ? step.step_batch_size : 1),
                estimated_labor_cost: Number(step.estimated_labor_cost || step.laborFlatRate || 0),
                qa_template_id: step.qa_template_id || null,
                created_by: userId
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
            const uiBomItems = step.bom_items || step.ingredients || [];

            // Get existing BOM items for this route in DB
            const bomsGetUrl = `${DIRECTUS_URL}/items/manufacturing_routes_bom?filter[route_id][_eq]=${finalRouteId}&limit=-1`;
            const resBomGet = await fetch(bomsGetUrl, { headers, cache: "no-store" });
            const existingBoms: { id: number }[] = resBomGet.ok ? (await resBomGet.json()).data || [] : [];

            const uiBomIds = new Set(uiBomItems.map((b: any) => String(b.id || "")).filter(Boolean));
            const bomsToDelete = existingBoms.filter(b => !uiBomIds.has(String(b.id)));

            // Delete removed BOM items
            for (const b of bomsToDelete) {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom/${b.id}`, { method: "DELETE", headers });
            }

            // Create or Update BOM items
            for (const bItem of uiBomItems) {
                const isNewBomItem = !bItem.id || isNaN(Number(bItem.id)) || Number(bItem.id) < 0;

                let uomId: number | null = null;
                const rawUom = bItem.unit_of_measurement || bItem.uomId || bItem.uom;
                if (rawUom) {
                    if (!isNaN(Number(rawUom))) {
                        uomId = Number(rawUom);
                    } else {
                        uomId = unitsMap.get(String(rawUom).toLowerCase()) || null;
                    }
                }

                const bomPayload = {
                    route_id: finalRouteId,
                    product_id: Number(bItem.product_id || bItem.productId || 0),
                    quantity_required: Number(bItem.quantity_required || bItem.quantity || 0),
                    unit_of_measurement: uomId,
                    wastage_factor_percentage: Number(bItem.wastage_factor_percentage || bItem.wastagePercent || 0),
                    cost_per_unit: Number(bItem.cost_per_unit ?? bItem.landedCost ?? 0),
                    created_by: userId
                };

                if (isNewBomItem) {
                    const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(bomPayload)
                    });
                    if (!res.ok) {
                        const errTxt = await res.text();
                        throw new Error(`Failed to create BOM item: ${res.status} - ${errTxt}`);
                    }
                } else {
                    const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom/${bItem.id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify(bomPayload)
                    });
                    if (!res.ok) {
                        const errTxt = await res.text();
                        throw new Error(`Failed to update BOM item ${bItem.id}: ${res.status} - ${errTxt}`);
                    }
                }
            }
        }
        return true;
    } catch (e) {
        if (e instanceof BOMValidationError) throw e;
        console.error("[Manufacturing Directus API] Failed syncing routes and BOM:", e);
        return false;
    }
}
