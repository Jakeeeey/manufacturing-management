/* eslint-disable */
import { DIRECTUS_URL, headers, DirectusJobOrder, getUomCountForProduct } from "./shared";
import { getBOMDetailsForVersion, getActiveVersionForProduct } from "../../finished-goods/versions/versions-helper";

export async function createJobOrder(joData: Partial<DirectusJobOrder>, salesOrderIds?: number[]): Promise<{ jo_id?: string | null }> {
    try {
        let productsList = joData.products || [];
        if (productsList.length === 0 && joData.product_id) {
            productsList = [{
                product_id: joData.product_id,
                product_name: joData.product_name,
                quantity: joData.quantity,
                bom: joData.bom
            }];
        }

        const mergedProducts: Record<string, any> = {};
        for (const p of productsList) {
            const pId = Number(p.product_id);
            let versionId = (p as any).bom?.version || (p as any).bom?.bom_id || (p as any).bom?.version_id || null;
            if (!versionId && salesOrderIds && salesOrderIds.length > 0) {
                try {
                    const soId = salesOrderIds[0];
                    const soRes = await fetch(`${DIRECTUS_URL}/items/sales_order/${soId}`, { headers });
                    if (soRes.ok) {
                        const so = (await soRes.json()).data;
                        const customerCode = so?.customer_code;
                        if (customerCode) {
                            const custRes = await fetch(`${DIRECTUS_URL}/items/customer?filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=1`, { headers });
                            if (custRes.ok) {
                                const customer = (await custRes.json()).data?.[0];
                                const customerId = customer?.id || customer?.customer_id;
                                if (customerId) {
                                    const activeVer = await getActiveVersionForProduct(pId, Number(customerId));
                                    versionId = activeVer.version?.version_id || null;
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("Failed to resolve customer override during creation:", err);
                }
            }
            if (!versionId) {
                const activeVer = await getActiveVersionForProduct(pId);
                versionId = activeVer.version?.version_id || null;
            }
            const key = `${pId}-${versionId || 'default'}`;
            if (!mergedProducts[key]) {
                mergedProducts[key] = {
                    product_id: pId,
                    product_name: p.product_name || `Product #${pId}`,
                    quantity: 0,
                    bom: versionId ? { version_id: versionId } : null
                };
            }
            mergedProducts[key].quantity += Number(p.quantity || 0);
        }
        const finalProductsList = Object.values(mergedProducts);
        const totalMergedQuantity = finalProductsList.reduce((sum, p) => sum + Number(p.quantity || 0), 0);

        const firstProd = finalProductsList[0];
        if (!firstProd) throw new Error("No products selected for Job Order");

        let versionId = firstProd.bom?.version_id;
        if (!versionId && salesOrderIds && salesOrderIds.length > 0) {
            try {
                const soId = salesOrderIds[0];
                const soRes = await fetch(`${DIRECTUS_URL}/items/sales_order/${soId}`, { headers });
                if (soRes.ok) {
                    const so = (await soRes.json()).data;
                    const customerCode = so?.customer_code;
                    if (customerCode) {
                        const custRes = await fetch(`${DIRECTUS_URL}/items/customer?filter[customer_code][_eq]=${encodeURIComponent(customerCode)}&limit=1`, { headers });
                        if (custRes.ok) {
                            const customer = (await custRes.json()).data?.[0];
                            const customerId = customer?.id || customer?.customer_id;
                            if (customerId) {
                                const activeVer = await getActiveVersionForProduct(firstProd.product_id, Number(customerId));
                                versionId = activeVer.version?.version_id;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to resolve customer override for first product:", err);
            }
        }
        if (!versionId) {
            const activeVer = await getActiveVersionForProduct(firstProd.product_id);
            versionId = activeVer.version?.version_id;
        }

        let initialStatus = joData.status || "Draft";
        if (initialStatus === "Shortage") initialStatus = "Draft";
        else if (initialStatus === "Proceed") initialStatus = "Released";
        else if (initialStatus === "Ongoing") initialStatus = "In Progress";
        else if (initialStatus === "Finished") initialStatus = "Completed";

        // 3. Insert header
        const headerPayload = {
            job_order_no: joData.jo_id || `JO-${Math.floor(100000 + Math.random() * 900000)}`,
            product_id: firstProd.product_id,
            version_id: versionId || null,
            target_quantity: Number(totalMergedQuantity),
            actual_quantity_produced: 0,
            start_date: new Date().toISOString().split("T")[0],
            end_date: joData.due_date || null,
            status: initialStatus,
            created_by: joData.created_by ? Number(joData.created_by) : null,
            created_at: new Date().toISOString(),
            remarks: joData.remarks || `Consolidated production run. Shift: ${joData.shift_option || "8"}`,
            parent_job_order_id: joData.parent_job_order_id ? Number(joData.parent_job_order_id) : null
        };

        const headerRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders`, {
            method: "POST",
            headers,
            body: JSON.stringify(headerPayload)
        });
        if (!headerRes.ok) {
            const txt = await headerRes.text();
            throw new Error(`Failed to create job_order header: ${headerRes.status} - ${txt}`);
        }

        const createdJo = (await headerRes.json()).data;
        const joIdInt = createdJo.job_order_id;
        const joNoStr = createdJo.job_order_no;

        // 4. Insert merged product(s) and explode BOM/routings
        for (const p of finalProductsList) {
            const { version, routes } = versionId 
                ? await getBOMDetailsForVersion(p.product_id, versionId)
                : await getActiveVersionForProduct(p.product_id);

            let productionQty = Number(p.quantity);
            if (version && version.product_id && Number(version.product_id) !== Number(p.product_id)) {
                try {
                    const originalUomCount = await getUomCountForProduct(Number(p.product_id));
                    const targetUomCount = await getUomCountForProduct(Number(version.product_id));
                    productionQty = productionQty * (originalUomCount / targetUomCount);
                } catch (e) {
                    console.error("Error scaling quantity for job order product variant:", e);
                }
            }

            const baseQuantity = Number(version?.base_quantity || 1);

            if (routes && routes.length > 0) {
                for (const r of routes) {
                    // Insert into JO routes table
                    const routePayload = {
                        job_order_id: joIdInt,
                        sequence_order: Number(r.sequence_order || 0),
                        work_center_id: Number(r.work_center_id || 1),
                        operation_id: Number((r as any).operation_id || (r as any).id || 1),
                        planned_setup_hours: Number(r.setup_time_hours || 0),
                        planned_run_hours: (productionQty * Number(r.run_time_hours || 0)) / baseQuantity,
                        actual_setup_hours: 0,
                        actual_run_hours: 0,
                        estimated_labor_cost: (productionQty * Number(r.estimated_labor_cost || 0)) / baseQuantity,
                        actual_labor_cost: 0
                    };

                    const routeRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_routes?fields=jo_route_id`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(routePayload)
                    });
                    if (routeRes.ok) {
                        const routeJson = await routeRes.json();
                        const newRouteId = routeJson.data?.jo_route_id;
                        if (newRouteId) {
                            const stepSeq = Number(r.sequence_order || 0);
                            const assignedUserIds = (joData as any).assignments?.[stepSeq] || [];
                            for (const uId of assignedUserIds) {
                                let userRate = 150;
                                try {
                                    const uRes = await fetch(`${DIRECTUS_URL}/items/user/${uId}?fields=hourly_rate`, { headers });
                                    if (uRes.ok) {
                                        const uData = (await uRes.json()).data;
                                        userRate = Number(uData?.hourly_rate || 150);
                                    }
                                } catch (e) {
                                    console.error("Error fetching user rate during creation:", e);
                                }

                                const assPayload = {
                                    jo_route_id: newRouteId,
                                    operator_id: Number(uId),
                                    logged_hours: 0,
                                    hourly_rate: userRate,
                                    logged_at: new Date().toISOString()
                                };
                                await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_route_operators`, {
                                    method: "POST",
                                    headers,
                                    body: JSON.stringify(assPayload)
                                }).catch(err => console.error("Error creating route operator assignment:", err));
                            }
                        }
                    } else {
                        console.error("Error creating manufacturing_job_order_routes row:", await routeRes.text());
                    }

                    // Extract BOM items (materials)
                    if (r.bom_items && r.bom_items.length > 0) {
                        for (const bItem of r.bom_items) {
                            const compProductId = Number(bItem.product_id);
                            const wastage = 1 + (Number(bItem.wastage_factor_percentage || 0) / 100);
                            const baseQuantity = Number(version?.base_quantity || 1);
                            const quantityRequired = (productionQty * Number(bItem.quantity_required || 0) * wastage) / baseQuantity;

                            // FIFO Allocation from inventory_lots
                            const lotFilter = joData.branch_id ? `&filter[branch_id][_eq]=${joData.branch_id}` : "";
                            const lotsRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots?filter[product_id][_eq]=${compProductId}&filter[qa_status][_eq]=Passed&filter[quantity][_gt]=0${lotFilter}&sort=expiry_date`, { headers });
                            const validLots = lotsRes.ok ? (await lotsRes.json()).data || [] : [];

                            let allocatedQty = 0;
                            for (const lot of validLots) {
                                if (allocatedQty >= quantityRequired) break;
                                const availableInLot = Number(lot.quantity || 0);
                                const needed = quantityRequired - allocatedQty;
                                const taken = Math.min(availableInLot, needed);

                                allocatedQty += taken;

                                // Deduct from inventory_lots to hold the stock
                                const newQty = availableInLot - taken;
                                await fetch(`${DIRECTUS_URL}/items/inventory_lots/${lot.id}`, {
                                    method: "PATCH",
                                    headers,
                                    body: JSON.stringify({ quantity: newQty })
                                }).catch(err => console.error(`Failed to deduct inventory lot ${lot.id}:`, err));
                            }

                            let uomId = Number((bItem as any).uom_id || 0);
                            if (!uomId) {
                                try {
                                    const pRes = await fetch(`${DIRECTUS_URL}/items/products/${compProductId}?fields=unit_of_measurement`, { headers });
                                    if (pRes.ok) {
                                        const pData = (await pRes.json()).data;
                                        const uomVal = pData?.unit_of_measurement;
                                        uomId = uomVal ? Number(uomVal.id || uomVal) : 1;
                                    }
                                } catch (e) {
                                    console.error("Error looking up UOM ID for component:", e);
                                    uomId = 1;
                                }
                            }

                            // Log Material Requirement
                            const matPayload = {
                                job_order_id: joIdInt,
                                jo_id: joNoStr,
                                product_id: compProductId,
                                uom_id: uomId || 1,
                                allocated_quantity: quantityRequired,
                                quantity_required: quantityRequired,
                                quantity_allocated: allocatedQty,
                                actual_consumed_quantity: 0,
                                scrap_quantity: 0
                            };
                            await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_materials`, {
                                method: "POST",
                                headers,
                                body: JSON.stringify(matPayload)
                            }).catch(err => console.error("Error creating manufacturing_job_order_materials row:", err));

                            // Auto-spawn child Job Orders for manufactured sub-assemblies with shortages
                            const shortfall = quantityRequired - allocatedQty;
                            if (shortfall > 0) {
                                try {
                                    const activeVer = await getActiveVersionForProduct(compProductId);
                                    if (activeVer && activeVer.version) {
                                        const childJoNo = `${joNoStr}-SUB${compProductId}`;
                                        const checkJoRes = await fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders?filter[job_order_no][_eq]=${childJoNo}&limit=1`, { headers });
                                        const alreadyExists = checkJoRes.ok ? ((await checkJoRes.json()).data || []).length > 0 : false;

                                        if (!alreadyExists) {
                                            console.log(`[Sub-Assembly Spawner] Auto-spawning child Job Order ${childJoNo} for product ID ${compProductId} (Qty: ${shortfall})`);
                                            const childJoPayload = {
                                                jo_id: childJoNo,
                                                product_id: compProductId,
                                                quantity: shortfall,
                                                due_date: joData.due_date || null,
                                                status: "Released",
                                                branch_id: joData.branch_id,
                                                created_by: joData.created_by,
                                                parent_job_order_id: joIdInt,
                                                remarks: `Auto-spawned sub-assembly run for parent Job Order ${joNoStr}`
                                            };
                                            await createJobOrder(childJoPayload, []);
                                        }
                                    }
                                } catch (subErr) {
                                    console.error(`[Sub-Assembly Spawner] Failed to spawn child JO for component ${compProductId}:`, subErr);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 5. Insert junction entries (Sales Order allocations)
        if (salesOrderIds && salesOrderIds.length > 0) {
            for (const soId of salesOrderIds) {
                // Fetch all detail lines for this sales order and filter in-memory to match family products
                const detailsRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details?filter[order_id][_eq]=${soId}&limit=-1`, { headers });
                if (detailsRes.ok) {
                    const details = (await detailsRes.json()).data || [];
                    for (const det of details) {
                        const detProductId = Number(det.product_id);
                        let isMatch = detProductId === Number(firstProd.product_id);

                        if (!isMatch) {
                            try {
                                const prodCheckRes = await fetch(`${DIRECTUS_URL}/items/products/${detProductId}?fields=product_id,parent_id`, { headers });
                                if (prodCheckRes.ok) {
                                    const prodCheck = await prodCheckRes.json();
                                    const parentVal = prodCheck.data?.parent_id;
                                    const parentIdVal = parentVal && typeof parentVal === 'object' ? Number(parentVal.product_id) : (parentVal ? Number(parentVal) : null);
                                    if (parentIdVal === Number(firstProd.product_id)) {
                                        isMatch = true;
                                    }
                                }
                            } catch (e) {
                                console.error("Error checking product family hierarchy for allocation:", e);
                            }
                        }

                        if (isMatch) {
                            await fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_allocations`, {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    job_order_id: joIdInt,
                                    jo_id: joNoStr,
                                    sales_order_detail_id: det.detail_id,
                                    allocated_quantity: Number(det.ordered_quantity || 0)
                                })
                            }).catch(err => console.error("Error creating manufacturing_job_order_allocations link:", err));

                            // Automatically update the sales order status to 'For Picking'
                            console.log(`[Manufacturing Directus API] Updating sales order status for details ${det.detail_id} to For Picking`);
                            try {
                                await fetch(`${DIRECTUS_URL}/items/sales_order/${soId}`, {
                                    method: "PATCH",
                                    headers,
                                    body: JSON.stringify({
                                        order_status: "For Picking",
                                        for_picking_at: new Date().toISOString()
                                    })
                                });
                            } catch (err) {
                                console.error("Failed to update parent sales order status:", err);
                            }
                        }
                    }
                }
            }
        }

        return { jo_id: joNoStr };
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to create job order:", e);
        throw e;
    }
}
