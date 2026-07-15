import { NextResponse } from "next/server";
import { z } from "zod";
import { RECEIVING_QUEUE_INVENTORY_STATUS_IDS } from "../../procurement/_domain";
import { procurementDirectusFetch } from "../../procurement/_directus";
import {
    PURCHASE_ORDER_MODULE_PATHS,
    PurchaseOrderAuthorizationError,
    requirePurchaseOrderModuleAccess
} from "../../purchase-orders/_auth";
import { fetchProductQaSpecifications, PurchaseQaConfigurationError } from "../../qa/_purchase-specifications";
import { evaluateQaChecklist } from "../../qa/_purchase-specification-domain";
import { applyQaDecision, deriveReceivingDisposition, ReceivingQuantityError } from "../../qa/_receiving-evaluation";
import {
    buildReceivingRoutes,
    type ReceivingPreviewLineResult,
    type ReceivingRouteBranch,
    type ReceivingRouteTransactionType
} from "../_preview-domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const quantity = z.number().finite().nonnegative();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const lineSchema = z.object({
    lineId: z.number().int().positive(),
    productId: z.number().int().positive(),
    receivedQuantity: quantity,
    acceptedQuantity: quantity,
    rejectedQuantity: quantity,
    storageLotId: z.number().int().positive().nullable(),
    supplierBatchNumber: z.string().max(50),
    manufacturingDate: optionalDate,
    expiryDate: optionalDate,
    remarks: z.string().max(255).nullable(),
    isPackaging: z.boolean(),
    readings: z.array(z.object({
        specId: z.number().int().positive(),
        actualReading: z.string()
    }))
});
const requestSchema = z.object({
    shipmentId: z.number().int().positive(),
    receiptNumber: z.string().trim().min(1).max(50),
    destinationBranchId: z.number().int().positive(),
    lines: z.array(lineSchema).min(1)
});

class ReceivingPreviewError extends Error {
    constructor(message: string, readonly status = 422) {
        super(message);
    }
}

interface DirectusBranch {
    id?: unknown;
    branch_name?: unknown;
    branch_code?: unknown;
    isActive?: unknown;
    isBadStock?: unknown;
    bad_stock_branch_id?: unknown;
}

interface DirectusMovementType {
    transaction_type_id?: unknown;
    type_name?: unknown;
    direction?: unknown;
    origin_table?: unknown;
}

function rows(body: unknown): Record<string, unknown>[] {
    return body && typeof body === "object" && "data" in body && Array.isArray(body.data)
        ? body.data as Record<string, unknown>[]
        : [];
}

