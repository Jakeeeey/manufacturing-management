/* eslint-disable */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
    addSalesOrderFilters,
    enrichSalesOrderReadModel,
    fetchDetailsForOrders,
    findScheduledDetailIds,
    SALES_ORDER_FIELDS
} from "./_read";

const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://vtc:8074";
const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

const headers: Record<string, string> = {
    "Content-Type": "application/json"
};
if (DIRECTUS_STATIC_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_STATIC_TOKEN}`;
}


export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
        const orderId = searchParams.get("orderId");

        const read = async (collection: string, params: URLSearchParams) => {
            const response = await fetch(`${DIRECTUS_URL}/items/${collection}?${params.toString()}`, {
                headers,
                cache: "no-store"
            });
            if (!response.ok) throw new Error(`Failed to fetch ${collection}: ${response.status}`);
            return response.json();
        };

        if (action === "create-lookups") {
            const optionalRead = async (collection: string, params: URLSearchParams) => {
                try {
                    return await read(collection, params);
                } catch (error) {
                    console.error(`Failed to fetch optional sales-order lookup ${collection}:`, error);
                    return { data: [] };
                }
            };

            const [customerResult, productResult] = await Promise.all([
                read("customer", new URLSearchParams({
                    fields: "id,customer_name,customer_code",
                    limit: "-1",
                    sort: "customer_name"
                })),
                read("products", new URLSearchParams({
                    "filter[product_type][_eq]": "388",
                    fields: "product_id,product_name,product_code,product_type,price_per_unit,cost_per_unit",
                    limit: "-1",
                    sort: "product_name"
                }))
            ]);

            const [branchResult, paymentTermResult, salesmanResult, supplierResult] = await Promise.all([
                optionalRead("branches", new URLSearchParams({
                    "filter[isActive][_eq]": "1",
                    fields: "id,branch_name",
                    limit: "100",
                    sort: "branch_name"
                })),
                optionalRead("payment_terms", new URLSearchParams({
                    fields: "id,payment_name,payment_days",
                    limit: "-1",
                    sort: "payment_name"
                })),
                optionalRead("salesman", new URLSearchParams({
                    "filter[isActive][_eq]": "true",
                    fields: "id,salesman_name",
                    limit: "-1",
                    sort: "salesman_name"
                })),
                optionalRead("suppliers", new URLSearchParams({
                    "filter[isActive][_eq]": "true",
                    fields: "id,supplier_name",
                    limit: "-1",
                    sort: "supplier_name"
                }))
            ]);

            return NextResponse.json({
                customers: customerResult.data || [],
                products: productResult.data || [],
                branches: branchResult.data || [],
                paymentTerms: paymentTermResult.data || [],
                salesmen: salesmanResult.data || [],
                suppliers: supplierResult.data || []
            });
        }

        // Fetch details for a specific order
        if (orderId) {
            const numericOrderId = Number(orderId);
            const [details, orderResult] = await Promise.all([
                fetchDetailsForOrders(read, [numericOrderId]),
                read("sales_order", new URLSearchParams({
                    "filter[order_id][_eq]": String(numericOrderId),
                    fields: SALES_ORDER_FIELDS,
                    limit: "1"
                }))
            ]);
            const orders = orderResult.data || [];
            const detailsMap = await enrichSalesOrderReadModel(read, orders, details);
            return NextResponse.json(detailsMap[numericOrderId] || []);
        }

        // Paginated list of sales orders
        const page = Number(searchParams.get("page") || "1");
        const limit = Number(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const selectedIdsParam = searchParams.get("selectedIds") || "";
        const excludeHasJo = searchParams.get("excludeHasJo") === "true";
        const customerCode = searchParams.get("customerCode") || "";
        const dateFrom = searchParams.get("dateFrom") || "";
        const dateTo = searchParams.get("dateTo") || "";

        const filters = { search, status, customerCode, dateFrom, dateTo };
        let salesOrders: any[] = [];
        let prefetchedDetails: any[] = [];
        let scheduledDetailIds = new Set<number>();
        let totalCount = 0;
        let countExact = true;
        let hasMore = false;

        if (excludeHasJo) {
            const candidateChunkSize = 100;
            const candidateLimit = 1000;
            const targetEligibleCount = page * limit;
            const eligibleOrders: any[] = [];
            const eligibleDetails: any[] = [];
            let inspectedCount = 0;
            let candidateCount = 0;

            while (inspectedCount < candidateLimit && eligibleOrders.length < targetEligibleCount) {
                const candidateParams = new URLSearchParams({
                    page: String(Math.floor(inspectedCount / candidateChunkSize) + 1),
                    limit: String(Math.min(candidateChunkSize, candidateLimit - inspectedCount)),
                    meta: "filter_count",
                    sort: "-created_date",
                    fields: SALES_ORDER_FIELDS
                });
                addSalesOrderFilters(candidateParams, filters);
                const candidateResult = await read("sales_order", candidateParams);
                const candidates = candidateResult.data || [];
                if (inspectedCount === 0) candidateCount = Number(candidateResult.meta?.filter_count || candidates.length);
                if (candidates.length === 0) break;

                const candidateDetails = await fetchDetailsForOrders(read, candidates.map((order: any) => Number(order.order_id)));
                const chunkScheduledIds = await findScheduledDetailIds(read, candidateDetails);
                const detailsByOrder = new Map<number, any[]>();
                for (const detail of candidateDetails) {
                    const detailOrderId = Number(detail.order_id);
                    const orderDetails = detailsByOrder.get(detailOrderId) || [];
                    orderDetails.push(detail);
                    detailsByOrder.set(detailOrderId, orderDetails);
                }
                for (const candidate of candidates) {
                    const orderDetails = detailsByOrder.get(Number(candidate.order_id)) || [];
                    const unscheduled = orderDetails.filter((detail) => !chunkScheduledIds.has(Number(detail.detail_id || detail.id)));
                    if (orderDetails.length === 0 || unscheduled.length > 0) {
                        eligibleOrders.push(candidate);
                        eligibleDetails.push(...unscheduled);
                    }
                }
                inspectedCount += candidates.length;
                if (candidates.length < candidateChunkSize) break;
            }

            countExact = inspectedCount >= candidateCount;
            const start = (page - 1) * limit;
            salesOrders = eligibleOrders.slice(start, start + limit);
            const pageOrderIds = new Set(salesOrders.map((order) => Number(order.order_id)));
            prefetchedDetails = eligibleDetails.filter((detail) => pageOrderIds.has(Number(detail.order_id)));
            totalCount = eligibleOrders.length;
            hasMore = !countExact || eligibleOrders.length > start + salesOrders.length;
        } else {
            const orderParams = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                meta: "filter_count",
                sort: "-created_date",
                fields: SALES_ORDER_FIELDS
            });
            addSalesOrderFilters(orderParams, filters);
            const orderResult = await read("sales_order", orderParams);
            salesOrders = orderResult.data || [];
            totalCount = Number(orderResult.meta?.filter_count || 0);
            hasMore = page * limit < totalCount;
        }

        const orderIdsToFetch = new Set<number>(salesOrders.map((so: any) => Number(so.order_id)));
        if (selectedIdsParam) {
            selectedIdsParam.split(",").forEach(idStr => {
                const idNum = Number(idStr.trim());
                if (idNum) orderIdsToFetch.add(idNum);
            });
        }

        const missingSelectedIds = [...orderIdsToFetch].filter((id) => !salesOrders.some((order) => Number(order.order_id) === id));
        let selectedOrders: any[] = [];
        if (missingSelectedIds.length > 0) {
            selectedOrders = (await read("sales_order", new URLSearchParams({
                "filter[order_id][_in]": missingSelectedIds.join(","),
                fields: SALES_ORDER_FIELDS,
                limit: "-1"
            }))).data || [];
        }
        const contextOrders = [...salesOrders, ...selectedOrders];
        const details = excludeHasJo
            ? [...prefetchedDetails, ...(missingSelectedIds.length > 0 ? await fetchDetailsForOrders(read, missingSelectedIds) : [])]
            : await fetchDetailsForOrders(read, [...orderIdsToFetch]);
        if (excludeHasJo && missingSelectedIds.length > 0) {
            scheduledDetailIds = await findScheduledDetailIds(read, details);
        }
        const detailsMap = await enrichSalesOrderReadModel(read, contextOrders, details, scheduledDetailIds);

        const totalPages = Math.ceil(totalCount / limit);

        return NextResponse.json({
            data: salesOrders,
            detailsMap,
            meta: {
                totalCount,
                totalPages,
                page,
                limit,
                hasMore,
                countExact
            }
        });
    } catch (e) {
        console.error("API Error in sales-order GET:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to fetch sales orders" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { quotationId, customerId, poNo, items, dueDate, deliveryDate, paymentTerms, remarks, discountAmount, salesmanId, supplierId, branchId } = body;

        // Get logged in user ID from secure access token cookie
        let encoderId: number | null = null;
        try {
            const cookieStore = await cookies();
            const token = cookieStore.get("vos_access_token")?.value;
            if (token) {
                const parts = token.split(".");
                if (parts.length >= 2) {
                    const base64Url = parts[1];
                    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                    while (base64.length % 4) base64 += "=";
                    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
                    const payload = JSON.parse(jsonPayload);
                    const rawId = payload?.id || payload?.user_id || payload?.sub;
                    if (rawId) {
                        const parsed = Number(rawId);
                        if (!isNaN(parsed)) {
                            encoderId = parsed;
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Error decoding user token in SO creation:", err);
        }

        if (!quotationId) {
            if (!customerId || !poNo || !items || items.length === 0) {
                return NextResponse.json({ error: "Missing required fields for direct creation (customerId, poNo, items)" }, { status: 400 });
            }

            // 1. Fetch customer details
            const custRes = await fetch(`${DIRECTUS_URL}/items/customer/${customerId}`, { headers, cache: "no-store" });
            if (!custRes.ok) throw new Error("Failed to fetch customer");
            const cust = (await custRes.json()).data;
            const customerCode = cust.customer_code || cust.customer_name || "CUST-GEN";

            // 2. Reserve a collision-safe number using the allocator's auto-increment key.
            const allocationRes = await fetch(`${DIRECTUS_URL}/items/sales_order_number_allocations`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    created_at: new Date().toISOString(),
                    created_by: encoderId
                })
            });
            if (!allocationRes.ok) {
                const allocationError = await allocationRes.text();
                console.error(`Failed to allocate sales order number: ${allocationRes.status} - ${allocationError}`);
                return NextResponse.json(
                    { error: "Unable to allocate a sales order number. Please try again." },
                    { status: 503 }
                );
            }
            const allocation = (await allocationRes.json()).data;
            const allocationId = Number(allocation?.id);
            if (!Number.isSafeInteger(allocationId) || allocationId < 1) {
                console.error("Sales order number allocator returned an invalid ID.", allocation);
                return NextResponse.json(
                    { error: "Unable to allocate a sales order number. Please try again." },
                    { status: 503 }
                );
            }
            const orderNo = `SO-DIR-${String(allocationId).padStart(6, "0")}`;

            // Calculate total amount
            // disabled-lint-next-line @typescript-eslint/no-explicit-any
            const totalAmount = items.reduce((sum: number, it: any) => sum + (Number(it.unit_price || 0) * Number(it.quantity || 0)), 0);

            // 3. Create Sales Order
            const salesOrderPayload = {
                order_no: orderNo,
                po_no: poNo,
                customer_code: customerCode,
                order_status: "Draft",
                total_amount: totalAmount,
                discount_amount: discountAmount ? Number(discountAmount) : 0,
                net_amount: totalAmount - (discountAmount ? Number(discountAmount) : 0),
                remarks: remarks || `Directly Created Sales Order.`,
                created_date: new Date().toISOString(),
                created_by: encoderId || null,
                delivery_date: deliveryDate || null,
                due_date: dueDate || null,
                payment_terms: paymentTerms ? Number(paymentTerms) : null,
                salesman_id: salesmanId ? Number(salesmanId) : null,
                supplier_id: supplierId ? Number(supplierId) : null,
                branch_id: branchId ? Number(branchId) : null
            };

            const createSoRes = await fetch(`${DIRECTUS_URL}/items/sales_order`, {
                method: "POST",
                headers,
                body: JSON.stringify(salesOrderPayload)
            });

            if (!createSoRes.ok) {
                const errText = await createSoRes.text();
                throw new Error(`Failed to create sales order: ${createSoRes.status} - ${errText}`);
            }

            const newSo = (await createSoRes.json()).data;
            const newOrderId = newSo.order_id;

            // 4. Create Sales Order Details
            for (const item of items) {
                const detailPayload = {
                    order_id: newOrderId,
                    product_id: item.product_id,
                    unit_price: Number(item.unit_price || 0),
                    ordered_quantity: Number(item.quantity || 1),
                    allocated_quantity: 0,
                    served_quantity: 0,
                    allocated_amount: 0,
                    net_amount: Number(item.unit_price || 0) * Number(item.quantity || 1),
                    gross_amount: Number(item.unit_price || 0) * Number(item.quantity || 1),
                    created_date: new Date().toISOString()
                };

                const detailRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(detailPayload)
                });

                if (!detailRes.ok) {
                    console.error(`Failed to insert SO detail: ${detailRes.status}`);
                }
            }

            return NextResponse.json({ success: true, order_id: newOrderId, order_no: orderNo });
        }

        if (!poNo) {
            return NextResponse.json({ error: "Missing required field poNo" }, { status: 400 });
        }

        // 1. Fetch the quotation header
        const quoteRes = await fetch(`${DIRECTUS_URL}/items/quotation_header/${quotationId}`, { headers, cache: "no-store" });
        if (!quoteRes.ok) throw new Error(`Failed to fetch quotation header: ${quoteRes.status}`);
        const quote = (await quoteRes.json()).data;

        // 2. Fetch the quotation snapshots
        const snapRes = await fetch(`${DIRECTUS_URL}/items/quotation_snapshots?filter[quotation_id][_eq]=${quotationId}&limit=-1`, { headers, cache: "no-store" });
        if (!snapRes.ok) throw new Error(`Failed to fetch quotation snapshots: ${snapRes.status}`);
        const snapshots = (await snapRes.json()).data;

        // Filter snapshots that are actual product quotas
// disabled-lint-next-line @typescript-eslint/no-explicit-any
        const quoteItems = snapshots.filter((s: any) => s.node_type === "product_quota");
        if (quoteItems.length === 0) {
            throw new Error("No finished goods found in this quotation.");
        }

        // 3. Fetch customer details
        const custRes = await fetch(`${DIRECTUS_URL}/items/customer/${quote.customer_id}`, { headers, cache: "no-store" });
        let customerCode = "CUST-GEN";
        if (custRes.ok) {
            const cust = (await custRes.json()).data;
            customerCode = cust.customer_code || cust.customer_name || "CUST-GEN";
        }

        // 4. Create Sales Order
        const orderNo = `SO-${quote.quote_number.replace("QT-", "")}`;
        const salesOrderPayload = {
            order_no: orderNo,
            po_no: poNo,
            customer_code: customerCode,
            order_status: "Draft", // Start as Draft to edit quantities
            total_amount: Number(quote.total_selling_price || 0),
            discount_amount: discountAmount ? Number(discountAmount) : 0,
            net_amount: Number(quote.total_selling_price || 0) - (discountAmount ? Number(discountAmount) : 0),
            remarks: remarks || `Converted 1:1 from Quote ${quote.quote_number}.`,
            created_date: new Date().toISOString(),
            created_by: encoderId || null,
            delivery_date: deliveryDate || null,
            due_date: dueDate || null,
            payment_terms: paymentTerms ? Number(paymentTerms) : null,
            salesman_id: salesmanId ? Number(salesmanId) : null,
            supplier_id: supplierId ? Number(supplierId) : null,
            branch_id: branchId ? Number(branchId) : null
        };

        const createSoRes = await fetch(`${DIRECTUS_URL}/items/sales_order`, {
            method: "POST",
            headers,
            body: JSON.stringify(salesOrderPayload)
        });

        if (!createSoRes.ok) {
            const errText = await createSoRes.text();
            throw new Error(`Failed to create sales order: ${createSoRes.status} - ${errText}`);
        }

        const newSo = (await createSoRes.json()).data;
        const newOrderId = newSo.order_id;

        // 5. Create Sales Order Details
        for (const item of quoteItems) {
            const detailPayload = {
                order_id: newOrderId,
                product_id: item.product_id,
                unit_price: Number(item.frozen_total_cost_php || 0), // Agreed unit price
                ordered_quantity: Number(item.quantity || 1),
                allocated_quantity: 0,
                served_quantity: 0,
                allocated_amount: 0,
                net_amount: Number(item.frozen_total_cost_php || 0) * Number(item.quantity || 1),
                gross_amount: Number(item.frozen_total_cost_php || 0) * Number(item.quantity || 1),
                created_date: new Date().toISOString()
            };

            const detailRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details`, {
                method: "POST",
                headers,
                body: JSON.stringify(detailPayload)
            });

            if (!detailRes.ok) {
                console.error(`Failed to insert SO detail: ${detailRes.status}`);
            }
        }

        // 6. Update Quotation Status
        await fetch(`${DIRECTUS_URL}/items/quotation_header/${quotationId}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
                status: "Converted to SO",
                remarks: `${quote.remarks || ""}\n[System: Converted to Sales Order ${orderNo}]`
            })
        });

        return NextResponse.json({ success: true, order_id: newOrderId, order_no: orderNo });
    } catch (e) {
        console.error("API Error in sales-order POST:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to process quotation conversion" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { orderId, orderStatus, details } = body;

        if (!orderId) {
            return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
        }

        // 1. If details array is provided, batch update quantities and totals
        if (details && Array.isArray(details)) {
            for (const item of details) {
                const detailRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details/${item.detail_id}`, { headers, cache: "no-store" });
                if (detailRes.ok) {
                    const detailData = (await detailRes.json()).data;
                    const unitPrice = Number(detailData.unit_price || 0);
                    const qty = Number(item.ordered_quantity || 0);
                    const newNet = unitPrice * qty;
                    
                    // Update the detail record
                    await fetch(`${DIRECTUS_URL}/items/sales_order_details/${item.detail_id}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({
                            ordered_quantity: qty,
                            net_amount: newNet,
                            gross_amount: newNet
                        })
                    });
                }
            }

            // Recalculate total_amount from all details of this order
            const allDetailsRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details?filter[order_id][_eq]=${orderId}&limit=-1`, { headers, cache: "no-store" });
            if (allDetailsRes.ok) {
                const allDetails = (await allDetailsRes.json()).data || [];
// disabled-lint-next-line @typescript-eslint/no-explicit-any
                const sum = allDetails.reduce((acc: number, d: any) => acc + Number(d.net_amount || 0), 0);
                
                // Fetch current status and discount_amount to update net_amount
                const soHeaderRes = await fetch(`${DIRECTUS_URL}/items/sales_order/${orderId}`, { headers, cache: "no-store" });
                let discount = 0;
                let currentStatus = "";
                if (soHeaderRes.ok) {
                    const soHeader = (await soHeaderRes.json()).data;
                    discount = Number(soHeader.discount_amount || 0);
                    currentStatus = soHeader.order_status;
                }

// disabled-lint-next-line @typescript-eslint/no-explicit-any
                const headerPayload: any = {
                    total_amount: sum,
                    net_amount: sum - discount
                };

                // Auto transition Draft to Pending upon edit
                if (currentStatus === "Draft") {
                    headerPayload.order_status = "Pending";
                }

                // Update the sales order header with recalculated totals
                await fetch(`${DIRECTUS_URL}/items/sales_order/${orderId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(headerPayload)
                });
            }
        }

        // 2. If orderStatus is provided, update the status
        if (orderStatus) {
            const updateRes = await fetch(`${DIRECTUS_URL}/items/sales_order/${orderId}`, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ order_status: orderStatus })
            });

            if (!updateRes.ok) throw new Error(`Failed to update sales order status: ${updateRes.status}`);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("API Error in sales-order PATCH:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to update sales order" }, { status: 500 });
    }
}
