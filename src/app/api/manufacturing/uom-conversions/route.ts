import { NextRequest, NextResponse } from "next/server";
import { fetchDensityFactors, createDensityFactor, deleteDensityFactor } from "../directus-api";

export async function GET() {
    try {
        const factors = await fetchDensityFactors();
        return NextResponse.json(factors);
    } catch (e: any) {
        console.error("API Error fetching density factors:", e);
        return NextResponse.json({ error: e.message || "Failed to fetch density factors" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const created = await createDensityFactor(body);
        return NextResponse.json(created);
    } catch (e: any) {
        console.error("API Error creating density factor:", e);
        return NextResponse.json({ error: e.message || "Failed to create density factor" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Missing required 'id' parameter" }, { status: 400 });
        }
        const success = await deleteDensityFactor(id);
        return NextResponse.json({ success });
    } catch (e: any) {
        console.error("API Error deleting density factor:", e);
        return NextResponse.json({ error: e.message || "Failed to delete density factor" }, { status: 500 });
    }
}
