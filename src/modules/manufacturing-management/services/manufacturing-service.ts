/**
 * VOS ERP - Manufacturing & BOM Engine Service Client
 * Handles connection to Directus API and computes rolled-up costing trees.
 */

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://goatedcodoer:8091";
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "rTilKSsclzuQW8WfQWK1ba8wrD_LetNn";

const headers = {
    "Authorization": `Bearer ${DIRECTUS_TOKEN}`,
    "Content-Type": "application/json"
};

// Data Interfaces
export interface DirectusProductCurrencyProfile {
    id: number;
    product_id: number;
    is_foreign_sourced: boolean;
    purchase_currency: "PHP" | "USD";
    purchase_price: number | null;
}

export interface DirectusProduct {
    product_id: number;
    product_name: string;
    product_code: string; // SKU
    description: string;
    unit_of_measurement: { unit_id: number; unit_name: string; unit_shortcut: string } | null;
    cost_per_unit: number;
    price_per_unit: number;
    barcode?: string | null;
    parent_id?: number | null;
    density_factor?: number | null;
    has_versions?: boolean;
    currency_profile?: DirectusProductCurrencyProfile | null;
}


export interface DirectusBOM {
    bom_id: number;
    product_id: number;
    bom_name: string;
    base_quantity: number;
    expected_yield_percentage: number;
    is_active: boolean;
    version: { id: number; version_name: string } | number | null;
    valid_from?: string;
    valid_to?: string;
}

export interface DirectusUnit {
    unit_id: number;
    unit_name: string;
    unit_shortcut: string;
}

export interface DirectusBOMComponent {
    component_id: number;
    bom_id: number;
    component_product_id: number;
    quantity_required: number;
    unit_of_measurement: { unit_id: number; unit_name: string; unit_shortcut: string } | null;
    wastage_factor_percentage: number;
    component_type: "raw_material" | "sub_assembly" | "by_product";
    landed_cost?: number | null;
}

export interface DirectusOperation {
    id: number;
    operation_name: string;
}

export interface DirectusRouting {
    routing_id: number;
    bom_id: number;
    operation_name: string;
    operation_id?: number | null;
    estimated_labor_cost: number;
    estimated_overhead_cost: number;
    duration_hours: number;
    sequence_order: number;
}

export interface DirectusBOMComponentInput {
    id?: string | number;
    productId: number;
    quantity: number;
    uom?: string | null;
    uomId?: number | null;
    wastagePercent: number;
    type?: "raw_material" | "sub_assembly" | "by_product" | null;
    landedCost?: number | null;
}

export interface DirectusRoutingStepInput {
    id?: string | number;
    sequence: number;
    name: string;
    operationId?: number | null;
    laborFlatRate: number;
    machineHourlyRate: number;
    durationHours: number;
}

export interface CostRollupResult {
    productId: number;
    productName: string;
    sku: string;
    bomId: number | null;
    bomVersion: string | number;
    materialsCost: number;
    routingsCost: number;
    yieldPercentage: number;
    totalBaseCost: number;
    targetSellingPrice: number;
    grossMarginPercent: number;
    costTree: CostNode[];
}

interface CostNode {
    id: string;
    name: string;
    type: "ingredient" | "by_product" | "routing" | "sub_assembly";
    quantity: number;
    uom: string;
    unitCost: number;
    wastagePercent: number;
    totalCost: number;
    children?: CostNode[];
}

/**
 * 1. Fetches all products registered in the database.
 */
export async function fetchAllProducts(search?: string, limit: number = -1): Promise<DirectusProduct[]> {
    try {
        let url = `${DIRECTUS_URL}/items/products?limit=${limit}&fields=*,unit_of_measurement.*,product_category.*,parent_id.*`;
        if (search && search.trim()) {
            url += `&search=${encodeURIComponent(search.trim())}`;
        }
        
        // Fetch products, all versions, and currency profiles concurrently
        const [prodRes, versionsRes, profilesRes] = await Promise.all([
            fetch(url, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_product_version?limit=-1&fields=product_id`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/product_currency_profiles?limit=-1`, { headers, cache: "no-store" })
        ]);

        if (!prodRes.ok) throw new Error(`Directus failed to fetch products: ${prodRes.status}`);
        const prodJson = await prodRes.json();
        const products: DirectusProduct[] = prodJson.data || [];

        const versionProductIds = new Set<number>();
        if (versionsRes.ok) {
            const versionsJson = await versionsRes.json();
            const versions = versionsJson.data || [];
            versions.forEach((v: { product_id: number }) => {
                if (v.product_id) {
                    versionProductIds.add(Number(v.product_id));
                }
            });
        }

        const profiles = profilesRes.ok ? (await profilesRes.json()).data || [] : [];
        const profilesMap = new Map<number, DirectusProductCurrencyProfile>();
        profiles.forEach((p: DirectusProductCurrencyProfile) => {
            profilesMap.set(Number(p.product_id), p);
        });

        // Map has_versions flag and currency profile
        products.forEach((p: DirectusProduct) => {
            p.has_versions = versionProductIds.has(Number(p.product_id));
            p.currency_profile = profilesMap.get(Number(p.product_id)) || null;
        });


        // Sort: products with versions first (true > false -> desc order), then by product_name
        products.sort((a: DirectusProduct, b: DirectusProduct) => {
            if (a.has_versions && !b.has_versions) return -1;
            if (!a.has_versions && b.has_versions) return 1;
            return a.product_name.localeCompare(b.product_name);
        });

        return products;
    } catch (error) {
        console.error("[Manufacturing Service] Error fetching products:", error);
        return [];
    }
}

/**
 * 1b. Fetches all unit definitions registered in the database.
 */
export async function fetchAllUnits(): Promise<DirectusUnit[]> {
    try {
        const res = await fetch(`${DIRECTUS_URL}/items/units?limit=-1`, { headers, next: { revalidate: 60 } });
        if (!res.ok) throw new Error(`Directus failed to fetch units: ${res.status}`);
        const json = await res.json();
        return json.data || [];
    } catch (error) {
        console.error("[Manufacturing Service] Error fetching units:", error);
        return [];
    }
}

/**
 * 2. Fetches the latest landed unit cost for a raw ingredient based on recent shipment logs.
 */
