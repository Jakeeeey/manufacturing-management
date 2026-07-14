/* eslint-disable */
import { DIRECTUS_URL, headersNoCache, DirectusJobOrder } from "./shared";

interface DirectusMfgBom {
    product_id: string | number;
    bom_id: string | number;
}

interface DirectusMfgRouting {
    routing_id?: string | number;
    id?: string | number;
    requires_qa?: number | boolean;
    requiresQA?: number | boolean;
    bom_id?: string | number;
    operation_name?: string;
    name?: string;
}

export async function fetchJobOrders(): Promise<DirectusJobOrder[]> {
    try {
        const [joRes, josoRes, tasksRes, assignsRes, qaRes, mfgRoutingsRes, mfgBomsRes, prodRes, operationsRes, materialsRes, mfgRoutesBomRes, mfgYieldLedgerRes] = await Promise.all([
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders?limit=-1&sort=-job_order_id`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_allocations?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_routes?limit=-1&fields=jo_route_id,job_order_id,sequence_order,work_center_id,operation_id,planned_setup_hours,planned_run_hours,actual_setup_hours,actual_run_hours,estimated_labor_cost,actual_labor_cost`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_route_operators?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_routes?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_boms?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/products?limit=-1&fields=product_id,product_name,unit_of_measurement.unit_shortcut`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_operations?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_yield_ledger?limit=-1`, { headers: headersNoCache })
        ]);

        const jos = joRes.ok ? (await joRes.json()).data || [] : [];
        const josos = josoRes.ok ? (await josoRes.json()).data || [] : [];
        const tasks = tasksRes.ok ? (await tasksRes.json()).data || [] : [];
        const assigns = assignsRes.ok ? (await assignsRes.json()).data || [] : [];
        const qaLogs = qaRes.ok ? (await qaRes.json()).data || [] : [];
        const mfgRoutings = mfgRoutingsRes && mfgRoutingsRes.ok ? (await mfgRoutingsRes.json()).data || [] : [];
        const mfgBoms = mfgBomsRes && mfgBomsRes.ok ? (await mfgBomsRes.json()).data || [] : [];
        const productsList = prodRes.ok ? (await prodRes.json()).data || [] : [];
        const operations = operationsRes.ok ? (await operationsRes.json()).data || [] : [];
        const materialsList = materialsRes && materialsRes.ok ? (await materialsRes.json()).data || [] : [];
        const mfgRoutesBom = mfgRoutesBomRes.ok ? (await mfgRoutesBomRes.json()).data || [] : [];
        const mfgYieldLedger = mfgYieldLedgerRes.ok ? (await mfgYieldLedgerRes.json()).data || [] : [];

        const getObjId = (obj: any): number => {
            if (!obj) return 0;
            if (typeof obj === "object") {
                return Number(obj.job_order_id || obj.id || 0);
            }
            return Number(obj);
        };

        // Map them together
        return jos.map((jo: any) => {
            const joNo = jo.job_order_no;
            jo.jo_id = joNo;
            jo.quantity = Number(jo.target_quantity || 0);
            jo.due_date = jo.end_date || null;

            const joIdInt = Number(jo.job_order_id || jo.id || 0);

            let mappedStatus = jo.status;
            if (jo.status === "Draft") {
                const joMaterials = materialsList.filter((m: any) => m.jo_id === joNo || getObjId(m.job_order_id) === joIdInt);
                if (joMaterials.length > 0) {
                    const hasShortage = joMaterials.some((m: any) => Number(m.quantity_allocated || m.allocated_quantity || 0) < Number(m.quantity_required || m.allocated_quantity || 0));
                    mappedStatus = hasShortage ? "Shortage" : "Proceed";
                } else {
                    mappedStatus = "Draft";
                }
            } else if (jo.status === "Released") {
                mappedStatus = "Proceed";
            } else if (jo.status === "In Progress") {
                mappedStatus = "Ongoing";
            } else if (jo.status === "Completed") {
                mappedStatus = "Finished";
            }

            const matchedProduct = productsList.find((p: any) => Number(p.product_id) === Number(jo.product_id));
            const productName = matchedProduct?.product_name || `Product #${jo.product_id}`;

            const salesOrders = josos
                .filter((s: any) => s.job_order_id ? getObjId(s.job_order_id) === joIdInt : s.jo_id === joNo)
                .map((s: any) => ({
                    jo_id: joNo,
                    order_id: s.sales_order_detail_id,
                    order_no: `SO-DETAIL-${s.sales_order_detail_id}`,
                    quantity: Number(s.allocated_quantity || 0)
                }));

            const productBomIds = mfgBoms
                .filter((b: DirectusMfgBom) => Number(b.product_id) === Number(jo.product_id))
                .map((b: DirectusMfgBom) => Number(b.bom_id));

            // Map routing tasks relationally and update requires_qa dynamically
            const routingTasks = tasks
                .filter((t: any) => getObjId(t.job_order_id) === joIdInt)
                .map((task: any) => {
                    const taskAssigns = assigns
                        .filter((a: any) => Number(a.jo_route_id) === Number(task.jo_route_id))
                        .map((a: any) => ({
                            id: a.jo_route_operator_id || a.id,
                            task_id: a.jo_route_id,
                            user_id: a.operator_id,
                            hourly_rate: Number(a.hourly_rate || 0),
                            logged_hours: Number(a.logged_hours || 0),
                            started_at: a.started_at || null,
                            stopped_at: a.stopped_at || null,
                            is_team_lead: false
                        }));
                    
                    const taskQAs = qaLogs.filter((q: any) => Number(q.jo_route_id) === Number(task.jo_route_id));
                    const op = operations.find((o: any) => Number(o.id) === Number(task.operation_id));
                    const taskName = op?.operation_name || "Production Step";

                    const liveRout = mfgRoutings.find((mr: any) => Number(mr.route_id || mr.id) === Number(task.routing_id));
                    let reqQA = liveRout 
                        ? (liveRout.qa_template_id !== null && liveRout.qa_template_id !== undefined && liveRout.qa_template_id !== 0)
                        : false;

                    if (!reqQA && taskName) {
                        reqQA = mfgRoutings.some((mr: any) => 
                            productBomIds.includes(Number(mr.version_id)) && 
                            Number(mr.operation_id) === Number(task.operation_id) &&
                            (mr.qa_template_id !== null && mr.qa_template_id !== undefined && mr.qa_template_id !== 0)
                        );
                    }

                    const totalHours = taskAssigns.reduce((sum: number, a: any) => sum + Number(a.logged_hours || 0), 0);
                    const totalCost = taskAssigns.reduce((sum: number, a: any) => sum + (Number(a.logged_hours || 0) * Number(a.hourly_rate || 0)), 0);

                    const masterRoute = mfgRoutings.find((mr: any) => 
                        Number(mr.version_id) === Number(jo.version_id) && 
                        Number(mr.sequence_order) === Number(task.sequence_order) && 
                        Number(mr.operation_id) === Number(task.operation_id)
                    );
                    const routeId = masterRoute?.route_id || masterRoute?.id;
                    const stepBoms = routeId ? mfgRoutesBom.filter((b: any) => Number(b.route_id) === Number(routeId)) : [];
                    
                    const stepBomItems = stepBoms.map((b: any) => {
                        const prod = productsList.find((p: any) => Number(p.product_id) === Number(b.product_id));
                        const qtyPerUnit = Number(b.quantity_required || 0);
                        const wastage = 1 + (Number(b.wastage_factor_percentage || 0) / 100);
                        const totalNeeded = qtyPerUnit * Number(jo.target_quantity || 0) * wastage;
                        return {
                            product_id: b.product_id,
                            product_name: prod?.product_name || `Product #${b.product_id}`,
                            qty_per_unit: qtyPerUnit,
                            total_needed: totalNeeded,
                            unit_shortcut: prod?.unit_of_measurement?.unit_shortcut || "pcs"
                        };
                    });

                    return {
                        id: task.jo_route_id, // Map primary key jo_route_id to legacy 'id'
                        jo_id: joNo,
                        routing_id: task.routing_id,
                        qa_template_id: liveRout ? liveRout.qa_template_id : null,
                        name: taskName,
                        sequence_order: task.sequence_order,
                        status: task.status,
                        planned_setup_hours: Number(task.planned_setup_hours || 0),
                        planned_run_hours: Number(task.planned_run_hours || 0),
                        actual_setup_hours: Number(task.actual_setup_hours || 0),
                        actual_run_hours: totalHours > 0 ? totalHours : Number(task.actual_run_hours || 0),
                        estimated_labor_cost: Number(task.estimated_labor_cost || 0),
                        actual_labor_cost: totalCost > 0 ? totalCost : Number(task.actual_labor_cost || 0),
                        completed_at: task.completed_at,
                        requires_qa: reqQA ? 1 : 0,
                        assignments: taskAssigns,
                        qa_logs: taskQAs,
                        bom_items: stepBomItems
                    };
                });

            const simulatedRoutings = routingTasks.map((t: any) => ({
                routing_id: t.routing_id,
                id: t.id,
                qa_template_id: t.qa_template_id,
                sequence_order: t.sequence_order,
                operation_name: t.name,
                setup_time_hours: t.planned_setup_hours,
                run_time_hours: t.planned_run_hours,
                estimated_labor_cost: t.estimated_labor_cost,
                status: t.status
            }));

            const matchingBom = mfgBoms.find((b: any) => Number(b.version_id) === Number(jo.version_id));
            const versionStr = matchingBom ? `${matchingBom.version_name || "v" + matchingBom.version_code}` : jo.version_id ? `Version #${jo.version_id}` : "";

            const joYieldLogs = mfgYieldLedger.filter((l: any) => getObjId(l.job_order_id) === joIdInt);
            const totalProduced = joYieldLogs.reduce((sum: number, l: any) => sum + Number(l.yield_quantity || 0), 0);

            let resolvedParentId = jo.parent_job_order_id ? Number(jo.parent_job_order_id) : null;
            if (!resolvedParentId && jo.job_order_no && jo.job_order_no.includes("-SUB")) {
                const parentNo = jo.job_order_no.split("-SUB")[0];
                const parentJo = jos.find((j: any) => j.job_order_no === parentNo);
                if (parentJo) {
                    resolvedParentId = Number(parentJo.job_order_id || parentJo.id || 0);
                }
            }

            const simulatedProducts = [{
                jo_id: joNo,
                product_id: jo.product_id,
                product_name: productName,
                quantity: Number(jo.target_quantity || 0),
                bom: jo.version_id ? { version_id: jo.version_id } : null,
                components: [],
                routings: simulatedRoutings,
                allocation_results: null
            }];

            return {
                ...jo,
                product_id: jo.product_id,
                product_name: productName,
                quantity: Number(jo.target_quantity || 0),
                status: mappedStatus,
                bom: jo.version_id ? { version_id: jo.version_id } : null,
                version_name: versionStr,
                components: [],
                routings: simulatedRoutings,
                allocation_results: null,
                products: simulatedProducts,
                sales_orders: salesOrders,
                routing_tasks: routingTasks,
                parent_job_order_id: resolvedParentId,
                produced_quantity: totalProduced
            };
        });
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch job orders:", e);
        return [];
    }
}
