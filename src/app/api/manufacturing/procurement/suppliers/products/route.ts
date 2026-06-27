import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { fetchProductsBySupplier } from "../suppliers-helper";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const supplierId = searchParams.get("supplierId");
        if (!supplierId) {
            return NextResponse.json({ error: "Supplier ID is required" }, { status: 400 });
        }
        const products = await fetchProductsBySupplier(Number(supplierId));
        return NextResponse.json(products);
    } catch (e) {
        console.error("API Error fetching linked products:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch linked products" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { supplierId, productId } = body;
        if (!supplierId || !productId) {
            return NextResponse.json({ error: "supplierId and productId are required" }, { status: 400 });
        }

        const res = await fetch(`${DIRECTUS_URL}/items/product_per_supplier`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                supplier_id: Number(supplierId),
                product_id: Number(productId)
            })
        });

        if (!res.ok) {
            let errorMsg = `Failed to link product: ${res.status}`;
            try {
                const errorJson = await res.json();
                if (errorJson.errors && errorJson.errors[0]?.message) {
                    errorMsg = errorJson.errors[0].message;
                }
            } catch {}
            throw new Error(errorMsg);
        }

        const data = (await res.json()).data;
        return NextResponse.json({ success: true, data });
    } catch (e) {
        console.error("API Error linking product to supplier:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to link product" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const linkId = searchParams.get("linkId");
        if (!linkId) {
            return NextResponse.json({ error: "Link ID is required" }, { status: 400 });
        }

        const res = await fetch(`${DIRECTUS_URL}/items/product_per_supplier/${linkId}`, {
            method: "DELETE",
            headers
        });

        if (!res.ok) {
            throw new Error(`Failed to unlink product: ${res.statusText}`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error unlinking product:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to unlink product" }, { status: 500 });
    }
}
