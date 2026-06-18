import { NextResponse } from "next/server";
import { 
    fetchQuotations, 
    saveQuotation 
} from "../../directus-api";

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

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { quoteId, status } = body;

        if (!quoteId || !status) {
            return NextResponse.json({ error: "Missing quoteId or status" }, { status: 400 });
        }

        const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
        const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "test";
        const reqHeaders: Record<string, string> = {
            "Content-Type": "application/json"
        };
        if (DIRECTUS_STATIC_TOKEN) {
            reqHeaders["Authorization"] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
        }
        const res = await fetch(`${DIRECTUS_URL}/items/quotation_header/${quoteId}`, {
            method: "PATCH",
            headers: reqHeaders,
            body: JSON.stringify({ status })
        });

        if (!res.ok) throw new Error(`Failed to update quotation status: ${res.status}`);

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error updating quotation status:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to update quotation status" }, { status: 500 });
    }
}
