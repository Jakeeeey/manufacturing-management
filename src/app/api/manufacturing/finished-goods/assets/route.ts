import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function GET() {
    // Elegant Auto-Registration side-effect
    try {
        const checkRes = await fetch(`${DIRECTUS_URL}/items/modules?filter[slug][_eq]=assets-equipment`, { headers });
        if (checkRes.ok) {
            const checkJson = await checkRes.json();
            if (!checkJson.data || checkJson.data.length === 0) {
                await fetch(`${DIRECTUS_URL}/items/modules`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        title: "Asset & Equipment Management",
                        slug: "assets-equipment",
                        base_path: "/mm/assets",
                        icon_name: "Wrench",
                        status: "active",
                        sort: 6,
                        subsystem_id: 8
                    })
                });
                console.log("[Auto-Registration] Registered Assets & Equipment module in Directus modules collection");
            }
        }
    } catch (err) {
        console.error("[Auto-Registration] Failed to check/register Assets & Equipment module:", err);
    }

    try {
        const res = await fetch(
            `${DIRECTUS_URL}/items/assets_and_equipment?limit=-1&fields=*,item_id.id,item_id.item_name,department.department_id,department.department_name`,
            { headers, cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Directus failed to fetch assets: ${res.status}`);
        const json = await res.json();
        const assets = json.data || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedAssets = assets.map((a: any) => ({
            ...a,
            is_active_warning: a.is_active_warning === undefined || a.is_active_warning === null ? false : Boolean(Number(a.is_active_warning)),
            is_active: a.is_active === undefined || a.is_active === null ? true : Boolean(Number(a.is_active))
        }));
        return NextResponse.json(mappedAssets);
    } catch (e) {
        console.error("API Error fetching assets:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch assets" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        
        // Clean payload fields
        const formattedPayload = {
            item_image: payload.item_image || null,
            item_id: payload.item_id || null,
            quantity: payload.quantity !== undefined ? Number(payload.quantity) : 1,
            rfid_code: payload.rfid_code || null,
            barcode: payload.barcode || null,
            serial: payload.serial || null,
            department: payload.department || null,
            employee: payload.employee || null,
            cost_per_item: payload.cost_per_item !== undefined ? Number(payload.cost_per_item) : 0,
            total: (payload.quantity !== undefined ? Number(payload.quantity) : 1) * (payload.cost_per_item !== undefined ? Number(payload.cost_per_item) : 0),
            condition: payload.condition || "Good",
            life_span: payload.life_span !== undefined ? Number(payload.life_span) : null,
            is_active_warning: payload.is_active_warning !== undefined ? !!payload.is_active_warning : false,
            is_active: payload.is_active !== undefined ? !!payload.is_active : true,
            date_acquired: payload.date_acquired || null
        };

        const res = await fetch(`${DIRECTUS_URL}/items/assets_and_equipment`, {
            method: "POST",
            headers,
            body: JSON.stringify(formattedPayload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to create asset: ${res.status} - ${errText}`);
        }

        const json = await res.json();
        const newAsset = json.data;
        if (newAsset) {
            if (newAsset.is_active_warning !== undefined) newAsset.is_active_warning = Boolean(Number(newAsset.is_active_warning));
            if (newAsset.is_active !== undefined) newAsset.is_active = Boolean(Number(newAsset.is_active));
        }
        return NextResponse.json({ success: true, asset: newAsset });
    } catch (e) {
        console.error("API Error creating asset:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to create asset" }, { status: 500 });
    }
}
