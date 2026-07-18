import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    // Auto-register "Item Management" module in Directus modules list if not exists
    try {
        const checkRes = await fetch(
            `${DIRECTUS_URL}/items/modules?filter[slug][_eq]=item-management`,
            { headers }
        );
        if (checkRes.ok) {
            const checkJson = await checkRes.json();
            if (!checkJson.data || checkJson.data.length === 0) {
                await fetch(`${DIRECTUS_URL}/items/modules`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        title: "Item Management",
                        slug: "item-management",
                        base_path: "/mm/item-management",
                        icon_name: "Boxes",
                        status: "active",
                        sort: 8,
                        subsystem_id: 8 // Manufacturing Management
                    })
                });
                console.log("[Auto-Registration] Registered Item Management module in Directus");
            }
        }
    } catch (err) {
        console.error("[Auto-Registration] Failed to check/register Item Management module:", err);
    }

    try {
        const res = await fetch(
            `${DIRECTUS_URL}/items/items?limit=-1&fields=id,item_name,item_type.id,item_type.type_name,item_classification.id,item_classification.classification_name`,
            { headers, cache: "no-store" }
        );
        if (!res.ok) {
            throw new Error(`Directus failed to fetch items: ${res.status}`);
        }
        const json = await res.json();
        return NextResponse.json(json.data || []);
    } catch (e) {
        console.error("API Error fetching items:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Failed to fetch items" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { item_name, item_type, item_classification } = body;

        if (!item_name || !item_name.trim()) {
            return NextResponse.json({ error: "Missing required field: item_name" }, { status: 400 });
        }
        if (!item_type) {
            return NextResponse.json({ error: "Missing required field: item_type" }, { status: 400 });
        }
        if (!item_classification) {
            return NextResponse.json({ error: "Missing required field: item_classification" }, { status: 400 });
        }

        const trimmedName = item_name.trim();

        // Case-insensitive duplicate check via Directus fetch
        const checkRes = await fetch(
            `${DIRECTUS_URL}/items/items?limit=-1&fields=item_name`,
            { headers, cache: "no-store" }
        );
        if (checkRes.ok) {
            const checkJson = await checkRes.json();
            const items = checkJson.data || [];
            const isDuplicate = items.some(
                (item: { item_name?: string }) =>
                    item.item_name?.trim().toLowerCase() === trimmedName.toLowerCase()
            );
            if (isDuplicate) {
                return NextResponse.json(
                    { error: "Item name already exists. Please choose a unique name." },
                    { status: 400 }
                );
            }
        }

        const payload = {
            item_name: trimmedName,
            item_type: Number(item_type),
            item_classification: Number(item_classification)
        };

        const res = await fetch(`${DIRECTUS_URL}/items/items`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to create item: ${res.status} - ${errText}`);
        }

        const json = await res.json();
        return NextResponse.json({ success: true, item: json.data });
    } catch (e) {
        console.error("API Error creating item:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Failed to create item" },
            { status: 500 }
        );
    }
}
