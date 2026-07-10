import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const workCenterId = parseInt(id);
        if (isNaN(workCenterId)) {
            return NextResponse.json({ error: "Invalid work center ID" }, { status: 400 });
        }

        const body = await request.json();
        const { work_center_name, asset_id, department_id, overhead_cost_per_hour, capacity_per_hour, is_active } = body;

        const payload: Record<string, unknown> = {};
        if (work_center_name !== undefined) payload.work_center_name = work_center_name;
        if (asset_id !== undefined) payload.asset_id = asset_id;
        if (department_id !== undefined) payload.department_id = department_id;
        if (overhead_cost_per_hour !== undefined) payload.overhead_cost_per_hour = Number(overhead_cost_per_hour);
        if (capacity_per_hour !== undefined) payload.capacity_per_hour = Number(capacity_per_hour);
        if (is_active !== undefined) payload.is_active = !!is_active;

        const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_work_centers/${workCenterId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to update work center: ${res.status} - ${errText}`);
        }
        
        const json = await res.json();
        const updatedWc = json.data;
        if (updatedWc && updatedWc.is_active !== undefined) updatedWc.is_active = Boolean(Number(updatedWc.is_active));
        return NextResponse.json({ success: true, workCenter: updatedWc });
    } catch (e) {
        console.error("API Error updating work center:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to update work center" }, { status: 500 });
    }
}
