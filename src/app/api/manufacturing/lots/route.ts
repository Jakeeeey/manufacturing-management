import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { Lot, DirectusLot } from "@/modules/manufacturing-management/lot-management/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    // Auto-register "Lot Management" module in Directus sidebar
    try {
        const checkRes = await fetch(
            `${DIRECTUS_URL}/items/modules?filter[slug][_eq]=lot-management`,
            { headers }
        );
        if (checkRes.ok) {
            const checkJson = await checkRes.json();
            if (!checkJson.data || checkJson.data.length === 0) {
                await fetch(`${DIRECTUS_URL}/items/modules`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        title: "Lot Management",
                        slug: "lot-management",
                        base_path: "/mm/lot-management",
                        icon_name: "Warehouse",
                        status: "active",
                        sort: 7,
                        subsystem_id: 8
                    })
                });
                console.log("[Auto-Registration] Registered Lot Management module in Directus modules collection");
            }
        }
    } catch (err) {
        console.error("[Auto-Registration] Failed to check/register Lot Management module:", err);
    }

    // Main fetch
    try {
        const fields = [
            "lot_id",
            "lot_name",
            "inventory_type_id.id",
            "inventory_type_id.name",
            "max_batch_capacity",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by"
        ].join(",");

        const res = await fetch(
            `${DIRECTUS_URL}/items/lots?limit=-1&sort=lot_id&fields=${fields}`,
            { headers, cache: "no-store" }
        );

        if (!res.ok) {
            throw new Error(`Directus failed to fetch lots: ${res.status}`);
        }

        const json = await res.json();
        const rawLots: DirectusLot[] = json.data || [];

        const mappedLots: Lot[] = rawLots.map((row) => {
            let inventoryTypeId = 0;
            let inventoryTypeName = "Unknown";

            if (row.inventory_type_id && typeof row.inventory_type_id === "object") {
                inventoryTypeId = row.inventory_type_id.id;
                inventoryTypeName = row.inventory_type_id.name;
            } else if (typeof row.inventory_type_id === "number") {
                inventoryTypeId = row.inventory_type_id;
            }

            let createdBy = "System";
            if (row.created_by) {
                createdBy = typeof row.created_by === "object"
                    ? (row.created_by.username || `User #${row.created_by.user_id}`)
                    : `User #${row.created_by}`;
            }

            let updatedBy = "System";
            if (row.updated_by) {
                updatedBy = typeof row.updated_by === "object"
                    ? (row.updated_by.username || `User #${row.updated_by.user_id}`)
                    : `User #${row.updated_by}`;
            }

            return {
                lotId: row.lot_id,
                lotName: row.lot_name,
                inventoryTypeId,
                inventoryTypeName,
                maxBatchCapacity: row.max_batch_capacity,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                createdBy,
                updatedBy
            };
        });

        return NextResponse.json(mappedLots);
    } catch (e) {
        console.error("API Error fetching lots:", e);
        return NextResponse.json(
            { error: (e as { message?: string }).message || "Failed to fetch lots" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { lot_name, inventory_type_id, max_batch_capacity } = body;

        if (!lot_name || typeof lot_name !== "string" || !lot_name.trim()) {
            return NextResponse.json(
                { error: "lot_name is required and must be a non-empty string" },
                { status: 400 }
            );
        }

        if (typeof inventory_type_id !== "number") {
            return NextResponse.json(
                { error: "inventory_type_id is required and must be a number" },
                { status: 400 }
            );
        }

        if (typeof max_batch_capacity !== "number" || max_batch_capacity <= 0) {
            return NextResponse.json(
                { error: "max_batch_capacity must be a positive number greater than 0" },
                { status: 400 }
            );
        }

        // Get logged in user ID from secure access token cookie
        let userId: number | null = null;
        try {
            const cookieStore = await cookies();
            const token = cookieStore.get("vos_access_token")?.value;
            if (token) {
                const parts = token.split(".");
                if (parts.length >= 2) {
                    const base64Url = parts[1];
                    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                    while (base64.length % 4) base64 += "=";
                    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
                    const payload = JSON.parse(jsonPayload);
                    userId = payload?.id || payload?.user_id || payload?.sub || null;
                }
            }
        } catch (err) {
            console.error("Error parsing user token in POST lot route:", err);
        }

        // Check for duplicate lot name
        const duplicateCheckRes = await fetch(
            `${DIRECTUS_URL}/items/lots?filter[lot_name][_eq]=${encodeURIComponent(lot_name.trim())}&limit=1&fields=lot_id`,
            { headers, cache: "no-store" }
        );
        if (duplicateCheckRes.ok) {
            const duplicateJson = await duplicateCheckRes.json();
            if (duplicateJson.data && duplicateJson.data.length > 0) {
                return NextResponse.json(
                    { error: `A lot with the name "${lot_name.trim()}" already exists` },
                    { status: 409 }
                );
            }
        }

        // Generate current Manila time (UTC+8) to save in Directus
        const now = new Date();
        const manilaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const manilaIsoString = manilaTime.toISOString();

        const res = await fetch(`${DIRECTUS_URL}/items/lots`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                lot_name: lot_name.trim(),
                inventory_type_id,
                max_batch_capacity,
                created_by: userId ? Number(userId) : 24, // Fallback to seed user ID 24 if no active token
                created_at: manilaIsoString,
                updated_at: manilaIsoString
            })
        });

        if (!res.ok) {
            const errTxt = await res.text();
            throw new Error(`Directus failed to create lot: ${res.status} - ${errTxt}`);
        }

        const resJson = await res.json();
        const saved = resJson.data;

        return NextResponse.json({ success: true, data: saved });
    } catch (e) {
        console.error("API Error creating lot:", e);
        return NextResponse.json(
            { error: (e as { message?: string }).message || "Failed to create lot" },
            { status: 500 }
        );
    }
}
