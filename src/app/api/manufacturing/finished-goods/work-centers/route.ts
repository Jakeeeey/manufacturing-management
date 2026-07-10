import { NextResponse } from "next/server";
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

        const payload = {
            work_center_name,
            asset_id: asset_id || null,
            department_id: department_id || null,
            overhead_cost_per_hour: overhead_cost_per_hour !== undefined ? Number(overhead_cost_per_hour) : 0,
            capacity_per_hour: capacity_per_hour !== undefined ? Number(capacity_per_hour) : 0,
            is_active: is_active !== undefined ? !!is_active : true
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
