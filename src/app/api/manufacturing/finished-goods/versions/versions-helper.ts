import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { ProductVersion, RouteStep, RouteBOMItem } from "@/modules/manufacturing-management/finished-goods/types";

export async function getBOMDetailsForVersion(productId: number, versionId: number): Promise<{
    version: ProductVersion | null;
    routes: RouteStep[];
}> {
    try {
        const filter = encodeURIComponent(JSON.stringify({
            _and: [
                { product_id: { _eq: productId } },
                { version_id: { _eq: versionId } }
            ]
        }));
        
        const resVer = await fetch(`${DIRECTUS_URL}/items/product_manufacturing_version?filter=${filter}&limit=1`, { headers, cache: "no-store" });
        if (!resVer.ok) return { version: null, routes: [] };
        
        const verData = await resVer.json();
        const version: ProductVersion = verData.data?.[0];
        
        if (!version) return { version: null, routes: [] };
        
        const routesFilter = encodeURIComponent(JSON.stringify({ version_id: { _eq: version.version_id } }));
        const resRoutes = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes?filter=${routesFilter}&sort=sequence_order&limit=-1`, { headers, cache: "no-store" });
        const routesJson = await resRoutes.json();
        const routes: RouteStep[] = routesJson.data || [];
        
        if (routes.length === 0) {
            version.routes = [];
            return { version, routes: [] };
        }
        
        const routeIds = routes.map(r => r.route_id);
        const bomFilter = encodeURIComponent(JSON.stringify({ route_id: { _in: routeIds } }));
        const resBom = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom?filter=${bomFilter}&limit=-1`, { headers, cache: "no-store" });
        const bomJson = await resBom.json();
        const bomItems: RouteBOMItem[] = bomJson.data || [];
        
        routes.forEach(r => {
            r.bom_items = bomItems.filter(b => b.route_id === r.route_id);
        });
        
        version.routes = routes;
        return { version, routes };
    } catch (e) {
        console.error(`[Versions Helper] Error fetching version details for version ID ${versionId}:`, e);
        return { version: null, routes: [] };
    }
}

export async function getActiveVersionForProduct(productId: number): Promise<{
    version: ProductVersion | null;
    routes: RouteStep[];
}> {
    try {
        // 1. Fetch active version
        const filter = encodeURIComponent(JSON.stringify({
            product_id: { _eq: productId },
            status: { _eq: "Active" }
        }));
        const resVer = await fetch(`${DIRECTUS_URL}/items/product_manufacturing_version?filter=${filter}&limit=1`, { headers, cache: "no-store" });
        if (!resVer.ok) return { version: null, routes: [] };
        
        const verJson = await resVer.json();
        const version: ProductVersion = verJson.data?.[0];
        if (!version) return { version: null, routes: [] };

        return getBOMDetailsForVersion(productId, version.version_id);
    } catch (e) {
        console.error(`[Versions Helper] Error fetching active version for product ID ${productId}:`, e);
        return { version: null, routes: [] };
    }
}

export async function createProductVersion(
    productId: number, 
    versionName: string, 
    expectedYield: number = 100, 
    baseQuantity: number = 1, 
    uomId?: number | null
): Promise<number | null> {
    try {
        const url = `${DIRECTUS_URL}/items/product_manufacturing_version`;
        const payload = {
            product_id: productId,
            version_name: versionName,
            expected_yield_percentage: expectedYield,
            base_quantity: baseQuantity,
            uom_id: uomId || null,
            status: "For Approval",
            valid_from: new Date().toISOString().split("T")[0]
        };
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Failed to create product version: ${res.status}`);
        const json = await res.json();
        return json.data?.version_id || null;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed product version registration:", e);
        return null;
    }
}

export async function updateProductStandardCost(productId: number, standardCost: number): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/products/${productId}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ cost_per_unit: standardCost })
        });
        return res.ok;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed standard cost update:", e);
        return false;
    }
}
