import { cookies } from "next/headers";

export async function getCurrentUserId(): Promise<number | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("vos_access_token")?.value;
        if (!token) return null;

        const payloadPart = token.split(".")[1];
        if (!payloadPart) return null;

        const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
        const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
        return Number(payload.user_id || payload.userId || payload.sub) || null;
    } catch {
        return null;
    }
}
