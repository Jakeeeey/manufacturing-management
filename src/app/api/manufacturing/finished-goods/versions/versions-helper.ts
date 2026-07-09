import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { 
    DirectusBOM, 
    DirectusBOMComponent, 
    DirectusRouting 
} from "@/modules/manufacturing-management/finished-goods/types";

export async function getActiveBOMForProduct(productId: number): Promise<{
    bom: DirectusBOM | null;
    components: DirectusBOMComponent[];
    routings: DirectusRouting[];
}> {
    try {
        const filter = encodeURIComponent(JSON.stringify({
            product_id: { _eq: productId }
        }));
        
        const resBOM = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms?filter=${filter}&fields=*,version.*&limit=-1`, { headers, cache: "no-store" });
        if (!resBOM.ok) return { bom: null, components: [], routings: [] };
        
        const bomData = await resBOM.json();
        const boms: DirectusBOM[] = bomData.data || [];
        
        if (boms.length === 0) return { bom: null, components: [], routings: [] };
        
        const sortedBoms = [...boms].sort((a, b) => {
            const versionA = a.version && typeof a.version === "object" ? a.version : null;
            const versionB = b.version && typeof b.version === "object" ? b.version : null;
            const timeA = versionA?.created_at ? new Date(versionA.created_at).getTime() : 0;
            const timeB = versionB?.created_at ? new Date(versionB.created_at).getTime() : 0;
            
            if (timeA !== timeB) return timeB - timeA;
            
            const idA = versionA ? versionA.id : 0;
            const idB = versionB ? versionB.id : 0;
            if (idA !== idB) return idB - idA;
            
            return b.bom_id - a.bom_id;
        });
        
        const activeBOM = sortedBoms[0];
        
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
        console.error(`[Manufacturing Directus API] Error fetching active BOM for product ID ${productId}:`, e);
        return { bom: null, components: [], routings: [] };
    }
}

export async function createProductVersion(productId: number, versionName: string): Promise<number | null> {
    try {
        const url = `${DIRECTUS_URL}/items/manufacturing_product_version`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                product_id: productId,
                version_name: versionName,
                created_at: new Date().toISOString()
            })
        });
        if (!res.ok) throw new Error("Failed to create product version");
        const json = await res.json();
        return json.data?.id || null;
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


