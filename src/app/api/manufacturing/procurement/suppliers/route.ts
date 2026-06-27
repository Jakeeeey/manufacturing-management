import { NextResponse } from "next/server";
import { fetchSuppliers, createSupplier, updateSupplier } from "./suppliers-helper";

export async function GET() {
    try {
        const suppliers = await fetchSuppliers();
        return NextResponse.json(suppliers);
    } catch (e) {
        console.error("API Error fetching suppliers:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch suppliers" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.supplier_name) {
            return NextResponse.json({ error: "supplier_name is required" }, { status: 400 });
        }
        const supplier = await createSupplier(body);
        return NextResponse.json({ success: true, supplier });
    } catch (e) {
        console.error("API Error creating supplier:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to create supplier" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...data } = body;
        if (!id) {
            return NextResponse.json({ error: "Supplier ID is required" }, { status: 400 });
        }
        const supplier = await updateSupplier(id, data);
        return NextResponse.json({ success: true, supplier });
    } catch (e) {
        console.error("API Error updating supplier:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to update supplier" }, { status: 500 });
    }
}
