import { NextResponse } from "next/server";
import { 
    fetchProductVersions, 
    createActiveBOM, 
    registerNewBOMVersion 
} from "@/modules/manufacturing-management/services/manufacturing-service";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productIdStr = searchParams.get("productId");
        if (!productIdStr) {
            return NextResponse.json({ error: "Missing productId query parameter" }, { status: 400 });
        }
        const productId = parseInt(productIdStr);
        if (isNaN(productId)) {
            return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
        }

        const versions = await fetchProductVersions(productId);
        return NextResponse.json(versions);
    } catch (e) {
        console.error("API Error fetching versions:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch versions" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, baseBomId, expectedYield, bomName, versionName } = body;

        if (!productId || !versionName) {
            return NextResponse.json({ error: "Missing required fields (productId, versionName)" }, { status: 400 });
        }

        const numericProductId = parseInt(productId);
        const yieldPercent = Number(expectedYield) || 100;

        if (baseBomId) {
            // Clone and register version
            const newBom = await registerNewBOMVersion(
                numericProductId,
                parseInt(baseBomId),
                yieldPercent,
                bomName || `BOM for product ${productId}`,
                versionName
            );
            if (!newBom) {
                return NextResponse.json({ error: "Failed to clone and register version in Directus." }, { status: 500 });
            }
            return NextResponse.json({ success: true, bom: newBom });
        } else {
            // Register initial version
            const newBom = await createActiveBOM(
                numericProductId,
                yieldPercent,
                bomName || `BOM for product ${productId}`,
                versionName
            );
            if (!newBom) {
                return NextResponse.json({ error: "Failed to register initial version in Directus." }, { status: 500 });
            }
            return NextResponse.json({ success: true, bom: newBom });
        }
    } catch (e) {
        console.error("API Error registering version:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to register version" }, { status: 500 });
    }
}
