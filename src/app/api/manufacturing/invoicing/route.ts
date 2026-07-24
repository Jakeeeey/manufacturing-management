import { NextResponse } from "next/server";
import { getUserIdFromToken } from "../invoice-consolidation/_auth";
import { allocateInvoicesForConsolidation, releaseReservationIds } from "../invoice-consolidation/_reservation-service";
import { DIRECTUS_URL, headers } from "../directus-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class ApiError extends Error {
    constructor(public status: number, message: string, public details?: Record<string, unknown>) {
        super(message);
    }
}

type Row = Record<string, unknown>;
const locks = new Map<number, Promise<void>>();

async function directus(collection: string, params = new URLSearchParams()) {
    const response = await fetch(`${DIRECTUS_URL}/items/${collection}?${params}`, { headers, cache: "no-store" });
    if (!response.ok) throw new ApiError(503, `Unable to read ${collection}.`);
    return (await response.json()).data;
}

async function remove(collection: string, id: number) {
    const response = await fetch(`${DIRECTUS_URL}/items/${collection}/${id}`, { method: "DELETE", headers });
    if (!response.ok && response.status !== 404) throw new Error(`${collection} ${id} delete returned ${response.status}`);
}

async function withLock<T>(orderId: number, operation: () => Promise<T>) {
    const previous = locks.get(orderId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => current);
    locks.set(orderId, queued);
    await previous;
    try {
        return await operation();
    } finally {
        release();
        if (locks.get(orderId) === queued) locks.delete(orderId);
    }
}