export async function getLatestLandedCost(productId: number, forexRate: number = 58.00): Promise<number> {
    try {
        // First check currency profile for USD prices
        const resProfile = await fetch(`${DIRECTUS_URL}/items/product_currency_profiles?filter[product_id][_eq]=${productId}&limit=1`, { headers, cache: "no-store" });
        if (resProfile.ok) {
            const profileJson = await resProfile.json();
            const profile = profileJson.data?.[0];
            if (profile && profile.is_foreign_sourced && profile.purchase_currency === "USD" && profile.purchase_price) {
                return Number(profile.purchase_price) * forexRate;
            }
        }

        // Query shipment_line_items joined with incoming_shipments to sort by date_received desc
        const query = encodeURIComponent(JSON.stringify({
            _and: [
                { product_id: { _eq: productId } },
                { shipment_id: { status: { _in: ["Received", "Receiving (QA)"] } } }
            ]
        }));
        
        const url = `${DIRECTUS_URL}/items/shipment_line_items?filter=${query}&fields=*,shipment_id.date_received&sort=-shipment_id.date_received&limit=1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        
        if (res.ok) {
            const json = await res.json();
            const latest = json.data?.[0];
            if (latest && latest.final_landed_unit_cost) {
                return Number(latest.final_landed_unit_cost);
            }
        }
        
        // Fallback to product list unit cost estimation if no shipments exist
        const resProd = await fetch(`${DIRECTUS_URL}/items/products/${productId}?fields=price_per_unit,cost_per_unit`, { headers });
        if (resProd.ok) {
            const jsonProd = await resProd.json();
            return Number(jsonProd.data?.cost_per_unit || jsonProd.data?.price_per_unit || 0);
        }
        return 0;
    } catch (e) {
        console.error(`[Manufacturing Service] Error fetching landed cost for product ID ${productId}:`, e);
        return 0;
    }
}


/**
 * 3. Crawls active BOM, routing steps, and components for a product.
 */
export async function getActiveBOMForProduct(productId: number): Promise<{
    bom: DirectusBOM | null;
    components: DirectusBOMComponent[];
    routings: DirectusRouting[];
}> {
    try {
        const filter = encodeURIComponent(JSON.stringify({
            _and: [
                { product_id: { _eq: productId } },
                { is_active: { _eq: true } }
            ]
        }));
        
        // Get active BOM
        const resBOM = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms?filter=${filter}&fields=*,version.*&limit=1`, { headers, cache: "no-store" });
        if (!resBOM.ok) return { bom: null, components: [], routings: [] };
        
        const bomData = await resBOM.json();
        const activeBOM: DirectusBOM = bomData.data?.[0];
        
        if (!activeBOM) return { bom: null, components: [], routings: [] };
        
        // Fetch Components
        const compFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: activeBOM.bom_id } }));
        const resComp = await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components?filter=${compFilter}&limit=-1`, { headers, cache: "no-store" });
        const compJson = await resComp.json();
        const components: DirectusBOMComponent[] = compJson.data || [];
        
        // Fetch Routings
        const routFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: activeBOM.bom_id } }));
        const resRout = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings?filter=${routFilter}&sort=sequence_order&limit=-1`, { headers, cache: "no-store" });
        const routJson = await resRout.json();
        const routings: DirectusRouting[] = routJson.data || [];
        
        return { bom: activeBOM, components, routings };
    } catch (e) {
        console.error(`[Manufacturing Service] Error fetching active BOM for product ID ${productId}:`, e);
        return { bom: null, components: [], routings: [] };
    }
}

/**
 * 4. Main roll-up engine: Recursively crawls nested assemblies and calculates standard costs.
 */
export async function calculateRollupCost(
    productId: number,
    visited: Set<number> = new Set(),
    productsMap?: Map<number, DirectusProduct>,
    forexRate: number = 58.00
): Promise<CostRollupResult> {
    const defaultResult = (pName = "Unknown Product", sku = ""): CostRollupResult => ({
        productId,
        productName: pName,
        sku,
        bomId: null,
        bomVersion: "v1.0",
        materialsCost: 0,
        routingsCost: 0,
        yieldPercentage: 100,
        totalBaseCost: 0,
        targetSellingPrice: 0,
        grossMarginPercent: 0,
        costTree: []
    });

    // Circular dependency check
    if (visited.has(productId)) {
        console.error(`[Cost Engine] Circular dependency detected on product ID: ${productId}`);
        return defaultResult("Circular Dependency Reference", "ERR-LOOP");
    }
    visited.add(productId);

    // Warm productsMap cache if not provided to save API calls
    if (!productsMap) {
        const allProds = await fetchAllProducts();
        productsMap = new Map(allProds.map(p => [p.product_id, p]));
    }

    // Fetch product profile from cache
    const product = productsMap.get(productId);
    if (!product) {
        // Fallback to fetch if not in map (edge case)
        const resProd = await fetch(`${DIRECTUS_URL}/items/products/${productId}`, { headers });
        if (!resProd.ok) return defaultResult();
        const productJson = await resProd.json();
        const fetchedProduct: DirectusProduct = productJson.data;
        if (!fetchedProduct) return defaultResult();
        productsMap.set(productId, fetchedProduct);
    }

    const currentProduct = productsMap.get(productId)!;

    // Fetch BOM & Routings
    const { bom, components, routings } = await getActiveBOMForProduct(productId);
    if (!bom) {
        // Raw material (leaf node): Cost is its latest landed shipment unit cost
        const landedCost = await getLatestLandedCost(productId, forexRate);
        return {
            ...defaultResult(currentProduct.product_name, currentProduct.product_code),
            totalBaseCost: landedCost,
            targetSellingPrice: currentProduct.price_per_unit || 0,
            costTree: [{
                id: `leaf-${productId}`,
                name: currentProduct.product_name,
                type: "ingredient",
                quantity: 1,
                uom: "UOM",
                unitCost: landedCost,
                wastagePercent: 0,
                totalCost: landedCost
            }]
        };
    }

    let materialsSubtotal = 0;
    const costTreeNodes: CostNode[] = [];

    // Calculate Ingredients Costs
    for (const comp of components) {
        let compUnitCost = 0;
        let childrenNodes: CostNode[] | undefined;

        if (comp.component_type === "sub_assembly") {
            // Recursive calculation
            const subResult = await calculateRollupCost(comp.component_product_id, new Set(visited), productsMap, forexRate);
            compUnitCost = subResult.totalBaseCost;
            childrenNodes = subResult.costTree;
        } else {
            // Raw material cost
            compUnitCost = await getLatestLandedCost(comp.component_product_id, forexRate);
        }

        // Apply component spillage wastage: Qty * Cost / (1 - wastage)
        const wastageFactor = 1 - (comp.wastage_factor_percentage / 100);
        let lineCost = (comp.quantity_required * compUnitCost) / (wastageFactor > 0 ? wastageFactor : 1);


        // Subtract value if it is a sellable by-product
        if (comp.component_type === "by_product") {
            lineCost = -Math.abs(lineCost);
        } else {
            materialsSubtotal += lineCost;
        }

        // Retrieve ingredient name from map or database fallback
        const compProduct = productsMap.get(comp.component_product_id);
        const ingName = compProduct ? compProduct.product_name : `Component #${comp.component_product_id}`;

        costTreeNodes.push({
            id: `comp-${comp.component_id}`,
            name: ingName,
            type: comp.component_type === "by_product" ? "by_product" : comp.component_type === "sub_assembly" ? "sub_assembly" : "ingredient",
            quantity: comp.quantity_required,
            uom: comp.unit_of_measurement?.unit_shortcut || "pc",
            unitCost: compUnitCost,
            wastagePercent: comp.wastage_factor_percentage,
            totalCost: lineCost,
            children: childrenNodes
        });
    }

    // Calculate Routings Costs
    let routingsSubtotal = 0;
    for (const r of routings) {
        const stepCost = r.estimated_labor_cost + (r.estimated_overhead_cost * r.duration_hours);
        routingsSubtotal += stepCost;

        costTreeNodes.push({
            id: `route-${r.routing_id}`,
            name: r.operation_name,
            type: "routing",
            quantity: r.duration_hours,
            uom: "hrs",
            unitCost: r.estimated_overhead_cost,
            wastagePercent: 0,
            totalCost: stepCost
        });
    }

    // Total base unit cost rolled up under yields shrinkage
    const yieldFactor = bom.expected_yield_percentage / 100;
    const rolledCost = (materialsSubtotal + routingsSubtotal) / (yieldFactor > 0 ? yieldFactor : 1);
    
    // Profit Margins
    const targetPrice = currentProduct.price_per_unit || 0;
    const marginPhp = targetPrice - rolledCost;
    const marginPercent = targetPrice > 0 ? (marginPhp / targetPrice) * 100 : 0;

    return {
        productId,
        productName: currentProduct.product_name,
        sku: currentProduct.product_code,
        bomId: bom.bom_id,
        bomVersion: (bom.version && typeof bom.version === "object") ? bom.version.version_name : (bom.version || "V1"),
        materialsCost: materialsSubtotal,
        routingsCost: routingsSubtotal,
        yieldPercentage: bom.expected_yield_percentage,
        totalBaseCost: rolledCost,
        targetSellingPrice: targetPrice,
        grossMarginPercent: marginPercent,
        costTree: costTreeNodes
    };
}

