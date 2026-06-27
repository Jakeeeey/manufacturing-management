import { NextRequest, NextResponse } from "next/server";
import { ChangePasswordService } from "@/modules/manufacturing-management/change-password/services/change-password-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null);
        if (!body) {
            return NextResponse.json(
                { success: false, message: "Invalid request payload" },
                { status: 400 }
            );
        }

        const { oldPassword, newPassword } = body;
        if (!oldPassword || !newPassword) {
            return NextResponse.json(
                { success: false, message: "oldPassword and newPassword are required" },
                { status: 400 }
            );
        }

        const result = await ChangePasswordService.changePassword({ oldPassword, newPassword });
        if (result.success) {
            return NextResponse.json({ success: true, message: result.message });
        } else {
            return NextResponse.json(
                { success: false, message: result.message },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error("API error change-password:", error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
