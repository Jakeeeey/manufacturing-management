import { NextResponse } from "next/server";
import { 
    getBOMDetailsForVersion,
    saveActiveBOMDetails,
    syncRoutesAndBOM
} from "./bom-details-helper";
import {
    updateProductDetails,
    calculateRollupCost,
    updateProductStandardCost
} from "../products/products-helper";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productIdStr = searchParams.get("productId");
        const versionIdStr = searchParams.get("versionId");

        if (!productIdStr || !versionIdStr) {
            return NextResponse.json({ error: "Missing productId or versionId" }, { status: 400 });
        }

        const productId = parseInt(productIdStr);
        const versionId = parseInt(versionIdStr);

        const details = await getBOMDetailsForVersion(productId, versionId);
        if (!details || !details.version) {
            return NextResponse.json(null);
        }

        return NextResponse.json(details.version);
    } catch (e) {
        console.error("API Error fetching BOM details:", e);
        const error = e instanceof Error ? e : new Error(String(e));
        return NextResponse.json({ error: (error as { message?: string }).message || "Failed to fetch BOM details" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, versionId, details, routes } = body;

        if (!productId || !versionId) {
            return NextResponse.json({ error: "Missing productId or versionId" }, { status: 400 });
        }

        const numericProductId = parseInt(productId);
        const numericVersionId = parseInt(versionId);

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
            product_image: details.productImage,
            production_capacity_per_hour: details.productionCapacityPerHour
        });
        if (!prodOk) throw new Error("Failed to update product details in Directus");

        // 2. Save version metadata (expected yield and base quantity)
        const versionOk = await saveActiveBOMDetails(
            numericVersionId, 
            details.expected_yield_percentage || details.expectedYieldPercent || 100,
            details.base_quantity || 1
        );
        if (!versionOk) throw new Error("Failed to update version metadata in Directus");

        // 3. Sync routes and their route-level BOM items
        const syncOk = await syncRoutesAndBOM(numericVersionId, routes);
        if (!syncOk) throw new Error("Failed to sync routes and route-level BOM items in Directus");

        // 4. Run standard rollup costing recalculation and save to product standard cost field
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
