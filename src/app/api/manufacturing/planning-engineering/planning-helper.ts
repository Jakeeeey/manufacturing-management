import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { DirectusJobOrder } from "@/types/manufacturing";

const headersNoCache = { ...headers, "cache": "no-store" as const };

export async function fetchJobOrders(): Promise<DirectusJobOrder[]> {
    try {
        const [joRes, jopRes, josoRes, tasksRes, assignsRes, qaRes, mfgRoutingsRes, mfgBomsRes] = await Promise.all([
            fetch(`${DIRECTUS_URL}/items/job_order?limit=-1&sort=-jo_id`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/job_order_products?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/job_order_sales_orders?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/job_order_routing_tasks?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/job_order_task_assignments?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/job_order_qa_logs?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_routings?limit=-1`, { headers: headersNoCache }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_boms?limit=-1`, { headers: headersNoCache })
        ]);

        const jos = joRes.ok ? (await joRes.json()).data || [] : [];
        const jops = jopRes.ok ? (await jopRes.json()).data || [] : [];
        const josos = josoRes.ok ? (await josoRes.json()).data || [] : [];
        const tasks = tasksRes.ok ? (await tasksRes.json()).data || [] : [];
        const assigns = assignsRes.ok ? (await assignsRes.json()).data || [] : [];
        const qaLogs = qaRes.ok ? (await qaRes.json()).data || [] : [];
        const mfgRoutings = mfgRoutingsRes && mfgRoutingsRes.ok ? (await mfgRoutingsRes.json()).data || [] : [];
        const mfgBoms = mfgBomsRes && mfgBomsRes.ok ? (await mfgBomsRes.json()).data || [] : [];

        // Map them together
        return jos.map((jo: Record<string, unknown>) => {
            const rawProducts = jops.filter((p: { jo_id?: unknown }) => p.jo_id === jo.jo_id);
            const salesOrders = josos.filter((s: { jo_id?: unknown }) => s.jo_id === jo.jo_id);
            const mainProductId = rawProducts[0]?.product_id || jo.product_id;
            
            // Get all BOM IDs associated with this product
            const productBomIds = mfgBoms
                .filter((b: any) => Number(b.product_id) === Number(mainProductId))
                .map((b: any) => Number(b.bom_id));

            // Map product routings to update requires_qa/requiresQA dynamically from the live template
            const products = rawProducts.map((p: any) => {
                const pId = p.product_id || mainProductId;
                const pBomIds = mfgBoms
                    .filter((b: any) => Number(b.product_id) === Number(pId))
                    .map((b: any) => Number(b.bom_id));

                const mappedRoutings = (p.routings || []).map((r: any) => {
                    const rId = Number(r.routing_id || r.id);
                    const rName = String(r.operation_name || r.name || "").trim().toLowerCase();
                    // Match by routing ID first, or fall back to finding any routing step for this product with the same name that requires QA
                    const liveRout = mfgRoutings.find((mr: any) => Number(mr.routing_id || mr.id) === rId);
                    let reqQA = liveRout 
                        ? (liveRout.requires_qa == 1 || liveRout.requires_qa === true || liveRout.requiresQA === true || liveRout.requiresQA == 1)
                        : (r.requires_qa === true || r.requires_qa == 1 || r.requiresQA === true || r.requiresQA == 1);

                    if (!reqQA && rName) {
                        reqQA = mfgRoutings.some((mr: any) => 
                            pBomIds.includes(Number(mr.bom_id)) && 
                            String(mr.operation_name || mr.name || "").trim().toLowerCase() === rName &&
                            (mr.requires_qa == 1 || mr.requires_qa === true || mr.requiresQA === true || mr.requiresQA == 1)
                        );
                    }

                    return {
                        ...r,
                        requires_qa: reqQA,
                        requiresQA: reqQA
                    };
                });
                return {
                    ...p,
                    routings: mappedRoutings
                };
            });

            // Map routing tasks relationally and update requires_qa dynamically
            const routingTasks = tasks
                .filter((t: { jo_id?: unknown }) => t.jo_id === jo.jo_id)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((task: any) => {
                    const taskAssigns = assigns.filter((a: { task_id?: unknown }) => Number(a.task_id) === Number(task.id));
                    const taskQAs = qaLogs.filter((q: { task_id?: unknown }) => Number(q.task_id) === Number(task.id));
                    const taskName = String(task.name || "").trim().toLowerCase();
                    
                    const liveRout = mfgRoutings.find((mr: any) => Number(mr.routing_id || mr.id) === Number(task.routing_id));
                    let reqQA = liveRout 
                        ? (liveRout.requires_qa == 1 || liveRout.requires_qa === true || liveRout.requiresQA === true || liveRout.requiresQA == 1)
                        : (task.requires_qa === true || task.requires_qa == 1 || task.requiresQA === true || task.requiresQA == 1);

                    if (!reqQA && taskName) {
                        reqQA = mfgRoutings.some((mr: any) => 
                            productBomIds.includes(Number(mr.bom_id)) && 
                            String(mr.operation_name || mr.name || "").trim().toLowerCase() === taskName &&
                            (mr.requires_qa == 1 || mr.requires_qa === true || mr.requiresQA === true || mr.requiresQA == 1)
                        );
                    }

                    return {
                        ...task,
                        requires_qa: reqQA ? 1 : 0,
                        assignments: taskAssigns,
                        qa_logs: taskQAs
                    };
                });
            
            // First product details (for backward compatibility with single-product UI)
            const mainProduct = products[0] || {};

            return {
                ...jo,
                product_id: mainProduct.product_id || null,
                product_name: mainProduct.product_name || null,
                quantity: mainProduct.quantity ? Number(mainProduct.quantity) : 0,
                bom: mainProduct.bom || null,
                components: mainProduct.components || null,
                routings: mainProduct.routings || null,
                allocation_results: mainProduct.allocation_results || null,
                products: products, // array for future-proofing
                sales_orders: salesOrders,
                routing_tasks: routingTasks
            };
        });
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch job orders:", e);
        return [];
    }
}

