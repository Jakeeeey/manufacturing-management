import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const res = await fetch(`${DIRECTUS_URL}/items/item_type?limit=-1`, { headers, cache: "no-store" });
        if (!res.ok) {
            throw new Error(`Directus failed to fetch item types: ${res.status}`);
        }
        const json = await res.json();
        return NextResponse.json(json.data || []);
    } catch (e) {
        console.error("API Error fetching item types:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Failed to fetch item types" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
        }

        const trimmedName = name.trim();

        // Case-insensitive duplicate check
        const checkRes = await fetch(
            `${DIRECTUS_URL}/items/item_type?limit=-1&fields=type_name`,
            { headers, cache: "no-store" }
        );
        if (checkRes.ok) {
            const checkJson = await checkRes.json();
            const types = checkJson.data || [];
            const isDuplicate = types.some(
                (t: { type_name?: string }) =>
                    t.type_name?.trim().toLowerCase() === trimmedName.toLowerCase()
            );
            if (isDuplicate) {
                return NextResponse.json(
                    { error: "Item type already exists. Please choose a unique name." },
                    { status: 400 }
                );
            }
        }

        const res = await fetch(`${DIRECTUS_URL}/items/item_type`, {
            method: "POST",
            headers,
            body: JSON.stringify({ type_name: trimmedName })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to create item type: ${res.status} - ${errText}`);
        }

        const json = await res.json();
        return NextResponse.json({ success: true, type: json.data });
    } catch (e) {
        console.error("API Error creating item type:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Failed to create item type" },
            { status: 500 }
        );
    }
}
