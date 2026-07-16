import { NextResponse } from "next/server";
import {
    PURCHASE_ORDER_MODULE_PATHS,
    PurchaseOrderAuthorizationError,
    requirePurchaseOrderModuleAccess
} from "../../purchase-orders/_auth";
import { procurementDirectusFetch } from "../../procurement/_directus";
import { INVENTORY_STATUS } from "../../procurement/_domain";
import { handleQaReceivingPost } from "../../procurement/qa-receiving/_receiving-service";
import {
    RECEIVING_POSTING_ENABLED,
    receivingCommitRequestSchema,
    type ReceivingCommitRequest,
    type ReceivingCommitResult
} from "../_commit-contract";
import type { ReceivingPreviewResult } from "../_preview-domain";
import { POST as previewReceiving } from "../preview/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class CommitError extends Error {
    constructor(readonly statusCode: number, message: string) { super(message); }
}

function rows(body: unknown): Record<string, unknown>[] {
    return body && typeof body === "object" && "data" in body && Array.isArray(body.data)
        ? body.data as Record<string, unknown>[]
        : [];
}

async function directusRows(path: string, message: string) {
    const response = await procurementDirectusFetch(path);
    if (!response.ok) throw new CommitError(503, message);
    return rows(await response.json());
}

function statusLabel(status: number): "Received" | "Rejected" {
    if (status === INVENTORY_STATUS.REJECTED) return "Rejected";
    if (status === INVENTORY_STATUS.RECEIVED) return "Received";
    throw new CommitError(500, "Receiving records were posted but the purchase order did not reach a terminal receiving status.");
}

async function persistedResult(input: ReceivingCommitRequest, idempotentReplay: boolean): Promise<ReceivingCommitResult | null> {
    const receiptNumbers = input.lines.map(line => `REC-${input.shipmentId}-${line.lineId}-${line.storageLotId}`);
    const receiptParams = new URLSearchParams({
        "filter[receipt_no][_in]": receiptNumbers.join(","),
        fields: "purchase_order_product_id,receipt_no",
        limit: "-1"
    });
    const inventoryParams = new URLSearchParams({
        "filter[source_type][_eq]": "procurement",
        "filter[source_reference][_eq]": String(input.shipmentId),
        fields: "id",
        limit: "-1"
    });
    const [headerRows, receivingRows, inventoryRows] = await Promise.all([
        directusRows(
            `/items/purchase_order?filter[purchase_order_id][_eq]=${input.shipmentId}&fields=purchase_order_id,inventory_status,workflow_revision&limit=1`,
            "Unable to verify the final purchase-order status."
        ),
        directusRows(`/items/purchase_order_receiving?${receiptParams}`, "Unable to verify the created receiving records."),
        directusRows(`/items/inventory_lots?${inventoryParams}`, "Unable to verify the created inventory records.")
    ]);
    const header = headerRows[0];
    if (!header) throw new CommitError(404, "Purchase order not found.");
    const status = Number(header.inventory_status);
    const terminal = status === INVENTORY_STATUS.RECEIVED || status === INVENTORY_STATUS.REJECTED;
    if (!terminal) return null;
    if (receivingRows.length !== receiptNumbers.length || inventoryRows.length === 0) {
        throw new CommitError(409, "The purchase order is terminal but its receiving or inventory records are incomplete. Reconciliation is required.");
    }
    return {
        contractVersion: "v1",
        mode: "compatibility",
        commitReference: input.receiptNumber,
        idempotentReplay,
        shipmentId: input.shipmentId,
        status: statusLabel(status),
        workflowRevision: Number(header.workflow_revision || input.workflowRevision),
        receivingRecordIds: receivingRows.map(row => Number(row.purchase_order_product_id)),
        inventoryLotIds: inventoryRows.map(row => Number(row.id)),
        receiptNumbers
    };
}

