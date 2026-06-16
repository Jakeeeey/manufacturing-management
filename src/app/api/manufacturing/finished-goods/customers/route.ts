import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fetchCustomers, createCustomer } from "../../directus-api";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const customers = await fetchCustomers(search);
        return NextResponse.json(customers);
    } catch (e) {
        console.error("API Error fetching customers:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch customers" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.customer_code || !body.customer_name) {
            return NextResponse.json({ error: "Customer Code and Customer Name are required" }, { status: 400 });
        }

        // Retrieve logged-in user ID from JWT token
        let encoderId: number | null = null;
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
                    // Extract principal ID from sub, id, or user_id
                    const rawId = payload?.id || payload?.user_id || payload?.sub;
                    if (rawId) {
                        const parsed = Number(rawId);
                        if (!isNaN(parsed)) {
                            encoderId = parsed;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Error decoding user token:", err);
        }

        if (!encoderId) {
            return NextResponse.json({ error: "Unauthorized: A valid encoder session could not be established." }, { status: 401 });
        }

        const newCustomer = await createCustomer({
            ...body,
            encoder_id: encoderId
        });
        return NextResponse.json(newCustomer);
    } catch (e) {
        console.error("API Error creating customer:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to create customer" }, { status: 500 });
    }
}


