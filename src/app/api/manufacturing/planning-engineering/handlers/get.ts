/* eslint-disable */
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { 
    fetchJobOrders, 
    getProductInventoryAndSafetyStock
} from "../planning-helper";
import {
    DIRECTUS_URL,
    headers
} from "@/app/api/manufacturing/directus-api";
import { getBOMDetailsForVersion, getActiveVersionForProduct } from "../../finished-goods/versions/versions-helper";

export async function handleGET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId");
        const bomId = searchParams.get("bomId");
        const action = searchParams.get("action");

        if (action === "net-requirements") {
            const productIdsStr = searchParams.get("productIds");
            const branchIdStr = searchParams.get("branchId");
            const productIds = productIdsStr ? productIdsStr.split(",").map(Number).filter(Boolean) : [];
            const branchId = branchIdStr ? Number(branchIdStr) : undefined;
            const data = await getProductInventoryAndSafetyStock(productIds, branchId);
            return NextResponse.json(data);
        }

        if (action === "version-stock") {
            const prodId = Number(searchParams.get("productId") || "0");
            const branchId = Number(searchParams.get("branchId") || "0");
            if (!prodId || !branchId) {
                return NextResponse.json({ error: "Missing productId or branchId" }, { status: 400 });
            }

            // Fetch Passed inventory lots with quantity > 0
            const lotFilter = encodeURIComponent(JSON.stringify({
                _and: [
                    { product_id: { _eq: prodId } },
                    { branch_id: { _eq: branchId } },
                    { qa_status: { _eq: "Passed" } },
                    { quantity: { _gt: 0 } }
                ]
            }));
            const lotsRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${lotFilter}&limit=-1`, { headers, cache: "no-store" });
            if (!lotsRes.ok) {
                return NextResponse.json({});
            }
            const lots = (await lotsRes.json()).data || [];

            // Trace lot's recipe version
            const mfgLots = lots.filter((lot: any) => lot.source_type === "manufacturing" && lot.source_reference);
            const joNos = Array.from(new Set(mfgLots.map((lot: any) => lot.source_reference)));
            const joMap = new Map<string, number>();

            if (joNos.length > 0) {
                const joFilter = encodeURIComponent(JSON.stringify({
                    job_order_no: { _in: joNos }
                }));
                const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders?filter=${joFilter}&fields=job_order_no,version_id&limit=-1`, { headers, cache: "no-store" });
                if (joRes.ok) {
                    const jos = (await joRes.json()).data || [];
                    jos.forEach((jo: any) => {
                        if (jo.job_order_no && jo.version_id) {
                            joMap.set(jo.job_order_no, Number(jo.version_id));
                        }
                    });
                }
            }

            // Get product's active standard version
            const { version: activeVersion } = await getActiveVersionForProduct(prodId);
            const activeVersionId = activeVersion ? Number(activeVersion.version_id) : null;

            // Group lot quantities by recipe version ID
            const versionStockMap: Record<number, number> = {};
            lots.forEach((lot: any) => {
                const resolvedVersionId = lot.source_type === "manufacturing" && lot.source_reference
                    ? (joMap.get(lot.source_reference) || activeVersionId)
                    : activeVersionId;

                if (resolvedVersionId) {
                    versionStockMap[resolvedVersionId] = (versionStockMap[resolvedVersionId] || 0) + Number(lot.quantity || 0);
                }
            });

            return NextResponse.json(versionStockMap);
        }

        if (action === "job-materials") {
            const joId = searchParams.get("joId");
            const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials?filter[job_order_id][_eq]=${joId}&limit=-1`, { headers, cache: "no-store" });
            const mData = res.ok ? (await res.json()).data || [] : [];
            const pIds = mData.map((d: any) => d.product_id);
            const pMap = new Map<number, any>();
            
            // Also get Job Order branch
            const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joId}`, { headers, cache: "no-store" });
            const joData = joRes.ok ? (await joRes.json()).data : null;
            const branchId = joData?.branch_id || 1;

            if (pIds.length > 0) {
                const pRes = await fetch(`${DIRECTUS_URL}/items/products?filter[product_id][_in]=${pIds.join(",")}&fields=product_id,product_name,unit_of_measurement.unit_shortcut&limit=-1`, { headers });
                if (pRes.ok) {
                    const prods = (await pRes.json()).data || [];
                    prods.forEach((p: any) => pMap.set(Number(p.product_id), p));
                }
            }

            // Fetch inventory lots to calculate available stock per product
            const stockMap = new Map<number, number>();
            if (pIds.length > 0) {
                const lotFilter = encodeURIComponent(JSON.stringify({
                    _and: [
                        { product_id: { _in: pIds } },
                        { branch_id: { _eq: branchId } },
                        { qa_status: { _eq: "Passed" } },
                        { quantity: { _gt: 0 } }
                    ]
                }));
                const lotsRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter=${lotFilter}&limit=-1`, { headers, cache: "no-store" });
                if (lotsRes.ok) {
                    const lots = (await lotsRes.json()).data || [];
                    lots.forEach((lot: any) => {
                        const prodId = Number(lot.product_id);
                        const qty = Number(lot.quantity || 0);
                        stockMap.set(prodId, (stockMap.get(prodId) || 0) + qty);
                    });
                }
            }

            const enriched = mData.map((d: any) => {
                const prod = pMap.get(Number(d.product_id));
                const availableStock = stockMap.get(Number(d.product_id)) || 0;
                return {
                    ...d,
                    product_name: prod?.product_name || `Product #${d.product_id}`,
                    unit_shortcut: prod?.unit_of_measurement?.unit_shortcut || "units",
                    available_stock: availableStock
                };
            });
            return NextResponse.json(enriched);
        }

        if (action === "step-materials") {
            const joId = searchParams.get("joId");
            const joRouteId = searchParams.get("joRouteId");
            const quantity = Number(searchParams.get("quantity") || 0);

            // Fetch job order route step details
            const stepRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_routes/${joRouteId}?fields=jo_route_id,job_order_id,sequence_order,work_center_id,operation_id,planned_setup_hours,planned_run_hours,actual_setup_hours,actual_run_hours,estimated_labor_cost,actual_labor_cost`, { headers, cache: "no-store" });
            if (!stepRes.ok) return NextResponse.json([]);
            const step = (await stepRes.json()).data;
            if (!step) return NextResponse.json([]);

            // Fetch Job Order details
            const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders/${joId}`, { headers, cache: "no-store" });
            if (!joRes.ok) return NextResponse.json([]);
            const jo = (await joRes.json()).data;
            if (!jo || !jo.version_id) return NextResponse.json([]);

            // Find master route matching version, sequence, and operation
            const masterRouteRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_routings?filter[version_id][_eq]=${jo.version_id}&filter[sequence_order][_eq]=${step.sequence_order}&filter[operation_id][_eq]=${step.operation_id}&limit=1`, { headers, cache: "no-store" });
            const masterRoutes = masterRouteRes.ok ? (await masterRouteRes.json()).data || [] : [];
            const masterRoute = masterRoutes[0];
            if (!masterRoute) return NextResponse.json([]);

            const routeId = masterRoute.route_id || masterRoute.id;
            
            const res = await fetch(`${DIRECTUS_URL}/items/manufacturing_routes_bom?filter[route_id][_eq]=${routeId}&limit=-1`, { headers, cache: "no-store" });
            const bomItems = res.ok ? (await res.json()).data || [] : [];
            
            const pIds = bomItems.map((d: any) => d.product_id);
            const pMap = new Map<number, any>();
            if (pIds.length > 0) {
                const pRes = await fetch(`${DIRECTUS_URL}/items/products?filter[product_id][_in]=${pIds.join(",")}&fields=product_id,product_name,product_code,unit_of_measurement.unit_shortcut&limit=-1`, { headers });
                if (pRes.ok) {
                    const prods = (await pRes.json()).data || [];
                    prods.forEach((p: any) => pMap.set(Number(p.product_id), p));
                }
            }

            const mapped = bomItems.map((b: any) => {
                const prod = pMap.get(Number(b.product_id));
                const qtyPerUnit = Number(b.quantity_required || 0);
                const wastage = 1 + (Number(b.wastage_factor_percentage || 0) / 100);
                const totalNeeded = qtyPerUnit * quantity * wastage;

                return {
                    product_id: b.product_id,
                    product_name: prod?.product_name || `Product #${b.product_id}`,
                    product_code: prod?.product_code || "",
                    unit_shortcut: prod?.unit_of_measurement?.unit_shortcut || "pcs",
                    qty_per_unit: qtyPerUnit,
                    total_needed: totalNeeded
                };
            });

            return NextResponse.json(mapped);
        }

        if (action === "users") {
            const url = `${DIRECTUS_URL}/items/user?limit=-1`;
            const res = await fetch(url, { headers, cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch users");
            const data = await res.json();
            const mappedUsers = (data.data || []).map((u: Record<string, unknown> & { user_id?: number; id?: number }) => ({
                ...u,
                user_id: u.user_id || u.id
            }));
            return NextResponse.json(mappedUsers);
        }

        if (action === "qa-logs") {
            const qaRecordsRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records?limit=-1&sort=-inspected_at`, { headers, cache: "no-store" });
            const qaRecords = qaRecordsRes.ok ? ((await qaRecordsRes.json()).data || []) : [];

            if (qaRecords.length === 0) {
                return NextResponse.json([]);
            }

            const joRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders?limit=-1`, { headers, cache: "no-store" });
            const jobOrders = joRes.ok ? ((await joRes.json()).data || []) : [];
            const joMap = new Map<number, any>();
            jobOrders.forEach((jo: any) => joMap.set(Number(jo.job_order_id), jo));

            const routesRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_routes?limit=-1&fields=jo_route_id,job_order_id,sequence_order,work_center_id,operation_id,planned_setup_hours,planned_run_hours,actual_setup_hours,actual_run_hours,estimated_labor_cost,actual_labor_cost`, { headers, cache: "no-store" });
            const routes = routesRes.ok ? ((await routesRes.json()).data || []) : [];
            const routeMap = new Map<number, any>();
            routes.forEach((r: any) => routeMap.set(Number(r.jo_route_id), r));

            const opsRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_operations?limit=-1`, { headers, cache: "no-store" });
            const operations = opsRes.ok ? ((await opsRes.json()).data || []) : [];
            const opsMap = new Map<number, string>();
            operations.forEach((o: any) => opsMap.set(Number(o.id), o.operation_name));

            let dispositions: any[] = [];
            try {
                const dispFile = path.join(process.cwd(), "src/app/api/manufacturing/qa/dispositions.json");
                if (fs.existsSync(dispFile)) {
                    dispositions = JSON.parse(fs.readFileSync(dispFile, "utf-8") || "[]");
                }
            } catch (err) {
                console.error("Failed to read dispositions for qa-logs mapping:", err);
            }

            const groupsMap = new Map<string, any[]>();
            qaRecords.forEach((rec: any) => {
                const key = `${rec.jo_route_id}_${rec.inspected_at}`;
                if (!groupsMap.has(key)) {
                    groupsMap.set(key, []);
                }
                groupsMap.get(key)!.push(rec);
            });

            const mappedLogs = Array.from(groupsMap.values()).map((group, index) => {
                const first = group[0];
                const joId = Number(first.job_order_id);
                const routeId = Number(first.jo_route_id);
                const inspectedAt = first.inspected_at;

                const parentJo = joMap.get(joId);
                const joNo = parentJo?.job_order_no || `JO-${joId}`;
                const targetQty = parentJo ? Number(parentJo.target_quantity || 0) : 0;

                const routeTask = routeMap.get(routeId);
                const opId = routeTask ? Number(routeTask.operation_id) : 0;
                const opName = opsMap.get(opId) || "Production Step";
                const seqOrder = routeTask ? Number(routeTask.sequence_order || 1) : 1;
                const routeStatus = routeTask ? routeTask.status : "Completed";

                const overallPassed = group.every((r: any) => r.is_passed === true || r.is_passed === 1);
                const uniqueRemarks = Array.from(new Set(group.map((r: any) => r.remarks).filter(Boolean)));
                const comments = uniqueRemarks.join("; ") || (overallPassed ? "All parameters passed." : "Parameter checks failed.");

                let expected = targetQty;
                let actual = targetQty;
                if (!overallPassed && dispositions.length > 0) {
                    const disp = dispositions.find(d => Number(d.task_id) === routeId);
                    if (disp) {
                        expected = Number(disp.expected_quantity || targetQty);
                        actual = Number(disp.actual_quantity || targetQty);
                    }
                }

                return {
                    id: Number(first.qa_record_id || index + 1),
                    task_id: {
                        jo_route_id: routeId,
                        jo_id: joNo,
                        operation_name: opName,
                        name: opName,
                        sequence_order: seqOrder,
                        status: routeStatus
                    },
                    expected_quantity: expected,
                    actual_quantity: actual,
                    deviation_quantity: Math.max(0, expected - actual),
                    qa_status: overallPassed ? "Passed" : "Failed",
                    recorded_at: inspectedAt,
                    comments: comments,
                    photos: null
                };
            });

            return NextResponse.json(mappedLogs);
        }

        if (action === "job-order-materials") {
            const joId = searchParams.get("joId");
            if (!joId) {
                return NextResponse.json({ error: "Missing joId" }, { status: 400 });
            }
            const url = `${DIRECTUS_URL}/items/manufacturing_job_order_materials?filter[jo_id][_eq]=${encodeURIComponent(joId)}&limit=-1`;
            const res = await fetch(url, { headers, cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch job order materials");
            const data = await res.json();
            
            // Resolve product details for each material for better UI presentation
            const prodRes = await fetch(`${DIRECTUS_URL}/items/products?limit=-1&fields=product_id,product_name,product_code,cost_per_unit`, { headers });
            const products = prodRes.ok ? (await prodRes.json()).data || [] : [];
            const productsMap = new Map<number, any>();
            products.forEach((p: any) => {
                productsMap.set(Number(p.product_id), p);
            });
            
            const enriched = (data.data || []).map((m: any) => {
                const prod = productsMap.get(Number(m.product_id)) as any;
                return {
                    ...m,
                    product_name: prod?.product_name || `Product #${m.product_id}`,
                    product_code: prod?.product_code || "",
                    cost_per_unit: prod?.cost_per_unit || 0
                };
            });
            
            return NextResponse.json(enriched);
        }

        if (productId) {
            const prodId = Number(productId);
            const vId = bomId ? Number(bomId) : undefined;

            const { version, routes } = vId
                ? await getBOMDetailsForVersion(prodId, vId)
                : await getActiveVersionForProduct(prodId);

            if (!version) {
                return NextResponse.json({ bom: null, components: [], routings: [] });
            }

            // Map version to look like old bom format for client compatibility
            const bom = {
                ...version,
                bom_id: version.version_id,
                bom_name: version.version_name,
                base_quantity: version.base_quantity,
                expected_yield_percentage: version.expected_yield_percentage
            };

            // Fetch operations list to map operation_id to name
            const opRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_operations?limit=-1`, { headers });
            const operations = opRes.ok ? (await opRes.json()).data || [] : [];
            const operationsMap = new Map(operations.map((o: any) => [Number(o.id), o.operation_name]));

            // Flatten and map components from route steps
            const allBomItems: any[] = [];
            routes.forEach(r => {
                if (r.bom_items) {
                    r.bom_items.forEach(bItem => {
                        allBomItems.push(bItem);
                    });
                }
            });

            // Fetch product details (names, codes, categories, UOMs) for BOM items
            const componentProductIds = Array.from(new Set(allBomItems.map(item => Number(item.product_id)).filter(Boolean)));
            const productsMap = new Map<number, any>();
            if (componentProductIds.length > 0) {
                const prodRes = await fetch(`${DIRECTUS_URL}/items/products?filter[product_id][_in]=${componentProductIds.join(",")}&fields=product_id,product_name,product_code,unit_of_measurement.unit_shortcut,product_category.category_name,product_type&limit=-1`, { headers });
                if (prodRes.ok) {
                    const prods = (await prodRes.json()).data || [];
                    prods.forEach((p: any) => productsMap.set(Number(p.product_id), p));
                }
            }

            const components = allBomItems.map(item => {
                const pDetails = productsMap.get(Number(item.product_id));
                return {
                    component_id: item.id,
                    bom_id: version.version_id,
                    component_product_id: {
                        product_id: item.product_id,
                        product_name: pDetails?.product_name || `Product #${item.product_id}`,
                        product_code: pDetails?.product_code || "",
                        category_name: pDetails?.product_category?.category_name || "Uncategorized",
                        product_type: pDetails?.product_type
                    },
                    quantity_required: item.quantity_required,
                    wastage_factor_percentage: item.wastage_factor_percentage || 0,
                    unit_of_measurement: pDetails?.unit_of_measurement?.unit_shortcut || "pcs"
                };
            });

            // Map routings to old format
            const routings = routes.map(r => ({
                routing_id: r.route_id,
                bom_id: version.version_id,
                sequence_order: r.sequence_order,
                setup_time_hours: r.setup_time_hours,
                run_time_hours: r.run_time_hours,
                estimated_labor_cost: r.estimated_labor_cost,
                operation_id: r.operation_id,
                work_center_id: r.work_center_id,
                qa_template_id: r.qa_template_id,
                operation_name: operationsMap.get(Number(r.operation_id)) || `Operation #${r.operation_id}`
            }));

            return NextResponse.json({
                bom,
                components,
                routings
            });
        } else {
            // Fetch all Job Orders
            const list = await fetchJobOrders();
            // Transform snake_case keys back to camelCase for client compatibility if needed
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const camelCaseList = list.map((item: any) => ({
                jo_id: item.jo_id,
                order_id: item.job_order_id || item.order_id || item.id,
                order_no: item.order_no,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: Number(item.quantity || 0),
                due_date: item.due_date,
                status: item.status,
                is_batched: !!item.is_batched,
                bom: item.bom,
                components: item.components,
                routings: item.routings,
                allocationResults: item.allocation_results,
                procurementStatus: item.procurement_status,
                branch_id: item.branch_id,
                products: item.products || [],
                routing_tasks: item.routing_tasks || [],
                routingTasks: item.routing_tasks || [],
                shiftOption: item.shift_option || "8",
                dailyBreakdown: item.daily_breakdown || null,
                createdAt: item.created_at || null,
                createdBy: item.created_by || null,
                parentJobOrderId: item.parent_job_order_id || null,
                producedQty: item.produced_quantity || 0
            }));
            return NextResponse.json(camelCaseList);
        }
    } catch (e) {
        console.error("API Error in planning-engineering GET:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to process planning request" }, { status: 500 });
    }
}
