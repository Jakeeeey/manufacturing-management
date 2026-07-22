import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { canonicalBatchNumber } from "@/app/api/manufacturing/procurement/_domain";
import { movementStockKey, sumMovementQuantitiesByStock, uniqueRowsByMovementStockKey } from "@/app/api/manufacturing/qa-receiving/_movement-stock";

interface InventoryLot {
    id: number;
    product_id: number;
    branch_id: number;
    lot_number?: string;
    batch_no?: string;
    lot_id?: number | { lot_id: number; lot_name?: string } | null;
    expiry_date?: string | null;
    quantity?: string | number;
    unit_cost?: string | number;
    qa_status?: string;
    rejection_reason?: string | null;
    created_on?: string | null;
    source_reference?: string | null;
    source_type?: string | null;
    remarks?: string | null;
}

interface LedgerEntry {
    quantity?: string | number;
}

interface DirectusMovementRaw {
    movement_id: number;
    product_id: number | { product_id?: number };
    branch_id: number | { id?: number };
    lot_id: number | { lot_id?: number };
    batch_no?: string | null;
    quantity: number | string;
    remarks?: string | null;
    transaction_type_id?: number | {
        type_name?: string | null;
    } | null;
}

export async function GET() {
    try {
        const [ledgerRes, batchesRes, productsRes, branchesRes] = await Promise.all([
            fetch(`${DIRECTUS_URL}/items/product_ledger?limit=100&sort=-id`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/inventory_lots?fields=*,lot_id.lot_id,lot_id.lot_name&limit=500&sort=-id`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/products?limit=500&fields=product_id,product_name,product_code,product_brand.brand_id,product_brand.brand_name,product_category.category_id,product_category.category_name,unit_of_measurement.unit_shortcut,unit_of_measurement.unit_name,cost_per_unit,product_shelf_life,parent_id,product_type`, { headers, cache: "no-store" }),
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
        const productsData = (await productsRes.json()).data || [];
        const branches = (await branchesRes.json()).data || [];

        // Fetch corresponding movements to resolve transaction types and remarks
        let rawMovements: DirectusMovementRaw[] = [];
        if (porData.length > 0) {
            const lotIds = porData
                .map((l: InventoryLot) => typeof l.lot_id === "object" ? l.lot_id?.lot_id : l.lot_id)
                .filter((id: number | null | undefined): id is number => id !== null && id !== undefined);
            try {
                const movementsRes = await fetch(
                    `${DIRECTUS_URL}/items/inventory_movements?filter[lot_id][_in]=${lotIds.join(",")}&limit=-1&fields=*,transaction_type_id.type_name`,
                    { headers, cache: "no-store" }
                );
                if (movementsRes.ok) {
                    const movementsJson = await movementsRes.json();
                    rawMovements = movementsJson.data || [];
                }
            } catch (err) {
                console.error("[Inventory BFF] Error fetching lot movements:", err);
            }
        }

        // Group movements by lot_id
        const movementsByLot = new Map<number, DirectusMovementRaw[]>();
        rawMovements.forEach((m: DirectusMovementRaw) => {
            const lotId = typeof m.lot_id === "object" ? m.lot_id?.lot_id : m.lot_id;
            if (lotId) {
                const list = movementsByLot.get(Number(lotId)) || [];
                list.push(m);
                movementsByLot.set(Number(lotId), list);
            }
        });
        const movementStock = sumMovementQuantitiesByStock(
            rawMovements as unknown as Array<Record<string, unknown>>
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const products = productsData.map((p: any) => {
            const productTypeId = p.product_type && typeof p.product_type === "object"
                ? Number(p.product_type.id)
                : Number(p.product_type);
            return {
                ...p,
                product_type: isNaN(productTypeId) ? null : productTypeId,
                is_finished_good: productTypeId === 388
            };
        });

        // Multiple receipts can point at the same physical stock key. Movements
        // already aggregate that key, so expose it once instead of double-counting it.
        const uniqueBatches = uniqueRowsByMovementStockKey(
            porData as Array<InventoryLot & Record<string, unknown>>
        );

        // Map inventory lots to the Batch format expected by the frontend
        const batches = uniqueBatches.map((b: InventoryLot) => {
            const batchNo = canonicalBatchNumber(b.batch_no, b.lot_number);
            const lotId = typeof b.lot_id === "object" ? b.lot_id?.lot_id || null : b.lot_id || null;
            const lotName = typeof b.lot_id === "object" ? b.lot_id?.lot_name || null : null;

            // Find matching movements
            const lotMvts = lotId ? (movementsByLot.get(lotId) || []) : [];
            // Creation movement is the inbound addition (quantity > 0) or fallback to first movement
            const creationMvt = lotMvts.find((m: DirectusMovementRaw) => Number(m.quantity) > 0) || lotMvts[0];

            const txnTypeName = typeof creationMvt?.transaction_type_id === "object"
                ? creationMvt.transaction_type_id?.type_name
                : null;

            const resolvedTxnType = txnTypeName || (b.source_type ? String(b.source_type).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Legacy Stock");
            const resolvedRemarks = b.remarks || b.rejection_reason || creationMvt?.remarks || null;

            return {
                line_id: b.id,
                product_id: b.product_id,
                branch_id: b.branch_id,
                batch_no: batchNo,
                lot_number: batchNo || "LOT-N/A",
                lot_id: lotId,
                lot_name: lotName,
                storage_assignment_state: lotId ? "assigned" : "legacy_unassigned",
                expiration_date: b.expiry_date || null,
                quantity_received: movementStock.get(movementStockKey(b as unknown as Record<string, unknown>)) || 0,
                base_unit_cost_php: Number(b.unit_cost || 0),
                allocated_expense_php: 0,
                final_landed_unit_cost: Number(b.unit_cost || 0),
                qa_status: b.qa_status || "Passed",
                rejection_reason: b.rejection_reason || null,
                created_on: b.created_on || null,
                source_reference: b.source_reference || null,
                source_type: b.source_type || null,
                remarks: resolvedRemarks,
                transaction_type: resolvedTxnType
            };
        });

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
            
            currentStock = ledger.reduce((sum: number, entry: LedgerEntry) => sum + (Number(entry.quantity) || 0), 0);

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


