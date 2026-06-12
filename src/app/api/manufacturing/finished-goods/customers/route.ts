import { NextResponse } from "next/server";
import { fetchCustomers } from "@/modules/manufacturing-management/services/manufacturing-service";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const customers = await fetchCustomers(search);
        return NextResponse.json(customers);
    } catch (e) {
        console.error("API Error fetching customers:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch customers" }, { status: 500 });
    }
}