export async function createJobOrder(joData: Partial<DirectusJobOrder>, salesOrderIds?: number[]): Promise<{ jo_id?: string | null }> {
    try {
        // Insert header
        const headerPayload = {
            jo_id: joData.jo_id,
            due_date: joData.due_date,
            status: joData.status || "Draft",
            is_batched: !!joData.is_batched,
            procurement_status: joData.procurement_status || "Idle",
            branch_id: joData.branch_id || null,
            shift_option: joData.shift_option || "8",
            daily_breakdown: joData.daily_breakdown || null
        };

        const headerRes = await fetch(`${DIRECTUS_URL}/items/job_order`, {
            method: "POST",
            headers,
            body: JSON.stringify(headerPayload)
        });
        if (!headerRes.ok) {
            const txt = await headerRes.text();
            throw new Error(`Failed to create job_order header: ${headerRes.status} - ${txt}`);
        }

        // Insert product(s)
        const productsList = joData.products || [{
            product_id: joData.product_id,
            product_name: joData.product_name,
            quantity: joData.quantity,
            bom: joData.bom || null,
            components: joData.components || null,
            routings: joData.routings || null,
            allocation_results: joData.allocation_results || null
        }];

        for (const p of productsList) {
            const productPayload = {
                jo_id: joData.jo_id,
                product_id: p.product_id,
                product_name: p.product_name,
                quantity: p.quantity,
                bom: p.bom || null,
                components: p.components || null,
                routings: p.routings || null,
                allocation_results: p.allocation_results || null
            };

            const productRes = await fetch(`${DIRECTUS_URL}/items/job_order_products`, {
                method: "POST",
                headers,
                body: JSON.stringify(productPayload)
            });
            if (!productRes.ok) {
                // Rollback header
                await fetch(`${DIRECTUS_URL}/items/job_order/${encodeURIComponent(joData.jo_id || "")}`, { method: "DELETE", headers }).catch(() => {});
                const txt = await productRes.text();
                throw new Error(`Failed to create job_order_product line: ${productRes.status} - ${txt}`);
            }

            // Create relational execution tasks based on the product's routings (planned steps)
            if (p.routings && Array.isArray(p.routings)) {
                for (const r of p.routings) {
                    const taskPayload = {
                        jo_id: joData.jo_id,
                        routing_id: r.routing_id || r.id || null,
                        name: r.name || r.operation_name || "",
                        sequence_order: r.sequence_order || 0,
                        status: "Pending",
                        started_at: null,
                        completed_at: null,
                        completed_by: null,
                        requires_qa: r.requires_qa === true || r.requires_qa == 1 || r.requiresQA === true || r.requiresQA == 1
                    };
                    await fetch(`${DIRECTUS_URL}/items/job_order_routing_tasks`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(taskPayload)
                    }).catch(err => console.error("[Manufacturing Directus API] Failed to auto-generate job_order_routing_tasks row:", err));
                }
            }
        }

        // Insert junction entries
        if (salesOrderIds && salesOrderIds.length > 0) {
            for (const soId of salesOrderIds) {
                await fetch(`${DIRECTUS_URL}/items/job_order_sales_orders`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        jo_id: joData.jo_id,
                        order_id: soId,
                        quantity: joData.quantity
                    })
                }).catch(err => console.error("Error creating job_order_sales_orders link:", err));

                // Automatically update the sales order status to 'For Consolidation'
                console.log(`[Manufacturing Directus API] Updating sales order ${soId} status to For Consolidation`);
                await fetch(`${DIRECTUS_URL}/items/sales_order/${soId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                        order_status: "For Consolidation"
                    })
                }).catch(err => console.error(`Failed to update sales order ${soId} status:`, err));
            }
        }

        return { jo_id: joData.jo_id };
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to create job order:", e);
        throw e;
    }
}

export async function updateJobOrder(joId: string, patchData: Record<string, unknown> & { products?: { product_id: string | number; bom?: unknown; components?: unknown; routings?: unknown; allocationResults?: unknown; quantity?: unknown }[] }): Promise<unknown> {
    try {
        // Self-healing: ensure execution tasks exist in database for all products/routings
        try {
            const tasksCheck = await fetch(`${DIRECTUS_URL}/items/job_order_routing_tasks?filter[jo_id][_eq]=${encodeURIComponent(joId)}&limit=-1`, { headers });
            if (tasksCheck.ok) {
                const existingTasks = (await tasksCheck.json()).data || [];
                const existingRoutingIds = new Set(existingTasks.map((t: { routing_id?: string | number }) => Number(t.routing_id)));
                
                const jopRes = await fetch(`${DIRECTUS_URL}/items/job_order_products?filter[jo_id][_eq]=${encodeURIComponent(joId)}`, { headers });
                if (jopRes.ok) {
                    const productsList = (await jopRes.json()).data || [];
                    for (const p of productsList) {
                        if (p.routings && Array.isArray(p.routings)) {
                            for (const r of p.routings) {
                                const rId = Number(r.routing_id || r.id);
                                if (rId && !existingRoutingIds.has(rId)) {
                                    console.log(`[Manufacturing Directus API] Self-healing auto-generating missing task for JO ${joId}, routing ${rId}`);
                                    const taskPayload = {
                                        jo_id: joId,
                                        routing_id: rId,
                                        name: r.name || r.operation_name || "",
                                        sequence_order: r.sequence_order || 0,
                                        status: "Pending",
                                        started_at: null,
                                        completed_at: null,
                                        completed_by: null,
                                        requires_qa: r.requires_qa === true || r.requires_qa == 1 || r.requiresQA === true || r.requiresQA == 1
                                    };
                                    await fetch(`${DIRECTUS_URL}/items/job_order_routing_tasks`, {
                                        method: "POST",
                                        headers,
                                        body: JSON.stringify(taskPayload)
                                    }).catch(err => console.error("[Manufacturing Directus API] Failed to auto-generate task in self-healing:", err));
                                    
                                    existingRoutingIds.add(rId);
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[Manufacturing Directus API] Error in self-healing task check:", err);
        }

        // Split header fields and product fields
        const headerFields = [
            "due_date", 
            "status", 
            "is_batched", 
            "procurement_status", 
            "branch_id", 
            "assigned_personnel",
            "shift_option",
            "daily_breakdown"
        ];
        const headerPatch: Record<string, unknown> = {};
        const productPatch: Record<string, unknown> = {};

        for (const key of Object.keys(patchData)) {
            if (headerFields.includes(key)) {
                headerPatch[key] = patchData[key];
            } else {
                productPatch[key] = patchData[key];
            }
        }

        // Patch header if needed
        if (Object.keys(headerPatch).length > 0) {
            const res = await fetch(`${DIRECTUS_URL}/items/job_order/${encodeURIComponent(joId)}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify(headerPatch)
            });
            if (!res.ok) throw new Error(`Failed to patch job_order header: ${res.status}`);

            // Automatically pass finished goods to inventory if JO is finalized
            if (headerPatch.status === "Finished") {
                try {
                    const joRes = await fetch(`${DIRECTUS_URL}/items/job_order/${encodeURIComponent(joId)}`, { headers });
                    const jopRes = await fetch(`${DIRECTUS_URL}/items/job_order_products?filter[jo_id][_eq]=${encodeURIComponent(joId)}`, { headers });
                    if (joRes.ok && jopRes.ok) {
                        const joData = (await joRes.json()).data;
                        const productsList = (await jopRes.json()).data || [];
                        
                        if (joData && productsList.length > 0) {
                            const bId = joData.branch_id ? Number(joData.branch_id) : null;
                            
                            // 1. Create a purchase_order record for the completed job order
                            let supplierId = 309;
                            try {
                                const supRes = await fetch(`${DIRECTUS_URL}/items/suppliers?limit=1`, { headers });
                                const suppliers = supRes.ok ? (await supRes.json()).data || [] : [];
                                if (suppliers.length > 0) supplierId = suppliers[0].id;
                            } catch (e) {
                                console.error("Error fetching supplier for JO auto-pass:", e);
                            }

                            for (const p of productsList) {
                                const qty = Number(p.quantity || 0);
                                if (qty > 0) {
                                    const lotNo = `MFG-${joId}`;
                                    const expDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                    
                                    // 1. Create inventory_lots record (acting as the FIFO lot)
                                    const lotRes = await fetch(`${DIRECTUS_URL}/items/inventory_lots`, {
                                        method: "POST",
                                        headers,
                                        body: JSON.stringify({
                                            product_id: p.product_id,
                                            branch_id: bId,
                                            lot_number: lotNo,
                                            expiry_date: expDate,
                                            quantity: qty,
                                            unit_cost: 0,
                                            qa_status: "Passed",
                                            source_type: "manufacturing",
                                            source_reference: joId,
                                            created_on: new Date().toISOString()
                                        })
                                    });

                                    if (!lotRes.ok) {
                                        console.error("[Manufacturing Directus API] Failed to create inventory lot record:", await lotRes.text());
                                    }
                                    
                                    // 2. Create a product_ledger entry (updating transaction history & stock balances)
                                    await fetch(`${DIRECTUS_URL}/items/product_ledger`, {
                                        method: "POST",
                                        headers,
                                        body: JSON.stringify({
                                            branchId: bId,
                                            productId: p.product_id,
                                            quantity: qty,
                                            documentType: "QA Receive", // Map as QA Receive so FIFO check detects it
                                            documentNo: joId,
                                            documentDescription: `MFG Run: ${lotNo}`, // Shorter description to avoid validation length error
                                            documentDate: new Date().toISOString().split('T')[0]
                                        })
                                    });
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error("[Manufacturing Directus API] Failed to auto-pass finished goods to inventory:", err);
                }
            }
        }

        // Patch products array if provided (multi-product JO support)
        if (patchData.products && Array.isArray(patchData.products)) {
            for (const p of patchData.products) {
                const lookupRes = await fetch(`${DIRECTUS_URL}/items/job_order_products?filter[jo_id][_eq]=${encodeURIComponent(joId)}&filter[product_id][_eq]=${p.product_id}&limit=1`, { headers });
                if (lookupRes.ok) {
                    const existing = (await lookupRes.json()).data || [];
                    if (existing.length > 0) {
                        const payload: Record<string, unknown> = {};
                        if (p.bom !== undefined) payload.bom = p.bom;
                        if (p.components !== undefined) payload.components = p.components;
                        if (p.routings !== undefined) payload.routings = p.routings;
                        if (p.allocationResults !== undefined) payload.allocation_results = p.allocationResults;
                        if (p.quantity !== undefined) payload.quantity = p.quantity;
                        
                         const resProd = await fetch(`${DIRECTUS_URL}/items/job_order_products/${existing[0].id}`, {
                            method: "PATCH",
                            headers,
                            body: JSON.stringify(payload)
                        });
                        if (!resProd.ok) throw new Error(`Failed to patch job_order_products line for product ${p.product_id}: ${resProd.status}`);

                        // Relational execution tasks auto-generation if not already present
                        if (p.routings && Array.isArray(p.routings) && p.routings.length > 0) {
                            try {
                                const tasksCheck = await fetch(`${DIRECTUS_URL}/items/job_order_routing_tasks?filter[jo_id][_eq]=${encodeURIComponent(joId)}&limit=-1`, { headers });
                                if (tasksCheck.ok) {
                                    const existingTasks = (await tasksCheck.json()).data || [];
                                    const existingRoutingIds = new Set(existingTasks.map((t: { routing_id?: string | number }) => Number(t.routing_id)));
                                    for (const r of p.routings) {
                                        const rId = Number(r.routing_id || r.id);
                                        if (rId && !existingRoutingIds.has(rId)) {
                                            console.log(`[Manufacturing Directus API] Auto-generating execution task for JO ${joId}, routing ${rId}`);
                                            const taskPayload = {
                                                jo_id: joId,
                                                routing_id: rId,
                                                name: r.name || r.operation_name || "",
                                                sequence_order: r.sequence_order || 0,
                                                status: "Pending",
                                                started_at: null,
                                                completed_at: null,
                                                completed_by: null,
                                                requires_qa: r.requires_qa === true || r.requires_qa == 1 || r.requiresQA === true || r.requiresQA == 1
                                            };
                                            await fetch(`${DIRECTUS_URL}/items/job_order_routing_tasks`, {
                                                method: "POST",
                                                headers,
                                                body: JSON.stringify(taskPayload)
                                            }).catch(err => console.error("[Manufacturing Directus API] Failed to auto-generate task in update:", err));
                                            existingRoutingIds.add(rId);
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error("[Manufacturing Directus API] Error checking/generating tasks in update:", err);
                            }
                        }
                    }
                }
            }
        } else if (Object.keys(productPatch).length > 0) {
            // Fallback for single product patch
            const lookupRes = await fetch(`${DIRECTUS_URL}/items/job_order_products?filter[jo_id][_eq]=${encodeURIComponent(joId)}&limit=1`, { headers });
            if (lookupRes.ok) {
                const products = (await lookupRes.json()).data || [];
                if (products.length > 0) {
                    const resProd = await fetch(`${DIRECTUS_URL}/items/job_order_products/${products[0].id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify(productPatch)
                    });
                    if (!resProd.ok) throw new Error(`Failed to patch job_order_products line: ${resProd.status}`);
                }
            }
        }

        return { success: true };
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to update job order:", e);
        throw e;
    }
}

export async function deleteJobOrder(joId: string): Promise<boolean> {
    try {
        // 1. Delete associated routing tasks and their dependencies
        const tasksRes = await fetch(`${DIRECTUS_URL}/items/job_order_routing_tasks?filter[jo_id][_eq]=${encodeURIComponent(joId)}&limit=-1`, { headers });
        if (tasksRes.ok) {
            const tasksList = (await tasksRes.json()).data || [];
            for (const t of tasksList) {
                // Delete task assignments
                const assRes = await fetch(`${DIRECTUS_URL}/items/job_order_task_assignments?filter[task_id][_eq]=${t.id}&limit=-1`, { headers });
                if (assRes.ok) {
                    const assList = (await assRes.json()).data || [];
                    for (const a of assList) {
                        await fetch(`${DIRECTUS_URL}/items/job_order_task_assignments/${a.id}`, { method: "DELETE", headers }).catch(() => {});
                    }
                }
                // Delete QA logs
                const qaRes = await fetch(`${DIRECTUS_URL}/items/job_order_qa_logs?filter[task_id][_eq]=${t.id}&limit=-1`, { headers });
                if (qaRes.ok) {
                    const qaList = (await qaRes.json()).data || [];
                    for (const q of qaList) {
                        await fetch(`${DIRECTUS_URL}/items/job_order_qa_logs/${q.id}`, { method: "DELETE", headers }).catch(() => {});
                    }
                }
                // Delete the task record itself
                await fetch(`${DIRECTUS_URL}/items/job_order_routing_tasks/${t.id}`, { method: "DELETE", headers }).catch(() => {});
            }
        }

        // Delete job_order_products
        const prodRes = await fetch(`${DIRECTUS_URL}/items/job_order_products?filter[jo_id][_eq]=${encodeURIComponent(joId)}&limit=-1`, { headers });
        if (prodRes.ok) {
            const prods = (await prodRes.json()).data || [];
            for (const p of prods) {
                await fetch(`${DIRECTUS_URL}/items/job_order_products/${p.id}`, { method: "DELETE", headers }).catch(() => {});
            }
        }

        // Delete job_order_sales_orders
        const linkRes = await fetch(`${DIRECTUS_URL}/items/job_order_sales_orders?filter[jo_id][_eq]=${encodeURIComponent(joId)}&limit=-1`, { headers });
        if (linkRes.ok) {
            const links = (await linkRes.json()).data || [];
            for (const link of links) {
                await fetch(`${DIRECTUS_URL}/items/job_order_sales_orders/${link.id}`, { method: "DELETE", headers }).catch(() => {});
            }
        }

        // Delete header
        const res = await fetch(`${DIRECTUS_URL}/items/job_order/${encodeURIComponent(joId)}`, { method: "DELETE", headers });
        return res.ok;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to delete job order:", e);
        return false;
    }
}


