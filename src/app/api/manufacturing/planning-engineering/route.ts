import { NextResponse } from "next/server";
import { 
    fetchJobOrders, 
    createJobOrder, 
    updateJobOrder, 
    deleteJobOrder,
    DIRECTUS_URL,
    headers
} from "../directus-api";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId");
        const action = searchParams.get("action");

        if (action === "users") {
            const url = `${DIRECTUS_URL}/items/user?limit=-1`;
            const res = await fetch(url, { headers, cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch users");
            const data = await res.json();
            return NextResponse.json(data.data || []);
        }

        if (productId) {
            // 1. Fetch active BOM for the product
            const bomUrl = `${DIRECTUS_URL}/items/manufacturing_boms?filter[product_id][_eq]=${productId}&filter[is_active][_eq]=1&limit=1&fields=*,product_id.*`;
            const bomRes = await fetch(bomUrl, { headers, cache: "no-store" });
            if (!bomRes.ok) throw new Error("Failed to fetch active BOM");
            
            const bomData = await bomRes.json();
            const bom = bomData.data?.[0] || null;

            if (!bom) {
                return NextResponse.json({ bom: null, components: [], routings: [] });
            }

            // 2. Fetch BOM components and join raw material products details
            const componentsUrl = `${DIRECTUS_URL}/items/manufacturing_bom_components?filter[bom_id][_eq]=${bom.bom_id}&limit=-1&fields=*,component_product_id.*`;
            const compRes = await fetch(componentsUrl, { headers, cache: "no-store" });
            if (!compRes.ok) throw new Error("Failed to fetch BOM components");
            const components = (await compRes.json()).data || [];

            // 3. Fetch manufacturing routings for labor duration and sequencing
            const routingsUrl = `${DIRECTUS_URL}/items/manufacturing_routings?filter[bom_id][_eq]=${bom.bom_id}&sort=sequence_order&limit=-1`;
            const routRes = await fetch(routingsUrl, { headers, cache: "no-store" });
            if (!routRes.ok) throw new Error("Failed to fetch routings");
            const routings = (await routRes.json()).data || [];

            return NextResponse.json({
                bom,
                components,
                routings
            });
        } else {
            // Fetch all Job Orders
            const list = await fetchJobOrders();
            // Transform snake_case keys back to camelCase for client compatibility if needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const camelCaseList = list.map((item: any) => ({
                jo_id: item.jo_id,
                order_id: item.order_id,
                order_no: item.order_no,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: Number(item.quantity || 0),
                due_date: item.due_date,
                status: item.status,
                is_batched: !!item.is_batched,
                bom: item.bom,
                components: item.components,
                routings: item.routings,
                allocationResults: item.allocation_results,
                procurementStatus: item.procurement_status,
                branch_id: item.branch_id,
                products: item.products || [],
                assignedPersonnel: item.assigned_personnel || []
            }));
            return NextResponse.json(camelCaseList);
        }
    } catch (e) {
        console.error("API Error in planning-engineering GET:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to process planning request" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { jo, salesOrderIds } = body;

        if (!jo || !jo.jo_id) {
            return NextResponse.json({ error: "Missing job order configuration" }, { status: 400 });
        }

        // Map camelCase from frontend to snake_case for Directus database
        const dbPayload = {
            jo_id: jo.jo_id,
            order_id: jo.order_id || null,
            order_no: jo.order_no || null,
            product_id: jo.product_id,
            product_name: jo.product_name,
            quantity: jo.quantity,
            due_date: jo.due_date,
            status: jo.status || "Draft",
            is_batched: !!jo.is_batched,
            bom: jo.bom || null,
            components: jo.components || null,
            routings: jo.routings || null,
            allocation_results: jo.allocationResults || null,
            procurement_status: jo.procurementStatus || "Idle",
            branch_id: jo.branch_id || null,
            assigned_personnel: jo.assignedPersonnel || null,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            products: jo.products ? jo.products.map((p: any) => ({
                product_id: p.product_id,
                product_name: p.product_name,
                quantity: p.quantity,
                bom: p.bom || null,
                components: p.components || null,
                routings: p.routings || null,
                allocation_results: p.allocationResults || null
            })) : null
        };

        const result = await createJobOrder(dbPayload, salesOrderIds);
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("API Error in planning-engineering POST:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to create Job Order" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { joId, patch } = body;

        if (!joId || !patch) {
            return NextResponse.json({ error: "Missing joId or patch data" }, { status: 400 });
        }

        // Map camelCase patch fields to snake_case fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbPatch: Record<string, any> = {};
        if (patch.status !== undefined) dbPatch.status = patch.status;
        if (patch.bom !== undefined) dbPatch.bom = patch.bom;
        if (patch.components !== undefined) dbPatch.components = patch.components;
        if (patch.routings !== undefined) dbPatch.routings = patch.routings;
        if (patch.allocationResults !== undefined) dbPatch.allocation_results = patch.allocationResults;
        if (patch.procurementStatus !== undefined) dbPatch.procurement_status = patch.procurementStatus;
        if (patch.quantity !== undefined) dbPatch.quantity = patch.quantity;
        if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate;
        if (patch.branch_id !== undefined) dbPatch.branch_id = patch.branch_id;
        if (patch.branchId !== undefined) dbPatch.branch_id = patch.branchId;
        if (patch.assignedPersonnel !== undefined) dbPatch.assigned_personnel = patch.assignedPersonnel;
        if (patch.products !== undefined) dbPatch.products = patch.products;

        const result = await updateJobOrder(joId, dbPatch);
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        console.error("API Error in planning-engineering PATCH:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to update Job Order" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
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
