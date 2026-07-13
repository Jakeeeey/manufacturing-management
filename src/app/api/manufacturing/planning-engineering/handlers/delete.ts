import { NextResponse } from "next/server";
import { deleteJobOrder } from "../planning-helper";

export async function handleDELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const joId = searchParams.get("joId");

        if (!joId) {
            return NextResponse.json({ error: "Missing joId parameter" }, { status: 400 });
        }

        const success = await deleteJobOrder(joId);
        return NextResponse.json({ success });
    } catch (e) {
        console.error("API Error in planning-engineering DELETE:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to delete Job Order" }, { status: 500 });
    }
}
