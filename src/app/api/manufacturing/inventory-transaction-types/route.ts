import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { TransactionTypeLookup } from "@/modules/manufacturing-management/inventory-reports/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DirectusTransactionTypeRaw {
    transaction_type_id: number;
    type_name: string;
    direction: "IN" | "OUT" | "NEUTRAL";
}

export async function GET() {
    try {
        const res = await fetch(
            `${DIRECTUS_URL}/items/inventory_transaction_types?limit=-1&sort=transaction_type_id`,
            { headers, cache: "no-store" }
        );

        if (!res.ok) {
            throw new Error(`Directus failed to fetch inventory transaction types: ${res.status}`);
        }

        const json = await res.json();
        const data: DirectusTransactionTypeRaw[] = json.data || [];

        const mapped: TransactionTypeLookup[] = data.map((item) => ({
            transactionTypeId: item.transaction_type_id,
            typeName: item.type_name,
            direction: item.direction
        }));

        return NextResponse.json(mapped);
    } catch (e) {
        console.error("API Error fetching transaction types lookup:", e);
        return NextResponse.json(
            { error: (e as { message?: string }).message || "Failed to fetch transaction types lookup" },
            { status: 500 }
        );
    }
}
