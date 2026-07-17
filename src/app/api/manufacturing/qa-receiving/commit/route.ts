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
    type FinalReceivingMovement,
    type FinalReceivingRecord,
    type ReceivingCommitRequest,
    type ReceivingCommitResult
} from "../_commit-contract";
import type { ReceivingPreviewResult } from "../_preview-domain";
import { POST as previewReceiving } from "../preview/route";
import { normalizeReceivingLotAllocations } from "../_lot-allocation";

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

function relationId(value: unknown, key: string): number {
    return Number(value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value);
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
    const receiptNumbers = input.lines.map(line => {
        const primaryLotId = line.storageLotId || normalizeReceivingLotAllocations(line.acceptedQuantity, line.acceptedLotAllocations, line.storageLotId)[0]?.storageLotId;
        return `REC-${input.shipmentId}-${line.lineId}-${primaryLotId}`;
    });
    const receiptParams = new URLSearchParams({
        "filter[receipt_no][_in]": receiptNumbers.join(","),
        fields: "purchase_order_product_id,purchase_order_id,receipt_no,product_id,branch_id,lot_id,batch_no,received_quantity,quantity_rejected,unit_price,final_landed_unit_cost,qa_status,expiry_date,received_date",
        limit: "-1"
    });
    const inventoryParams = new URLSearchParams({
        "filter[source_type][_eq]": "procurement",
        "filter[source_reference][_eq]": String(input.shipmentId),
        fields: "id,product_id,branch_id,lot_id,batch_no",
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
    if (
        receivingRows.length !== receiptNumbers.length
        || new Set(receivingRows.map(row => String(row.receipt_no))).size !== receiptNumbers.length
        || inventoryRows.length === 0
    ) {
        throw new CommitError(409, "The purchase order is terminal but its receiving or inventory records are incomplete. Reconciliation is required.");
    }
    const receivingIds = receivingRows.map(row => Number(row.purchase_order_product_id));
    const movementParams = new URLSearchParams({
        "filter[source_document_id][_in]": receivingIds.join(","),
        fields: "movement_id,product_id,lot_id,branch_id,transaction_type_id,source_document_id,source_document_no,batch_no,quantity",
        limit: "-1"
    });
    const movementRows = await directusRows(
        `/items/inventory_movements?${movementParams.toString()}`,
        "Unable to verify the created inventory movements."
    );
    const expectedMovementCount = input.lines.reduce((count, line) =>
        count + normalizeReceivingLotAllocations(line.acceptedQuantity, line.acceptedLotAllocations, line.storageLotId).length
        + (line.rejectedQuantity > 0 ? 1 : 0), 0);
    if (movementRows.length !== expectedMovementCount) {
        throw new CommitError(409, "The purchase order is terminal but its inventory movements are incomplete. Reconciliation is required.");
    }

    const finalMovements: FinalReceivingMovement[] = [];
    const receivingRecords: FinalReceivingRecord[] = [];
    for (const line of input.lines) {
        const acceptedLotAllocations = normalizeReceivingLotAllocations(line.acceptedQuantity, line.acceptedLotAllocations, line.storageLotId);
        const primaryLotId = line.storageLotId || acceptedLotAllocations[0]?.storageLotId;
        const receiptNo = `REC-${input.shipmentId}-${line.lineId}-${primaryLotId}`;
        const receiving = receivingRows.find(row => row.receipt_no === receiptNo);
        const receivingLineId = Number(receiving?.purchase_order_product_id);
        if (!receiving || !receivingLineId) {
            throw new CommitError(409, `Receiving record for line ${line.lineId} could not be correlated.`);
        }
        const candidates = movementRows.filter(row => relationId(row.source_document_id, "purchase_order_product_id") === receivingLineId);
        const routeInputs = [
            ...acceptedLotAllocations.map(allocation => ({
                kind: "Passed" as const,
                quantity: allocation.quantity,
                storageLotId: allocation.storageLotId,
                passed: true
            })),
            ...(line.rejectedQuantity > 0 && primaryLotId
                ? [{ kind: "Rejected" as const, quantity: line.rejectedQuantity, storageLotId: primaryLotId, passed: false }]
                : [])
        ];

        for (const route of routeInputs) {
            const matches = candidates.filter(row => {
                const branchId = relationId(row.branch_id, "id");
                return (route.passed ? branchId === input.destinationBranchId : branchId !== input.destinationBranchId)
                    && Number(row.quantity) === route.quantity
                    && relationId(row.lot_id, "lot_id") === route.storageLotId
                    && String(row.source_document_no || "") === receiptNo;
            });
            if (matches.length !== 1) {
                throw new CommitError(409, `${route.kind} movement for line ${line.lineId} could not be correlated uniquely.`);
            }
            const movement = matches[0];
            const branchId = relationId(movement.branch_id, "id");
            const productId = relationId(movement.product_id, "product_id");
            const storageLotId = relationId(movement.lot_id, "lot_id");
            const inventoryMatches = inventoryRows.filter(row =>
                relationId(row.product_id, "product_id") === productId
                && relationId(row.branch_id, "id") === branchId
                && relationId(row.lot_id, "lot_id") === storageLotId
                && String(row.batch_no || "") === String(movement.batch_no || "")
            );
            if (inventoryMatches.length !== 1) {
                throw new CommitError(409, `${route.kind} inventory lot for line ${line.lineId} could not be correlated uniquely.`);
            }
            finalMovements.push({
                movementId: Number(movement.movement_id),
                lineId: line.lineId,
                kind: route.kind,
                receivingLineId,
                inventoryLotId: Number(inventoryMatches[0].id),
                productId,
                storageLotId,
                branchId,
                transactionTypeId: relationId(movement.transaction_type_id, "transaction_type_id"),
                sourceDocumentNo: receiptNo,
                quantity: route.quantity
            });
        }

        receivingRecords.push({
            receivingRecordId: receivingLineId,
            lineId: line.lineId,
            shipmentId: relationId(receiving.purchase_order_id, "purchase_order_id") || input.shipmentId,
            productId: relationId(receiving.product_id, "product_id"),
            receiptNumber: String(receiving.receipt_no),
            branchId: relationId(receiving.branch_id, "id"),
            storageLotId: relationId(receiving.lot_id, "lot_id"),
            batchNumber: String(receiving.batch_no || line.supplierBatchNumber),
            receivedQuantity: Number(receiving.received_quantity || 0),
            rejectedQuantity: Number(receiving.quantity_rejected || 0),
            unitPrice: Number(receiving.unit_price || 0),
            finalLandedUnitCost: Number(receiving.final_landed_unit_cost || 0),
            qaStatus: String(receiving.qa_status || ""),
            expirationDate: receiving.expiry_date ? String(receiving.expiry_date) : null,
            receivedDate: receiving.received_date ? String(receiving.received_date) : null,
            inventoryLotIds: [...new Set(finalMovements
                .filter(movement => movement.receivingLineId === receivingLineId)
                .map(movement => movement.inventoryLotId))]
        });
    }
    return {
        contractVersion: "v1",
        mode: "compatibility",
        commitReference: input.receiptNumber,
        idempotentReplay,
        shipmentId: input.shipmentId,
        status: statusLabel(status),
        workflowRevision: Number(header.workflow_revision || input.workflowRevision),
        receivingRecordIds: receivingIds,
        inventoryLotIds: [...new Set(finalMovements.map(movement => movement.inventoryLotId))],
        receiptNumbers,
        receivingRecords,
        movements: finalMovements
    };
}

export async function POST(request: Request) {
    try {
        if (!RECEIVING_POSTING_ENABLED) throw new CommitError(503, "Receiving posting is not enabled.");
        const actor = await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.receiving });
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
                        lot_id: line.storageLotId || line.acceptedLotAllocations[0]?.storageLotId,
                        accepted_lot_allocations: line.acceptedLotAllocations.map(allocation => ({
                            storage_lot_id: allocation.storageLotId,
                            quantity: allocation.quantity
                        })),
                        manufacturing_date: line.manufacturingDate,
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
        }), { actorUserId: actor.userId });
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