/**
 * 5. Utility to update the calculated base unit cost back into the master product catalog.
 */
export async function updateProductStandardCost(productId: number, standardCost: number): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/products/${productId}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                cost_per_unit: standardCost
            })
        });
        return res.ok;
    } catch (e) {
        console.error(`[Manufacturing Service] Failed to save updated costing back to product ${productId}:`, e);
        return false;
    }
}

export interface DirectusSupplier {
    id: number;
    supplier_name: string;
    supplier_shortcut?: string | null;
    isActive?: boolean;
}

export interface DirectusProductPerSupplier {
    id: number;
    supplier_id: number;
    product_id: DirectusProduct & {
        unit_of_measurement?: {
            unit_id: number;
            unit_name: string;
            unit_shortcut: string;
            sku_code?: string | null;
        } | null;
    };
}

/**
 * 6. Fetches all active suppliers from Directus.
 */
export async function fetchSuppliers(): Promise<DirectusSupplier[]> {
    try {
        const res = await fetch(`${DIRECTUS_URL}/items/suppliers?filter[isActive][_eq]=true&sort=supplier_name&limit=-1`, { headers, next: { revalidate: 60 } });
        if (!res.ok) throw new Error(`Directus failed to fetch suppliers: ${res.status}`);
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        console.error("[Manufacturing Service] Error fetching suppliers:", e);
        return [];
    }
}

/**
 * 7. Fetches all products linked to a supplier, including nested UOM details.
 */
