import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { calculateRollupCost } from "./products-helper";

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
    production_capacity_per_hour?: number | null;
    has_versions?: boolean;
    currency_profile?: DirectusProductCurrencyProfile | null;
    has_cogs?: boolean;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const limit = parseInt(searchParams.get("limit") || "-1");
        const excludeRollup = searchParams.get("excludeRollup") === "true";

        const explicitFields = "product_id,product_name,product_code,description,isActive,cost_per_unit,price_per_unit,product_brand,parent_id,product_category,product_class,product_segment,product_section,product_shelf_life,product_image,unit_of_measurement.unit_shortcut,unit_of_measurement.unit_name,unit_of_measurement_count,density_factor,production_capacity_per_hour";
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

        // Resolve calculateRollupCost helper

        // Use Promise.all to compute dynamic rollup cost for each product concurrently
        const resolvedProducts = await Promise.all(products.map(async (p: DirectusProduct) => {
            const productCopy = { ...p };
            productCopy.has_versions = versionProductIds.has(Number(p.product_id));
            productCopy.currency_profile = profilesMap.get(Number(p.product_id)) || null;
            
            if (excludeRollup) {
                productCopy.has_cogs = false;
                return productCopy;
            }

            try {
                // Get rolled up cost (COGS) using current active BOM recipe & routings
                const costRollup = await calculateRollupCost(p.product_id);
                if (costRollup && costRollup.bomId !== null) {
                    productCopy.cost_per_unit = costRollup.totalBaseCost;
                    productCopy.has_cogs = true;
                } else {
                    productCopy.cost_per_unit = 0;
                    productCopy.has_cogs = false;
                }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.error(`Error calculating dynamic rollup cost for product ${p.product_id}:`, err);
                productCopy.has_cogs = false;
            }
            return productCopy;
        }));

        resolvedProducts.sort((a: DirectusProduct, b: DirectusProduct) => {
            if (a.has_versions && !b.has_versions) return -1;
            if (!a.has_versions && b.has_versions) return 1;
            return a.product_name.localeCompare(b.product_name);
        });

        return NextResponse.json(resolvedProducts);
    } catch (e) {
        console.error("API Error fetching products:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch products" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productDetails, versionName, supplierIds } = body;

        if (!productDetails || !productDetails.product_name || !productDetails.product_code || !versionName) {
            return NextResponse.json({ error: "Missing required fields (product_name, product_code, versionName)" }, { status: 400 });
        }

        // Get logged in user ID from secure access token cookie
        let userId: number | null = null;
        try {
            const cookieStore = await cookies();
            const token = cookieStore.get("vos_access_token")?.value;
            if (token) {
                const parts = token.split(".");
                if (parts.length >= 2) {
                    const base64Url = parts[1];
                    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                    while (base64.length % 4) base64 += "=";
                    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
                    const payload = JSON.parse(jsonPayload);
                    userId = payload?.id || payload?.user_id || payload?.sub || null;
                }
            }
        } catch (err) {
            console.error("Error parsing user token in POST product route:", err);
        }

        // 1. Create Product
        const productPayload = {
            ...productDetails,
            isActive: 1,
            status: "Approved",
            item_type: "regular",
            date_added: productDetails.date_added || new Date().toISOString().split("T")[0],
            created_by: userId ? Number(userId) : null
        };

        const prodRes = await fetch(`${DIRECTUS_URL}/items/products?fields=product_id`, {
            method: "POST",
            headers,
            body: JSON.stringify(productPayload)
        });
        if (!prodRes.ok) {
            const errText = await prodRes.text();
            throw new Error(`Directus failed to create product: ${prodRes.status} - ${errText}`);
        }
        const prodJson = await prodRes.json();
        const productId = prodJson.data?.product_id;

        // 2. Create Product Version
        const verRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_product_version`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                product_id: productId,
                version_name: versionName,
                created_at: new Date().toISOString()
            })
        });
        if (!verRes.ok) {
            // Rollback product
            await fetch(`${DIRECTUS_URL}/items/products/${productId}`, { method: "DELETE", headers }).catch(() => {});
            throw new Error(`Directus failed to create product version: ${verRes.status}`);
        }
        const verJson = await verRes.json();
        const versionId = verJson.data?.id;

        // 3. Create BOM
        const bomName = `BOM for ${productDetails.product_name}`;
        const bomRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_boms`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                product_id: productId,
                bom_name: bomName,
                base_quantity: 1,
                expected_yield_percentage: 100,
                is_active: true,
                version: versionId
            })
        });

        if (!bomRes.ok) {
            // Rollback version and product
            await fetch(`${DIRECTUS_URL}/items/manufacturing_product_version/${versionId}`, { method: "DELETE", headers }).catch(() => {});
            await fetch(`${DIRECTUS_URL}/items/products/${productId}`, { method: "DELETE", headers }).catch(() => {});
            throw new Error(`Directus failed to create BOM: ${bomRes.status}`);
        }
        const bomJson = await bomRes.json();

        // 4. Link selected suppliers in product_per_supplier junction table
        if (supplierIds && Array.isArray(supplierIds) && supplierIds.length > 0) {
            try {
                for (const supId of supplierIds) {
                    await fetch(`${DIRECTUS_URL}/items/product_per_supplier`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            product_id: productId,
                            supplier_id: Number(supId)
                        })
                    });
                }
            } catch (err) {
                console.error("Error linking suppliers to product:", err);
            }
        }

        return NextResponse.json({ success: true, productId, bom: bomJson.data });
    } catch (e) {
        console.error("API Error registering product:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to register product" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { product_id, production_capacity_per_hour } = body;
        if (!product_id) {
            return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
        }
        
        const res = await fetch(`${DIRECTUS_URL}/items/products/${product_id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ production_capacity_per_hour: Number(production_capacity_per_hour) })
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus PATCH failed: ${res.status} - ${errText}`);
        }
        
        const json = await res.json();
        return NextResponse.json({ success: true, data: json.data });
    } catch (e) {
        console.error("API Error patching product:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to update product" }, { status: 500 });
    }
}


