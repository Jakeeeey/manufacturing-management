import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
        const orderId = searchParams.get("orderId");

        // Fetch details for a specific order
        if (orderId) {
            const res = await fetch(`${DIRECTUS_URL}/items/sales_order_details?filter[order_id][_eq]=${orderId}&limit=-1`, { headers, cache: "no-store" });
            if (!res.ok) throw new Error(`Failed to fetch sales order details: ${res.status}`);
            const json = await res.json();
            const details = json.data || [];

            // Resolve raw product_id integers into objects for frontend compatibility
            const productIds = [...new Set(details.map((d: any) => Number(d.product_id)).filter(Boolean))];
            if (productIds.length > 0) {
                try {
                    const prodRes = await fetch(`${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&limit=-1&fields=product_id,product_name,product_code,unit_of_measurement.unit_shortcut,unit_of_measurement_count,product_brand.brand_name,product_category.category_name`, { headers });
                    if (prodRes.ok) {
                        const prodData = (await prodRes.json()).data || [];
                        const prodMap = new Map<number, any>(prodData.map((p: any) => [p.product_id, p]));
                        for (const det of details) {
                            const rawId = Number(det.product_id);
                            const matchedProd = prodMap.get(rawId);
                            det.product_id = matchedProd ? {
                                product_id: matchedProd.product_id,
                                product_name: matchedProd.product_name,
                                product_code: matchedProd.product_code,
                                uom: matchedProd.unit_of_measurement?.unit_shortcut || "PCS",
                                uom_count: matchedProd.unit_of_measurement_count ? Number(matchedProd.unit_of_measurement_count) : 1,
                                brand: matchedProd.product_brand?.brand_name || "N/A",
                                category: matchedProd.product_category?.category_name || "N/A"
                            } : {
                                product_id: rawId,
                                product_name: `Product #${rawId}`,
                                product_code: `CODE-${rawId}`,
                                uom: "PCS",
                                uom_count: 1,
                                brand: "N/A",
                                category: "N/A"
                            };
                        }
                    }
                } catch (err) {
                    console.error("Error expanding products in sales-order details:", err);
                }
            }

            return NextResponse.json(details);
        }

        // Paginated list of sales orders
        const page = Number(searchParams.get("page") || "1");
        const limit = Number(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const selectedIdsParam = searchParams.get("selectedIds") || "";
        const excludeHasJo = searchParams.get("excludeHasJo") === "true";

        let linkedSoIds: number[] = [];
        if (excludeHasJo) {
            try {
                const josoRes = await fetch(`${DIRECTUS_URL}/items/job_order_sales_orders?limit=-1`, { headers, cache: "no-store" });
                if (josoRes.ok) {
                    const links = (await josoRes.json()).data || [];
                    linkedSoIds = links.map((l: any) => Number(l.so_id || l.sales_order_id)).filter(Boolean);
                }
            } catch (err) {
                console.error("Error fetching job_order_sales_orders links:", err);
            }
        }

        let queryParams = `?page=${page}&limit=${limit}&meta=filter_count&sort=-created_date`;
        
        const filterParts: string[] = [];
        if (status) {
            filterParts.push(`filter[order_status][_eq]=${encodeURIComponent(status)}`);
        }
        if (search) {
            filterParts.push(`filter[_or][0][order_no][_icontains]=${encodeURIComponent(search)}`);
            filterParts.push(`filter[_or][1][customer_code][_icontains]=${encodeURIComponent(search)}`);
        }
        if (excludeHasJo && linkedSoIds.length > 0) {
            filterParts.push(`filter[order_id][_nin]=${linkedSoIds.join(",")}`);
        }
        if (filterParts.length > 0) {
            queryParams += "&" + filterParts.join("&");
        }

        const res = await fetch(`${DIRECTUS_URL}/items/sales_order${queryParams}`, { headers, cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to fetch sales orders: ${res.status}`);
        const json = await res.json();
        const salesOrders = json.data || [];
        const totalCount = json.meta?.filter_count || 0;
        const totalPages = Math.ceil(totalCount / limit);

        const orderIdsToFetch = new Set<number>(salesOrders.map((so: any) => Number(so.order_id)));
        if (selectedIdsParam) {
            selectedIdsParam.split(",").forEach(idStr => {
                const idNum = Number(idStr.trim());
                if (idNum) orderIdsToFetch.add(idNum);
            });
        }

        const detailsMap: Record<number, any[]> = {};
        
        if (orderIdsToFetch.size > 0) {
            const orderIdsArray = Array.from(orderIdsToFetch);
            const detailsRes = await fetch(`${DIRECTUS_URL}/items/sales_order_details?filter[order_id][_in]=${orderIdsArray.join(",")}&limit=-1`, { headers, cache: "no-store" });
            if (detailsRes.ok) {
                const detailsJson = await detailsRes.json();
                const allDetails = detailsJson.data || [];

                const productIds = [...new Set(allDetails.map((d: any) => Number(d.product_id)).filter(Boolean))];
                let prodMap = new Map<number, any>();
                if (productIds.length > 0) {
                    try {
                        const prodRes = await fetch(`${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&limit=-1&fields=product_id,product_name,product_code,unit_of_measurement.unit_shortcut,unit_of_measurement_count,product_brand.brand_name,product_category.category_name`, { headers });
                        if (prodRes.ok) {
                            const prodData = (await prodRes.json()).data || [];
                            prodMap = new Map(prodData.map((p: any) => [p.product_id, p]));
                        }
                    } catch (err) {
                        console.error("Error fetching products in bulk:", err);
                    }
                }

                for (const det of allDetails) {
                    const rawId = Number(det.product_id);
                    const matchedProd = prodMap.get(rawId);
                    det.product_id = matchedProd ? {
                        product_id: matchedProd.product_id,
                        product_name: matchedProd.product_name,
                        product_code: matchedProd.product_code,
                        uom: matchedProd.unit_of_measurement?.unit_shortcut || "PCS",
                        uom_count: matchedProd.unit_of_measurement_count ? Number(matchedProd.unit_of_measurement_count) : 1,
                        brand: matchedProd.product_brand?.brand_name || "N/A",
                        category: matchedProd.product_category?.category_name || "N/A"
                    } : {
                        product_id: rawId,
                        product_name: `Product #${rawId}`,
                        product_code: `CODE-${rawId}`,
                        uom: "PCS",
                        uom_count: 1,
                        brand: "N/A",
                        category: "N/A"
                    };

                    const orderIdNum = Number(det.order_id);
                    if (!detailsMap[orderIdNum]) {
                        detailsMap[orderIdNum] = [];
                    }
                    detailsMap[orderIdNum].push(det);
                }
            }
        }

        try {
            const custRes = await fetch(`${DIRECTUS_URL}/items/customer?limit=-1&fields=customer_code,customer_name`, { headers });
            if (custRes.ok) {
                const custData = (await custRes.json()).data || [];
                const custMap = new Map(custData.map((c: any) => [c.customer_code, c.customer_name]));
                for (const so of salesOrders) {
                    so.customer_name = custMap.get(so.customer_code) || so.customer_code;
                }
            }
        } catch (err) {
            console.error("Error joining customers in sales-order route:", err);
        }

        return NextResponse.json({
            data: salesOrders,
            detailsMap,
            meta: {
                totalCount,
                totalPages,
                page,
                limit
            }
        });
    } catch (e: any) {
        console.error("API Error in sales-order GET:", e);
        return NextResponse.json({ error: e.message || "Failed to fetch sales orders" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { quotationId, poNo, dueDate, deliveryDate, paymentTerms, remarks, discountAmount, salesmanId, supplierId, branchId } = body;

        if (!quotationId || !poNo) {
            return NextResponse.json({ error: "Missing required fields (quotationId, poNo)" }, { status: 400 });
        }

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
            console.error("Error decoding user token in SO conversion:", err);
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
        const items = snapshots.filter((s: any) => s.node_type === "product_quota");
        if (items.length === 0) {
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
        for (const item of items) {
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
    } catch (e: any) {
        console.error("API Error in sales-order POST:", e);
        return NextResponse.json({ error: e.message || "Failed to process quotation conversion" }, { status: 500 });
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
    } catch (e: any) {
        console.error("API Error in sales-order PATCH:", e);
        return NextResponse.json({ error: e.message || "Failed to update sales order" }, { status: 500 });
    }
}
