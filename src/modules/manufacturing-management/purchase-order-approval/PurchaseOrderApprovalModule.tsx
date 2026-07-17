"use client";

import ApprovalModule from "../approval/ApprovalModule";
import type { PurchaseOrderDecisionStage } from "../purchase-order/types";

export default function PurchaseOrderApprovalModule({ stage }: { stage: PurchaseOrderDecisionStage }) {
    return <ApprovalModule stage={stage} />;
}
