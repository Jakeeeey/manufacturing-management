import { NextResponse } from "next/server";
import { 
    fetchAllOverheadTypes,
    createOverheadType
} from "../../directus-api";

export async function GET() {
    try {
        const types = await fetchAllOverheadTypes();
        return NextResponse.json(types);
    } catch (e) {
        console.error("API Error fetching overhead types:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch overhead types" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name } = await request.json();
        if (!name) {
            return NextResponse.json({ error: "Missing name" }, { status: 400 });
        }
        const newType = await createOverheadType(name);
        if (!newType) throw new Error("Failed to create overhead type in Directus");
        return NextResponse.json({ success: true, type: newType });
    } catch (e) {
        console.error("API Error creating overhead type:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to create overhead type" }, { status: 500 });
    }
}
