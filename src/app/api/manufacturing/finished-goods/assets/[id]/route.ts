import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const assetId = parseInt(id);
        if (isNaN(assetId)) {
            return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
        }

        const payload = await request.json();
        
        // Map payload fields cleanly
        const formattedPayload: Record<string, unknown> = {};
        if (payload.item_image !== undefined) formattedPayload.item_image = payload.item_image;
        if (payload.item_id !== undefined) formattedPayload.item_id = payload.item_id;
        if (payload.quantity !== undefined) formattedPayload.quantity = Number(payload.quantity);
        if (payload.rfid_code !== undefined) formattedPayload.rfid_code = payload.rfid_code;
        if (payload.barcode !== undefined) formattedPayload.barcode = payload.barcode;
        if (payload.serial !== undefined) formattedPayload.serial = payload.serial;
        if (payload.department !== undefined) formattedPayload.department = payload.department;
        if (payload.employee !== undefined) formattedPayload.employee = payload.employee;
        if (payload.cost_per_item !== undefined) formattedPayload.cost_per_item = Number(payload.cost_per_item);
        if (payload.condition !== undefined) formattedPayload.condition = payload.condition;
        if (payload.life_span !== undefined) formattedPayload.life_span = payload.life_span !== null ? Number(payload.life_span) : null;
        if (payload.is_active_warning !== undefined) formattedPayload.is_active_warning = !!payload.is_active_warning;
        if (payload.is_active !== undefined) formattedPayload.is_active = !!payload.is_active;
        if (payload.date_acquired !== undefined) formattedPayload.date_acquired = payload.date_acquired;

        // Auto recalculate total if qty or cost changes
        if (payload.quantity !== undefined || payload.cost_per_item !== undefined) {
            const qty = payload.quantity !== undefined ? Number(payload.quantity) : 0;
            const cost = payload.cost_per_item !== undefined ? Number(payload.cost_per_item) : 0;
            formattedPayload.total = qty * cost;
        }

        const res = await fetch(`${DIRECTUS_URL}/items/assets_and_equipment/${assetId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(formattedPayload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to update asset: ${res.status} - ${errText}`);
        }

        const json = await res.json();
        return NextResponse.json({ success: true, asset: json.data });
    } catch (e) {
        console.error("API Error updating asset:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to update asset" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const assetId = parseInt(id);
        if (isNaN(assetId)) {
            return NextResponse.json({ error: "Invalid asset ID" }, { status: 400 });
        }

        const res = await fetch(`${DIRECTUS_URL}/items/assets_and_equipment/${assetId}`, {
            method: "DELETE",
            headers
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus failed to delete asset: ${res.status} - ${errText}`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error deleting asset:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to delete asset" }, { status: 500 });
    }
}
