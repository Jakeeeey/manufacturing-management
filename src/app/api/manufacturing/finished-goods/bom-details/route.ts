import { NextResponse } from "next/server";
import { 
    getBOMDetailsForVersion,
    fetchAllProducts,
    fetchAllUnits,
    getLatestLandedCost,
    updateProductDetails,
    saveActiveBOMDetails,
    syncBOMComponents,
    syncRoutingSteps,
    calculateRollupCost,
    updateProductStandardCost,
    updateProductVersionOverhead,
    getProductOverheads,
    syncProductOverheads,
    fetchAllOverheadTypes,
    fetchAllOperations,
    DIRECTUS_URL,
    headers
} from "../../directus-api";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productIdStr = searchParams.get("productId");
        const versionIdStr = searchParams.get("versionId");
        const forexRateStr = searchParams.get("forexRate");

        const forexRate = forexRateStr ? parseFloat(forexRateStr) : 58.00;

        if (!productIdStr || !versionIdStr) {
            return NextResponse.json({ error: "Missing productId or versionId" }, { status: 400 });
        }

        const productId = parseInt(productIdStr);
        const versionId = parseInt(versionIdStr);

        const details = await getBOMDetailsForVersion(productId, versionId);
        if (!details || !details.bom) {
            return NextResponse.json(null);
        }

        const productsList = await fetchAllProducts();
        const unitsList = await fetchAllUnits();
        const overheadTypesList = await fetchAllOverheadTypes();
        const operationsList = await fetchAllOperations();

        // Format ingredients
        const ingredients = await Promise.all(details.components.map(async (c) => {
            const compProduct = productsList.find(p => p.product_id === c.component_product_id);
            const landedCost = Number(c.landed_cost) || (await getLatestLandedCost(c.component_product_id, forexRate)) || Number(compProduct?.cost_per_unit) || Number(compProduct?.price_per_unit || 0);
            const name = compProduct ? compProduct.product_name : `Ingredient #${c.component_product_id}`;
            const matchedUnit = unitsList.find(u => u.unit_id === Number(c.unit_of_measurement));
            const uomShortcut = matchedUnit ? matchedUnit.unit_shortcut : (typeof c.unit_of_measurement === "string" ? c.unit_of_measurement : "L");

            const isForeign = compProduct?.currency_profile?.is_foreign_sourced || false;
            const currency = compProduct?.currency_profile?.purchase_currency || "PHP";
            const originalPrice = compProduct?.currency_profile?.purchase_price || null;

            return {
                id: String(c.component_id),
                productId: c.component_product_id,
                name,
                type: c.component_type === "by_product" ? "by_product" : c.component_type === "sub_assembly" ? "sub_assembly" : "raw_material",
                quantity: c.quantity_required,
                uom: uomShortcut,
                uomId: Number(c.unit_of_measurement) || undefined,
                wastagePercent: c.wastage_factor_percentage,
                landedCost,
                isForeign,
                currency,
                originalPrice
            };
        }));

        // Format routings
        const formattedRoutings = details.routings.map(r => {
            const opId = Number((r.operation_id as unknown as { id?: number })?.id || r.operation_id);
            const matchedOp = operationsList.find(op => op.id === opId);
            return {
                id: String(r.routing_id),

                sequence: r.sequence_order,
                name: matchedOp ? matchedOp.operation_name : (r.operation_name || ""),
                operationId: opId || undefined,
                laborFlatRate: Number(r.estimated_labor_cost),
                machineHourlyRate: Number(r.estimated_overhead_cost),
                durationHours: Number(r.duration_hours)
            };
        });

        const versionObj = details.bom.version;
        const bomVersionId = (versionObj && typeof versionObj === "object") ? versionObj.id : (Number(versionObj) || 0);

        const dbOverheads = await getProductOverheads(productId, bomVersionId);
        const formattedOverheads = dbOverheads.map(o => {
            const rawOverhead = o as Record<string, unknown>;
            const rawOverheadId = rawOverhead.overhead_id;
            const ohId = typeof rawOverheadId === "object" && rawOverheadId !== null
                ? Number((rawOverheadId as Record<string, unknown>).id || 0)
                : Number(rawOverheadId || 0);

            const matchedType = overheadTypesList.find(t => (t as { id?: number }).id === ohId);
            const rawOverheadName = typeof rawOverheadId === "object" && rawOverheadId !== null
                ? String((rawOverheadId as Record<string, unknown>).overhead_name || "Custom Overhead")
                : "Custom Overhead";

            return {
                id: String(rawOverhead.id || ""),
                overheadId: ohId,
                overheadName: matchedType ? (matchedType as { overhead_name?: string }).overhead_name : rawOverheadName,
                amount: Number(rawOverhead.amount || 0)
            };
        });

        const customOverheadVal = (versionObj && typeof versionObj === "object" && "custom_overhead" in versionObj) 
            ? Number((versionObj as Record<string, unknown>).custom_overhead) 
            : 0;

        return NextResponse.json({
            bomId: details.bom.bom_id,
            expectedYieldPercent: details.bom.expected_yield_percentage,
            version: (versionObj && typeof versionObj === "object") ? versionObj.version_name : "V1",
            versionId: bomVersionId,
            customOverhead: customOverheadVal,
            ingredients,
            routings: formattedRoutings,
            overheads: formattedOverheads
        });
    } catch (e) {
        console.error("API Error fetching BOM details:", e);
        const error = e instanceof Error ? e : new Error(String(e));
        return NextResponse.json({ error: (error as { message?: string }).message || "Failed to fetch BOM details" }, { status: 500 });
    }
}


