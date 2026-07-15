import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "../_auth";
import { allocateInvoice } from "../_reservation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const userId = await getCurrentUserId();
        if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { invoiceId } = await req.json();
        if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
            return NextResponse.json({ message: "A valid invoiceId is required" }, { status: 400 });
        }

        const result = await allocateInvoice(invoiceId, userId);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error("manufacturing invoicing allocate error:", error);
        return NextResponse.json({ message: error instanceof Error ? error.message : "Allocation failed" }, { status: 409 });
    }
}
