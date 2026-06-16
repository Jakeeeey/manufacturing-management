import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "test";

const headers: Record<string, string> = {
    "Content-Type": "application/json"
};
if (DIRECTUS_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
}

interface DirectusProductCurrencyProfile {
    id: number;
    product_id: number;
    is_foreign_sourced: boolean;
    purchase_currency: "PHP" | "USD";
    purchase_price: number | null;
}

interface DirectusProduct {
    product_id: number;
    product_name: string;
    product_code: string;
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

async function fetchAllProducts(): Promise<DirectusProduct[]> {
    const url = `${DIRECTUS_URL}/items/products?limit=-1&fields=*,unit_of_measurement.*,product_category.*,parent_id.*`;
    const [prodRes, versionsRes, profilesRes] = await Promise.all([
        fetch(url, { headers, cache: "no-store" }),
        fetch(`${DIRECTUS_URL}/items/manufacturing_product_version?limit=-1&fields=product_id`, { headers, cache: "no-store" }),
        fetch(`${DIRECTUS_URL}/items/product_currency_profiles?limit=-1`, { headers, cache: "no-store" })
    ]);

    if (!prodRes.ok) throw new Error("Failed to fetch products");
    const products = (await prodRes.json()).data || [];
    const versionProductIds = new Set<number>();
    if (versionsRes.ok) {
        const versions = (await versionsRes.json()).data || [];
        versions.forEach((v: any) => v.product_id && versionProductIds.add(Number(v.product_id)));
    }
    const profiles = profilesRes.ok ? (await profilesRes.json()).data || [] : [];
    const profilesMap = new Map();
    profiles.forEach((p: any) => profilesMap.set(Number(p.product_id), p));

    products.forEach((p: any) => {
        p.has_versions = versionProductIds.has(Number(p.product_id));
        p.currency_profile = profilesMap.get(Number(p.product_id)) || null;
    });
    return products;
}

async function getLatestLandedCost(productId: number, forexRate: number): Promise<number> {
    const resProfile = await fetch(`${DIRECTUS_URL}/items/product_currency_profiles?filter[product_id][_eq]=${productId}&limit=1`, { headers, cache: "no-store" });
    if (resProfile.ok) {
        const profile = (await resProfile.json()).data?.[0];
        if (profile && profile.is_foreign_sourced && profile.purchase_currency === "USD" && profile.purchase_price) {
            return Number(profile.purchase_price) * forexRate;
        }
    }

    const query = encodeURIComponent(JSON.stringify({
        _and: [
            { product_id: { _eq: productId } },
            { shipment_id: { status: { _in: ["Received", "Receiving (QA)"] } } }
        ]
    }));
    const res = await fetch(`${DIRECTUS_URL}/items/shipment_line_items?filter=${query}&fields=*,shipment_id.date_received&sort=-shipment_id.date_received&limit=1`, { headers, cache: "no-store" });
    if (res.ok) {
        const latest = (await res.json()).data?.[0];
        if (latest && latest.final_landed_unit_cost) {
            return Number(latest.final_landed_unit_cost);
        }
    }

    const resProd = await fetch(`${DIRECTUS_URL}/items/products/${productId}?fields=price_per_unit,cost_per_unit`, { headers });
    if (resProd.ok) {
        const p = (await resProd.json()).data;
        return Number(p?.cost_per_unit || p?.price_per_unit || 0);
    }
    return 0;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const bomIdStr = searchParams.get("bomId");
        const productIdStr = searchParams.get("productId");
        const versionIdStr = searchParams.get("versionId");
        const forexRateStr = searchParams.get("forexRate");

        const forexRate = forexRateStr ? parseFloat(forexRateStr) : 58.00;
        let bomId: number | null = null;

        if (bomIdStr) {
            bomId = parseInt(bomIdStr);
        } else if (productIdStr && versionIdStr) {
            const filter = encodeURIComponent(JSON.stringify({
                _and: [
                    { product_id: { _eq: parseInt(productIdStr) } },
                    { version: { _eq: parseInt(versionIdStr) } }
                ]
            }));
            const resBOM = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms?filter=${filter}&limit=1`, { headers, cache: "no-store" });
            if (resBOM.ok) {
                const bom = (await resBOM.json()).data?.[0];
                if (bom) bomId = bom.bom_id;
            }
        } else if (productIdStr) {
            const filter = encodeURIComponent(JSON.stringify({
                product_id: { _eq: parseInt(productIdStr) }
            }));
            const resBOM = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms?filter=${filter}&fields=*,version.*&limit=-1`, { headers, cache: "no-store" });
            if (resBOM.ok) {
                const boms = (await resBOM.json()).data || [];
                const sortedBoms = [...boms].sort((a: any, b: any) => {
                    const timeA = a.version && typeof a.version === "object" && a.version.created_at
                        ? new Date(a.version.created_at).getTime()
                        : 0;
                    const timeB = b.version && typeof b.version === "object" && b.version.created_at
                        ? new Date(b.version.created_at).getTime()
                        : 0;
                    if (timeA !== timeB) return timeB - timeA;
                    const idA = a.version && typeof a.version === "object" ? a.version.id : 0;
                    const idB = b.version && typeof b.version === "object" ? b.version.id : 0;
                    if (idA !== idB) return idB - idA;
                    return b.bom_id - a.bom_id;
                });
                if (sortedBoms.length > 0) bomId = sortedBoms[0].bom_id;
            }
        }

        if (!bomId) {
            return NextResponse.json({ cost: 0, hasCogs: false });
        }

        // Calculate cost directly
        const compFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: bomId } }));
        const resComp = await fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components?filter=${compFilter}&limit=-1`, { headers, cache: "no-store" });
        if (!resComp.ok) throw new Error("Failed to load components");
        const components = (await resComp.json()).data || [];

        const allProducts = await fetchAllProducts();
        let totalMaterialCost = 0;

        for (const comp of components) {
            const compProduct = allProducts.find(p => p.product_id === comp.component_product_id);
            if (!compProduct) continue;

            let lowestCost = comp.landed_cost && Number(comp.landed_cost) > 0 ? Number(comp.landed_cost) : Infinity;

            if (lowestCost === Infinity) {
                const nameToMatch = compProduct.product_name.trim().toLowerCase();
                const matchingProducts = allProducts.filter(p => p.product_name.trim().toLowerCase() === nameToMatch);

                for (const p of matchingProducts) {
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

        const routFilter = encodeURIComponent(JSON.stringify({ bom_id: { _eq: bomId } }));
        const resRout = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings?filter=${routFilter}&limit=-1`, { headers, cache: "no-store" });
        let totalRoutingCost = 0;
        if (resRout.ok) {
            const routings = (await resRout.json()).data || [];
            for (const r of routings) {
                totalRoutingCost += Number(r.estimated_labor_cost) + (Number(r.estimated_overhead_cost) * Number(r.duration_hours));
            }
        }

        return NextResponse.json({ cost: totalMaterialCost + totalRoutingCost, hasCogs: true });

    } catch (e: any) {
        console.error("API Error calculating BOM cost:", e);
        return NextResponse.json({ error: e.message || "Failed to calculate cost" }, { status: 500 });
    }
}