function positiveInteger(value: unknown, relationKey?: string): number | null {
    const raw = relationKey && value && typeof value === "object"
        ? (value as Record<string, unknown>)[relationKey]
        : value;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function enabled(value: unknown): boolean {
    return value === true || Number(value) === 1;
}

function mapBranch(branch: DirectusBranch): ReceivingRouteBranch {
    const id = positiveInteger(branch.id);
    if (!id) throw new ReceivingPreviewError("Receiving branch configuration is invalid.", 503);
    return {
        id,
        name: String(branch.branch_name || `Branch ${id}`),
        code: String(branch.branch_code || `BR-${id}`)
    };
}

function movementType(
    movementTypes: DirectusMovementType[],
    typeName: string
): ReceivingRouteTransactionType {
    const matches = movementTypes.filter(type =>
        type.type_name === typeName
        && type.direction === "IN"
        && type.origin_table === "purchase_order_receiving"
    );
    if (matches.length !== 1) {
        throw new ReceivingPreviewError(`Inventory movement type "${typeName}" is not configured uniquely.`, 503);
    }
    const id = positiveInteger(matches[0].transaction_type_id);
    if (!id) throw new ReceivingPreviewError(`Inventory movement type "${typeName}" has an invalid ID.`, 503);
    return { id, name: typeName };
}

async function loadBranch(branchId: number): Promise<DirectusBranch> {
    const params = new URLSearchParams({
        fields: "id,branch_name,branch_code,isActive,isBadStock,bad_stock_branch_id"
    });
    const response = await procurementDirectusFetch(`/items/branches/${branchId}?${params.toString()}`);
    if (response.status === 404) throw new ReceivingPreviewError("The selected receiving branch does not exist.");
    if (!response.ok) throw new ReceivingPreviewError("Unable to verify receiving branch configuration.", 503);
    const body = await response.json();
    if (!body?.data || typeof body.data !== "object") {
        throw new ReceivingPreviewError("The selected receiving branch does not exist.");
    }
    return body.data as DirectusBranch;
}

async function loadConfiguredBadStockBranch(source: DirectusBranch): Promise<DirectusBranch | null> {
    if (!source.bad_stock_branch_id) return null;
    if (typeof source.bad_stock_branch_id === "object") return source.bad_stock_branch_id as DirectusBranch;
    const id = positiveInteger(source.bad_stock_branch_id);
    return id ? loadBranch(id) : null;
}

export async function POST(request: Request) {
    try {
        const actor = await requirePurchaseOrderModuleAccess({ modulePath: PURCHASE_ORDER_MODULE_PATHS.receiving });
        const parsed = requestSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid receiving preview request.", details: parsed.error.flatten() }, { status: 400 });
        }

        const { shipmentId, receiptNumber, destinationBranchId, lines } = parsed.data;
        const lineIds = lines.map(line => line.lineId);
        if (new Set(lineIds).size !== lineIds.length) {
            throw new ReceivingPreviewError("Duplicate purchase-order lines are not allowed.");
        }
        if (!lines.some(line => line.receivedQuantity > 0)) {
            throw new ReceivingPreviewError("At least one line must have a positive received quantity.");
        }

        for (const line of lines) {
            const disposition = deriveReceivingDisposition(line);
            if (disposition === "Not Received") continue;
            if (!line.storageLotId) throw new ReceivingPreviewError(`Select a storage lot for line ${line.lineId}.`);
            if (!line.supplierBatchNumber.trim()) throw new ReceivingPreviewError(`Enter a supplier batch number for line ${line.lineId}.`);
            if (!line.isPackaging && (!line.manufacturingDate || !line.expiryDate)) {
                throw new ReceivingPreviewError(`Manufacturing and expiry dates are required for raw-material line ${line.lineId}.`);
            }
            if (line.manufacturingDate && line.expiryDate && line.manufacturingDate > line.expiryDate) {
                throw new ReceivingPreviewError(`Manufacturing date cannot be later than expiry date for line ${line.lineId}.`);
            }
        }

        const requestedLotIds = [...new Set(lines
            .filter(line => line.receivedQuantity > 0)
            .map(line => line.storageLotId as number))];
        const [headerResponse, lineResponse, lotResponse, destinationBranch, movementTypeResponse] = await Promise.all([
            procurementDirectusFetch(`/items/purchase_order/${shipmentId}?fields=purchase_order_id,inventory_status`),
            procurementDirectusFetch(`/items/purchase_order_products?filter[purchase_order_product_id][_in]=${lineIds.join(",")}&fields=purchase_order_product_id,purchase_order_id,product_id&limit=${lineIds.length}`),
            procurementDirectusFetch(`/items/lots?filter[lot_id][_in]=${requestedLotIds.join(",")}&fields=lot_id&limit=${requestedLotIds.length}`),
            loadBranch(destinationBranchId),
            procurementDirectusFetch("/items/inventory_transaction_types?fields=transaction_type_id,type_name,direction,origin_table&limit=-1")
        ]);
        if (headerResponse.status === 404) throw new ReceivingPreviewError("Purchase order not found.", 404);
        if (!headerResponse.ok || !lineResponse.ok || !lotResponse.ok || !movementTypeResponse.ok) {
            throw new ReceivingPreviewError("Unable to validate receiving preview reference data.", 503);
        }

        const header = (await headerResponse.json()).data as Record<string, unknown>;
        const statusId = positiveInteger(header.inventory_status, "transaction_status_id") || Number(header.inventory_status);
        if (!RECEIVING_QUEUE_INVENTORY_STATUS_IDS.some(eligible => eligible === statusId)) {
            throw new ReceivingPreviewError("This purchase order is not eligible for receiving.", 409);
        }
        if (!enabled(destinationBranch.isActive) || enabled(destinationBranch.isBadStock)) {
            throw new ReceivingPreviewError("Select an active standard branch as the receiving destination.");
        }

        const poLines = rows(await lineResponse.json());
        if (poLines.length !== lineIds.length) {
            throw new ReceivingPreviewError("One or more purchase-order lines do not exist.");
        }
        const poLineById = new Map(poLines.map(line => [positiveInteger(line.purchase_order_product_id), line]));
        for (const line of lines) {
            const stored = poLineById.get(line.lineId);
            if (!stored || positiveInteger(stored.purchase_order_id, "purchase_order_id") !== shipmentId) {
                throw new ReceivingPreviewError(`Line ${line.lineId} does not belong to this purchase order.`);
            }
            if (positiveInteger(stored.product_id, "product_id") !== line.productId) {
                throw new ReceivingPreviewError(`Product mismatch for line ${line.lineId}.`);
            }
        }

        const validLotIds = new Set(rows(await lotResponse.json()).map(lot => positiveInteger(lot.lot_id)));
        if (requestedLotIds.some(id => !validLotIds.has(id))) {
            throw new ReceivingPreviewError("One or more storage lots do not exist.");
        }

        const movementTypes = rows(await movementTypeResponse.json()) as DirectusMovementType[];
        const needsAcceptedRoute = lines.some(line => line.acceptedQuantity > 0);
        const needsRejectedRouteBeforeQa = lines.some(line => line.rejectedQuantity > 0);
        const passedType = needsAcceptedRoute
            ? movementType(movementTypes, "Purchase Receiving QA")
            : null;

        const includedProductIds = [...new Set(lines
            .filter(line => line.receivedQuantity > 0)
            .map(line => line.productId))];
        const specificationEntries = await Promise.all(includedProductIds.map(async productId => [
            productId,
            await fetchProductQaSpecifications(productId)
        ] as const));
        const specificationsByProduct = new Map(specificationEntries);

        const evaluated = lines.map(line => {
            const enteredDisposition = deriveReceivingDisposition(line);
            if (enteredDisposition === "Not Received") {
                if (line.readings.length > 0) {
                    throw new ReceivingPreviewError(`Line ${line.lineId} cannot include QA readings when it is not received.`);
                }
                return {
                    line,
                    result: {
                        lineId: line.lineId,
                        disposition: enteredDisposition,
                        receivedQuantity: 0,
                        acceptedQuantity: 0,
                        rejectedQuantity: 0,
                        forceRejected: false,
                        rejectionReason: null,
                        evaluations: []
                    }
                };
            }

            const specifications = specificationsByProduct.get(line.productId) || [];
            const readingBySpecId = new Map<number, string>();
            for (const reading of line.readings) {
                if (readingBySpecId.has(reading.specId)) {
                    throw new ReceivingPreviewError(`Line ${line.lineId} contains duplicate QA readings.`);
                }
                readingBySpecId.set(reading.specId, reading.actualReading);
            }
            const configuredIds = new Set(specifications.map(specification => specification.specId));
            if (line.readings.some(reading => !configuredIds.has(reading.specId)) || readingBySpecId.size !== configuredIds.size) {
                throw new ReceivingPreviewError(`Line ${line.lineId} QA readings do not match the current product specifications.`);
            }
            const decision = evaluateQaChecklist(specifications.map(specification => ({
                specification,
                reading: readingBySpecId.get(specification.specId)
            })));
            if (!decision.complete) throw new ReceivingPreviewError(`Complete all QA readings for line ${line.lineId}.`);
            return {
                line,
                result: {
                    lineId: line.lineId,
                    ...applyQaDecision(line, decision),
                    evaluations: decision.evaluations
                }
            };
        });

        const needsRejectedRoute = needsRejectedRouteBeforeQa || evaluated.some(entry => entry.result.rejectedQuantity > 0);
        const badStockBranch = needsRejectedRoute ? await loadConfiguredBadStockBranch(destinationBranch) : null;
        if (needsRejectedRoute && (!badStockBranch || !enabled(badStockBranch.isActive) || !enabled(badStockBranch.isBadStock))) {
            throw new ReceivingPreviewError("The selected destination has no active Bad Order branch configured for rejected inventory.");
        }
        const rejectedType = needsRejectedRoute
            ? movementType(movementTypes, "QA Reject / Bad Order Receipt")
            : null;
        const passedBranch = mapBranch(destinationBranch);
        const rejectedBranch = badStockBranch ? mapBranch(badStockBranch) : null;

        const data: ReceivingPreviewLineResult[] = evaluated.map(({ line, result }) => ({
            ...result,
            routes: result.receivedQuantity === 0
                ? []
                : buildReceivingRoutes({
                    acceptedQuantity: result.acceptedQuantity,
                    rejectedQuantity: result.rejectedQuantity,
                    createdBy: actor.userId,
                    sourceDocumentNo: receiptNumber,
                    storageLotId: line.storageLotId as number,
                    supplierBatchNumber: line.supplierBatchNumber.trim(),
                    manufacturingDate: line.manufacturingDate,
                    expiryDate: line.expiryDate,
                    remarks: line.remarks?.trim() || null,
                    rejectionReason: result.rejectionReason
                }, passedBranch, rejectedBranch, passedType, rejectedType)
        }));

        return NextResponse.json({ data });
    } catch (error) {
        const status = error instanceof PurchaseOrderAuthorizationError || error instanceof PurchaseQaConfigurationError
            ? error.status
            : error instanceof ReceivingPreviewError
                ? error.status
                : error instanceof ReceivingQuantityError
                    ? 422
                    : 500;
        return NextResponse.json({ error: (error as Error).message || "Failed to generate receiving preview." }, { status });
    }
}
