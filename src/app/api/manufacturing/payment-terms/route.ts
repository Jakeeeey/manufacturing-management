import { NextResponse } from "next/server";
import { fetchPaymentTerms } from "./payment-helper";

export async function GET() {
    try {
        const terms = await fetchPaymentTerms();
        return NextResponse.json(terms);
    } catch (e) {
        console.error("API Error fetching payment terms:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch payment terms" }, { status: 500 });
    }
}
