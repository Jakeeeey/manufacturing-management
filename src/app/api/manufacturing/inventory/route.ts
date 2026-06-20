import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function GET() {
    try {
        const [ledgerRes, batchesRes, productsRes, branchesRes] = await Promise.all([
            fetch(`${DIRECTUS_URL}/items/product_ledger?limit=100&sort=-id`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/inventory_lots?limit=500&sort=-id`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/products?limit=500&fields=product_id,product_name,product_code,product_brand.brand_id,product_brand.brand_name,product_category.category_id,product_category.category_name,unit_of_measurement.unit_shortcut,unit_of_measurement.unit_name,cost_per_unit,product_shelf_life`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/branches?limit=-1`, { headers, cache: "no-store" })
        ]);

        let ledger = [];
        if (ledgerRes.ok) {
            try {
                ledger = (await ledgerRes.json()).data || [];
            } catch (e) {
                console.error("Failed to parse Directus product_ledger:", e);
            }
        } else {
            console.warn("Directus product_ledger fetch failed, using fallback entries.");
        }

        if (!batchesRes.ok) throw new Error("Failed to fetch inventory_lots from Directus");
        if (!productsRes.ok) throw new Error("Failed to fetch products from Directus");
        if (!branchesRes.ok) throw new Error("Failed to fetch branches from Directus");

        const porData = (await batchesRes.json()).data || [];
        const products = (await productsRes.json()).data || [];
        const branches = (await branchesRes.json()).data || [];

        // Map inventory lots to the Batch format expected by the frontend
        const batches = porData.map((b: any) => ({
            line_id: b.id,
            product_id: b.product_id,
            branch_id: b.branch_id,
            lot_number: b.lot_number || "LOT-N/A",
            expiration_date: b.expiry_date || null,
            quantity_received: Number(b.quantity || 0),
            base_unit_cost_php: Number(b.unit_cost || 0),
            allocated_expense_php: 0,
            final_landed_unit_cost: Number(b.unit_cost || 0),
            qa_status: b.qa_status || "Passed"
        }));

        return NextResponse.json({
            ledger,
            batches,
            products,
            branches
        });
    } catch (e) {
        console.error("[Inventory BFF GET] Error:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch inventory logs" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId, branchId, quantity, documentType, documentDescription, documentDate } = body;

        if (!productId || !branchId || quantity === undefined) {
            return NextResponse.json({ error: "Missing required fields (productId, branchId, quantity)" }, { status: 400 });
        }

        const pId = Number(productId);
        const bId = Number(branchId);
        const qtyChange = Number(quantity);

        if (isNaN(pId) || isNaN(bId) || isNaN(qtyChange)) {
            return NextResponse.json({ error: "Invalid numeric formats for productId, branchId, or quantity" }, { status: 400 });
        }

        // If adjustment is a deduction, prevent stock from going below zero
        if (qtyChange < 0) {
            const ledgerRes = await fetch(`${DIRECTUS_URL}/items/product_ledger?filter[productId][_eq]=${pId}&filter[branchId][_eq]=${bId}&limit=-1`, { headers, cache: "no-store" });
            let currentStock = 0;
            let ledger = [];
            if (ledgerRes.ok) {
                ledger = (await ledgerRes.json()).data || [];
            }
            
            currentStock = ledger.reduce((sum: number, entry: any) => sum + (Number(entry.quantity) || 0), 0);

            if (currentStock + qtyChange < 0) {
                return NextResponse.json({ 
                    error: `Cannot complete adjustment. Insufficient stock (Available: ${currentStock.toLocaleString(undefined, { minimumFractionDigits: 2 })}, requested reduction: ${Math.abs(qtyChange).toLocaleString(undefined, { minimumFractionDigits: 2 })})` 
                }, { status: 400 });
            }
        }

        const docNo = `ADJ-${Math.floor(100000 + Math.random() * 900000)}`;

        const ledgerPayload = {
            productId: pId,
            branchId: bId,
            quantity: qtyChange,
            documentType: documentType || "Stock Adjustment",
            documentNo: docNo,
            documentDescription: documentDescription || "Manual Stock Take Adjustment",
            documentDate: documentDate || new Date().toISOString().split('T')[0]
        };

        const res = await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
            method: "POST",
            headers,
            body: JSON.stringify(ledgerPayload)
        });

        if (!res.ok) {
            const errTxt = await res.text();
            return NextResponse.json({ error: `Failed to save to cloud product ledger: ${res.status} - ${errTxt}` }, { status: res.status });
        }

        const saved = (await res.json()).data;
        return NextResponse.json({ success: true, data: saved });
    } catch (e) {
        console.error("[Inventory BFF POST] Error:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to post stock adjustment" }, { status: 500 });
    }
}