export async function fetchProductsBySupplier(supplierId: number): Promise<DirectusProductPerSupplier[]> {
    try {
        const url = `${DIRECTUS_URL}/items/product_per_supplier?filter[supplier_id][_eq]=${supplierId}&fields=id,supplier_id,product_id.*,product_id.unit_of_measurement.*&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) throw new Error(`Directus failed to fetch products for supplier ${supplierId}: ${res.status}`);
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        console.error(`[Manufacturing Service] Error fetching products for supplier ID ${supplierId}:`, e);
        return [];
    }
}

/**
 * 8. Updates active BOM metadata (expected yield percentage).
 */
export async function saveActiveBOMDetails(bomId: number, expectedYield: number): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/manufacturing_boms/${bomId}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                expected_yield_percentage: expectedYield
            })
        });
        return res.ok;
    } catch (e) {
        console.error(`[Manufacturing Service] Failed to save BOM details for BOM ${bomId}:`, e);
        return false;
    }
}

/**
 * Registers a new product version in the database.
 */
export async function createProductVersion(productId: number, versionName: string): Promise<number | null> {
    try {
        const url = `${DIRECTUS_URL}/items/manufacturing_product_version`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                product_id: productId,
                version_name: versionName
            })
        });
        if (!res.ok) throw new Error(`Directus failed to create product version: ${res.status}`);
        const json = await res.json();
        return json.data?.id || null;
    } catch (e) {
        console.error(`[Manufacturing Service] Failed to create product version for product ${productId}:`, e);
        return null;
    }
}

/**
 * Creates a new active BOM in Directus, registering its V1 version first.
 */
/**
 * Creates a new active BOM in Directus, registering its version first with custom name.
 */
export async function createActiveBOM(
    productId: number,
    expectedYield: number,
    bomName: string,
    versionName: string
): Promise<DirectusBOM | null> {
    try {
        const versionId = await createProductVersion(productId, versionName);
        if (!versionId) throw new Error(`Could not create product version ${versionName}`);

        const url = `${DIRECTUS_URL}/items/manufacturing_boms`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                product_id: productId,
                bom_name: bomName,
                base_quantity: 1,
                expected_yield_percentage: expectedYield,
                is_active: true,
                version: versionId
            })
        });
        if (!res.ok) throw new Error(`Directus failed to create BOM: ${res.status}`);
        const json = await res.json();
        return json.data || null;
    } catch (e) {
        console.error(`[Manufacturing Service] Failed to create BOM for product ${productId}:`, e);
        return null;
    }
}

/**
 * Deactivates the old BOM, registers a new version, and clones components & routings.
 */
export async function registerNewBOMVersion(
    productId: number,
    oldBomId: number,
    expectedYield: number,
    bomName: string,
    versionName: string
): Promise<DirectusBOM | null> {
    let createdVersionId: number | null = null;
    let createdBomId: number | null = null;
    const createdComponents: number[] = [];
    const createdRoutings: number[] = [];

    try {
        createdVersionId = await createProductVersion(productId, versionName);
        if (!createdVersionId) throw new Error(`Could not register new product version ${versionName}`);

        const today = new Date().toISOString().split("T")[0];

        // Deactivate old BOM
        await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${oldBomId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                is_active: false,
                valid_to: today
            })
        });

        // Create new BOM
        const resNew = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                product_id: productId,
                bom_name: bomName,
                base_quantity: 1,
                expected_yield_percentage: expectedYield,
                is_active: true,
                version: createdVersionId,
                valid_from: today
            })
        });

        if (!resNew.ok) throw new Error(`Failed to create new active BOM version: ${resNew.status}`);
        const json = await resNew.json();
        const newBOM: DirectusBOM = json.data;
        createdBomId = newBOM.bom_id;

        // Fetch components of old BOM
        const compFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: oldBomId } }));
        const resComp = await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components?filter=${compFilter}&limit=-1`, { headers, cache: "no-store" });
        if (resComp.ok) {
            const compJson = await resComp.json();
            const oldComponents: DirectusBOMComponent[] = compJson.data || [];
            
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
                if (!resItem.ok) throw new Error(`Failed to clone component during revision: ${resItem.status}`);
                const itemData = await resItem.json();
                createdComponents.push(itemData.data.component_id);
            }
        }

        // Fetch routing steps of old BOM
        const routFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: oldBomId } }));
        const resRout = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings?filter=${routFilter}&limit=-1`, { headers, cache: "no-store" });
        if (resRout.ok) {
            const routJson = await resRout.json();
            const oldRoutings: DirectusRouting[] = routJson.data || [];

            for (const step of oldRoutings) {
                const resStep = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        bom_id: createdBomId,
                        sequence_order: step.sequence_order,
                        operation_name: step.operation_name,
                        estimated_labor_cost: step.estimated_labor_cost,
                        estimated_overhead_cost: step.estimated_overhead_cost,
                        duration_hours: step.duration_hours
                    })
                });
                if (!resStep.ok) throw new Error(`Failed to clone routing step during revision: ${resStep.status}`);
                const stepData = await resStep.json();
                createdRoutings.push(stepData.data.routing_id);
            }
        }

        return newBOM;
    } catch (e) {
        console.error("[Manufacturing Service] Error during transactional version registration, rolling back...", e);
        
        // Emulated Rollback
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

        // Re-activate the old BOM
        await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${oldBomId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                is_active: true,
                valid_to: null
            })
        }).catch(() => {});

        return null;
    }
}

/**
 * 9. Syncs BOM components to Directus (add, update, delete).
 */
export async function syncBOMComponents(bomId: number, components: DirectusBOMComponentInput[], isNewBOM = false): Promise<boolean> {
    try {
        // Fetch all units for mapping UOM shortcut to ID
        const units = await fetchAllUnits();

        if (isNewBOM) {
            for (const item of components) {
                let uomId = item.uomId;
                if (!uomId && item.uom) {
                    const matchedUnit = units.find(u => 
                        u.unit_shortcut?.toLowerCase() === String(item.uom).toLowerCase() ||
                        u.unit_name?.toLowerCase() === String(item.uom).toLowerCase()
                    );
                    if (matchedUnit) {
                        uomId = matchedUnit.unit_id;
                    }
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

        // Fetch existing components
        const getUrl = `${DIRECTUS_URL}/items/manufacturing_bom_components?filter[bom_id][_eq]=${bomId}&limit=-1`;
        const resGet = await fetch(getUrl, { headers, cache: "no-store" });
        if (!resGet.ok) throw new Error("Failed to fetch existing components for sync");
        const getJson = await resGet.json();
        const existing: { component_id: number }[] = getJson.data || [];

        const uiIds = new Set(components.map(item => String(item.id)));

        // 1. Delete removed components
        const toDelete = existing.filter(e => !uiIds.has(String(e.component_id)));
        for (const item of toDelete) {
            await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components/${item.component_id}`, {
                method: "DELETE",
                headers
            });
        }

        // 2. Add or Update components
        for (const item of components) {
            let uomId = item.uomId;
            if (!uomId && item.uom) {
                const matchedUnit = units.find(u => 
                    u.unit_shortcut?.toLowerCase() === String(item.uom).toLowerCase() ||
                    u.unit_name?.toLowerCase() === String(item.uom).toLowerCase()
                );
                if (matchedUnit) {
                    uomId = matchedUnit.unit_id;
                }
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
                await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components/${item.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(payload)
                });
            }
        }
        return true;
    } catch (e) {
        console.error(`[Manufacturing Service] Error syncing BOM components for BOM ${bomId}:`, e);
        return false;
    }
}

/**
 * 10. Syncs routing steps to Directus (add, update, delete).
 */
export async function syncRoutingSteps(
    bomId: number,
    routings: DirectusRoutingStepInput[],
    versionId: number,
    isNewBOM = false
): Promise<boolean> {
    try {
        let finalVersionId = versionId;
        if (!finalVersionId || finalVersionId === 0) {
            const bomRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${bomId}`, { headers });
            if (bomRes.ok) {
                const bomJson = await bomRes.json();
                const bomVersion = bomJson.data?.version;
                if (bomVersion) {
                    finalVersionId = typeof bomVersion === "object" ? bomVersion.id : Number(bomVersion);
                }
            }
        }

        // Fetch existing operations first to map name -> operation_id
        const operations = await fetchAllOperations();

        if (isNewBOM) {
            for (const step of routings) {
                const matchedOp = operations.find(o => o.operation_name.trim().toLowerCase() === String(step.name || "").trim().toLowerCase());
                const payload = {
                    bom_id: bomId,
                    version: finalVersionId,
                    sequence_order: step.sequence,
                    operation_name: step.name,
                    operation_id: matchedOp ? matchedOp.id : (step.operationId || null),
                    estimated_labor_cost: step.laborFlatRate,
                    estimated_overhead_cost: step.machineHourlyRate,
                    duration_hours: step.durationHours
                };
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routings`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload)
                });
            }
            return true;
        }

        // Fetch existing routings
        const getUrl = `${DIRECTUS_URL}/items/manufacturing_routings?filter[bom_id][_eq]=${bomId}&limit=-1`;
        const resGet = await fetch(getUrl, { headers, cache: "no-store" });
        if (!resGet.ok) throw new Error("Failed to fetch existing routing steps for sync");
        const getJson = await resGet.json();
        const existing: { routing_id: number }[] = getJson.data || [];

        const uiIds = new Set(routings.map(step => String(step.id)));

        // 1. Delete removed steps
        const toDelete = existing.filter(e => !uiIds.has(String(e.routing_id)));
        for (const step of toDelete) {
            await fetch(`${DIRECTUS_URL}/items/manufacturing_routings/${step.routing_id}`, {
                method: "DELETE",
                headers
            });
        }

        // 2. Add or Update steps
        for (const step of routings) {
            const matchedOp = operations.find(o => o.operation_name.trim().toLowerCase() === String(step.name || "").trim().toLowerCase());
            const payload = {
                bom_id: bomId,
                version: finalVersionId,
                sequence_order: step.sequence,
                operation_name: step.name,
                operation_id: matchedOp ? matchedOp.id : (step.operationId || null),
                estimated_labor_cost: step.laborFlatRate,
                estimated_overhead_cost: step.machineHourlyRate,
                duration_hours: step.durationHours
            };

            const isNew = isNaN(Number(step.id));
            if (isNew) {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routings`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                await fetch(`${DIRECTUS_URL}/items/manufacturing_routings/${step.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(payload)
                });
            }
        }
        return true;

    } catch (e) {
        console.error(`[Manufacturing Service] Error syncing routings for BOM ${bomId}:`, e);
        return false;
    }
}

