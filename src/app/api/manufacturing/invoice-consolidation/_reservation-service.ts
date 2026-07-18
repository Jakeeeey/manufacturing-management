import { DIRECTUS_URL, headers as directusHeaders } from "../directus-api";
import { resolveVersions } from "./version-resolver";

type ReservationStatus = "Pending" | "Reserved" | "Consumed" | "Released";

interface InvoiceRow {
    invoice_id: number;
    invoice_no: string;
    invoice_date: string | null;
    customer_code: string;
    branch_id: number;
    transaction_status: string;
    isDispatched: boolean | null;
}

interface DetailRow {
    detail_id: number;
    invoice_no: number;
    product_id: number;
    quantity: number;
}

interface InventoryLotRow {
    id: number;
    product_id: number;
    branch_id: number;
    lot_id: number | { lot_id: number; lot_name?: string | null } | null;
    lot_number?: string | null;
    batch_no?: string | null;
    expiry_date?: string | null;
    created_on?: string | null;
    quantity: number;
    qa_status: string;
    source_type?: string | null;
    source_reference?: string | null;
}

interface ReservationRow {
    id: number;
    sales_invoice_detail_id: number | DetailRow;
    inventory_lot_id: number | InventoryLotRow;
    quantity: number;
    status: ReservationStatus;
    created_at?: string | null;
}

function numericId(value: unknown, keys: string[] = ["id"]): number | null {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number(value) || null;
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        for (const key of keys) {
            const id = Number(record[key]);
            if (id) return id;
        }
    }
    return null;
}

function detailId(row: ReservationRow): number {
    return numericId(row.sales_invoice_detail_id, ["detail_id", "id"]) || 0;
}

function inventoryLotId(row: ReservationRow): number {
    return numericId(row.inventory_lot_id, ["id"]) || 0;
}

