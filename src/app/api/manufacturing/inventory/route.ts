import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "../directus-api";

export async function GET() {
    try {
        const [ledgerRes, batchesRes, productsRes] = await Promise.all([
            fetch(`${DIRECTUS_URL}/items/product_ledger?limit=100&sort=-id`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/shipment_line_items?limit=200&sort=-line_id`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/products?limit=500&fields=product_id,product_name,product_code,product_brand.brand_id,product_brand.brand_name,product_category.category_id,product_category.category_name,unit_of_measurement.unit_shortcut,unit_of_measurement.unit_name,cost_per_unit,product_shelf_life`, { headers, cache: "no-store" })
        ]);



        if (!ledgerRes.ok) throw new Error("Failed to fetch product_ledger from Directus");
        if (!batchesRes.ok) throw new Error("Failed to fetch shipment_line_items from Directus");
        if (!productsRes.ok) throw new Error("Failed to fetch products from Directus");

        const ledger = (await ledgerRes.json()).data || [];
        const batches = (await batchesRes.json()).data || [];
        const products = (await productsRes.json()).data || [];

        return NextResponse.json({
            ledger,
            batches,
            products
        });
    } catch (e) {
        console.error("[Inventory BFF GET] Error:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch inventory logs" }, { status: 500 });
    }
}
