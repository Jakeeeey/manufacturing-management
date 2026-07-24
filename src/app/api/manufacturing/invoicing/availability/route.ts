import { NextResponse } from "next/server";
import { getUserIdFromToken } from "../../invoice-consolidation/_auth";
import { calculateSalesOrderAvailability } from "../../invoice-consolidation/_reservation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        if (!(await getUserIdFromToken())) {
            return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const salesOrderId = Number(searchParams.get("salesOrderId"));
        if (!Number.isSafeInteger(salesOrderId) || salesOrderId < 1) {
            return NextResponse.json({ error: "salesOrderId query parameter is required." }, { status: 400 });
        }

        const result = await calculateSalesOrderAvailability(salesOrderId);
        return NextResponse.json(result);
    } catch (error) {
        console.error("[Invoicing availability] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to calculate availability." },
            { status: 500 }
        );
    }
}
