import { NextResponse } from "next/server";
import { 
    fetchQuotations, 
    saveQuotation 
} from "@/modules/manufacturing-management/services/manufacturing-service";

export async function GET() {
    try {
        const quotes = await fetchQuotations();
        return NextResponse.json(quotes);
    } catch (e) {
        console.error("API Error fetching quotations:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch quotations" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { header, snapshots } = body;
        
        if (!header || !header.quote_number || !header.customer_id || !snapshots || snapshots.length === 0) {
            return NextResponse.json({ error: "Missing required quote header or snapshot fields" }, { status: 400 });
        }

        const result = await saveQuotation(header, snapshots);
        return NextResponse.json(result);
    } catch (e) {
        console.error("API Error saving quotation snapshot:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to save quotation snapshot" }, { status: 500 });
    }
}