async function directusJson(url: string, init?: RequestInit) {
    const response = await fetch(url, {
        ...init,
        headers: directusHeaders,
        cache: "no-store",
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Directus request failed (${response.status}): ${text}`);
    }
    return response.json();
}

async function fetchEligibleInvoices(branchId: number): Promise<InvoiceRow[]> {
    const filter: Record<string, unknown> = {
        _and: [
            { branch_id: { _eq: branchId } },
            { transaction_status: { _eq: "Prepared" } },
            {
                _or: [
                    { isDispatched: { _eq: false } },
                    { isDispatched: { _null: true } },
                ],
            },
        ],
    };
    const query = new URLSearchParams({
        filter: JSON.stringify(filter),
        fields: "invoice_id,invoice_no,invoice_date,customer_code,branch_id,transaction_status,isDispatched",
        sort: "-invoice_date,-invoice_id",
        limit: "-1",
    });
    const invoiceJson = await directusJson(`${DIRECTUS_URL}/items/sales_invoice?${query.toString()}`);
    let invoices: InvoiceRow[] = invoiceJson.data || [];
    if (invoices.length === 0) return [];

    const linkedJson = await directusJson(
        `${DIRECTUS_URL}/items/consolidator_invoices?filter[consolidator_id][consolidator_no][_starts_with]=CLINV-&filter[consolidator_id][is_delete][_eq]=0&fields=invoice_id&limit=-1`
    );
    const linkedIds = new Set<number>((linkedJson.data || []).map((row: { invoice_id: number }) => Number(row.invoice_id)));
    invoices = invoices.filter((invoice) => !linkedIds.has(Number(invoice.invoice_id)));
    return invoices;
}

export async function getInvoiceReservationSummaries(branchId: number, search?: string) {
    const invoices = await fetchEligibleInvoices(branchId);
    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((invoice) => invoice.invoice_id);
    const detailsJson = await directusJson(
        `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_in]=${invoiceIds.join(",")}&fields=detail_id,invoice_no,product_id,quantity&limit=-1`
    );
    const details: DetailRow[] = detailsJson.data || [];
    const detailIds = details.map((detail) => detail.detail_id);

    let reservations: ReservationRow[] = [];
    if (detailIds.length > 0) {
        const reservationFilter = encodeURIComponent(JSON.stringify({
            _and: [
                { sales_invoice_detail_id: { _in: detailIds } },
                { status: { _eq: "Reserved" } },
            ],
        }));
        const reservationJson = await directusJson(
            `${DIRECTUS_URL}/items/sales_invoice_reservation?filter=${reservationFilter}&fields=id,sales_invoice_detail_id,inventory_lot_id.id,inventory_lot_id.lot_number,inventory_lot_id.batch_no,inventory_lot_id.expiry_date,inventory_lot_id.lot_id.lot_id,inventory_lot_id.lot_id.lot_name,quantity,status&limit=-1`
        );
        reservations = reservationJson.data || [];
    }

    const productIds = [...new Set(details.map((detail) => Number(detail.product_id)).filter(Boolean))];
    const productMap = new Map<number, { product_name: string; product_code: string }>();
    if (productIds.length > 0) {
        const productJson = await directusJson(
            `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&fields=product_id,product_name,product_code&limit=-1`
        );
        for (const product of productJson.data || []) {
            productMap.set(Number(product.product_id), product);
        }
    }

    const customerCodes = [...new Set(invoices.map((invoice) => invoice.customer_code).filter(Boolean))];
    const customerMap = new Map<string, string>();
    if (customerCodes.length > 0) {
        const customerFilter = encodeURIComponent(JSON.stringify({ customer_code: { _in: customerCodes } }));
        const customerJson = await directusJson(
            `${DIRECTUS_URL}/items/customer?filter=${customerFilter}&fields=customer_code,customer_name&limit=-1`
        );
        for (const customer of customerJson.data || []) {
            customerMap.set(String(customer.customer_code), customer.customer_name);
        }
    }

    const reservationsByDetail = new Map<number, ReservationRow[]>();
    for (const reservation of reservations) {
        const id = detailId(reservation);
        const rows = reservationsByDetail.get(id) || [];
        rows.push(reservation);
        reservationsByDetail.set(id, rows);
    }

    const summaries = invoices.map((invoice) => {
        const invoiceDetails = details.filter((detail) => Number(detail.invoice_no) === Number(invoice.invoice_id));
        const mappedDetails = invoiceDetails.map((detail) => {
            const rows = reservationsByDetail.get(detail.detail_id) || [];
            const requiredQuantity = Number(detail.quantity || 0);
            const reservedQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
            const product = productMap.get(Number(detail.product_id));

            return {
                detailId: detail.detail_id,
                productId: Number(detail.product_id),
                productName: product?.product_name || `Product #${detail.product_id}`,
                productCode: product?.product_code || "",
                requiredQuantity,
                reservedQuantity,
                shortageQuantity: Math.max(0, requiredQuantity - reservedQuantity),
                allocations: rows.map((row) => {
                    const lot = typeof row.inventory_lot_id === "object" ? row.inventory_lot_id : null;
                    const physicalLot = lot && typeof lot.lot_id === "object" ? lot.lot_id : null;
                    return {
                        id: row.id,
                        inventoryLotId: inventoryLotId(row),
                        lotName: physicalLot?.lot_name || "Unassigned",
                        batchNo: lot?.batch_no || lot?.lot_number || "LOT-N/A",
                        expiryDate: lot?.expiry_date || null,
                        quantity: Number(row.quantity || 0),
                        status: row.status,
                    };
                }),
            };
        });

        const requiredQuantity = mappedDetails.reduce((sum, detail) => sum + detail.requiredQuantity, 0);
        const reservedQuantity = mappedDetails.reduce((sum, detail) => sum + detail.reservedQuantity, 0);
        const fullyReservedDetails = mappedDetails.filter((detail) => detail.shortageQuantity <= 0).length;
        const status = reservedQuantity <= 0
            ? "Unallocated"
            : fullyReservedDetails === mappedDetails.length && mappedDetails.length > 0
                ? "Reserved"
                : "Partial";

        return {
            invoiceId: invoice.invoice_id,
            invoiceNo: invoice.invoice_no,
            invoiceDate: invoice.invoice_date,
            customerName: customerMap.get(invoice.customer_code) || invoice.customer_code || "Unknown Customer",
            branchId: Number(invoice.branch_id),
            totalDetails: mappedDetails.length,
            fullyReservedDetails,
            requiredQuantity,
            reservedQuantity,
            status,
            details: mappedDetails,
        };
    });

    const normalizedSearch = search?.trim().toLowerCase();
    return normalizedSearch
        ? summaries.filter((invoice) =>
            invoice.invoiceNo.toLowerCase().includes(normalizedSearch)
            || invoice.customerName.toLowerCase().includes(normalizedSearch)
        )
        : summaries;
}