export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, bomId, details, ingredients, routings, overheads } = body;

        if (!productId || !bomId) {
            return NextResponse.json({ error: "Missing productId or bomId" }, { status: 400 });
        }

        const numericProductId = parseInt(productId);
        const numericBomId = parseInt(bomId);

        // 1. Update Product Details
        const prodOk = await updateProductDetails(numericProductId, {
            product_name: details.title,
            product_code: details.sku,
            barcode: details.barcode,
            price_per_unit: details.targetSellingPrice,
            density_factor: details.densityFactor,
            product_brand: details.productBrand,
            product_category: details.productCategory,
            description: details.description,
            cost_per_unit: details.costPerUnit,
            unit_of_measurement_count: details.unitOfMeasurementCount,
            product_class: details.productClass,
            product_segment: details.productSegment,
            product_section: details.productSection,
            product_shelf_life: details.productShelfLife,
            product_image: details.productImage
        });
        if (!prodOk) throw new Error("Failed to update product details in Directus");

        // 1b. Update Product Version Overhead
        if (details.customOverhead !== undefined) {
            await updateProductVersionOverhead(numericBomId, Number(details.customOverhead) || 0);
        }

        // 2. Update BOM yield details
        const bomOk = await saveActiveBOMDetails(numericBomId, details.expectedYieldPercent);
        if (!bomOk) throw new Error("Failed to update BOM yield details in Directus");

        // 3. Sync BOM components list
        const compOk = await syncBOMComponents(numericBomId, ingredients, false);
        if (!compOk) throw new Error("Failed to sync BOM components in Directus");

        // 4. Sync routing steps
        const routOk = await syncRoutingSteps(numericBomId, routings, 0, false);
        if (!routOk) throw new Error("Failed to sync routings in Directus");

        // 4b. Sync product overhead variables
        if (overheads) {
            let versionId = 0;
            const bomRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${numericBomId}`, {
                headers
            });
            if (bomRes.ok) {
                const bomJson = await bomRes.json();
                const bomVersion = bomJson.data?.version;
                if (bomVersion) {
                    versionId = typeof bomVersion === "object" ? bomVersion.id : Number(bomVersion);
                }
            }
            if (versionId > 0) {
                const overheadsOk = await syncProductOverheads(numericProductId, versionId, overheads);
                if (!overheadsOk) throw new Error("Failed to sync product overhead variables in Directus");
            }
        }

        // 5. Run standard rollup costing recalculation and save to product standard cost field
        const rollupResult = await calculateRollupCost(numericProductId);
        if (rollupResult.bomId) {
            await updateProductStandardCost(numericProductId, rollupResult.totalBaseCost);
        }

        return NextResponse.json({
            success: true,
            rollup: rollupResult
        });
    } catch (e) {
        console.error("API Error saving BOM details:", e);
        const error = e instanceof Error ? e : new Error(String(e));
        return NextResponse.json({ error: (error as { message?: string }).message || "Failed to save BOM details" }, { status: 500 });
    }
}