/**
 * 11. Updates product master fields (price, density, title, SKU, barcode, etc.).
 */
export async function updateProductDetails(
    productId: number,
    details: {
        product_name?: string;
        product_code?: string;
        description?: string;
        barcode?: string;
        price_per_unit?: number;
        density_factor?: number;
        product_brand?: number;
        product_category?: number;
        cost_per_unit?: number;
    }
): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/products/${productId}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify(details)
        });
        return res.ok;
    } catch (e) {
        console.error(`[Manufacturing Service] Failed to update product details for ${productId}:`, e);
        return false;
    }
}

/**
 * Updates custom overhead on a specific product version record associated with a BOM.
 */
export async function updateProductVersionOverhead(
    bomId: number,
    customOverhead: number
): Promise<boolean> {
    try {
        const bomRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms/${bomId}`, { headers });
        if (!bomRes.ok) return false;
        const bomJson = await bomRes.json();
        const bomVersion = bomJson.data?.version;
        if (!bomVersion) return false;
        const versionId = typeof bomVersion === "object" ? bomVersion.id : Number(bomVersion);
        
        const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_product_version/${versionId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ custom_overhead: customOverhead })
        });
        return res.ok;
    } catch (e) {
        console.error(`[Manufacturing Service] Failed to update product version overhead for BOM ${bomId}:`, e);
        return false;
    }
}

/**
 * Creates a new product record in the products master list in Directus.
 */
export async function createNewProduct(
    details: {
        product_name: string;
        product_code: string;
        description?: string;
        barcode?: string;
        price_per_unit?: number;
        density_factor?: number;
        unit_of_measurement?: number;
        product_brand?: number;
        product_category?: number;
    }
): Promise<number | null> {
    try {
        const url = `${DIRECTUS_URL}/items/products`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...details,
                isActive: 1,
                status: "Approved",
                item_type: "regular"
            })
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to create product: ${res.status} - ${errText}`);
        }
        const json = await res.json();
        return json.data?.product_id || null;
    } catch (e) {
        console.error("[Manufacturing Service] Failed to create product:", e);
        return null;
    }
}

/**
 * Transactionally registers a new product and its initial BOM version in Directus.
 * Emulates a rollback by deleting the created product if the BOM version creation fails.
 */
export async function registerProductWithBOM(
    productDetails: {
        product_name: string;
        product_code: string;
        description?: string;
        barcode?: string;
        price_per_unit?: number;
        density_factor?: number;
        unit_of_measurement?: number;
        product_brand?: number;
        product_category?: number;
    },
    versionName: string
): Promise<{ productId: number; bom: DirectusBOM } | null> {
    let productId: number | null = null;
    try {
        productId = await createNewProduct(productDetails);
        if (!productId) throw new Error("Failed to create product record in Directus");

        const bomName = `BOM for ${productDetails.product_name}`;
        const newBom = await createActiveBOM(productId, 100, bomName, versionName);
        if (!newBom) throw new Error("Failed to register initial BOM version in Directus");

        return { productId, bom: newBom };
    } catch (e) {
        console.error("[Manufacturing Service] Failed transaction in registerProductWithBOM:", e);
        if (productId) {
            await fetch(`${DIRECTUS_URL}/items/products/${productId}`, { method: "DELETE", headers }).catch(() => {});
        }
        return null;
    }
}


export interface DirectusProductVersion {
    id: number;
    product_id: number;
    version_name: string;
}

/**
 * Fetches all registered versions of a product.
 */
export async function fetchProductVersions(productId: number): Promise<DirectusProductVersion[]> {
    try {
        const filter = encodeURIComponent(JSON.stringify({ product_id: { _eq: productId } }));
        const url = `${DIRECTUS_URL}/items/manufacturing_product_version?filter=${filter}&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) throw new Error(`Directus failed to fetch versions: ${res.status}`);
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        console.error(`[Manufacturing Service] Error fetching product versions for product ${productId}:`, e);
        return [];
    }
}

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
        
        // Get active/matching BOM for version
        const resBOM = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms?filter=${filter}&fields=*,version.*&limit=1`, { headers, cache: "no-store" });
        if (!resBOM.ok) return { bom: null, components: [], routings: [] };
        
        const bomData = await resBOM.json();
        const activeBOM: DirectusBOM = bomData.data?.[0];
        
        if (!activeBOM) return { bom: null, components: [], routings: [] };
        
        // Fetch Components
        const compFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: activeBOM.bom_id } }));
        const resComp = await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components?filter=${compFilter}&limit=-1`, { headers, cache: "no-store" });
        const compJson = await resComp.json();
        const components: DirectusBOMComponent[] = compJson.data || [];
        
        // Fetch Routings
        const routFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: activeBOM.bom_id } }));
        const resRout = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings?filter=${routFilter}&sort=sequence_order&limit=-1`, { headers, cache: "no-store" });
        const routJson = await resRout.json();
        const routings: DirectusRouting[] = routJson.data || [];
        
        return { bom: activeBOM, components, routings };
    } catch (e) {
        console.error(`[Manufacturing Service] Error fetching BOM details for version ${versionId}:`, e);
        return { bom: null, components: [], routings: [] };
    }
}

/**
 * Calculates absolute cheapest estimated production cost for a BOM dynamically.
 */
export async function calculateDynamicBOMCost(bomId: number, forexRate: number = 58.00): Promise<number> {
    try {
        // 1. Fetch components
        const compFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: bomId } }));
        const resComp = await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components?filter=${compFilter}&limit=-1`, { headers, cache: "no-store" });
        if (!resComp.ok) return 0;
        const compJson = await resComp.json();
        const components: DirectusBOMComponent[] = compJson.data || [];

        // 2. Fetch all products to match matching names
        const allProducts = await fetchAllProducts();
        
        let totalMaterialCost = 0;

        for (const comp of components) {
            const compProduct = allProducts.find(p => p.product_id === comp.component_product_id);
            if (!compProduct) continue;

            const nameToMatch = compProduct.product_name.trim().toLowerCase();

            // Find all matching products by name
            const matchingProducts = allProducts.filter(p => 
                p.product_name.trim().toLowerCase() === nameToMatch
            );

            let lowestCost = Infinity;

            for (const p of matchingProducts) {
                // Determine base cost (either latest landed cost or price_per_unit/cost_per_unit converted if USD)
                let cost = 0;
                if (p.currency_profile?.is_foreign_sourced && p.currency_profile?.purchase_currency === "USD" && p.currency_profile?.purchase_price) {
                    cost = Number(p.currency_profile.purchase_price) * forexRate;
                } else {
                    cost = p.cost_per_unit || p.price_per_unit || 0;
                }
                
                if (cost === 0) {
                    cost = await getLatestLandedCost(p.product_id, forexRate);
                }

                if (cost > 0 && cost < lowestCost) {
                    lowestCost = cost;
                }
            }

            if (lowestCost === Infinity) {
                if (compProduct.currency_profile?.is_foreign_sourced && compProduct.currency_profile?.purchase_currency === "USD" && compProduct.currency_profile?.purchase_price) {
                    lowestCost = Number(compProduct.currency_profile.purchase_price) * forexRate;
                } else {
                    lowestCost = compProduct.cost_per_unit || compProduct.price_per_unit || 0;
                }
                if (lowestCost === 0) {
                    lowestCost = await getLatestLandedCost(comp.component_product_id, forexRate);
                }
            }


            const wastageFactor = 1 - (comp.wastage_factor_percentage / 100);
            const lineCost = (comp.quantity_required * lowestCost) / (wastageFactor > 0 ? wastageFactor : 1);

            if (comp.component_type === "by_product") {
                totalMaterialCost -= lineCost;
            } else {
                totalMaterialCost += lineCost;
            }
        }

        // 3. Fetch routings and sum
        const routFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: bomId } }));
        const resRout = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings?filter=${routFilter}&limit=-1`, { headers, cache: "no-store" });
        let totalRoutingCost = 0;
        if (resRout.ok) {
            const routJson = await resRout.json();
            const routings: DirectusRouting[] = routJson.data || [];
            for (const r of routings) {
                totalRoutingCost += Number(r.estimated_labor_cost) + (Number(r.estimated_overhead_cost) * Number(r.duration_hours));
            }
        }

        return totalMaterialCost + totalRoutingCost;
    } catch (e) {
        console.error(`[Manufacturing Service] Error calculating dynamic BOM cost for BOM ${bomId}:`, e);
        return 0;
    }
}

