import PurchaseOrderApprovalPage from "../_components/purchase-order-approval-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function PlantApprovalPage() {
    return <PurchaseOrderApprovalPage stage="Plant" />;
}
