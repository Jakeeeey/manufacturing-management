"use server";

import { 
    fetchAllProducts, 
    getActiveBOMForProduct, 
    getLatestLandedCost, 
    calculateRollupCost,
    updateProductStandardCost,
    fetchSuppliers,
    fetchProductsBySupplier,
    saveActiveBOMDetails,
    syncBOMComponents,
    syncRoutingSteps,
    updateProductDetails,
    createNewProduct,
    registerProductWithBOM,
    fetchAllUnits,
    createActiveBOM,
    registerNewBOMVersion,
    fetchProductVersions,
    getBOMDetailsForVersion,
    calculateDynamicBOMCost,
    DirectusBOMComponentInput,
    DirectusRoutingStepInput
} from "../services/manufacturing-service";

/**
 * Server Action: Fetches all products to populate the sidebar list.
 */
export async function getProductsAction(search?: string, limit?: number) {
    try {
        return await fetchAllProducts(search, limit);
    } catch (e) {
        console.error("Failed getProductsAction:", e);
        return [];
    }
}

/**
 * Server Action: Resolves detailed BOM components, landed costs, and routings for a product.
 * Standardizes Directus snake_case fields into camelCase for the frontend UI.
 */
export async function getBOMDetailsAction(productId: number) {
    try {
        const { bom, components, routings } = await getActiveBOMForProduct(productId);
        
        if (!bom) {
            return {
                bomId: null,
                expectedYieldPercent: 100,
                version: "v1.0",
                ingredients: [],
                routings: []
            };
        }

        // Fetch all products once to cache names
        const products = await fetchAllProducts();
        
        // Fetch all units once to resolve UOM shortcuts
        const units = await fetchAllUnits();

        // Format components into UI model (ingredients)
        const ingredients = await Promise.all(components.map(async (c) => {
            const landedCost = await getLatestLandedCost(c.component_product_id);
            
            // Find component product name in cache
            const compProduct = products.find(p => p.product_id === c.component_product_id);
            const name = compProduct ? compProduct.product_name : `Ingredient #${c.component_product_id}`;

            const matchedUnit = units.find(u => u.unit_id === Number(c.unit_of_measurement));
            const uomShortcut = matchedUnit ? matchedUnit.unit_shortcut : (typeof c.unit_of_measurement === "string" ? c.unit_of_measurement : "L");

            return {
                id: String(c.component_id),
                productId: c.component_product_id,
                name,
                type: (c.component_type === "by_product" ? "by_product" : c.component_type === "sub_assembly" ? "sub_assembly" : "raw_material") as "raw_material" | "sub_assembly" | "by_product",
                quantity: c.quantity_required,
                uom: uomShortcut,
                uomId: Number(c.unit_of_measurement) || undefined,
                wastagePercent: c.wastage_factor_percentage,
                landedCost
            };
        }));

        // Format routings into UI model
        const formattedRoutings = routings.map(r => ({
            id: String(r.routing_id),
            sequence: r.sequence_order,
            name: r.operation_name,
            laborFlatRate: Number(r.estimated_labor_cost),
            machineHourlyRate: Number(r.estimated_overhead_cost),
            durationHours: Number(r.duration_hours)
        }));

        const versionString = bom.version && typeof bom.version === "object"
            ? bom.version.version_name || "V1"
            : String(bom.version || "V1");

        return {
            bomId: bom.bom_id,
            expectedYieldPercent: bom.expected_yield_percentage,
            version: versionString,
            ingredients,
            routings: formattedRoutings
        };
    } catch (e) {
        console.error("Failed getBOMDetailsAction:", e);
        return null;
    }
}

/**
 * Server Action: Runs the full recursive costing rollup and saves result back to the product.
 */
export async function calculateAndSaveRollupAction(productId: number) {
    try {
        const result = await calculateRollupCost(productId);
        if (result.bomId) {
            await updateProductStandardCost(productId, result.totalBaseCost);
        }
        return result;
    } catch (e) {
        console.error("Failed calculateAndSaveRollupAction:", e);
        return null;
    }
}

/**
 * Server Action: Fetches all active suppliers from Directus.
 */
export async function getSuppliersAction() {
    try {
        return await fetchSuppliers();
    } catch (e) {
        console.error("Failed getSuppliersAction:", e);
        return [];
    }
}

/**
 * Server Action: Fetches all products linked to a specific supplier.
 */
