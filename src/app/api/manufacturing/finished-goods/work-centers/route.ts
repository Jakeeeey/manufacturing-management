import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function GET() {
    try {
        const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_work_centers?limit=-1&fields=*,asset_id.id,asset_id.item_image,asset_id.serial,asset_id.barcode,asset_id.condition,asset_id.item_id.id,asset_id.item_id.item_name,department_id.department_id,department_id.department_name`, { headers, cache: "no-store" });
        if (!res.ok) throw new Error(`Directus failed to fetch work centers: ${res.status}`);
        const json = await res.json();
        const workCenters = json.data || [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedWorkCenters = workCenters.map((wc: any) => {
            const asset = wc.asset_id && typeof wc.asset_id === "object" ? wc.asset_id : null;
            const department = wc.department_id && typeof wc.department_id === "object" ? wc.department_id : null;
            return {
                ...wc,
                asset_id: asset ? asset.id : wc.asset_id,
                department_id: department ? department.department_id : wc.department_id,
                is_active: wc.is_active === undefined || wc.is_active === null ? true : Boolean(Number(wc.is_active)),
                asset,
                department
            };
        });

        return NextResponse.json(mappedWorkCenters);
    } catch (e) {
        console.error("API Error fetching work centers:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch work centers" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { work_center_name, asset_id, department_id, overhead_cost_per_hour, capacity_per_hour, is_active } = body;

        if (!work_center_name) {
            return NextResponse.json({ error: "Missing required field: work_center_name" }, { status: 400 });
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
            console.error("Error parsing user token in POST work center route:", err);
        }

        // Generate current Manila time (UTC+8) to save in Directus
        const now = new Date();
        const manilaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const manilaIsoString = manilaTime.toISOString();

        const payload = {
            work_center_name,
            asset_id: asset_id || null,
            department_id: department_id || null,
            overhead_cost_per_hour: overhead_cost_per_hour !== undefined ? Number(overhead_cost_per_hour) : 0,
            capacity_per_hour: capacity_per_hour !== undefined ? Number(capacity_per_hour) : 0,
            is_active: is_active !== undefined ? !!is_active : true,
            created_by: userId ? Number(userId) : 24, // Fallback to seed user ID 24 if no active token
            created_at: manilaIsoString,
            updated_at: manilaIsoString
        };

        const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_work_centers`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to create work center: ${res.status} - ${errText}`);
        }
        
        const json = await res.json();
        const newWc = json.data;
        if (newWc && newWc.is_active !== undefined) newWc.is_active = Boolean(Number(newWc.is_active));
        return NextResponse.json({ success: true, workCenter: newWc });
    } catch (e) {
        console.error("API Error creating work center:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to create work center" }, { status: 500 });
    }
}
