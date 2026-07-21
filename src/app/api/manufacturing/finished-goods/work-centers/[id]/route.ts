import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import {
    assertUniqueWorkCenterName,
    WorkCenterConflictError,
    WorkCenterDependencyError,
    WorkCenterValidationError,
    validateWorkCenterPayload
} from "../_validation";

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
        const payload = validateWorkCenterPayload(body, { partial: true });
        if (payload.work_center_name !== undefined) {
            await assertUniqueWorkCenterName(String(payload.work_center_name), workCenterId);
        }

        // Generate current Manila time (UTC+8) to save in Directus
        const now = new Date();
        const manilaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        const manilaIsoString = manilaTime.toISOString().replace("Z", "");

        const directusPayload: Record<string, unknown> = {
            ...payload,
            updated_at: manilaIsoString
        };

        const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_work_centers/${workCenterId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(directusPayload)
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
        if (e instanceof WorkCenterValidationError) {
            return NextResponse.json({ error: e.message, field: e.field }, { status: 400 });
        }
        if (e instanceof WorkCenterConflictError) {
            return NextResponse.json({ error: e.message }, { status: 409 });
        }
        if (e instanceof WorkCenterDependencyError) {
            return NextResponse.json({ error: e.message }, { status: 503 });
        }
        console.error("API Error updating work center:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to update work center" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const workCenterId = parseInt(id);
        if (isNaN(workCenterId)) {
            return NextResponse.json({ error: "Invalid work center ID" }, { status: 400 });
        }

        const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_work_centers/${workCenterId}`, {
            method: "DELETE",
            headers
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to delete work center: ${res.status} - ${errText}`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error deleting work center:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to delete work center" }, { status: 500 });
    }
}
