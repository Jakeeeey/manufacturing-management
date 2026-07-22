import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import {
    PhysicalInventoryDetail,
    generatePhNo,
    roundMoney,
    snapshotSystemInventory,
} from "./physical-inventory-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manufacturing/physical-inventory
 * Lists physical inventory count sheets from Directus collection physical_inventory
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branch_id") || searchParams.get("branch");
        const status = searchParams.get("status");
        const isCommittedParam = searchParams.get("is_committed") || searchParams.get("isComitted");
        const isCancelledParam = searchParams.get("is_cancelled") || searchParams.get("isCancelled");
        const limitParam = searchParams.get("limit") || "100";
        const sortParam = searchParams.get("sort") || "-date_encoded";
        const searchParam = searchParams.get("search");

        const filterParts: string[] = [];

        if (branchId) {
            filterParts.push(`filter[branch_id][_eq]=${encodeURIComponent(branchId)}`);
        }

        if (status) {
            const s = status.trim().toLowerCase();
            if (s === "draft") {
                filterParts.push("filter[isComitted][_eq]=0");
                filterParts.push("filter[isCancelled][_eq]=0");
            } else if (s === "committed") {
                filterParts.push("filter[isComitted][_eq]=1");
            } else if (s === "cancelled") {
                filterParts.push("filter[isCancelled][_eq]=1");
            }
        } else {
            if (isCommittedParam !== null && isCommittedParam !== undefined) {
                filterParts.push(`filter[isComitted][_eq]=${encodeURIComponent(isCommittedParam)}`);
            }
            if (isCancelledParam !== null && isCancelledParam !== undefined) {
                filterParts.push(`filter[isCancelled][_eq]=${encodeURIComponent(isCancelledParam)}`);
            }
        }

        if (searchParam) {
            filterParts.push(`filter[ph_no][_contains]=${encodeURIComponent(searchParam.trim())}`);
        }

        const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500);
        const filterQuery = filterParts.length > 0 ? `&${filterParts.join("&")}` : "";
        const url = `${DIRECTUS_URL}/items/physical_inventory?sort=${encodeURIComponent(sortParam)}&limit=${limit}&fields=*,branch_id.*${filterQuery}`;

        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Directus returned HTTP ${res.status}: ${errText}`);
        }

        const json = await res.json();
        const data = json.data || [];

        return NextResponse.json({
            success: true,
            count: data.length,
            data,
        });
    } catch (e) {
        console.error("[Physical Inventory GET] Error:", e);
        return NextResponse.json(
            { success: false, error: (e as Error).message || "Failed to fetch physical inventory count sheets" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/manufacturing/physical-inventory
 * Creates a new count sheet in physical_inventory matching all required Directus schema fields
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            branch_id,
            cutoff_date,
            cutOff_date,
            starting_date,
            price_type,
            stock_type,
            remarks,
            encoded_by,
            encoder_id,
            category_id,
            supplier_id,
            ph_no
        } = body;

        const branchIdNum = Number(branch_id);
        if (!branch_id || isNaN(branchIdNum) || branchIdNum <= 0) {
            return NextResponse.json(
                { success: false, error: "Missing or invalid required parameter: branch_id" },
                { status: 400 }
            );
        }

        const rawCutoff = cutoff_date || cutOff_date;
        const cutoffDateIso = rawCutoff ? new Date(rawCutoff).toISOString() : new Date().toISOString();
        const startingDateIso = starting_date ? new Date(starting_date).toISOString() : new Date().toISOString();
        const sheetNo = (typeof ph_no === "string" && ph_no.trim()) ? ph_no.trim() : generatePhNo();

        // 1. Safely resolve valid foreign key IDs for user, category, and supplier from DB if not provided
        const [firstUserRes, firstCategoryRes, firstSupplierRes] = await Promise.all([
            fetch(`${DIRECTUS_URL}/items/user?limit=1&fields=user_id`, { headers, cache: "no-store" }).catch(() => null),
            fetch(`${DIRECTUS_URL}/items/categories?limit=1&fields=category_id`, { headers, cache: "no-store" }).catch(() => null),
            fetch(`${DIRECTUS_URL}/items/suppliers?limit=1&fields=id`, { headers, cache: "no-store" }).catch(() => null),
        ]);

        let validUserId = Number(encoder_id || encoded_by || 0);
        if ((!validUserId || isNaN(validUserId)) && firstUserRes && firstUserRes.ok) {
            const uData = (await firstUserRes.json()).data?.[0];
            if (uData?.user_id) validUserId = Number(uData.user_id);
        }

        let validCategoryId = Number(category_id || 0);
        if ((!validCategoryId || isNaN(validCategoryId)) && firstCategoryRes && firstCategoryRes.ok) {
            const cData = (await firstCategoryRes.json()).data?.[0];
            if (cData?.category_id) validCategoryId = Number(cData.category_id);
        }

        let validSupplierId = Number(supplier_id || 0);
        if ((!validSupplierId || isNaN(validSupplierId)) && firstSupplierRes && firstSupplierRes.ok) {
            const sData = (await firstSupplierRes.json()).data?.[0];
            if (sData?.id) validSupplierId = Number(sData.id);
        }

        // 2. Calculate system count snapshot up to cutoff_date
        const snapshotLines = await snapshotSystemInventory(branchIdNum, cutoffDateIso);

        // 3. Compute total amount for sheet
        const totalAmount = snapshotLines.reduce(
            (sum, line) => sum + roundMoney(line.physical_count * line.unit_price),
            0
        );

        // 4. Create physical_inventory record in Directus with dynamic valid FKs
        const sheetPayload = {
            ph_no: sheetNo,
            date_encoded: new Date().toISOString(),
            starting_date: startingDateIso,
            cutOff_date: cutoffDateIso,
            price_type: String(price_type || "Selling Price"),
            stock_type: String(stock_type || "Finished Goods"),
            branch_id: branchIdNum,
            remarks: remarks ? String(remarks) : "",
            isComitted: 0,
            committed_at: null,
            isCancelled: 0,
            cancelled_at: null,
            total_amount: roundMoney(totalAmount),
            supplier_id: validSupplierId || 1,
            category_id: validCategoryId || 1,
            encoder_id: validUserId || 1,
        };

        const sheetRes = await fetch(`${DIRECTUS_URL}/items/physical_inventory`, {
            method: "POST",
            headers,
            body: JSON.stringify(sheetPayload),
        });

        if (!sheetRes.ok) {
            const errText = await sheetRes.text();
            throw new Error(`Directus failed to create physical_inventory record: ${sheetRes.status} - ${errText}`);
        }

        const sheetJson = await sheetRes.json();
        const createdSheet = sheetJson.data;
        const phId = Number(createdSheet.id);

        // 5. Pre-populate physical_inventory_details
        let createdDetails: PhysicalInventoryDetail[] = [];
        if (snapshotLines.length > 0) {
            const detailsPayload = snapshotLines.map((line) => ({
                ph_id: phId,
                date_encoded: new Date().toISOString(),
                product_id: line.product_id,
                version_id: line.version_id || null,
                lot_id: line.lot_id || null,
                batch_no: line.batch_no || null,
                unit_price: line.unit_price,
                system_count: line.system_count,
                physical_count: line.physical_count,
                variance: line.variance,
                difference_cost: line.difference_cost,
                amount: roundMoney(line.physical_count * line.unit_price),
                offset_match: null,
            }));

            const detailsRes = await fetch(`${DIRECTUS_URL}/items/physical_inventory_details`, {
                method: "POST",
                headers,
                body: JSON.stringify(detailsPayload),
            });

            if (detailsRes.ok) {
                const detailsJson = await detailsRes.json();
                createdDetails = Array.isArray(detailsJson.data) ? detailsJson.data : [detailsJson.data];
            } else {
                console.error("[Physical Inventory POST] Details insertion warning:", await detailsRes.text());
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...createdSheet,
                details: createdDetails,
            },
        });
    } catch (e) {
        console.error("[Physical Inventory POST] Error:", e);
        return NextResponse.json(
            { success: false, error: (e as Error).message || "Failed to create physical inventory count sheet" },
            { status: 500 }
        );
    }
}