async function reconcileInventoryLots(inventoryLotIds: number[], userId: number) {
    if (inventoryLotIds.length === 0) return;

    const lotsJson = await directusJson(
        `${DIRECTUS_URL}/items/inventory_lots?filter[id][_in]=${inventoryLotIds.join(",")}&fields=id,quantity&limit=-1`
    );
    const capacityMap = new Map<number, number>(
        (lotsJson.data || []).map((lot: { id: number; quantity: number }) => [Number(lot.id), Number(lot.quantity || 0)])
    );

    const filter = encodeURIComponent(JSON.stringify({
        _and: [
            { inventory_lot_id: { _in: inventoryLotIds } },
            { status: { _in: ["Reserved", "Pending"] } },
        ],
    }));
    const reservationJson = await directusJson(
        `${DIRECTUS_URL}/items/sales_invoice_reservation?filter=${filter}&fields=id,inventory_lot_id,quantity,status,created_at&sort=created_at,id&limit=-1`
    );
    const rows: ReservationRow[] = reservationJson.data || [];
    const grouped = new Map<number, ReservationRow[]>();
    for (const row of rows) {
        const id = inventoryLotId(row);
        const entries = grouped.get(id) || [];
        entries.push(row);
        grouped.set(id, entries);
    }

    const now = new Date().toISOString();
    for (const [lotId, lotRows] of grouped) {
        let remaining = capacityMap.get(lotId) || 0;
        const reservedRows = lotRows.filter((row) => row.status === "Reserved");
        const pendingRows = lotRows.filter((row) => row.status === "Pending");

        for (const row of reservedRows) {
            remaining = Math.max(0, remaining - Number(row.quantity || 0));
        }

        for (const row of pendingRows) {
            const requested = Number(row.quantity || 0);
            const accepted = Math.min(requested, remaining);
            remaining -= accepted;
            const payload = accepted > 0
                ? { quantity: accepted, status: "Reserved", updated_by: userId, updated_at: now }
                : { status: "Released", updated_by: userId, updated_at: now };
            await directusJson(`${DIRECTUS_URL}/items/sales_invoice_reservation/${row.id}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
        }
    }
}

export async function allocateInvoice(invoiceId: number, userId: number) {
    const invoiceJson = await directusJson(
        `${DIRECTUS_URL}/items/sales_invoice/${invoiceId}?fields=invoice_id,invoice_no,invoice_date,customer_code,branch_id,transaction_status,isDispatched`
    );
    const invoice: InvoiceRow | undefined = invoiceJson.data;
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.transaction_status !== "Prepared" || invoice.isDispatched === true) {
        throw new Error("Only prepared, undispatched invoices can be allocated");
    }

    const linkedJson = await directusJson(
        `${DIRECTUS_URL}/items/consolidator_invoices?filter[invoice_id][_eq]=${invoiceId}&filter[consolidator_id][consolidator_no][_starts_with]=CLINV-&filter[consolidator_id][is_delete][_eq]=0&fields=id&limit=1`
    );
    if ((linkedJson.data || []).length > 0) {
        throw new Error("Invoice is already linked to a consolidation batch");
    }

    const detailsJson = await directusJson(
        `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_eq]=${invoiceId}&fields=detail_id,invoice_no,product_id,quantity&limit=-1`
    );
    const details: DetailRow[] = detailsJson.data || [];
    if (details.length === 0) throw new Error("Invoice has no product details");

    const customerFilter = encodeURIComponent(JSON.stringify({ customer_code: { _eq: invoice.customer_code } }));
    const customerJson = await directusJson(
        `${DIRECTUS_URL}/items/customer?filter=${customerFilter}&fields=id&limit=1`
    );
    const customerId = Number(customerJson.data?.[0]?.id || 0);
    if (!customerId) throw new Error("Invoice customer cannot be resolved for BOM version allocation");

    const pairs = details.map((detail) => ({ customerId, productId: Number(detail.product_id) }));
    const demandVersionMap = await resolveVersions(pairs);
    for (const detail of details) {
        const version = demandVersionMap.get(`${customerId}:${Number(detail.product_id)}`)?.versionId;
        if (!version) throw new Error(`No manufacturing version is configured for product ${detail.product_id}`);
    }

    const productIds = [...new Set(details.map((detail) => Number(detail.product_id)))];
    const lotFilter = encodeURIComponent(JSON.stringify({
        _and: [
            { product_id: { _in: productIds } },
            { branch_id: { _eq: Number(invoice.branch_id) } },
            { qa_status: { _eq: "Passed" } },
            { quantity: { _gt: 0 } },
            { source_type: { _in: ["manufacturing", "yield_ledger"] } },
        ],
    }));
    const lotsJson = await directusJson(
        `${DIRECTUS_URL}/items/inventory_lots?filter=${lotFilter}&fields=id,product_id,branch_id,lot_id,lot_number,batch_no,expiry_date,created_on,quantity,qa_status,source_type,source_reference&limit=-1`
    );
    const lots: InventoryLotRow[] = (lotsJson.data || []).filter((lot: InventoryLotRow) => numericId(lot.lot_id, ["lot_id"]) !== null);

    const jobOrderNumbers = [...new Set(lots.map((lot) => lot.source_reference).filter(Boolean))] as string[];
    const jobVersionMap = new Map<string, number>();
    if (jobOrderNumbers.length > 0) {
        const joFilter = encodeURIComponent(JSON.stringify({ job_order_no: { _in: jobOrderNumbers } }));
        const joJson = await directusJson(
            `${DIRECTUS_URL}/items/manufacturing_job_orders?filter=${joFilter}&fields=job_order_no,version_id&limit=-1`
        );
        for (const jobOrder of joJson.data || []) {
            if (jobOrder.job_order_no && jobOrder.version_id) {
                jobVersionMap.set(String(jobOrder.job_order_no), Number(jobOrder.version_id));
            }
        }
    }

    const activeFilter = encodeURIComponent(JSON.stringify({
        _and: [
            { product_id: { _in: productIds } },
            { status: { _eq: "Active" } },
        ],
    }));
    const activeJson = await directusJson(
        `${DIRECTUS_URL}/items/product_manufacturing_version?filter=${activeFilter}&fields=product_id,version_id&limit=-1`
    );
    const activeVersionMap = new Map<number, number>();
    for (const version of activeJson.data || []) {
        const productId = Number(version.product_id);
        if (!activeVersionMap.has(productId)) activeVersionMap.set(productId, Number(version.version_id));
    }

    const lotIds = lots.map((lot) => lot.id);
    const reservedByLot = new Map<number, number>();
    const reservedByDetail = new Map<number, number>();
    if (lotIds.length > 0) {
        const reservationFilter = encodeURIComponent(JSON.stringify({
            _and: [
                { inventory_lot_id: { _in: lotIds } },
                { status: { _eq: "Reserved" } },
            ],
        }));
        const activeReservationsJson = await directusJson(
            `${DIRECTUS_URL}/items/sales_invoice_reservation?filter=${reservationFilter}&fields=id,sales_invoice_detail_id,inventory_lot_id,quantity,status&limit=-1`
        );
        for (const reservation of (activeReservationsJson.data || []) as ReservationRow[]) {
            const lotId = inventoryLotId(reservation);
            const detId = detailId(reservation);
            reservedByLot.set(lotId, (reservedByLot.get(lotId) || 0) + Number(reservation.quantity || 0));
            reservedByDetail.set(detId, (reservedByDetail.get(detId) || 0) + Number(reservation.quantity || 0));
        }
    }

    const availableByLot = new Map<number, number>();
    for (const lot of lots) {
        availableByLot.set(lot.id, Math.max(0, Number(lot.quantity || 0) - (reservedByLot.get(lot.id) || 0)));
    }

    const now = new Date().toISOString();
    const pendingRows: Record<string, unknown>[] = [];
    for (const detail of details) {
        let remaining = Math.max(0, Number(detail.quantity || 0) - (reservedByDetail.get(detail.detail_id) || 0));
        if (remaining <= 0) continue;

        const targetVersion = demandVersionMap.get(`${customerId}:${Number(detail.product_id)}`)!.versionId;
        const matchingLots = lots
            .filter((lot) => {
                if (Number(lot.product_id) !== Number(detail.product_id)) return false;
                const hasJobOrderLineage = ["manufacturing", "yield_ledger"].includes(lot.source_type || "") && lot.source_reference;
                const stockVersion = hasJobOrderLineage
                    ? (jobVersionMap.get(lot.source_reference!) || activeVersionMap.get(Number(lot.product_id)))
                    : activeVersionMap.get(Number(lot.product_id));
                return stockVersion === targetVersion && (availableByLot.get(lot.id) || 0) > 0;
            })
            .sort((a, b) => {
                const expiryCompare = (a.expiry_date || "9999-12-31").localeCompare(b.expiry_date || "9999-12-31");
                if (expiryCompare !== 0) return expiryCompare;
                const createdCompare = (a.created_on || "9999-12-31").localeCompare(b.created_on || "9999-12-31");
                return createdCompare !== 0 ? createdCompare : a.id - b.id;
            });

        for (const lot of matchingLots) {
            if (remaining <= 0) break;
            const available = availableByLot.get(lot.id) || 0;
            const quantity = Math.min(remaining, available);
            if (quantity <= 0) continue;
            pendingRows.push({
                sales_invoice_detail_id: detail.detail_id,
                inventory_lot_id: lot.id,
                quantity,
                status: "Pending",
                created_by: userId,
                created_at: now,
                updated_by: userId,
                updated_at: now,
            });
            availableByLot.set(lot.id, available - quantity);
            remaining -= quantity;
        }
    }

    const createdReservationIds: number[] = [];
    if (pendingRows.length > 0) {
        const createdJson = await directusJson(`${DIRECTUS_URL}/items/sales_invoice_reservation`, {
            method: "POST",
            body: JSON.stringify(pendingRows),
        });
        for (const row of createdJson.data || []) {
            const id = Number(row.id);
            if (id) createdReservationIds.push(id);
        }
        const touchedLotIds = [...new Set(pendingRows.map((row) => Number(row.inventory_lot_id)))];
        try {
            await reconcileInventoryLots(touchedLotIds, userId);
        } catch (error) {
            await releaseReservationIds(createdReservationIds, userId);
            throw error;
        }
    }

    return { created: createdReservationIds.length, createdReservationIds };
}

export async function releaseReservationIds(reservationIds: number[], userId: number): Promise<boolean> {
    if (reservationIds.length === 0) return true;
    const now = new Date().toISOString();
    const results = await Promise.all(reservationIds.map((id) => directusJson(
        `${DIRECTUS_URL}/items/sales_invoice_reservation/${id}`,
        {
            method: "PATCH",
            body: JSON.stringify({ status: "Released", updated_by: userId, updated_at: now }),
        }
    ).catch(() => null)));
    return results.every(Boolean);
}

export async function allocateInvoicesForConsolidation(invoiceIds: number[], userId: number) {
    const createdReservationIds: number[] = [];

    try {
        for (const invoiceId of invoiceIds) {
            const result = await allocateInvoice(invoiceId, userId);
            createdReservationIds.push(...result.createdReservationIds);
        }

        const detailsJson = await directusJson(
            `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_in]=${invoiceIds.join(",")}&fields=detail_id,invoice_no,product_id,quantity&limit=-1`
        );
        const details: DetailRow[] = detailsJson.data || [];
        if (details.length === 0) throw new Error("Selected invoices have no product details");

        const detailIds = details.map((detail) => detail.detail_id);
        const reservationFilter = encodeURIComponent(JSON.stringify({
            _and: [
                { sales_invoice_detail_id: { _in: detailIds } },
                { status: { _eq: "Reserved" } },
            ],
        }));
        const reservationJson = await directusJson(
            `${DIRECTUS_URL}/items/sales_invoice_reservation?filter=${reservationFilter}&fields=sales_invoice_detail_id,quantity&limit=-1`
        );
        const reservedByDetail = new Map<number, number>();
        for (const row of (reservationJson.data || []) as ReservationRow[]) {
            const id = detailId(row);
            reservedByDetail.set(id, (reservedByDetail.get(id) || 0) + Number(row.quantity || 0));
        }

        const shortages = details.filter((detail) =>
            (reservedByDetail.get(detail.detail_id) || 0) < Number(detail.quantity || 0)
        );
        if (shortages.length > 0) {
            const invoiceList = [...new Set(shortages.map((detail) => detail.invoice_no))].join(", ");
            throw new Error(`Insufficient eligible stock for invoice IDs: ${invoiceList}`);
        }

        return { createdReservationIds };
    } catch (error) {
        await releaseReservationIds(createdReservationIds, userId);
        throw error;
    }
}

export async function previewConsolidationAllocations(branchId: number, invoiceIds: number[]) {
    const invoiceJson = await directusJson(
        `${DIRECTUS_URL}/items/sales_invoice?filter[invoice_id][_in]=${invoiceIds.join(",")}&fields=invoice_id,invoice_date,customer_code,branch_id,transaction_status,isDispatched&limit=-1`
    );
    const invoices: InvoiceRow[] = invoiceJson.data || [];
    if (invoices.length !== invoiceIds.length) throw new Error("One or more selected invoices were not found");
    if (invoices.some((invoice) => Number(invoice.branch_id) !== branchId)) {
        throw new Error("Selected invoices must belong to the selected branch");
    }
    if (invoices.some((invoice) => invoice.transaction_status !== "Prepared" || invoice.isDispatched === true)) {
        throw new Error("Only prepared, undispatched invoices can be previewed");
    }

    const detailsJson = await directusJson(
        `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_in]=${invoiceIds.join(",")}&fields=detail_id,invoice_no,product_id,quantity&limit=-1`
    );
    const details: DetailRow[] = detailsJson.data || [];
    if (details.length === 0) throw new Error("Selected invoices have no product details");

    const customerCodes = [...new Set(invoices.map((invoice) => invoice.customer_code).filter(Boolean))];
    const customerFilter = encodeURIComponent(JSON.stringify({ customer_code: { _in: customerCodes } }));
    const customerJson = await directusJson(
        `${DIRECTUS_URL}/items/customer?filter=${customerFilter}&fields=id,customer_code&limit=-1`
    );
    const customerByCode = new Map<string, number>();
    for (const customer of customerJson.data || []) {
        customerByCode.set(String(customer.customer_code), Number(customer.id));
    }

    const invoiceById = new Map(invoices.map((invoice) => [Number(invoice.invoice_id), invoice]));
    const versionPairs = details.map((detail) => {
        const invoice = invoiceById.get(Number(detail.invoice_no));
        return {
            customerId: customerByCode.get(invoice?.customer_code || "") || 0,
            productId: Number(detail.product_id),
        };
    });
    if (versionPairs.some((pair) => !pair.customerId)) {
        throw new Error("An invoice customer cannot be resolved for BOM version allocation");
    }
    const demandVersionMap = await resolveVersions(versionPairs);

    const productIds = [...new Set(details.map((detail) => Number(detail.product_id)))];
    const lotFilter = encodeURIComponent(JSON.stringify({
        _and: [
            { product_id: { _in: productIds } },
            { branch_id: { _eq: branchId } },
            { qa_status: { _eq: "Passed" } },
            { quantity: { _gt: 0 } },
            { source_type: { _in: ["manufacturing", "yield_ledger"] } },
        ],
    }));
    const lotsJson = await directusJson(
        `${DIRECTUS_URL}/items/inventory_lots?filter=${lotFilter}&fields=id,product_id,branch_id,lot_id.lot_id,lot_id.lot_name,lot_number,batch_no,expiry_date,created_on,quantity,qa_status,source_type,source_reference&limit=-1`
    );
    const lots: InventoryLotRow[] = lotsJson.data || [];

    const jobOrderNumbers = [...new Set(lots.map((lot) => lot.source_reference).filter(Boolean))] as string[];
    const jobVersionMap = new Map<string, number>();
    if (jobOrderNumbers.length > 0) {
        const jobFilter = encodeURIComponent(JSON.stringify({ job_order_no: { _in: jobOrderNumbers } }));
        const jobJson = await directusJson(
            `${DIRECTUS_URL}/items/manufacturing_job_orders?filter=${jobFilter}&fields=job_order_no,version_id&limit=-1`
        );
        for (const jobOrder of jobJson.data || []) {
            jobVersionMap.set(String(jobOrder.job_order_no), Number(jobOrder.version_id));
        }
    }

    const activeFilter = encodeURIComponent(JSON.stringify({
        _and: [
            { product_id: { _in: productIds } },
            { status: { _eq: "Active" } },
        ],
    }));
    const activeJson = await directusJson(
        `${DIRECTUS_URL}/items/product_manufacturing_version?filter=${activeFilter}&fields=product_id,version_id&limit=-1`
    );
    const activeVersionMap = new Map<number, number>();
    for (const version of activeJson.data || []) {
        const productId = Number(version.product_id);
        if (!activeVersionMap.has(productId)) activeVersionMap.set(productId, Number(version.version_id));
    }

    const detailIds = details.map((detail) => detail.detail_id);
    const lotIds = lots.map((lot) => lot.id);
    const reservations: ReservationRow[] = lotIds.length > 0
        ? (await directusJson(
            `${DIRECTUS_URL}/items/sales_invoice_reservation?filter[inventory_lot_id][_in]=${lotIds.join(",")}&filter[status][_eq]=Reserved&fields=id,sales_invoice_detail_id,inventory_lot_id,quantity,status&limit=-1`
        )).data || []
        : [];
    const reservedByLot = new Map<number, number>();
    const selectedReservationsByDetail = new Map<number, ReservationRow[]>();
    const selectedDetailIds = new Set(detailIds);
    for (const reservation of reservations) {
        const lotId = inventoryLotId(reservation);
        const detId = detailId(reservation);
        reservedByLot.set(lotId, (reservedByLot.get(lotId) || 0) + Number(reservation.quantity || 0));
        if (selectedDetailIds.has(detId)) {
            const rows = selectedReservationsByDetail.get(detId) || [];
            rows.push(reservation);
            selectedReservationsByDetail.set(detId, rows);
        }
    }

    const productJson = await directusJson(
        `${DIRECTUS_URL}/items/products?filter[product_id][_in]=${productIds.join(",")}&fields=product_id,product_name,product_code&limit=-1`
    );
    const productMap = new Map<number, { product_name: string; product_code: string }>();
    for (const product of productJson.data || []) productMap.set(Number(product.product_id), product);

    const lotById = new Map(lots.map((lot) => [lot.id, lot]));
    const availableByLot = new Map(lots.map((lot) => [
        lot.id,
        Math.max(0, Number(lot.quantity || 0) - (reservedByLot.get(lot.id) || 0)),
    ]));
    const allocationMap = new Map<string, {
        productId: number;
        productName: string;
        productCode: string;
        inventoryLotId: number;
        lotId: number;
        lotName: string;
        batchNo: string;
        expiryDate: string | null;
        quantity: number;
    }>();
    const addAllocation = (productId: number, lot: InventoryLotRow, quantity: number) => {
        const physicalLotId = numericId(lot.lot_id, ["lot_id"]) || 0;
        const physicalLot = typeof lot.lot_id === "object" ? lot.lot_id : null;
        const product = productMap.get(productId);
        const key = `${productId}:${lot.id}`;
        const existing = allocationMap.get(key);
        if (existing) {
            existing.quantity += quantity;
        } else {
            allocationMap.set(key, {
                productId,
                productName: product?.product_name || `Product #${productId}`,
                productCode: product?.product_code || "",
                inventoryLotId: lot.id,
                lotId: physicalLotId,
                lotName: physicalLot?.lot_name || `Lot #${physicalLotId}`,
                batchNo: lot.batch_no || lot.lot_number || "LOT-N/A",
                expiryDate: lot.expiry_date || null,
                quantity,
            });
        }
    };

    const shortages = new Map<number, number>();
    const sortedInvoices = [...invoices].sort((a, b) =>
        (a.invoice_date || "9999-12-31").localeCompare(b.invoice_date || "9999-12-31")
        || a.invoice_id - b.invoice_id
    );
    for (const invoice of sortedInvoices) {
        const customerId = customerByCode.get(invoice.customer_code) || 0;
        for (const detail of details.filter((row) => Number(row.invoice_no) === Number(invoice.invoice_id))) {
            const productId = Number(detail.product_id);
            const existingRows = selectedReservationsByDetail.get(detail.detail_id) || [];
            let remaining = Number(detail.quantity || 0);
            for (const reservation of existingRows) {
                const lot = lotById.get(inventoryLotId(reservation));
                const quantity = Math.min(remaining, Number(reservation.quantity || 0));
                if (lot && quantity > 0) addAllocation(productId, lot, quantity);
                remaining -= quantity;
            }

            const targetVersion = demandVersionMap.get(`${customerId}:${productId}`)?.versionId;
            if (!targetVersion) {
                shortages.set(productId, (shortages.get(productId) || 0) + Math.max(0, remaining));
                continue;
            }
            const matchingLots = lots
                .filter((lot) => {
                    if (Number(lot.product_id) !== productId) return false;
                    const hasJobOrderLineage = ["manufacturing", "yield_ledger"].includes(lot.source_type || "") && lot.source_reference;
                    const stockVersion = hasJobOrderLineage
                        ? (jobVersionMap.get(lot.source_reference!) || activeVersionMap.get(productId))
                        : activeVersionMap.get(productId);
                    return stockVersion === targetVersion && (availableByLot.get(lot.id) || 0) > 0;
                })
                .sort((a, b) =>
                    (a.expiry_date || "9999-12-31").localeCompare(b.expiry_date || "9999-12-31")
                    || (a.created_on || "9999-12-31").localeCompare(b.created_on || "9999-12-31")
                    || a.id - b.id
                );
            for (const lot of matchingLots) {
                if (remaining <= 0) break;
                const available = availableByLot.get(lot.id) || 0;
                const quantity = Math.min(remaining, available);
                if (quantity <= 0) continue;
                addAllocation(productId, lot, quantity);
                availableByLot.set(lot.id, available - quantity);
                remaining -= quantity;
            }
            if (remaining > 0) shortages.set(productId, (shortages.get(productId) || 0) + remaining);
        }
    }

    return {
        allocations: [...allocationMap.values()].sort((a, b) =>
            a.productName.localeCompare(b.productName)
            || (a.expiryDate || "9999-12-31").localeCompare(b.expiryDate || "9999-12-31")
            || a.inventoryLotId - b.inventoryLotId
        ),
        shortages: [...shortages.entries()].map(([productId, quantity]) => ({
            productId,
            productName: productMap.get(productId)?.product_name || `Product #${productId}`,
            quantity,
        })),
    };
}

