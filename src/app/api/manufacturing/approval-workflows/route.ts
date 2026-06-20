import { NextRequest, NextResponse } from "next/server";
import { ThresholdRule, ApprovalRequest } from "@/modules/manufacturing-management/approval-workflows/types";

const DEFAULT_RULES = [
    {
        min_margin: 15,
        action: "require_approval",
        role_required: "Finance Manager",
        description: "Requires Finance Manager sign-off for gross margins below 15%.",
        is_active: true
    },
    {
        min_margin: 10,
        action: "require_approval",
        role_required: "Director",
        description: "Requires executive Director approval for high-risk low margin orders below 10%.",
        is_active: true
    },
    {
        min_margin: 5,
        action: "auto_reject",
        role_required: "System Admin",
        description: "Automatically rejects orders with margins below 5% to prevent direct losses.",
        is_active: true
    }
];

export async function GET() {
    try {
        const directusUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN || "test";
        const headers = {
            "Authorization": `Bearer ${staticToken}`,
            "Content-Type": "application/json"
        };

        const [rulesRes, requestsRes] = await Promise.all([
            fetch(`${directusUrl}/items/approval_threshold_rules?limit=-1`, { headers, cache: "no-store" }),
            fetch(`${directusUrl}/items/approval_threshold_requests?limit=-1`, { headers, cache: "no-store" })
        ]);

        if (!rulesRes.ok || !requestsRes.ok) {
            throw new Error(`Failed to fetch from Directus. Rules: ${rulesRes.status}, Requests: ${requestsRes.status}`);
        }

        const rulesData = await rulesRes.json();
        const requestsData = await requestsRes.json();

        let rulesList = rulesData.data || [];
        let requestsList = requestsData.data || [];

        // Auto-seed if both are empty in Directus
        if (rulesList.length === 0 && requestsList.length === 0) {
            try {
                console.log("[Workflow API Seeder] Seeding Directus tables with default threshold rules...");
                // Seed rules
                for (const r of DEFAULT_RULES) {
                    await fetch(`${directusUrl}/items/approval_threshold_rules`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(r)
                    });
                }
                // Re-fetch
                const [rRes, reqRes] = await Promise.all([
                    fetch(`${directusUrl}/items/approval_threshold_rules?limit=-1`, { headers, cache: "no-store" }),
                    fetch(`${directusUrl}/items/approval_threshold_requests?limit=-1`, { headers, cache: "no-store" })
                ]);
                const rD = await rRes.json();
                const reqD = await reqRes.json();
                rulesList = rD.data || [];
                requestsList = reqD.data || [];
            } catch (seedErr) {
                console.error("[Workflow API Seeder] Seeding failed:", seedErr);
            }
        }

        return NextResponse.json({
            rules: rulesList,
            requests: requestsList
        });
    } catch (e) {
        console.error("API Error in approval-workflows GET:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch workflow data" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, data } = body as { type: "rule" | "request"; data: Partial<ThresholdRule> & Partial<ApprovalRequest> };

        if (!type || !data) {
            return NextResponse.json({ error: "Missing type or data parameters" }, { status: 400 });
        }

        const directusUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN || "test";
        const headers = {
            "Authorization": `Bearer ${staticToken}`,
            "Content-Type": "application/json"
        };

        const collection = type === "rule" ? "approval_threshold_rules" : "approval_threshold_requests";
        let res;

        if (data.id) {
            res = await fetch(`${directusUrl}/items/${collection}/${data.id}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(data)
            });
        } else {
            const payload = { ...data };
            if (type === "request") {
                payload.status = payload.status || "pending";
                payload.requested_at = payload.requested_at || new Date().toISOString();
            } else {
                payload.is_active = payload.is_active ?? true;
            }
            res = await fetch(`${directusUrl}/items/${collection}`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            });
        }

        if (!res.ok) {
            const errTxt = await res.text();
            return NextResponse.json({ error: `Failed to save to cloud workflow db: ${res.status} - ${errTxt}` }, { status: res.status });
        }

        // Return fresh Directus status
        const [rRes, reqRes] = await Promise.all([
            fetch(`${directusUrl}/items/approval_threshold_rules?limit=-1`, { headers, cache: "no-store" }),
            fetch(`${directusUrl}/items/approval_threshold_requests?limit=-1`, { headers, cache: "no-store" })
        ]);

        if (!rRes.ok || !reqRes.ok) {
            return NextResponse.json({ error: "Failed to reload fresh data from cloud" }, { status: 500 });
        }

        const rData = await rRes.json();
        const reqData = await reqRes.json();
        return NextResponse.json({
            success: true,
            db: {
                rules: rData.data || [],
                requests: reqData.data || []
            }
        });
    } catch (e) {
        console.error("API error in workflow POST:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to update workflow data" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type");
        const idStr = searchParams.get("id");

        if (!type || !idStr) {
            return NextResponse.json({ error: "Missing required type or id parameters" }, { status: 400 });
        }

        const id = parseInt(idStr);
        const directusUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
        const staticToken = process.env.DIRECTUS_STATIC_TOKEN || "test";
        const headers = {
            "Authorization": `Bearer ${staticToken}`
        };

        const collection = type === "rule" ? "approval_threshold_rules" : "approval_threshold_requests";
        const res = await fetch(`${directusUrl}/items/${collection}/${id}`, {
            method: "DELETE",
            headers
        });

        if (!res.ok) {
            const errTxt = await res.text();
            return NextResponse.json({ error: `Failed to delete from cloud workflow db: ${res.status} - ${errTxt}` }, { status: res.status });
        }

        const [rRes, reqRes] = await Promise.all([
            fetch(`${directusUrl}/items/approval_threshold_rules?limit=-1`, { headers, cache: "no-store" }),
            fetch(`${directusUrl}/items/approval_threshold_requests?limit=-1`, { headers, cache: "no-store" })
        ]);

        if (!rRes.ok || !reqRes.ok) {
            return NextResponse.json({ error: "Failed to reload fresh data from cloud" }, { status: 500 });
        }

        const rData = await rRes.json();
        const reqData = await reqRes.json();
        return NextResponse.json({
            success: true,
            db: {
                rules: rData.data || [],
                requests: reqData.data || []
            }
        });
    } catch (e) {
        console.error("API error in workflow DELETE:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to delete workflow item" }, { status: 500 });
    }
}
