import { NextResponse } from "next/server";
import { fetchAllProducts, registerProductWithBOM } from "@/modules/manufacturing-management/services/manufacturing-service";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const limit = parseInt(searchParams.get("limit") || "-1");

        const products = await fetchAllProducts(search, limit);
        return NextResponse.json(products);
    } catch (e) {
        console.error("API Error fetching products:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch products" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productDetails, versionName } = body;

        if (!productDetails || !productDetails.product_name || !productDetails.product_code || !versionName) {
            return NextResponse.json({ error: "Missing required fields (product_name, product_code, versionName)" }, { status: 400 });
        }

        const result = await registerProductWithBOM(productDetails, versionName);
        if (!result) {
            return NextResponse.json({ error: "Failed to register product and initial BOM version" }, { status: 500 });
        }

        return NextResponse.json({ success: true, ...result });
    } catch (e) {
        console.error("API Error registering product:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to register product" }, { status: 500 });
    }
}
