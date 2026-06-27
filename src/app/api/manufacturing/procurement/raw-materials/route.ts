import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productDetails, supplierIds } = body;

        if (!productDetails || !productDetails.product_name || !productDetails.product_code) {
            return NextResponse.json({ error: "Missing required fields (product_name, product_code)" }, { status: 400 });
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
            console.error("Error parsing user token in POST raw-materials route:", err);
        }

        // Check if a product with the same name already exists in Directus
        const checkRes = await fetch(`${DIRECTUS_URL}/items/products?filter[product_name][_eq]=${encodeURIComponent(productDetails.product_name)}&limit=1`, { headers });
        if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.data && checkData.data.length > 0) {
                return NextResponse.json({ error: "A material with this name already exists. Please choose a unique name." }, { status: 400 });
            }
        }

        // Create Raw Material / Packaging Product with explicit null overrides for foreign keys to bypass invalid database defaults
        const productPayload = {
            ...productDetails,
            product_brand: productDetails.product_brand !== undefined ? productDetails.product_brand : null,
            product_category: productDetails.product_category !== undefined ? productDetails.product_category : null,
            product_class: productDetails.product_class !== undefined ? productDetails.product_class : null,
            product_segment: productDetails.product_segment !== undefined ? productDetails.product_segment : null,
            product_section: productDetails.product_section !== undefined ? productDetails.product_section : null,
            isActive: 1,
            status: "Approved",
            item_type: "regular", // Must be regular due to DB enum constraint
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
            throw new Error(`Directus failed to create raw material product: ${prodRes.status} - ${errText}`);
        }
        const prodJson = await prodRes.json();
        const productId = prodJson.data?.product_id;

        // Link selected suppliers in product_per_supplier junction table
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
                console.error("Error linking suppliers to raw material:", err);
            }
        }

        return NextResponse.json({ success: true, productId });
    } catch (e) {
        console.error("API Error registering raw material:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to register raw material" }, { status: 500 });
    }
}