/**
 * Fetch all product overheads for a specific product and version.
 */
export async function getProductOverheads(productId: number, versionId: number): Promise<unknown[]> {
    try {
        // 1. Try to get overheads for this specific version first
        const url = `${DIRECTUS_URL}/items/product_overheads?filter[product_id][_eq]=${productId}&filter[version_id][_eq]=${versionId}&fields=*,overhead_id.*&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        const json = res.ok ? await res.json() : { data: [] };
        let data = json.data || [];
        
        // 2. If none saved for this version yet, fall back to the latest saved overheads for this product overall
        if (data.length === 0) {
            const latestUrl = `${DIRECTUS_URL}/items/product_overheads?filter[product_id][_eq]=${productId}&sort=-date_created&fields=*,overhead_id.*&limit=100`;
            const resLatest = await fetch(latestUrl, { headers, cache: "no-store" });
            const latestData = resLatest.ok ? (await resLatest.json()).data || [] : [];
            if (latestData.length > 0) {
                // Filter items belonging to the most recently saved version
                const latestVersionId = latestData[0].version_id;
                data = latestData.filter((o: { version_id: number }) => o.version_id === latestVersionId);
            }
        }
        return data;
    } catch (e) {
        console.error("Failed to get product overheads:", e);
        return [];
    }
}

/**
 * Syncs product overhead variables to Directus (add, update, delete).
 */
export async function syncProductOverheads(
    productId: number,
    versionId: number,
    overheads: { id?: string | number; overheadId: number; amount: number }[]
): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/product_overheads?filter[product_id][_eq]=${productId}&filter[version_id][_eq]=${versionId}&limit=-1`;
        const resGet = await fetch(url, { headers, cache: "no-store" });
        const existing: { id: number }[] = resGet.ok ? (await resGet.json()).data || [] : [];
        
        const uiIds = new Set(overheads.map(o => String(o.id)));
        
        // 1. Delete removed overhead records
        const toDelete = existing.filter(e => !uiIds.has(String(e.id)));
        for (const item of toDelete) {
            await fetch(`${DIRECTUS_URL}/items/product_overheads/${item.id}`, {
                method: "DELETE",
                headers
            });
        }
        
        // 2. Add or Update records
        for (const item of overheads) {
            const payload = {
                product_id: productId,
                version_id: versionId,
                overhead_id: Number(item.overheadId),
                amount: Number(item.amount) || 0
            };
            const isNew = isNaN(Number(item.id));
            if (isNew) {
                await fetch(`${DIRECTUS_URL}/items/product_overheads`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                await fetch(`${DIRECTUS_URL}/items/product_overheads/${item.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(payload)
                });
            }
        }
        return true;
    } catch (e) {
        console.error("Failed to sync product overheads:", e);
        return false;
    }
}

/**
 * Fetch all reusable overhead types.
 */
export async function fetchAllOverheadTypes(): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/overhead_types?limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("Failed to fetch overhead types:", e);
        return [];
    }
}

/**
 * Creates a new overhead type variable.
 */
export async function createOverheadType(name: string): Promise<unknown> {
    try {
        const url = `${DIRECTUS_URL}/items/overhead_types`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ overhead_name: name })
        });
        if (!res.ok) return null;
        return (await res.json()).data;
    } catch (e) {
        console.error("Failed to create overhead type:", e);
        return null;
    }
}

/**
 * Fetch all reusable manufacturing operations.
 */
export async function fetchAllOperations(): Promise<DirectusOperation[]> {
    try {
        const url = `${DIRECTUS_URL}/items/manufacturing_operations?limit=-1&sort=operation_name`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("Failed to fetch manufacturing operations:", e);
        return [];
    }
}

/**
 * Creates a new manufacturing operation.
 */
export async function createOperation(name: string): Promise<DirectusOperation | null> {
    try {
        const url = `${DIRECTUS_URL}/items/manufacturing_operations`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ operation_name: name })
        });
        if (!res.ok) return null;
        return (await res.json()).data;
    } catch (e) {
        console.error("Failed to create manufacturing operation:", e);
        return null;
    }
}
/**
 * Fetch all registered customers.
 */
export async function fetchCustomers(search?: string): Promise<unknown[]> {
    try {
        let url = `${DIRECTUS_URL}/items/customer?limit=250&sort=customer_name&filter[isActive][_eq]=true`;
        if (search && search.trim()) {
            url += `&search=${encodeURIComponent(search.trim())}`;
        }
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("Failed to fetch customers:", e);
        return [];
    }
}

/**
 * Fetch all saved quotations, including populated customer details.
 */
export async function fetchQuotations(): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/quotation_header?limit=-1&sort=-quote_date`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        const quotes = ((await res.json()).data || []) as { id: number; customer_id: string | number | Record<string, unknown>; [key: string]: unknown }[];

        // Extract unique customer IDs
        const custIds = Array.from(new Set(quotes.map(q => q.customer_id).filter(Boolean)));
        let customers: { id: string | number; customer_name: string; customer_code: string }[] = [];
        if (custIds.length > 0) {
            const custUrl = `${DIRECTUS_URL}/items/customer?filter[id][_in]=${custIds.join(",")}&limit=-1`;
            const custRes = await fetch(custUrl, { headers, cache: "no-store" });
            if (custRes.ok) {
                customers = ((await custRes.json()).data || []) as { id: string | number; customer_name: string; customer_code: string }[];
            }
        }

        // Manually map customer records
        return quotes.map(q => {
            const rawCustId = q.customer_id;
            if (rawCustId && (typeof rawCustId === "number" || typeof rawCustId === "string")) {
                const match = customers.find(c => String(c.id) === String(rawCustId));
                if (match) {
                    return { ...q, customer_id: match };
                }
            }
            return q;
        });
    } catch (e) {
        console.error("Failed to fetch quotations:", e);
        return [];
    }
}

/**
 * Fetch detailed cost snapshot nodes for a specific quote.
 */
export async function fetchQuotationSnapshots(quoteId: number): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/quotation_snapshots?filter[quotation_id][_eq]=${quoteId}&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("Failed to fetch quotation snapshots:", e);
        return [];
    }
}

/**
 * Transactionally saves a quotation header and its associated frozen cost nodes.
 */
export async function saveQuotation(
    quoteData: {
        quote_number: string;
        customer_id: number;
        total_selling_price: number;
        total_simulated_cost: number;
        forex_rate_used: number;
        remarks?: string;
    },
    snapshots: Array<{
        product_id: number;
        version_id: number;
        node_name: string;
        node_type: string;
        quantity: number;
        uom: string;
        frozen_unit_cost_php: number;
        frozen_total_cost_php: number;
    }>
): Promise<unknown> {
    let quoteId: number | null = null;
    const createdSnapshotIds: number[] = [];
    try {
        // 1. Post Header
        const headerRes = await fetch(`${DIRECTUS_URL}/items/quotation_header`, {
            method: "POST",
            headers,
            body: JSON.stringify(quoteData)
        });
        if (!headerRes.ok) {
            const errText = await headerRes.text();
            throw new Error(`Failed to create quote header: ${headerRes.status} - ${errText}`);
        }
        const headerJson = await headerRes.json();
        quoteId = headerJson.data.id;

        // 2. Post Snapshot nodes
        for (const node of snapshots) {
            const nodePayload = {
                ...node,
                quotation_id: quoteId
            };
            const nodeRes = await fetch(`${DIRECTUS_URL}/items/quotation_snapshots`, {
                method: "POST",
                headers,
                body: JSON.stringify(nodePayload)
            });
            if (!nodeRes.ok) throw new Error(`Failed to save quote node: ${nodeRes.status}`);
            const nodeJson = await nodeRes.json();
            createdSnapshotIds.push(nodeJson.data.id);
        }

        return { success: true, quoteId };
    } catch (e) {
        console.error("Failed to transactional save quotation. Rolling back...", e);
        // Rollback snapshot nodes
        for (const sId of createdSnapshotIds) {
            await fetch(`${DIRECTUS_URL}/items/quotation_snapshots/${sId}`, { method: "DELETE", headers }).catch(() => {});
        }
        // Rollback header
        if (quoteId) {
            await fetch(`${DIRECTUS_URL}/items/quotation_header/${quoteId}`, { method: "DELETE", headers }).catch(() => {});
        }
        throw e;
    }
}

// === PROCUREMENT & IMPORTATION LANDED COST SERVICES ===

export interface DirectusShipment {
    shipment_id?: number;
    reference_number: string;
    supplier_id: number | Record<string, unknown>;
    date_received: string | null;
    total_foreign_currency: number;
    exchange_rate: number;
    total_php_value: number;
    status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received";
    created_at?: string;
}

export interface DirectusShipmentLineItem {
    line_id?: number;
    shipment_id: number;
    product_id: number | Record<string, unknown>;
    quantity_received: number;
    base_unit_cost_php: number;
    allocated_expense_php: number;
    final_landed_unit_cost: number;
}

export interface DirectusShipmentExpense {
    expense_id?: number;
    shipment_id: number;
    expense_type: string;
    amount_php: number;
    allocation_method: "Value" | "Weight" | "Volume";
}

/**
 * Fetch all incoming shipments
 */
export async function fetchIncomingShipments(): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/incoming_shipments?fields=*,supplier_id.*&sort=-created_at&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("Failed to fetch incoming shipments:", e);
        return [];
    }
}

