import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { 
    DirectusProduct, 
    DirectusProductCurrencyProfile,
    CostRollupResult,
    CostNode
} from "@/modules/manufacturing-management/finished-goods/types";
import { getActiveBOMForProduct } from "../versions/versions-helper";

/**
 * Fetches the latest landed unit cost for a raw ingredient based on recent shipment logs.
 */
export async function getLatestLandedCost(
    productId: number, 
    forexRate: number = 58.00,
    profilesMap?: Map<number, DirectusProductCurrencyProfile>,
    productsMap?: Map<number, DirectusProduct>
): Promise<number> {
    try {
        let profile: DirectusProductCurrencyProfile | undefined = undefined;
        if (profilesMap) {
            profile = profilesMap.get(productId);
        } else {
            const resProfile = await fetch(`${DIRECTUS_URL}/items/product_currency_profiles?filter[product_id][_eq]=${productId}&limit=1`, { headers, cache: "no-store" });
            if (resProfile.ok) {
                const profileJson = await resProfile.json();
                profile = profileJson.data?.[0];
            }
        }

        if (profile && profile.is_foreign_sourced && profile.purchase_currency === "USD" && profile.purchase_price) {
            return Number(profile.purchase_price) * forexRate;
        }

        const query = encodeURIComponent(JSON.stringify({
            _and: [
                { product_id: { _eq: productId } },
                { quantity: { _gt: 0 } }
            ]
        }));
        
        const url = `${DIRECTUS_URL}/items/inventory_lots?filter=${query}&fields=*&sort=-created_on&limit=1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        
        if (res.ok) {
            const json = await res.json();
            const latest = json.data?.[0];
            if (latest) {
                return Number(latest.unit_cost || 0);
            }
        }
        
        if (productsMap) {
            const cachedProd = productsMap.get(productId);
            if (cachedProd) {
                return Number(cachedProd.cost_per_unit || cachedProd.price_per_unit || 0);
            }
        }

        const resProd = await fetch(`${DIRECTUS_URL}/items/products/${productId}?fields=price_per_unit,cost_per_unit`, { headers });
        if (resProd.ok) {
            const jsonProd = await resProd.json();
            return Number(jsonProd.data?.cost_per_unit || jsonProd.data?.price_per_unit || 0);
        }
        return 0;
    } catch (e) {
        console.error(`[Manufacturing Directus API] Error fetching landed cost for product ID ${productId}:`, e);
        return 0;
    }
}


/**
 * Fetches all products.
 */
export async function fetchAllProducts(search?: string, limit: number = -1): Promise<DirectusProduct[]> {
    try {
        const explicitFields = "product_id,product_name,product_code,description,isActive,cost_per_unit,price_per_unit,product_brand,parent_id.product_id,parent_id.product_name,product_category.category_name,unit_of_measurement.unit_shortcut,unit_of_measurement.unit_name,unit_of_measurement_count,product_image,density_factor,production_capacity_per_hour,product_type";
        let url = `${DIRECTUS_URL}/items/products?limit=${limit}&fields=${explicitFields}`;
        if (search && search.trim()) {
            url += `&search=${encodeURIComponent(search.trim())}`;
        }
        
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

        products.forEach((p: DirectusProduct) => {
            p.has_versions = versionProductIds.has(Number(p.product_id));
            p.currency_profile = profilesMap.get(Number(p.product_id)) || null;
        });

        products.sort((a: DirectusProduct, b: DirectusProduct) => {
            if (a.has_versions && !b.has_versions) return -1;
            if (!a.has_versions && b.has_versions) return 1;
            return a.product_name.localeCompare(b.product_name);
        });

        return products;
    } catch (error) {
        console.error("[Manufacturing Directus API] Error fetching products:", error);
        return [];
    }
}

/**
 * Calculates rollup costing standards recursively.
 */
export async function calculateRollupCost(
    productId: number,
    visited: Set<number> = new Set(),
    productsMap?: Map<number, DirectusProduct>,
    forexRate: number = 58.00,
    profilesMap?: Map<number, DirectusProductCurrencyProfile>
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

    if (visited.has(productId)) {
        console.error(`[Cost Engine] Circular dependency detected on product ID: ${productId}`);
        return defaultResult("Circular Dependency Reference", "ERR-LOOP");
    }
    visited.add(productId);

    if (!productsMap) {
        const allProds = await fetchAllProducts();
        productsMap = new Map(allProds.map(p => [p.product_id, p]));
    }

    const product = productsMap.get(productId);
    if (!product) {
        const resProd = await fetch(`${DIRECTUS_URL}/items/products/${productId}`, { headers });
        if (!resProd.ok) return defaultResult();
        const productJson = await resProd.json();
        const fetchedProduct: DirectusProduct = productJson.data;
        if (!fetchedProduct) return defaultResult();
        productsMap.set(productId, fetchedProduct);
    }

    const currentProduct = productsMap.get(productId)!;
    const { bom, components, routings } = await getActiveBOMForProduct(productId);
    if (!bom) {
        const landedCost = await getLatestLandedCost(productId, forexRate, profilesMap, productsMap);
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

    for (const comp of components) {
        let compUnitCost = 0;
        let childrenNodes: CostNode[] | undefined;

        if (comp.landed_cost && Number(comp.landed_cost) > 0) {
            compUnitCost = Number(comp.landed_cost);
        } else if (comp.component_type === "sub_assembly") {
            const subResult = await calculateRollupCost(comp.component_product_id, new Set(visited), productsMap, forexRate, profilesMap);
            compUnitCost = subResult.totalBaseCost;
            childrenNodes = subResult.costTree;
        } else {
            compUnitCost = await getLatestLandedCost(comp.component_product_id, forexRate, profilesMap, productsMap);
        }

        const wastageFactor = 1 - (comp.wastage_factor_percentage / 100);
        let lineCost = (comp.quantity_required * compUnitCost) / (wastageFactor > 0 ? wastageFactor : 1);

        if (comp.component_type === "by_product") {
            lineCost = -Math.abs(lineCost);
        } else {
            materialsSubtotal += lineCost;
        }

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

    let routingsSubtotal = 0;
    for (const r of routings) {
        const laborCost = Number(r.estimated_labor_cost || 0);
        const overheadCost = Number(r.estimated_overhead_cost || 0);
        const hours = Number(r.duration_hours || 0);
        const stepCost = laborCost + (overheadCost * hours);
        routingsSubtotal += stepCost;

        costTreeNodes.push({
            id: `route-${r.routing_id}`,
            name: r.operation_name,
            type: "routing",
            quantity: hours,
            uom: "hrs",
            unitCost: overheadCost,
            wastagePercent: 0,
            totalCost: stepCost
        });
    }

    const yieldFactor = bom.expected_yield_percentage / 100;
    const rolledCost = (materialsSubtotal + routingsSubtotal) / (yieldFactor > 0 ? yieldFactor : 1);
    
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
 * Updates product details.
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
        product_class?: number;
        product_segment?: number;
        product_section?: number;
        product_shelf_life?: number;
        unit_of_measurement_count?: number;
        product_image?: string;
        production_capacity_per_hour?: number;
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
        console.error(`[Manufacturing Directus API] Failed updating product details:`, e);
        return false;
    }
}

/**
 * Gets product overheads.
 */
export async function getProductOverheads(productId: number, versionId: number): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/product_overheads?filter[product_id][_eq]=${productId}&filter[version_id][_eq]=${versionId}&fields=*,overhead_id.*&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        const json = res.ok ? await res.json() : { data: [] };
        let data = json.data || [];
        
        if (data.length === 0) {
            const latestUrl = `${DIRECTUS_URL}/items/product_overheads?filter[product_id][_eq]=${productId}&sort=-date_created&fields=*,overhead_id.*&limit=100`;
            const resLatest = await fetch(latestUrl, { headers, cache: "no-store" });
            const latestData = resLatest.ok ? (await resLatest.json()).data || [] : [];
            if (latestData.length > 0) {
                const latestVersionId = latestData[0].version_id;
                data = latestData.filter((o: { version_id?: unknown }) => o.version_id === latestVersionId);
            }
        }
        return data;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed fetching product overheads:", e);
        return [];
    }
}

/**
 * Syncs product overheads.
 */
export async function syncProductOverheads(
    productId: number,
    versionId: number,
    overheads: { id?: string | number; overheadId: number; amount: number; overheadName?: string }[]
): Promise<boolean> {
    try {
        const validOverheads = overheads.filter(o => {
            const hasOverhead = Number(o.overheadId || 0) !== 0 || String(o.overheadName || "").trim() !== "";
            const hasAmount = Number(o.amount || 0) !== 0;
            return hasOverhead || hasAmount;
        });

        const url = `${DIRECTUS_URL}/items/product_overheads?filter[product_id][_eq]=${productId}&filter[version_id][_eq]=${versionId}&limit=-1`;
        const resGet = await fetch(url, { headers, cache: "no-store" });
        const existing: { id: number }[] = resGet.ok ? (await resGet.json()).data || [] : [];
        const uiIds = new Set(validOverheads.map(o => String(o.id)));
        
        const toDelete = existing.filter(e => !uiIds.has(String(e.id)));
        for (const item of toDelete) {
            await fetch(`${DIRECTUS_URL}/items/product_overheads/${item.id}`, { method: "DELETE", headers });
        }
        
        for (const item of validOverheads) {
            const payload = {
                product_id: productId,
                version_id: versionId,
                overhead_id: Number(item.overheadId),
                amount: Number(item.amount) || 0
            };
            const isNew = isNaN(Number(item.id));
            if (isNew) {
                await fetch(`${DIRECTUS_URL}/items/product_overheads`, { method: "POST", headers, body: JSON.stringify(payload) });
            } else {
                await fetch(`${DIRECTUS_URL}/items/product_overheads/${item.id}`, { method: "PATCH", headers, body: JSON.stringify(payload) });
            }
        }
        return true;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed syncing product overheads:", e);
        return false;
    }
}


