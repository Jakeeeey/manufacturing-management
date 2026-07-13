/* eslint-disable */
import { NextResponse } from "next/server";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "test";

const headers: Record<string, string> = {
    "Content-Type": "application/json"
};
if (DIRECTUS_STATIC_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
}

// GET: Retrieves all daily yield QA inspections
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const joId = searchParams.get("joId");
        
        let url = `${DIRECTUS_URL}/items/manufacturing_daily_qa_inspections?limit=-1&sort=-inspected_at`;
        if (joId) {
            url += `&filter[job_order_id][_eq]=${joId}`;
        }

        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) {
            throw new Error("Failed to fetch daily QA inspections");
        }
        const json = await res.json();
        return NextResponse.json(json.data || []);
    } catch (e) {
        console.error("Error fetching daily QA inspections:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch inspections" }, { status: 500 });
    }
}

// POST: Creates daily yield QA inspections (supports array for paper-based checklist batch entries)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const inspectionsList = Array.isArray(body) ? body : [body];

        if (inspectionsList.length === 0) {
            return NextResponse.json({ error: "No inspection data provided" }, { status: 400 });
        }

        const firstEntry = inspectionsList[0];
        const { jobOrderId, ledgerId } = firstEntry;

        if (!jobOrderId || !ledgerId) {
            return NextResponse.json({ error: "Missing required fields: jobOrderId, ledgerId" }, { status: 400 });
        }

        const timestamp = new Date().toISOString();

        for (const entry of inspectionsList) {
            const { 
                joRouteId, 
                inspectorId, 
                moisturePercentage, 
                acidityPh, 
                sensoryStatus, 
                weightCheckPassed, 
                labStatus, 
                actionTaken, 
                remarks, 
                qaParameters 
            } = entry;

            if (!inspectorId) {
                return NextResponse.json({ error: "Missing required field: inspectorId" }, { status: 400 });
            }

            const payload = {
                job_order_id: Number(jobOrderId),
                jo_route_id: joRouteId ? Number(joRouteId) : null,
                ledger_id: Number(ledgerId),
                inspector_id: Number(inspectorId),
                moisture_percentage: moisturePercentage !== undefined && moisturePercentage !== "" ? Number(moisturePercentage) : null,
                acidity_ph: acidityPh !== undefined && acidityPh !== "" ? Number(acidityPh) : null,
                sensory_status: sensoryStatus || "Passed",
                weight_check_passed: weightCheckPassed ? 1 : 0,
                lab_status: labStatus || "Passed",
                action_taken: actionTaken || "Released",
                inspected_at: timestamp,
                remarks: remarks || ""
            };

            const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_daily_qa_inspections`, {
                method: "POST",
                headers,
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error("Failed to write daily QA inspection record: " + await res.text());
            }

            // If qaParameters is provided, insert them into manufacturing_job_order_qa_records
            if (qaParameters && qaParameters.length > 0 && joRouteId) {
                for (const param of qaParameters) {
                    const valNumeric = param.value !== undefined && param.value !== "" ? Number(param.value) : null;
                    const valText = typeof param.value === "string" ? param.value : null;
                    const valBool = typeof param.value === "boolean" ? param.value : null;

                    const qaPayload = {
                        job_order_id: Number(jobOrderId),
                        jo_route_id: Number(joRouteId),
                        parameter_id: Number(param.parameter_id),
                        value_text: valText,
                        value_numeric: valNumeric,
                        value_boolean: valBool,
                        is_passed: !param.is_failed,
                        inspected_by: Number(inspectorId),
                        inspected_at: timestamp,
                        remarks: `Daily QA Audit | Yield Log ID: ${ledgerId} | ${param.remarks || "Daily QA check"}`
                    };

                    await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(qaPayload)
                    }).catch(err => console.error("Failed to insert QA record in Daily QA:", err));
                }
            }
        }

        // Fetch all routes (steps) for this Job Order
        const routesRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_routes?filter[job_order_id][_eq]=${jobOrderId}&fields=jo_route_id,job_order_id,sequence_order,work_center_id,operation_id,planned_setup_hours,planned_run_hours,actual_setup_hours,actual_run_hours,estimated_labor_cost,actual_labor_cost`, { headers, cache: "no-store" });
        const routes = routesRes.ok ? (await routesRes.json()).data || [] : [];

        // Fetch all daily QA inspections for this ledgerId
        const inspectionsFetch = await fetch(`${DIRECTUS_URL}/items/manufacturing_daily_qa_inspections?filter[ledger_id][_eq]=${ledgerId}`, { headers, cache: "no-store" });
        const inspections = inspectionsFetch.ok ? (await inspectionsFetch.json()).data || [] : [];

        // Check if there are failed inspections or if all steps have been QA'd
        const hasFailedInspection = inspections.some((ins: any) => 
            ins.sensory_status === "Failed" || ins.lab_status === "Failed" || ins.action_taken === "Quarantined"
        );

        let finalLedgerStatus = "Pending";
        if (hasFailedInspection) {
            finalLedgerStatus = "QA Hold";
        } else {
            const allStepsAudited = routes.length === 0 || routes.every((r: any) => {
                return inspections.some((ins: any) => Number(ins.jo_route_id) === Number(r.jo_route_id));
            });
            if (allStepsAudited) {
                finalLedgerStatus = "Passed";
            } else {
                finalLedgerStatus = "Pending"; // still pending other steps
            }
        }

        // Sync QA disposition back to yield ledger (only "Passed" if all steps have been QA'd)
        await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_yield_ledger/${ledgerId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ qa_status: finalLedgerStatus })
        }).catch(err => console.error("Failed to patch yield ledger status:", err));

        // Sync inventory lot status as well
        try {
            // Robust lot resolver:
            // First get ledger details
            const ledgerFetch = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_yield_ledger/${ledgerId}`, { headers, cache: "no-store" });
            if (ledgerFetch.ok) {
                const ledgerEntry = (await ledgerFetch.json()).data;
                if (ledgerEntry) {
                    const shiftName = ledgerEntry.shift_name;
                    const joId = ledgerEntry.job_order_id;
                    
                    // Get job order details
                    const joFetch = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joId}`, { headers, cache: "no-store" });
                    if (joFetch.ok) {
                        const joData = (await joFetch.json()).data;
                        if (joData) {
                            const jobOrderNo = joData.job_order_no;
                            const producedProductId = joData.product_id;
                            const branchId = joData.branch_id || 1;

                            // Find matching lots using source_type/source_reference OR remarks/product/branch
                            const lotFilter = encodeURIComponent(JSON.stringify({
                                _or: [
                                    {
                                        _and: [
                                            { source_type: { _eq: "yield_ledger" } },
                                            { source_reference: { _eq: String(ledgerId) } }
                                        ]
                                    },
                                    {
                                        _and: [
                                            { product_id: { _eq: producedProductId } },
                                            { branch_id: { _eq: branchId } },
                                            { remarks: { _contains: `Yield from Job Order ${jobOrderNo}` } },
                                            { remarks: { _contains: `Shift: ${shiftName}` } }
                                        ]
                                    }
                                ]
                            }));

                            const lotRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${lotFilter}`, { headers, cache: "no-store" });
                            if (lotRes.ok) {
                                const lots = (await lotRes.json()).data || [];
                                for (const lot of lots) {
                                    await fetch(`${DIRECTUS_URL}/items/inventory_lots/${lot.id}`, {
                                        method: "PATCH",
                                        headers,
                                        body: JSON.stringify({ qa_status: finalLedgerStatus === "Passed" ? "Passed" : (finalLedgerStatus === "QA Hold" ? "QA Hold" : "Pending") })
                                    }).catch(err => console.error(`Failed to patch inventory lot ${lot.id} status:`, err));
                                }
                            }
                        }
                    }
                }
            }
        } catch (lotErr) {
            console.error("Failed to sync status with inventory lots:", lotErr);
        }

        return NextResponse.json({ success: true, message: "Daily yield QA inspection logged successfully." });
    } catch (e) {
        console.error("Error in daily-qa POST API:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to log inspection" }, { status: 500 });
    }
}