export async function POST(request: Request) {
    try {
        const userId = await getUserIdFromToken();
        if (!userId) throw new ApiError(401, "Authentication is required.");
        const body = await request.json().catch(() => null) as Row | null;
        const salesOrderId = Number(body?.salesOrderId);
        const invoiceNo = typeof body?.invoiceNo === "string" ? body.invoiceNo.trim() : "";
        const invoiceTypeId = Number(body?.invoiceTypeId);
        const invoiceDate = typeof body?.invoiceDate === "string" ? body.invoiceDate : "";
        const dueDate = typeof body?.dueDate === "string" ? body.dueDate : "";
        const remarks = typeof body?.remarks === "string" ? body.remarks.trim() : "";
        if (!Number.isSafeInteger(salesOrderId) || salesOrderId < 1 || !Number.isSafeInteger(invoiceTypeId) || invoiceTypeId < 1 || !invoiceNo || !invoiceDate || !dueDate) {
            throw new ApiError(400, "salesOrderId, invoiceTypeId, invoiceNo, invoiceDate, and dueDate are required.");
        }
        if (!Number.isFinite(Date.parse(invoiceDate)) || !Number.isFinite(Date.parse(dueDate))) {
            throw new ApiError(400, "invoiceDate and dueDate must be valid dates.");
        }

        return await withLock(salesOrderId, async () => {
            const invoiceTypes = await directus("sales_invoice_type", new URLSearchParams({
                "filter[id][_eq]": String(invoiceTypeId),
                fields: "id,type,isOfficial,max_length",
                limit: "1",
            })) as Row[];
            const invoiceType = invoiceTypes[0];
            if (!invoiceType) throw new ApiError(400, "Selected receipt type does not exist.");
            const maxLength = Number(invoiceType.max_length || 0);
            if (maxLength > 0 && invoiceNo.length > maxLength) throw new ApiError(400, `Receipt number cannot exceed ${maxLength} characters.`);
            const orderResponse = await fetch(
                `${DIRECTUS_URL}/items/sales_order/${salesOrderId}?fields=order_id,order_no,order_status,customer_code,branch_id,salesman_id,payment_terms,discount_amount`,
                { headers, cache: "no-store" },
            );
            if (orderResponse.status === 404) throw new ApiError(404, "Sales order not found.");
            if (!orderResponse.ok) throw new ApiError(503, "Unable to reload the sales order.");
            const order = (await orderResponse.json()).data as Row;
            if (order.order_status !== "For Picking") throw new ApiError(409, "Sales order must be For Picking.");
            const branchId = Number(order.branch_id);
            if (!Number.isSafeInteger(branchId) || branchId < 1) throw new ApiError(409, "Sales order has no valid branch.");

            const details = await directus("sales_order_details", new URLSearchParams({
                "filter[order_id][_eq]": String(salesOrderId),
                fields: "detail_id,product_id,bom_version_id,unit_price,ordered_quantity,net_amount,gross_amount",
                limit: "-1",
            })) as Row[];
            if (!details.length || details.some((detail) => Number(detail.ordered_quantity) <= 0 || !Number.isFinite(Number(detail.ordered_quantity)))) {
                throw new ApiError(409, "Sales order must contain positive detail quantities.");
            }

            const activeInvoices = await directus("sales_invoice", new URLSearchParams({
                "filter[order_id][_eq]": String(salesOrderId),
                fields: "invoice_id,transaction_status",
                limit: "-1",
            })) as Row[];
            if (activeInvoices.some((invoice) => invoice.transaction_status !== "Cancelled")) {
                throw new ApiError(409, "Sales order already has an active invoice.");
            }
            const duplicateInvoices = await directus("sales_invoice", new URLSearchParams({
                "filter[invoice_no][_eq]": invoiceNo,
                fields: "invoice_id",
                limit: "1",
            })) as Row[];
            if (duplicateInvoices.length) throw new ApiError(409, `Invoice number "${invoiceNo}" already exists.`);

            const productIds = [...new Set(details.map((detail) => Number(detail.product_id)))];
            const products = await directus("products", new URLSearchParams({
                "filter[product_id][_in]": productIds.join(","),
                fields: "product_id,product_name,unit_of_measurement.unit_id",
                limit: "-1",
            })) as Row[];
            const productMap = new Map(products.map((product) => [Number(product.product_id), product]));
            if (productIds.some((id) => !Number((productMap.get(id)?.unit_of_measurement as Row | undefined)?.unit_id))) {
                throw new ApiError(409, "Every invoiced product must have an actual unit of measurement.");
            }

            const lotFilter = encodeURIComponent(JSON.stringify({
                _and: [
                    { product_id: { _in: productIds } },
                    { branch_id: { _eq: branchId } },
                    { qa_status: { _eq: "Passed" } },
                    { source_type: { _in: ["manufacturing", "yield_ledger"] } },
                ],
            }));
            const lotsResponse = await fetch(
                `${DIRECTUS_URL}/items/inventory_lots?filter=${lotFilter}&fields=id,product_id,lot_id,source_type,source_reference&limit=-1`,
                { headers, cache: "no-store" },
            );
            if (!lotsResponse.ok) throw new ApiError(503, "Unable to read eligible finished-goods lots.");
            const lots = ((await lotsResponse.json()).data || []) as Row[];
            const lotIds = lots.map((lot) => Number(lot.lot_id)).filter(Boolean);
            const movements = lotIds.length ? await directus("inventory_movements", new URLSearchParams({
                "filter[branch_id][_eq]": String(branchId),
                "filter[product_id][_in]": productIds.join(","),
                "filter[lot_id][_in]": lotIds.join(","),
                fields: "product_id,version_id,lot_id,quantity",
                limit: "-1",
            })) as Row[] : [];
            const jobNumbers = [...new Set(lots.map((lot) => String(lot.source_reference || "")).filter(Boolean))];
            const jobs = jobNumbers.length ? await directus("manufacturing_job_orders", new URLSearchParams({
                "filter[job_order_no][_in]": jobNumbers.join(","),
                fields: "job_order_no,version_id",
                limit: "-1",
            })) as Row[] : [];
            const jobVersions = new Map(jobs.map((job) => [String(job.job_order_no), Number(job.version_id)]));
            const activeVersions = await directus("product_manufacturing_version", new URLSearchParams({
                "filter[product_id][_in]": productIds.join(","),
                fields: "product_id,version_id,version_name,status",
                limit: "-1",
            })) as Row[];
            const activeVersionMap = new Map<number, number>();
            for (const version of activeVersions) {
                const productId = Number(version.product_id);
                if (version.status === "Active" && !activeVersionMap.has(productId)) activeVersionMap.set(productId, Number(version.version_id));
            }
            const versionMap = new Map(activeVersions.map((version) => [Number(version.version_id), String(version.version_name || `Version ${version.version_id}`)]));
            const lotVersions = new Map(lots.map((lot) => [
                `${Number(lot.product_id)}:${Number(lot.lot_id)}`,
                jobVersions.get(String(lot.source_reference || "")) || activeVersionMap.get(Number(lot.product_id)) || null,
            ]));
            const stock = new Map<string, number>();
            for (const movement of movements) {
                const versionId = Number(movement.version_id) || lotVersions.get(`${Number(movement.product_id)}:${Number(movement.lot_id)}`);
                const key = `${Number(movement.product_id)}:${versionId || ""}`;
                stock.set(key, (stock.get(key) || 0) + Number(movement.quantity || 0));
            }
            const demand = new Map<string, number>();
            for (const detail of details) {
                const versionId = Number(detail.bom_version_id);
                if (!versionId) throw new ApiError(409, `Sales-order detail ${detail.detail_id} has no BOM version.`);
                const key = `${Number(detail.product_id)}:${versionId}`;
                demand.set(key, (demand.get(key) || 0) + Number(detail.ordered_quantity));
            }
            const shortages = [...demand]
                .filter(([key, quantity]) => (stock.get(key) || 0) < quantity)
                .map(([key, required]) => {
                    const [productId, versionId] = key.split(":").map(Number);
                    return {
                        productId,
                        productName: String(productMap.get(productId)?.product_name || `Product ${productId}`),
                        versionId,
                        versionName: versionMap.get(versionId) || `Version ${versionId}`,
                        branchId,
                        required,
                        available: stock.get(key) || 0,
                    };
                });
            if (shortages.length) {
                const first = shortages[0];
                throw new ApiError(
                    409,
                    `Insufficient ${first.productName} (${first.versionName}) stock in branch ${branchId}: ${first.required} required, ${first.available} available.`,
                    { shortages },
                );
            }

            const discount = Number(order.discount_amount || 0);
            const gross = details.reduce((sum, detail) => sum + Number(detail.unit_price) * Number(detail.ordered_quantity), 0);
            if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(discount) || discount < 0 || discount > gross) {
                throw new ApiError(409, "Sales order has invalid invoice amounts.");
            }

            let invoiceId: number | null = null;
            const detailIds: number[] = [];
            let reservationIds: number[] = [];
            try {
                const headerResponse = await fetch(`${DIRECTUS_URL}/items/sales_invoice`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        invoice_no: invoiceNo,
                        invoice_date: invoiceDate,
                        due_date: dueDate,
                        created_date: new Date().toISOString(),
                        customer_code: order.customer_code,
                        order_id: salesOrderId,
                        salesman_id: order.salesman_id || null,
                        branch_id: branchId,
                        payment_terms: order.payment_terms || null,
                        invoice_type: invoiceTypeId,
                        transaction_status: "Prepared",
                        payment_status: "Unpaid",
                        total_amount: gross,
                        gross_amount: gross,
                        discount_amount: discount,
                        vat_amount: 0,
                        net_amount: gross - discount,
                        remarks,
                    }),
                });
                if (!headerResponse.ok) throw new Error(`invoice header returned ${headerResponse.status}`);
                invoiceId = Number((await headerResponse.json()).data?.invoice_id);
                if (!Number.isSafeInteger(invoiceId) || invoiceId < 1) throw new Error("invoice header returned no valid ID");

                for (const detail of details) {
                    const quantity = Number(detail.ordered_quantity);
                    const unitPrice = Number(detail.unit_price);
                    const detailResponse = await fetch(`${DIRECTUS_URL}/items/sales_invoice_details`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            order_id: salesOrderId,
                            invoice_no: invoiceId,
                            product_id: Number(detail.product_id),
                            unit: Number((productMap.get(Number(detail.product_id))!.unit_of_measurement as Row).unit_id),
                            unit_price: unitPrice,
                            quantity,
                            discount_amount: 0,
                            gross_amount: quantity * unitPrice,
                            total_amount: quantity * unitPrice,
                            net_amount: quantity * unitPrice,
                        }),
                    });
                    if (!detailResponse.ok) throw new Error(`invoice detail returned ${detailResponse.status}`);
                    const detailId = Number((await detailResponse.json()).data?.detail_id);
                    if (!Number.isSafeInteger(detailId) || detailId < 1) throw new Error("invoice detail returned no valid ID");
                    detailIds.push(detailId);
                }

                const allocation = await allocateInvoicesForConsolidation([invoiceId], userId);
                reservationIds = allocation.createdReservationIds;

                const orderUpdate = await fetch(`${DIRECTUS_URL}/items/sales_order/${salesOrderId}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ order_status: "For Invoicing" }),
                });
                if (!orderUpdate.ok) throw new Error(`sales-order update returned ${orderUpdate.status}`);
            } catch (error) {
                const cleanupFailures: string[] = [];
                if (reservationIds.length > 0) {
                    const released = await releaseReservationIds(reservationIds, userId).catch(() => false);
                    if (!released) cleanupFailures.push("invoice reservations");
                }
                for (const detailId of detailIds.reverse()) await remove("sales_invoice_details", detailId).catch((failure) => cleanupFailures.push(String(failure)));
                if (invoiceId) await remove("sales_invoice", invoiceId).catch((failure) => cleanupFailures.push(String(failure)));
                if (cleanupFailures.length) throw new ApiError(500, "Invoice creation failed and cleanup was incomplete.", { cleanupRequired: true, invoiceId });
                console.error("Invoice creation compensated:", error);
                if (error instanceof Error && error.message.includes("Insufficient eligible stock")) {
                    throw new ApiError(409, error.message);
                }
                throw new ApiError(503, "Invoice creation failed. Partial records were removed; please retry.");
            }

            return NextResponse.json({
                invoiceId,
                invoiceNo,
                transactionStatus: "Prepared",
                reservationCount: reservationIds.length,
            }, { status: 201 });
        });
    } catch (error) {
        if (error instanceof ApiError) return NextResponse.json({ error: error.message, ...error.details }, { status: error.status });
        console.error("Invoicing creation error:", error);
        return NextResponse.json({ error: "Failed to create invoice." }, { status: 500 });
    }
}