/**
 * Fetch line items for a shipment
 */
export async function fetchShipmentLineItems(shipmentId: number): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/shipment_line_items?filter[shipment_id][_eq]=${shipmentId}&fields=*,product_id.*,product_id.unit_of_measurement.*&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("Failed to fetch shipment line items:", e);
        return [];
    }
}

/**
 * Fetch expenses for a shipment
 */
export async function fetchShipmentExpenses(shipmentId: number): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/shipment_expenses?filter[shipment_id][_eq]=${shipmentId}&fields=*,overhead_id.*&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("Failed to fetch shipment expenses:", e);
        return [];
    }
}

/**
 * Create a new supplier
 */
export async function createSupplier(supplierData: Record<string, unknown>): Promise<unknown> {
    try {
        const url = `${DIRECTUS_URL}/items/suppliers`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ ...supplierData, isActive: 1 })
        });
        if (!res.ok) throw new Error(`Failed to create supplier: ${res.status}`);
        return (await res.json()).data;
    } catch (e) {
        console.error("Failed to create supplier:", e);
        throw e;
    }
}

/**
 * Create an incoming shipment along with line items
 */
export async function createIncomingShipment(
    shipmentData: Partial<DirectusShipment>,
    lineItems: Array<Partial<DirectusShipmentLineItem>>
): Promise<unknown> {
    let shipmentId: number | null = null;
    const createdLineIds: number[] = [];
    try {
        const url = `${DIRECTUS_URL}/items/incoming_shipments`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...shipmentData,
                status: shipmentData.status || "Shipped",
                date_received: (shipmentData.status === "Receiving (QA)" || shipmentData.status === "Received")
                    ? (shipmentData.date_received || new Date().toISOString().split('T')[0])
                    : "1970-01-01"
            })
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Failed to create shipment header: ${res.status} - ${txt}`);
        }
        const shipmentJson = await res.json();
        shipmentId = shipmentJson.data.shipment_id;

        for (const item of lineItems) {
            const payload = {
                ...item,
                shipment_id: shipmentId,
                allocated_expense_php: 0,
                final_landed_unit_cost: item.base_unit_cost_php || 0,
                quantity_received: 0
            };
            const itemRes = await fetch(`${DIRECTUS_URL}/items/shipment_line_items`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            });
            if (!itemRes.ok) throw new Error(`Failed to create line item: ${itemRes.status}`);
            const itemJson = await itemRes.json();
            createdLineIds.push(itemJson.data.line_id);
        }

        return { success: true, shipment_id: shipmentId };
    } catch (e) {
        console.error("Failed to save incoming shipment. Rolling back...", e);
        for (const lid of createdLineIds) {
            await fetch(`${DIRECTUS_URL}/items/shipment_line_items/${lid}`, { method: "DELETE", headers }).catch(() => {});
        }
        if (shipmentId) {
            await fetch(`${DIRECTUS_URL}/items/incoming_shipments/${shipmentId}`, { method: "DELETE", headers }).catch(() => {});
        }
        throw e;
    }
}

/**
 * Allocate shipment expenses and calculate final landed unit costs
 */
export async function processShipmentLandedCosts(
    shipmentId: number,
    status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received",
    expenses: Array<Partial<DirectusShipmentExpense>>,
    allocationMethod: "Value" | "Weight" | "Volume",
    lineItemUpdates?: Array<{ line_id: number; quantity_received: number }>
): Promise<unknown> {
    try {
        // 0. Process any QA received quantity updates first
        if (lineItemUpdates && lineItemUpdates.length > 0) {
            for (const upd of lineItemUpdates) {
                await fetch(`${DIRECTUS_URL}/items/shipment_line_items/${upd.line_id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ quantity_received: upd.quantity_received })
                }).catch(err => console.error("Error updating line item received qty:", err));
            }
        }

        // 1. Delete existing expenses for this shipment
        const oldExpensesRes = await fetch(`${DIRECTUS_URL}/items/shipment_expenses?filter[shipment_id][_eq]=${shipmentId}&limit=-1`, { headers });
        if (oldExpensesRes.ok) {
            const oldExpenses = (await oldExpensesRes.json()).data || [];
            for (const exp of oldExpenses) {
                await fetch(`${DIRECTUS_URL}/items/shipment_expenses/${exp.expense_id}`, { method: "DELETE", headers }).catch(() => {});
            }
        }

        // 2. Save new expenses and sum up PHP total
        let totalExpensesPhp = 0;
        for (const exp of expenses) {
            const resExp = await fetch(`${DIRECTUS_URL}/items/shipment_expenses`, {
                method: "POST",
                headers,
                body: JSON.stringify({ ...exp, shipment_id: shipmentId, allocation_method: allocationMethod })
            });
            if (resExp.ok) {
                const data = (await resExp.json()).data;
                totalExpensesPhp += Number(data.amount_php || 0);
            }
        }

        // 3. Fetch shipment line items with product fields for allocation weight/volume ratios
        const linesRes = await fetch(`${DIRECTUS_URL}/items/shipment_line_items?filter[shipment_id][_eq]=${shipmentId}&fields=*,product_id.*&limit=-1`, { headers });
        if (!linesRes.ok) throw new Error("Failed to load shipment line items");
        const lines = (await linesRes.json()).data || [];

        if (lines.length === 0) {
            // No lines, just update status
            await fetch(`${DIRECTUS_URL}/items/incoming_shipments/${shipmentId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ status })
            });
            return { success: true };
        }

        // 4. Calculate total base values for allocation
        let totalWeight = 0;
        let totalVolume = 0;
        let totalCommercialValuePhp = 0;

        lines.forEach((l: any) => {
            const qty = Number(l.quantity_received) || 0;
            const price = Number(l.base_unit_cost_php) || 0;
            totalCommercialValuePhp += qty * price;

            const prod = l.product_id || {};
            const weight = Number(prod.weight || prod.product_weight || 0);
            totalWeight += qty * weight;

            const height = Number(prod.cbm_height || 0);
            const width = Number(prod.cbm_width || 0);
            const length = Number(prod.cbm_length || 0);
            totalVolume += qty * (height * width * length);
        });

        // 5. Allocate expenses and update shipment_line_items
        for (const l of lines) {
            const qty = Number(l.quantity_received) || 1;
            const price = Number(l.base_unit_cost_php) || 0;
            const lineValuePhp = qty * price;

            let ratio = 0;
            if (allocationMethod === "Weight" && totalWeight > 0) {
                const prod = l.product_id || {};
                const weight = Number(prod.weight || prod.product_weight || 0);
                ratio = (qty * weight) / totalWeight;
            } else if (allocationMethod === "Volume" && totalVolume > 0) {
                const prod = l.product_id || {};
                const height = Number(prod.cbm_height || 0);
                const width = Number(prod.cbm_width || 0);
                const length = Number(prod.cbm_length || 0);
                ratio = (qty * (height * width * length)) / totalVolume;
            } else {
                // Default: Commercial Value
                if (totalCommercialValuePhp > 0) {
                    ratio = lineValuePhp / totalCommercialValuePhp;
                } else {
                    ratio = 1 / lines.length;
                }
            }

            const allocatedExpense = ratio * totalExpensesPhp;
            const finalLandedUnitCost = price + (qty > 0 ? (allocatedExpense / qty) : 0);

            // Update shipment line item
            await fetch(`${DIRECTUS_URL}/items/shipment_line_items/${l.line_id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    allocated_expense_php: allocatedExpense,
                    final_landed_unit_cost: finalLandedUnitCost
                })
            });

            // If shipment is received, update product table cost_per_unit & estimated_unit_cost
            if (status === "Received" || status === "Receiving (QA)") {
                await fetch(`${DIRECTUS_URL}/items/products/${l.product_id.product_id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                        cost_per_unit: finalLandedUnitCost,
                        estimated_unit_cost: finalLandedUnitCost
                    })
                });
            }
        }

        // 6. Update Shipment Header Status
        await fetch(`${DIRECTUS_URL}/items/incoming_shipments/${shipmentId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                status,
                date_received: (status === "Received" || status === "Receiving (QA)") ? new Date().toISOString().split('T')[0] : "1970-01-01"
            })
        });

        return { success: true };
    } catch (e) {
        console.error("Failed to allocate shipment landed costs:", e);
        throw e;
    }
}