export async function getProductsBySupplierAction(supplierId: number) {
    try {
        const list = await fetchProductsBySupplier(supplierId);
        return list.map(item => ({
            id: String(item.product_id.product_id),
            sku: item.product_id.product_code || `SKU-${item.product_id.product_id}`,
            title: item.product_id.product_name,
            description: item.product_id.description || "",
            barcode: item.product_id.barcode || "",
            baseUom: item.product_id.unit_of_measurement?.unit_shortcut || "PCS",
            expectedYieldPercent: 100, // Default
            targetSellingPrice: Number(item.product_id.price_per_unit || 0),
            parentProduct: item.product_id.parent_id === null, // Boolean check
            bom: [],
            routings: [],
            densityFactor: item.product_id.density_factor ? Number(item.product_id.density_factor) : 1.0
        }));
    } catch (e) {
        console.error("Failed getProductsBySupplierAction:", e);
        return [];
    }
}

/**
 * Server Action: Saves/Syncs all BOM, routings, and product modifications back to Directus.
 * Then recalculates the Standard Cost Rollup.
 */
export async function saveBOMDetailsAction(
    productId: number,
    bomId: number | null,
    details: {
        title: string;
        sku: string;
        barcode: string;
        baseUom: string;
        expectedYieldPercent: number;
        targetSellingPrice: number;
        densityFactor: number;
    },
    ingredients: DirectusBOMComponentInput[],
    routings: DirectusRoutingStepInput[]
) {
    try {
        if (bomId === null) {
            throw new Error("No version selected. Please register or select a version first.");
        }

        // 1. Update Product Details
        const prodOk = await updateProductDetails(productId, {
            product_name: details.title,
            product_code: details.sku,
            barcode: details.barcode,
            price_per_unit: details.targetSellingPrice,
            density_factor: details.densityFactor
        });
        if (!prodOk) throw new Error("Failed to update product details in Directus");

        // 2. Update BOM yield details
        const bomOk = await saveActiveBOMDetails(bomId, details.expectedYieldPercent);
        if (!bomOk) throw new Error("Failed to update BOM yield details in Directus");

        // 3. Sync BOM components list
        const compOk = await syncBOMComponents(bomId, ingredients, false);
        if (!compOk) throw new Error("Failed to sync BOM components in Directus");

        // 4. Sync routing steps
        const routOk = await syncRoutingSteps(bomId, routings, 0, false);
        if (!routOk) throw new Error("Failed to sync routings in Directus");

        // 5. Run standard rollup costing recalculation and save to product standard cost field
        const rollupResult = await calculateRollupCost(productId);
        if (rollupResult.bomId) {
            await updateProductStandardCost(productId, rollupResult.totalBaseCost);
        }

        return {
            success: true,
            rollup: rollupResult
        };
    } catch (e) {
        console.error("Failed saveBOMDetailsAction:", e);
        const error = e instanceof Error ? e : new Error(String(e));
        return {
            success: false,
            error: error.message || "Unknown error during save"
        };
    }
}

/**
 * Server Action: Fetches all unit configurations.
 */
export async function getUnitsAction() {
    try {
        return await fetchAllUnits();
    } catch (e) {
        console.error("Failed getUnitsAction:", e);
        return [];
    }
}

/**
 * Server Action: Fetches all registered versions of a product.
 */
export async function getProductVersionsAction(productId: number) {
    try {
        return await fetchProductVersions(productId);
    } catch (e) {
        console.error("Failed getProductVersionsAction:", e);
        return [];
    }
}

/**
 * Server Action: Loads detailed components and routings for a specific version.
 */
