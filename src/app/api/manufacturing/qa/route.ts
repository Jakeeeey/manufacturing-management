/* eslint-disable */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

const DISPOSITIONS_FILE = path.join(process.cwd(), "src/app/api/manufacturing/qa/dispositions.json");

// Helper to resolve job_order_id (integer) and product_id from job_order_no (string)
async function getJobOrderIdByNo(joNo: string): Promise<{ id: number; productId: number } | null> {
    try {
        const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders?filter[job_order_no][_eq]=${encodeURIComponent(joNo)}&limit=1`, { headers });
        if (res.ok) {
            const data = (await res.json()).data?.[0];
            if (data) {
                return {
                    id: Number(data.job_order_id),
                    productId: Number(data.product_id)
                };
            }
        }
    } catch (e) {
        console.error("Failed to resolve job_order_id for", joNo, e);
    }
    return null;
}

// Helper to ensure the local dispositions database file exists and read it
function readDispositions(): any[] {
    try {
        const dir = path.dirname(DISPOSITIONS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(DISPOSITIONS_FILE)) {
            fs.writeFileSync(DISPOSITIONS_FILE, JSON.stringify([]));
            return [];
        }
        const fileContent = fs.readFileSync(DISPOSITIONS_FILE, "utf-8");
        return JSON.parse(fileContent || "[]");
    } catch (err) {
        console.error("Error reading dispositions JSON:", err);
        return [];
    }
}

// Helper to write to local dispositions database
function writeDispositions(data: any[]): void {
    try {
        const dir = path.dirname(DISPOSITIONS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DISPOSITIONS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing dispositions JSON:", err);
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");

        // Action: Fetch QA templates and parameters
        if (action === "templates") {
            const [templatesRes, parametersRes] = await Promise.all([
                fetch(`${DIRECTUS_URL}/items/quality_inspection_templates?limit=-1`, { headers, cache: "no-store" }),
                fetch(`${DIRECTUS_URL}/items/quality_inspection_parameters?limit=-1`, { headers, cache: "no-store" })
            ]);

            if (!templatesRes.ok || !parametersRes.ok) {
                throw new Error("Failed to fetch templates/parameters from Directus");
            }

            const templates = (await templatesRes.json()).data || [];
            const parameters = (await parametersRes.json()).data || [];

            const templatesWithParams = templates.map((tpl: any) => ({
                ...tpl,
                parameters: parameters.filter((param: any) => param.template_id === tpl.template_id)
            }));

            return NextResponse.json(templatesWithParams);
        }

        // Action: Fetch supervisor dispositions
        if (action === "dispositions") {
            const list = readDispositions();
            return NextResponse.json(list);
        }

        // Action: Match dynamic checklist template for a specific task and product
        if (action === "matching-template") {
            const taskName = searchParams.get("taskName") || "";
            const productId = searchParams.get("productId") || "";

            const [templatesRes, parametersRes] = await Promise.all([
                fetch(`${DIRECTUS_URL}/items/quality_inspection_templates?limit=-1`, { headers, cache: "no-store" }),
                fetch(`${DIRECTUS_URL}/items/quality_inspection_parameters?limit=-1`, { headers, cache: "no-store" })
            ]);

            if (!templatesRes.ok || !parametersRes.ok) {
                throw new Error("Failed to fetch templates/parameters from Directus");
            }

            const templates = (await templatesRes.json()).data || [];
            const parameters = (await parametersRes.json()).data || [];

            let matchedTpl = templates.find((tpl: any) => 
                tpl.is_active && 
                taskName.toLowerCase().includes(tpl.template_name.toLowerCase())
            );

            if (!matchedTpl) {
                matchedTpl = templates.find((tpl: any) => tpl.is_active);
            }

            if (!matchedTpl) {
                return NextResponse.json({ template: null, parameters: [] });
            }

            const tplParams = parameters.filter((param: any) => param.template_id === matchedTpl.template_id);
            return NextResponse.json({
                template: matchedTpl,
                parameters: tplParams
            });
        }

        return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
    } catch (e) {
        console.error("API Error in QA GET:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to process QA request" }, { status: 500 });
    }
}

// POST handler
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        // Action: Verify a QA routing step checklist
        if (action === "verify") {
            const {
                joId,
                taskId,
                taskName,
                productName,
                expectedQty,
                actualQty,
                verifications, // array of { parameter_id, test_name, value, min_value, max_value, target_value, is_failed, is_critical }
                comments,
                photos,
                userId
            } = body;

            if (!joId || !taskId) {
                return NextResponse.json({ error: "Missing joId or taskId" }, { status: 400 });
            }

            const joInfo = await getJobOrderIdByNo(joId);
            if (!joInfo) {
                return NextResponse.json({ error: `Job Order not found: ${joId}` }, { status: 404 });
            }
            const joIdInt = joInfo.id;

            const hasCriticalFailure = verifications.some((v: any) => v.is_failed && v.is_critical);

            if (hasCriticalFailure) {
                // 1. Lock the route steps & change Job Order status to "On Hold"
                const joPatchRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joIdInt}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ status: "On Hold" })
                });

                if (!joPatchRes.ok) {
                    throw new Error(`Failed to update Job Order status to On Hold: ${joPatchRes.status}`);
                }

                // Route step status is deprecated, no PATCH required.

                // 2. Alert supervisor disposition dashboard by creating a pending disposition entry
                const dispositions = readDispositions();
                const newDisp = {
                    id: `DISP-${Date.now()}`,
                    jo_id: joId,
                    task_id: taskId,
                    task_name: taskName || "Unknown Task",
                    product_name: productName || "Unknown Product",
                    expected_quantity: expectedQty,
                    actual_quantity: actualQty,
                    failed_parameters: verifications.filter((v: any) => v.is_failed),
                    disposition_status: "Pending",
                    decision: null, // Release with Deviation, Rework, Scrap
                    supervisor_comments: "",
                    recorded_at: new Date().toISOString(),
                    resolved_at: null,
                    resolved_by: null
                };
                dispositions.push(newDisp);
                writeDispositions(dispositions);

                // 3. Record failed QA inspection parameters
                for (const v of verifications) {
                    const valNumeric = v.value !== undefined ? Number(v.value) : (v.value_numeric !== undefined ? Number(v.value_numeric) : null);
                    const valText = typeof v.value === "string" ? v.value : (v.value_text !== undefined ? v.value_text : null);
                    const valBool = typeof v.value === "boolean" ? v.value : (v.value_boolean !== undefined ? !!v.value_boolean : null);
                    
                    const qaPayload = {
                        job_order_id: joIdInt,
                        jo_route_id: Number(taskId),
                        parameter_id: Number(v.parameter_id),
                        value_text: valText,
                        value_numeric: valNumeric,
                        value_boolean: valBool,
                        is_passed: !v.is_failed,
                        inspected_by: userId ? Number(userId) : null,
                        inspected_at: new Date().toISOString(),
                        remarks: `CRITICAL QA PARAMETER FAILURE. ${comments || ""}`
                    };

                    await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(qaPayload)
                    });
                }

                return NextResponse.json({
                    success: false,
                    onHold: true,
                    message: "Critical parameter failure detected. Job Order has been placed ON HOLD. Alerting supervisor disposition.",
                    disposition: newDisp
                });
            } else {
                // Standard case: Save standard QA log and mark task as completed
                for (const v of verifications) {
                    const valNumeric = v.value !== undefined ? Number(v.value) : (v.value_numeric !== undefined ? Number(v.value_numeric) : null);
                    const valText = typeof v.value === "string" ? v.value : (v.value_text !== undefined ? v.value_text : null);
                    const valBool = typeof v.value === "boolean" ? v.value : (v.value_boolean !== undefined ? !!v.value_boolean : null);

                    const qaPayload = {
                        job_order_id: joIdInt,
                        jo_route_id: Number(taskId),
                        parameter_id: Number(v.parameter_id),
                        value_text: valText,
                        value_numeric: valNumeric,
                        value_boolean: valBool,
                        is_passed: !v.is_failed,
                        inspected_by: userId ? Number(userId) : null,
                        inspected_at: new Date().toISOString(),
                        remarks: comments || "All standard parameters passed."
                    };

                    await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(qaPayload)
                    });
                }

                // Route step status is deprecated, no PATCH required.

                return NextResponse.json({
                    success: true,
                    onHold: false,
                    message: "All quality checks completed successfully."
                });
            }
        }

        // Action: Resolve a supervisor disposition override (Release with Deviation, Rework, Scrap)
        if (action === "disposition") {
            const { dispositionId, decision, supervisorComments, userId } = body;

            if (!dispositionId || !decision) {
                return NextResponse.json({ error: "Missing dispositionId or decision" }, { status: 400 });
            }

            const dispositions = readDispositions();
            const dispIdx = dispositions.findIndex((d: any) => d.id === dispositionId);

            if (dispIdx === -1) {
                return NextResponse.json({ error: "Disposition record not found" }, { status: 404 });
            }

            const disp = dispositions[dispIdx];
            const joInfo = await getJobOrderIdByNo(disp.jo_id);
            if (!joInfo) {
                return NextResponse.json({ error: `Job Order not found: ${disp.jo_id}` }, { status: 404 });
            }
            const joIdInt = joInfo.id;

            if (decision === "Release with Deviation") {
                // 1. Release with Deviation: Set JO status back to "In Progress"
                await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joIdInt}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ status: "In Progress" })
                });

                // Route step status is deprecated, no PATCH required.

                // 3. Log a new QA record for the deviation release override
                if (disp.failed_parameters && disp.failed_parameters.length > 0) {
                    for (const v of disp.failed_parameters) {
                        await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                job_order_id: joIdInt,
                                jo_route_id: Number(disp.task_id),
                                parameter_id: Number(v.parameter_id),
                                is_passed: true, // overridden to passed
                                inspected_by: userId ? Number(userId) : null,
                                inspected_at: new Date().toISOString(),
                                remarks: `[SUPERVISOR OVERRIDE: Release with Deviation] ${supervisorComments || ""}`
                            })
                        });
                    }
                }

            } else if (decision === "Rework") {
                // 1. Rework: Set JO status back to "In Progress"
                await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joIdInt}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ status: "In Progress" })
                });

                // Route step status is deprecated, no PATCH required.

                // 3. Log a new QA log entry for the rework trigger
                if (disp.failed_parameters && disp.failed_parameters.length > 0) {
                    for (const v of disp.failed_parameters) {
                        await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                job_order_id: joIdInt,
                                jo_route_id: Number(disp.task_id),
                                parameter_id: Number(v.parameter_id),
                                is_passed: false,
                                inspected_by: userId ? Number(userId) : null,
                                inspected_at: new Date().toISOString(),
                                remarks: `[SUPERVISOR OVERRIDE: Rework Triggered] ${supervisorComments || ""}`
                            })
                        });
                    }
                }

            } else if (decision === "Scrap") {
                // 1. Scrap: Set JO status to "Cancelled"
                await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joIdInt}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ status: "Cancelled" })
                });

                // Route step status is deprecated, no PATCH required.

                // 3. Log a new QA log entry for scrap
                if (disp.failed_parameters && disp.failed_parameters.length > 0) {
                    for (const v of disp.failed_parameters) {
                        await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                job_order_id: joIdInt,
                                jo_route_id: Number(disp.task_id),
                                parameter_id: Number(v.parameter_id),
                                is_passed: false,
                                inspected_by: userId ? Number(userId) : null,
                                inspected_at: new Date().toISOString(),
                                remarks: `[SUPERVISOR OVERRIDE: Scrap Action] ${supervisorComments || ""}`
                            })
                        });
                    }
                }
            }

            // Update disposition record
            disp.disposition_status = "Resolved";
            disp.decision = decision;
            disp.supervisor_comments = supervisorComments || "";
            disp.resolved_at = new Date().toISOString();
            disp.resolved_by = userId || null;

            dispositions[dispIdx] = disp;
            writeDispositions(dispositions);

            return NextResponse.json({
                success: true,
                message: `Disposition resolved successfully as ${decision}.`
            });
        }

        return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
    } catch (e) {
        console.error("API Error in QA POST:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to save QA action" }, { status: 500 });
    }
}