/**
 * Updates status of an incoming shipment, and commits product costs if status is Receiving (QA).
 */
export async function updateIncomingShipmentStatus(
    shipmentId: number, 
    status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received"
) {
    try {
        if (status === "Receiving (QA)" || status === "Received") {
            const linesRes = await fetch(`${DIRECTUS_URL}/items/shipment_line_items?filter[shipment_id][_eq]=${shipmentId}&fields=*,product_id.*&limit=-1`, { headers });
            if (linesRes.ok) {
                const lines = (await linesRes.json()).data || [];
                for (const l of lines) {
                    const finalLandedUnitCost = Number(l.final_landed_unit_cost || l.base_unit_cost_php || 0);
                    if (finalLandedUnitCost > 0 && l.product_id?.product_id) {
                        await fetch(`${DIRECTUS_URL}/items/products/${l.product_id.product_id}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify({
                                cost_per_unit: finalLandedUnitCost,
                                estimated_unit_cost: finalLandedUnitCost
                            })
                        }).catch(err => console.error("Error updating product cost on status change:", err));
                    }
                }
            }
        }

        const res = await fetch(`${DIRECTUS_URL}/items/incoming_shipments/${shipmentId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                status,
                date_received: (status === "Received" || status === "Receiving (QA)") ? new Date().toISOString().split('T')[0] : "1970-01-01"
            })
        });

        if (!res.ok) throw new Error(`Failed to update shipment status: ${res.status}`);
        return { success: true };
    } catch (e) {
        console.error("Failed to update incoming shipment status:", e);
        throw e;
    }
}