export async function releaseInvoiceReservations(invoiceId: number, userId: number) {
    const linkedJson = await directusJson(
        `${DIRECTUS_URL}/items/consolidator_invoices?filter[invoice_id][_eq]=${invoiceId}&filter[consolidator_id][consolidator_no][_starts_with]=CLINV-&filter[consolidator_id][is_delete][_eq]=0&fields=id&limit=1`
    );
    if ((linkedJson.data || []).length > 0) {
        throw new Error("Reservations cannot be released after the invoice enters consolidation");
    }

    const detailsJson = await directusJson(
        `${DIRECTUS_URL}/items/sales_invoice_details?filter[invoice_no][_eq]=${invoiceId}&fields=detail_id&limit=-1`
    );
    const detailIds: number[] = (detailsJson.data || []).map((detail: { detail_id: number }) => Number(detail.detail_id));
    if (detailIds.length === 0) return { released: 0 };

    const filter = encodeURIComponent(JSON.stringify({
        _and: [
            { sales_invoice_detail_id: { _in: detailIds } },
            { status: { _in: ["Pending", "Reserved"] } },
        ],
    }));
    const reservationJson = await directusJson(
        `${DIRECTUS_URL}/items/sales_invoice_reservation?filter=${filter}&fields=id&limit=-1`
    );
    const rows: { id: number }[] = reservationJson.data || [];
    const now = new Date().toISOString();
    await Promise.all(rows.map((row) => directusJson(`${DIRECTUS_URL}/items/sales_invoice_reservation/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Released", updated_by: userId, updated_at: now }),
    })));
    return { released: rows.length };
}
