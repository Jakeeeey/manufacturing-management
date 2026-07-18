import PurchaseOrderApprovalPage from "../approval/_components/purchase-order-approval-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function FinanceApprovalPage() {
    return <PurchaseOrderApprovalPage stage="Finance" />;
}
