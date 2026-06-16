import { NextResponse } from "next/server";
import { fetchPaymentTerms } from "../directus-api";

export async function GET() {
    try {
        const terms = await fetchPaymentTerms();
        return NextResponse.json(terms);
    } catch (e: any) {
        console.error("API Error fetching payment terms:", e);
        return NextResponse.json({ error: e.message || "Failed to fetch payment terms" }, { status: 500 });
    }
}
