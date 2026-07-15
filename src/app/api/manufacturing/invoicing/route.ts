import { NextRequest, NextResponse } from "next/server";
import { getInvoiceReservationSummaries } from "./_reservation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const branchId = Number(searchParams.get("branchId"));
        const search = searchParams.get("search") || undefined;
        if (!branchId || !Number.isInteger(branchId)) {
            return NextResponse.json({ message: "branchId is required" }, { status: 400 });
        }

        const invoices = await getInvoiceReservationSummaries(branchId, search);
        return NextResponse.json({ invoices });
    } catch (error) {
        console.error("manufacturing invoicing GET error:", error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Failed to load invoices" }, { status: 502 });
    }
}