export async function getBOMDetailsForVersionAction(productId: number, versionId: number) {
    try {
        const details = await getBOMDetailsForVersion(productId, versionId);
        if (!details || !details.bom) return null;

        // Fetch all products once to cache names
        const products = await fetchAllProducts();
        const units = await fetchAllUnits();

        // Format ingredients
        const ingredients = await Promise.all(details.components.map(async (c) => {
            const landedCost = await getLatestLandedCost(c.component_product_id);
            const compProduct = products.find(p => p.product_id === c.component_product_id);
            const name = compProduct ? compProduct.product_name : `Ingredient #${c.component_product_id}`;
            const matchedUnit = units.find(u => u.unit_id === Number(c.unit_of_measurement));
            const uomShortcut = matchedUnit ? matchedUnit.unit_shortcut : (typeof c.unit_of_measurement === "string" ? c.unit_of_measurement : "L");

            return {
                id: String(c.component_id),
                productId: c.component_product_id,
                name,
                type: (c.component_type === "by_product" ? "by_product" : c.component_type === "sub_assembly" ? "sub_assembly" : "raw_material") as "raw_material" | "sub_assembly" | "by_product",
                quantity: c.quantity_required,
                uom: uomShortcut,
                uomId: Number(c.unit_of_measurement) || undefined,
                wastagePercent: c.wastage_factor_percentage,
                landedCost
            };
        }));

        // Format routings
        const formattedRoutings = details.routings.map(r => ({
            id: String(r.routing_id),
            sequence: r.sequence_order,
            name: r.operation_name,
            laborFlatRate: Number(r.estimated_labor_cost),
            machineHourlyRate: Number(r.estimated_overhead_cost),
            durationHours: Number(r.duration_hours)
        }));

        const versionObj = details.bom.version;
        const bomVersionId = (versionObj && typeof versionObj === "object") ? versionObj.id : (Number(versionObj) || 0);
        const versionName = (versionObj && typeof versionObj === "object") ? versionObj.version_name : "V1";

        return {
            bomId: details.bom.bom_id,
            expectedYieldPercent: details.bom.expected_yield_percentage,
            version: versionName,
            versionId: bomVersionId,
            ingredients,
            routings: formattedRoutings
        };
    } catch (e) {
        console.error("Failed getBOMDetailsForVersionAction:", e);
        return null;
    }
}

/**
 * Server Action: Transactionally clones current version's recipe/routings to a brand new version.
 */
export async function registerNewVersionAction(
    productId: number,
    baseBomId: number,
    expectedYield: number,
    bomName: string,
    versionName: string
) {
    try {
        const newBom = await registerNewBOMVersion(productId, baseBomId, expectedYield, bomName, versionName);
        if (!newBom) {
            return { success: false, error: "Failed to clone and register version in Directus." };
        }
        return { success: true, bom: newBom };
    } catch (e) {
        console.error("Failed registerNewVersionAction:", e);
        const error = e instanceof Error ? e : new Error(String(e));
        return { success: false, error: error.message || "Clone failed" };
    }
}

/**
 * Server Action: Registers the initial version for a product that does not have a BOM.
 */
export async function createInitialVersionAction(
    productId: number,
    expectedYield: number,
    bomName: string,
    versionName: string
) {
    try {
        const newBom = await createActiveBOM(productId, expectedYield, bomName, versionName);
        if (!newBom) {
            return { success: false, error: "Failed to register initial version in Directus." };
        }
        return { success: true, bom: newBom };
    } catch (e) {
        console.error("Failed createInitialVersionAction:", e);
        const error = e instanceof Error ? e : new Error(String(e));
        return { success: false, error: error.message || "Registration failed" };
    }
}

/**
 * Server Action: Returns dynamic cheapest cost calculation.
 */
export async function calculateDynamicBOMCostAction(bomId: number) {
    try {
        return await calculateDynamicBOMCost(bomId);
    } catch (e) {
        console.error("Failed calculateDynamicBOMCostAction:", e);
        return 0;
    }
}

/**
 * Server Action: Creates a new product record inside the products master list.
 */
export async function createNewProductAction(details: {
    product_name: string;
    product_code: string;
    description?: string;
    barcode?: string;
    price_per_unit?: number;
    density_factor?: number;
    unit_of_measurement?: number;
}) {
    try {
        const newId = await createNewProduct(details);
        if (!newId) return { success: false, error: "Failed to create product record in Directus" };
        return { success: true, productId: newId };
    } catch (e) {
        console.error("Failed createNewProductAction:", e);
        const error = e instanceof Error ? e : new Error(String(e));
        return { success: false, error: error.message || "Product creation failed" };
    }
}

/**
 * Server Action: Registers a new product and its initial BOM version transactionally in Directus.
 */
export async function registerProductWithBOMAction(
    productDetails: {
        product_name: string;
        product_code: string;
        description?: string;
        barcode?: string;
        price_per_unit?: number;
        density_factor?: number;
        unit_of_measurement?: number;
    },
    versionName: string
) {
    try {
        const res = await registerProductWithBOM(productDetails, versionName);
        if (!res) return { success: false, error: "Failed to register product and BOM version transactionally in Directus" };
        return { success: true, productId: res.productId, bom: res.bom };
    } catch (e) {
        console.error("Failed registerProductWithBOMAction:", e);
        const error = e instanceof Error ? e : new Error(String(e));
        return { success: false, error: error.message || "Registration failed" };
    }
}

