import { NextResponse } from "next/server";
import { 
    calculateDynamicBOMCost,
    getBOMDetailsForVersion
} from "@/modules/manufacturing-management/services/manufacturing-service";

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
            const details = await getBOMDetailsForVersion(parseInt(productIdStr), parseInt(versionIdStr));
            if (details && details.bom) {
                bomId = details.bom.bom_id;
            }
        }

        if (!bomId) {
            return NextResponse.json({ cost: 0 });
        }

        const cost = await calculateDynamicBOMCost(bomId, forexRate);
        return NextResponse.json({ cost });

    } catch (e) {
        console.error("API Error calculating BOM cost:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to calculate cost" }, { status: 500 });
    }
}

