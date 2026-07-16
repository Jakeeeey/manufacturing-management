export type ReceivingDisposition = "Not Received" | "Passed" | "Partially Accepted" | "Rejected";

export interface ReceivingQuantities {
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
}

export class ReceivingQuantityError extends Error {}

export function deriveReceivingDisposition(quantities: ReceivingQuantities): ReceivingDisposition {
    const { receivedQuantity, acceptedQuantity, rejectedQuantity } = quantities;
    if (![receivedQuantity, acceptedQuantity, rejectedQuantity].every(Number.isFinite)) {
        throw new ReceivingQuantityError("Receiving quantities must be finite numbers.");
    }
    if (receivedQuantity < 0 || acceptedQuantity < 0 || rejectedQuantity < 0) {
        throw new ReceivingQuantityError("Receiving quantities cannot be negative.");
    }
    if (receivedQuantity === 0 && acceptedQuantity === 0 && rejectedQuantity === 0) return "Not Received";
    if (receivedQuantity <= 0) {
        throw new ReceivingQuantityError("Received quantity must be greater than zero for an included line.");
    }
    if (Math.abs(receivedQuantity - acceptedQuantity - rejectedQuantity) > 1e-9) {
        throw new ReceivingQuantityError("Accepted quantity plus rejected quantity must equal received quantity.");
    }
    if (acceptedQuantity === receivedQuantity) return "Passed";
    if (rejectedQuantity === receivedQuantity) return "Rejected";
    return "Partially Accepted";
}

export function applyQaDecision(quantities: ReceivingQuantities, decision: QaChecklistDecision) {
    const acceptedQuantity = decision.forceRejected ? 0 : quantities.acceptedQuantity;
    const rejectedQuantity = decision.forceRejected ? quantities.receivedQuantity : quantities.rejectedQuantity;
    return {
        disposition: deriveReceivingDisposition({
            receivedQuantity: quantities.receivedQuantity,
            acceptedQuantity,
            rejectedQuantity
        }),
        receivedQuantity: quantities.receivedQuantity,
        acceptedQuantity,
        rejectedQuantity,
        forceRejected: decision.forceRejected,
        rejectionReason: decision.rejectionReason
    };
}
import type { QaChecklistDecision } from "./_purchase-specification-domain";
