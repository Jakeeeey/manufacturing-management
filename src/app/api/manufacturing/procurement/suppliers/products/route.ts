import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "../../_directus";
import { fetchProductsBySupplier } from "../suppliers-helper";

const TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504]);

function wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function linkExists(linkId: string): Promise<boolean | null> {
    try {
        const response = await fetch(`${DIRECTUS_URL}/items/product_per_supplier/${linkId}`, {
            headers,
            cache: "no-store"
        });
        if (response.status === 404) return false;
        if (response.ok) return true;
        return null;
    } catch {
        return null;
    }
}

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

        let res: Response | null = null;
        let networkError: unknown = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            networkError = null;
            try {
                res = await fetch(`${DIRECTUS_URL}/items/product_per_supplier/${linkId}`, {
                    method: "DELETE",
                    headers
                });
            } catch (error) {
                networkError = error;
            }

            if (res?.ok || res?.status === 404) {
                return NextResponse.json({ success: true });
            }

            const isTransientFailure = networkError !== null || (res !== null && TRANSIENT_UPSTREAM_STATUSES.has(res.status));
            if (!isTransientFailure || attempt === 1) break;

            // A failed response can mean Directus completed the delete but the
            // response was lost. Check the desired state before retrying.
            if (await linkExists(linkId) === false) {
                return NextResponse.json({ success: true });
            }
            await wait(250);
        }

        if (networkError !== null || res === null) {
            return NextResponse.json({ error: "The product unlink service is temporarily unavailable. Please try again." }, { status: 503 });
        }

        let errorMessage = `Failed to unlink product: ${res.statusText || res.status}`;
        try {
            const errorJson = await res.json();
            if (errorJson.errors?.[0]?.message) errorMessage = errorJson.errors[0].message;
        } catch {}

        const status = TRANSIENT_UPSTREAM_STATUSES.has(res.status) ? res.status : 500;
        return NextResponse.json({ error: errorMessage }, { status });
    } catch (e) {
        console.error("API Error unlinking product:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to unlink product" }, { status: 500 });
    }
}