export async function POST(request: Request) {
    try {
        if (!RECEIVING_POSTING_ENABLED) throw new CommitError(503, "Receiving posting is not enabled.");
        await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.receiving });
        const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || "";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
            throw new CommitError(400, "A valid UUID Idempotency-Key header is required.");
        }
        const parsed = receivingCommitRequestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid receiving commit request.", details: parsed.error.flatten() }, { status: 400 });
        }
        const completed = await persistedResult(parsed.data, true);
        if (completed) return NextResponse.json({ data: completed });

        const previewResponse = await previewReceiving(new Request(request.url.replace(/\/commit$/, "/preview"), {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
            body: JSON.stringify({
                shipmentId: parsed.data.shipmentId,
                receiptNumber: parsed.data.receiptNumber,
                destinationBranchId: parsed.data.destinationBranchId,
                lines: parsed.data.lines
            })
        }));
        const previewBody = await previewResponse.json();
        if (!previewResponse.ok) throw new CommitError(previewResponse.status, previewBody.error || "Receiving validation failed.");
        const preview = previewBody.data as ReceivingPreviewResult;
        if (preview.workflowRevision !== parsed.data.workflowRevision) {
            throw new CommitError(409, "The purchase order changed after preview. Generate a new preview before posting.");
        }

        const poLineParams = new URLSearchParams({
            "filter[purchase_order_id][_eq]": String(parsed.data.shipmentId),
            fields: "purchase_order_product_id,ordered_quantity",
            limit: "-1"
        });
        const poLines = await directusRows(
            `/items/purchase_order_products?${poLineParams}`,
            "Unable to verify complete purchase-order quantities."
        );
        const previewByLine = new Map(preview.lines.map(line => [line.lineId, line]));
        if (poLines.length === 0 || poLines.length !== preview.lines.length) {
            throw new CommitError(422, "Every purchase-order line must be included before final receiving can be posted.");
        }
        for (const poLine of poLines) {
            const lineId = Number(poLine.purchase_order_product_id);
            const ordered = Number(poLine.ordered_quantity || 0);
            const inspected = previewByLine.get(lineId)?.receivedQuantity;
            if (!Number.isFinite(ordered) || ordered <= 0 || inspected !== ordered) {
                throw new CommitError(422, `Line ${lineId} must account for all ${ordered} ordered unit(s) before final receiving can be posted.`);
            }
        }

        const requestLineById = new Map(parsed.data.lines.map(line => [line.lineId, line]));
        const legacyResponse = await handleQaReceivingPost(new Request(request.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                shipmentId: parsed.data.shipmentId,
                referenceNumber: parsed.data.receiptNumber,
                branchId: parsed.data.destinationBranchId,
                branchName: preview.destinationBranch.name,
                lineItemUpdates: preview.lines.map(result => {
                    const line = requestLineById.get(result.lineId)!;
                    return {
                        line_id: result.lineId,
                        product_id: line.productId,
                        quantity_received: result.receivedQuantity,
                        quantity_accepted: result.acceptedQuantity,
                        quantity_rejected: result.rejectedQuantity,
                        batch_no: line.supplierBatchNumber,
                        lot_id: line.storageLotId,
                        expiration_date: line.expiryDate,
                        rejection_reason: result.rejectionReason || line.remarks,
                        qa_status: result.acceptedQuantity === 0
                            ? "Rejected"
                            : result.rejectedQuantity > 0
                                ? "Partially Accepted"
                                : "Passed"
                    };
                })
            })
        }));
        const legacyBody = await legacyResponse.json();
        if (!legacyResponse.ok) {
            throw new CommitError(legacyResponse.status, legacyBody.error || "Failed to post receiving records.");
        }

        const committed = await persistedResult(parsed.data, legacyBody.idempotent === true);
        if (!committed) {
            throw new CommitError(500, "Receiving completed but persisted records could not be fully verified. Reconciliation is required.");
        }
        return NextResponse.json({ data: committed }, { status: legacyBody.idempotent ? 200 : 201 });
    } catch (error) {
        const status = error instanceof PurchaseOrderAuthorizationError
            ? error.status
            : error instanceof CommitError
                ? error.statusCode
                : 500;
        return NextResponse.json({ error: (error as Error).message || "Failed to post receiving." }, { status });
    }
}
