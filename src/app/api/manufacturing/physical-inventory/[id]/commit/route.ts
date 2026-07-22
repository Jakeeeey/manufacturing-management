import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { extractId, roundQty, PhysicalInventoryDetail } from "../../physical-inventory-helper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
    params: Promise<{ id: string }>;
}

function parseBufferOrBool(val: unknown): boolean {
    if (val === true || val === 1 || val === "1") return true;
    if (val === false || val === 0 || val === "0" || val === null || val === undefined) return false;
    if (typeof val === "object" && val !== null) {
        const obj = val as Record<string, unknown>;
        if (Array.isArray(obj.data) && obj.data.length > 0) {
            return Number(obj.data[0]) === 1;
        }
        if (typeof obj.data === "number") {
            return obj.data === 1;
        }
    }
    return false;
}

/**
 * POST /api/manufacturing/physical-inventory/[id]/commit
 * Finalizes and commits the count sheet (isComitted = 1, committed_at = NOW()).
 */
export async function POST(_request: Request, context: RouteParams) {
    try {
        const { id } = await context.params;
        const sheetId = Number(id);

        if (isNaN(sheetId) || sheetId <= 0) {
            return NextResponse.json({ success: false, error: "Invalid count sheet ID" }, { status: 400 });
        }

        // Fetch physical count sheet header
        const sheetRes = await fetch(`${DIRECTUS_URL}/items/physical_inventory/${sheetId}`, {
            headers,
            cache: "no-store",
        });

        if (!sheetRes.ok) {
            return NextResponse.json({ success: false, error: "Physical count sheet not found" }, { status: 404 });
        }

        const sheet = (await sheetRes.json()).data;
        if (!sheet) {
            return NextResponse.json({ success: false, error: "Physical count sheet not found" }, { status: 404 });
        }

        const isCommitted = parseBufferOrBool(sheet.isComitted) || parseBufferOrBool(sheet.is_committed);
        const isCancelled = parseBufferOrBool(sheet.isCancelled) || parseBufferOrBool(sheet.is_cancelled);

        if (isCommitted) {
            return NextResponse.json(
                { success: false, error: "Physical count sheet is already committed" },
                { status: 400 }
            );
        }

        if (isCancelled) {
            return NextResponse.json(
                { success: false, error: "Cannot commit a cancelled physical count sheet" },
                { status: 400 }
            );
        }

        // Fetch line item details
        const detailsRes = await fetch(
            `${DIRECTUS_URL}/items/physical_inventory_details?filter[ph_id][_eq]=${sheetId}&limit=-1`,
            { headers, cache: "no-store" }
        );

        if (!detailsRes.ok) {
            throw new Error("Failed to fetch physical count sheet line items for commit");
        }

        const details: PhysicalInventoryDetail[] = (await detailsRes.json()).data || [];
        const branchId = extractId(sheet.branch_id, "id") || extractId(sheet.branch_id, "branch_id");

        // Filter line items with non-zero variance
        const movementsToPost = [];

        for (const detail of details) {
            const variance = roundQty(detail.variance);
            if (Math.abs(variance) < 0.0001) continue;

            const productId = extractId(detail.product_id, "product_id");
            const lotId = extractId(detail.lot_id, "lot_id") || null;
            const versionId = extractId(detail.version_id, "id") || null;
            const batchNo = detail.batch_no ? String(detail.batch_no).trim() : null;
            const detailId = Number(detail.id);

            if (variance > 0) {
                // Surplus: IN movement (+quantity), transaction_type_id = 6
                movementsToPost.push({
                    product_id: productId,
                    branch_id: branchId,
                    lot_id: lotId,
                    version_id: versionId,
                    batch_no: batchNo,
                    transaction_type_id: 6,
                    quantity: Math.abs(variance),
                    source_document_no: sheet.ph_no,
                    source_document_id: detailId,
                    remarks: detail.remarks || `Physical Inventory Surplus adjustment for ${sheet.ph_no}`,
                });
            } else if (variance < 0) {
                // Deficit: OUT movement (-quantity), transaction_type_id = 7
                movementsToPost.push({
                    product_id: productId,
                    branch_id: branchId,
                    lot_id: lotId,
                    version_id: versionId,
                    batch_no: batchNo,
                    transaction_type_id: 7,
                    quantity: -Math.abs(variance),
                    source_document_no: sheet.ph_no,
                    source_document_id: detailId,
                    remarks: detail.remarks || `Physical Inventory Deficit adjustment for ${sheet.ph_no}`,
                });
            }
        }

        // Write ledger movements to inventory_movements if any variances exist
        let postedMovements: unknown[] = [];

        if (movementsToPost.length > 0) {
            const movRes = await fetch(`${DIRECTUS_URL}/items/inventory_movements`, {
                method: "POST",
                headers,
                body: JSON.stringify(movementsToPost),
            });

            if (!movRes.ok) {
                const errText = await movRes.text();
                throw new Error(`Directus failed to insert inventory movements on commit: ${movRes.status} - ${errText}`);
            }

            const movJson = await movRes.json();
            postedMovements = Array.isArray(movJson.data) ? movJson.data : [movJson.data];
        }

        // Mark count sheet as committed using exact Directus schema field names
        const commitTime = new Date().toISOString();
        const patchRes = await fetch(`${DIRECTUS_URL}/items/physical_inventory/${sheetId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                isComitted: 1,
                is_committed: 1,
                committed_at: commitTime,
            }),
        });

        if (!patchRes.ok) {
            const errText = await patchRes.text();
            throw new Error(`Directus failed to finalize commit status: ${patchRes.status} - ${errText}`);
        }

        const updatedSheet = (await patchRes.json()).data;

        return NextResponse.json({
            success: true,
            message: "Physical inventory count sheet committed successfully",
            committed_movements_count: movementsToPost.length,
            data: {
                ...updatedSheet,
                posted_movements: postedMovements,
            },
        });

    } catch (e) {
        console.error("[Physical Inventory COMMIT] Error:", e);
        return NextResponse.json(
            { success: false, error: (e as Error).message || "Failed to commit physical count sheet" },
            { status: 500 }
        );
    }
}
