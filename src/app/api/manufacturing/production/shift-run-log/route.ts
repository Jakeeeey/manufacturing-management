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

// GET handler: Fetches yield ledger logs from the database
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get("taskId");
        const joId = searchParams.get("joId");

        let url = `${DIRECTUS_URL}/items/manufacturing_job_order_yield_ledger?limit=-1&sort=-logged_at`;
        if (joId) {
            url += `&filter[job_order_id][_eq]=${joId}`;
        }

        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) {
            throw new Error("Failed to fetch yield ledger from database");
        }
        const json = await res.json();
        return NextResponse.json(json.data || []);
    } catch (e) {
        console.error("Error fetching yield ledger:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to fetch ledger logs" }, { status: 500 });
    }
}

// POST handler: Logs the shift yield, updates inventory (FIFO), and inserts a ledger record
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { taskId, joId, shiftName, yieldQty, inspectorId, qaStatus, qaParameters, materialsConsumed } = body;

        if (!taskId || !joId || !shiftName || yieldQty === undefined) {
            return NextResponse.json({ error: "Missing required fields: taskId, joId, shiftName, yieldQty" }, { status: 400 });
        }

        // 1. Fetch Job Order Details to find product_id, branch_id, and job_order_no
        const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joId}`, { headers, cache: "no-store" });
        if (!joRes.ok) {
            throw new Error(`Failed to load job order with ID: ${joId}`);
        }
        const joData = (await joRes.json()).data;
        const producedProductId = joData.product_id;
        const branchId = joData.branch_id || 1;
        const jobOrderNo = joData.job_order_no;

        const timestamp = new Date().toISOString();

        // 2. Validate all material stock levels before writing any database entries
        const lotsCache: Record<number, any[]> = {};
        if (materialsConsumed && materialsConsumed.length > 0) {
            for (const item of materialsConsumed) {
                const rawProductId = Number(item.product_id);
                const consumedQty = Number(item.actual_qty || 0);

                if (consumedQty <= 0) continue;

                const lotsUrl = `${DIRECTUS_URL}/items/inventory_lots?filter[product_id][_eq]=${rawProductId}&filter[quantity][_gt]=0&filter[qa_status][_eq]=Passed&filter[branch_id][_eq]=${branchId}&sort=id&limit=-1`;
                const lotsRes = await fetch(lotsUrl, { headers, cache: "no-store" });
                const lots = lotsRes.ok ? (await lotsRes.json()).data || [] : [];
                
                lotsCache[rawProductId] = lots;

                const totalAvailable = lots.reduce((sum: number, l: any) => sum + Number(l.quantity || 0), 0);
                if (totalAvailable < consumedQty) {
                    let prodName = `Product #${rawProductId}`;
                    let unitName = "units";
                    try {
                        const prodDetailRes = await fetch(`${DIRECTUS_URL}/items/products/${rawProductId}?fields=product_name,unit_of_measurement.unit_shortcut`, { headers });
                        if (prodDetailRes.ok) {
                            const prodData = (await prodDetailRes.json()).data;
                            if (prodData) {
                                prodName = prodData.product_name || prodName;
                                unitName = prodData.unit_of_measurement?.unit_shortcut || unitName;
                            }
                        }
                    } catch (err) {
                        console.error("Failed to fetch product details for stock validation message:", err);
                    }

                    return NextResponse.json({
                        error: `Insufficient stock for raw material "${prodName}". Only ${totalAvailable.toLocaleString()} ${unitName} available in active Passed lots, but ${consumedQty.toLocaleString()} was logged as consumed.`
                    }, { status: 400 });
                }
            }
        }

        // 3. Insert new row into relational manufacturing_job_order_yield_ledger table
        // Initial qa_status is set to Pending unless operator explicitly requested QA Hold
        const ledgerPayload = {
            job_order_id: Number(joId),
            shift_name: shiftName,
            yield_quantity: Number(yieldQty),
            qa_status: qaStatus === "Passed" ? "Pending" : qaStatus,
            logged_at: timestamp,
            logged_by: inspectorId ? Number(inspectorId) : null
        };

        const ledgerRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_yield_ledger`, {
            method: "POST",
            headers,
            body: JSON.stringify(ledgerPayload)
        });

        if (!ledgerRes.ok) {
            throw new Error("Failed to insert into manufacturing_job_order_yield_ledger database table: " + await ledgerRes.text());
        }

        const ledgerData = (await ledgerRes.json()).data;
        const ledgerId = ledgerData.ledger_id || ledgerData.id;

        // 4. Insert QA Parameters/Yield Log into manufacturing_job_order_qa_records (remains step-specific for timeline)
        if (qaParameters && qaParameters.length > 0) {
            for (const param of qaParameters) {
                const valNumeric = param.value !== undefined && param.value !== "" ? Number(param.value) : null;
                const valText = typeof param.value === "string" ? param.value : null;
                const valBool = typeof param.value === "boolean" ? param.value : null;

                const qaPayload = {
                    job_order_id: Number(joId),
                    jo_route_id: Number(taskId),
                    parameter_id: Number(param.parameter_id),
                    value_text: valText,
                    value_numeric: valNumeric,
                    value_boolean: valBool,
                    is_passed: !param.is_failed,
                    inspected_by: inspectorId ? Number(inspectorId) : null,
                    inspected_at: timestamp,
                    remarks: `Shift: ${shiftName} | Yield: ${yieldQty} pcs | ${param.remarks || "Shift QA check"}`
                };

                await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(qaPayload)
                });
            }
        } else {
            // Write a general yield log record if no checklist parameters exist
            const qaPayload = {
                job_order_id: Number(joId),
                jo_route_id: Number(taskId),
                parameter_id: null,
                is_passed: qaStatus === "Passed" ? 1 : 0,
                inspected_by: inspectorId ? Number(inspectorId) : null,
                inspected_at: timestamp,
                remarks: `Shift Yield Log: ${shiftName} | Yield: ${yieldQty} pcs`
            };

            await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records`, {
                method: "POST",
                headers,
                body: JSON.stringify(qaPayload)
            });
        }

        // 5. Process Material Consumption Reconciliations & deductions
        if (materialsConsumed && materialsConsumed.length > 0) {
            // Load existing materials sheet for the Job Order
            const matsSheetRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials?filter[job_order_id][_eq]=${joId}&limit=-1`, { headers, cache: "no-store" });
            const matsSheet = matsSheetRes.ok ? (await matsSheetRes.json()).data || [] : [];

            for (const item of materialsConsumed) {
                const rawProductId = Number(item.product_id);
                const consumedQty = Number(item.actual_qty || 0);

                if (consumedQty <= 0) continue;

                // A. Update Job Order materials worksheet (actual_consumed_quantity)
                const matchingMat = matsSheet.find((m: any) => Number(m.product_id) === rawProductId);
                if (matchingMat) {
                    const newTotal = Number(matchingMat.actual_consumed_quantity || 0) + consumedQty;
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials/${matchingMat.id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({ actual_consumed_quantity: newTotal })
                    });
                } else {
                    // Create raw materials log entry if it wasn't pre-allocated
                    await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            job_order_id: Number(joId),
                            jo_id: jobOrderNo,
                            product_id: rawProductId,
                            quantity_required: 0,
                            actual_consumed_quantity: consumedQty
                        })
                    });
                }

                // B. Reconcile inventory lots using First-In-First-Out (FIFO)
                const lots = lotsCache[rawProductId] || [];
                let remainingToDeduct = consumedQty;
                for (const lot of lots) {
                    if (remainingToDeduct <= 0) break;

                    const lotQty = Number(lot.quantity || 0);
                    const lotId = lot.id || lot.lot_id;

                    if (lotQty >= remainingToDeduct) {
                        const newLotQty = lotQty - remainingToDeduct;
                        await fetch(`${DIRECTUS_URL}/items/inventory_lots/${lotId}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify({ quantity: newLotQty })
                        });
                        remainingToDeduct = 0;
                    } else {
                        await fetch(`${DIRECTUS_URL}/items/inventory_lots/${lotId}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify({ quantity: 0 })
                        });
                        remainingToDeduct -= lotQty;
                    }
                }

                // C. Insert new row into manufacturing_job_order_yield_ledger_bom_consumage
                if (ledgerId) {
                    const consumagePayload = {
                        ledger_id: Number(ledgerId),
                        product_id: rawProductId,
                        quantity_consumed: consumedQty
                    };
                    const consumageRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_yield_ledger_bom_consumage`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(consumagePayload)
                    });
                    if (!consumageRes.ok) {
                        console.error("Failed to insert into manufacturing_job_order_yield_ledger_bom_consumage database table:", await consumageRes.text());
                    }
                }
            }
        }

        // 5. Record Yield: Insert new inventory lot for the produced product
        // Linked directly to the yield ledger via source_type and source_reference
        const newLotPayload = {
            product_id: producedProductId,
            branch_id: branchId,
            quantity: Number(yieldQty),
            qa_status: qaStatus === "Passed" ? "Pending" : "QA Hold",
            source_type: "yield_ledger",
            source_reference: String(ledgerId),
            remarks: `Yield from Job Order ${jobOrderNo} | Shift: ${shiftName}`
        };

        const lotRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots`, {
            method: "POST",
            headers,
            body: JSON.stringify(newLotPayload)
        });

        if (!lotRes.ok) {
            console.error("Failed to insert new inventory lot:", await lotRes.text());
        }

        return NextResponse.json({ success: true, message: "Shift run progress logged successfully and inventory reconciled." });
    } catch (e) {
        console.error("Error in shift-run-log POST API:", e);
        return NextResponse.json({ error: (e as Error).message || "Failed to log shift progress" }, { status: 500 });
    }
}
