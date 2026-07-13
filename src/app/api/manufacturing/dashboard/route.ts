/* eslint-disable */
import { NextResponse } from "next/server";
import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

interface LedgerEntry {
    productId?: string | number;
    quantity?: string | number;
    documentDate?: string;
    created_date?: string;
    documentType?: string;
    documentDescription?: string;
}

interface Product {
    product_id: number;
    product_name?: string;
    product_code?: string;
    cost_per_unit?: string | number;
    price_per_unit?: string | number;
    product_category?: {
        category_name?: string;
    } | null;
    unit_of_measurement?: {
        unit_name?: string;
        unit_shortcut?: string;
    } | null;
}

interface QaLog {
    recorded_at: string;
    deviation_quantity?: string | number;
    task_id?: string | number;
}

interface Task {
    id: number;
    jo_id: number;
    status?: string;
}

interface JoProduct {
    jo_id: number;
    product_id: number;
    product_name?: string;
    quantity?: string | number;
    routings?: Array<{ id: number; name?: string }> | null;
}

interface DailyBreakdownDay {
    status?: string;
    completed_steps?: unknown[] | null;
}

interface JobOrder {
    jo_id: number;
    status: string;
    product_name?: string;
    quantity?: string | number;
    due_date?: string;
    daily_breakdown?: DailyBreakdownDay[] | null;
}

interface Invoice {
    invoice_no?: string;
    invoice_id?: string;
    status?: string;
    invoice_date?: string;
    created_date?: string;
}

interface InvoiceDetail {
    invoice_no: string | number;
    product_id: string | number;
    quantity?: string | number;
    unit_price?: string | number;
    net_amount?: string | number;
}

interface BomComponent {
    bom_id: number;
    component_product_id: number;
    wastage_factor_percentage?: string | number;
    quantity_required?: string | number;
    component_type?: string;
}

interface Bom {
    bom_id: number;
    product_id: number;
    base_quantity?: string | number;
    bom_name?: string;
}

interface DashboardProductItem {
    product_id: number;
    product_name: string;
    product_code: string;
    category: string;
    unit: string;
    unit_shortcut: string;
    cost: number;
    price: number;
    stock: number;
    value: number;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate") || "";
        const endDate = searchParams.get("endDate") || "";

        const [ledgerRes, productsRes, versionsRes, invoiceRes, invoiceDetailsRes, branchesRes, qaLogsRes, tasksRes, bomsRes, bomCompsRes, joRes] = await Promise.all([
            fetch(`${DIRECTUS_URL}/items/product_ledger?limit=2000`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/products?limit=500&fields=product_id,product_name,product_code,cost_per_unit,price_per_unit,unit_of_measurement.unit_name,unit_of_measurement.unit_shortcut,product_category.category_name`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_product_version?limit=-1&fields=product_id`, { headers, cache: "no-store" }).catch(() => null),
            fetch(`${DIRECTUS_URL}/items/sales_invoice?limit=1000&sort=-invoice_date`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/sales_invoice_details?limit=2000`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/branches?limit=-1`, { headers, cache: "no-store" }),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_qa_records?limit=-1`, { headers, cache: "no-store" }).catch(() => null),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_order_routes?limit=-1&fields=jo_route_id,job_order_id,sequence_order,work_center_id,operation_id,planned_setup_hours,planned_run_hours,actual_setup_hours,actual_run_hours,estimated_labor_cost,actual_labor_cost`, { headers, cache: "no-store" }).catch(() => null),
            fetch(`${DIRECTUS_URL}/items/manufacturing_boms?limit=-1&filter[is_active][_eq]=1`, { headers, cache: "no-store" }).catch(() => null),
            fetch(`${DIRECTUS_URL}/items/manufacturing_bom_components?limit=-1`, { headers, cache: "no-store" }).catch(() => null),
            fetch(`${DIRECTUS_URL}/items/manufacturing_job_orders?limit=-1`, { headers, cache: "no-store" }).catch(() => null)
        ]);

        if (!ledgerRes.ok) throw new Error("Failed to fetch product_ledger");
        if (!productsRes.ok) throw new Error("Failed to fetch products");
        if (!invoiceRes.ok) throw new Error("Failed to fetch sales invoices");
        if (!invoiceDetailsRes.ok) throw new Error("Failed to fetch sales invoice details");
        if (!branchesRes.ok) throw new Error("Failed to fetch branches");

        const ledger: LedgerEntry[] = (await ledgerRes.json()).data || [];
        const products: Product[] = (await productsRes.json()).data || [];
        const qaLogs: any[] = qaLogsRes && qaLogsRes.ok ? (await qaLogsRes.json()).data || [] : [];
        const tasks: any[] = tasksRes && tasksRes.ok ? (await tasksRes.json()).data || [] : [];
        const jobOrders: any[] = joRes && joRes.ok ? (await joRes.json()).data || [] : [];
        
        // Resolve versions for has_versions check
        const versionProductIds = new Set<number>();
        if (versionsRes && versionsRes.ok) {
            const versionsJson = await versionsRes.json();
            const versions = versionsJson.data || [];
            versions.forEach((v: { product_id: number }) => {
                if (v.product_id) versionProductIds.add(Number(v.product_id));
            });
        }

        const invoices: Invoice[] = (await invoiceRes.json()).data || [];
        const invoiceDetails: InvoiceDetail[] = (await invoiceDetailsRes.json()).data || [];
        const branches = (await branchesRes.json()).data || [];

        // 1. Group ledger entries by product for correct inventory levels
        const stockMap: Record<number, number> = {};
        ledger.forEach((entry: LedgerEntry) => {
            const pId = Number(entry.productId);
            const qty = Number(entry.quantity) || 0;
            stockMap[pId] = (stockMap[pId] || 0) + qty;
        });

        // 2. Classify products into Raw Materials vs Finished Goods
        const rawMaterials: DashboardProductItem[] = [];
        const finishedGoods: DashboardProductItem[] = [];

        products.forEach((prod: Product) => {
            const pId = Number(prod.product_id);
            const stock = stockMap[pId] || 0;
            const value = stock * (Number(prod.cost_per_unit) || 0);

            const has_versions = versionProductIds.has(pId);

            const item = {
                product_id: pId,
                product_name: prod.product_name || "Unnamed Product",
                product_code: prod.product_code || `SKU-${pId}`,
                category: prod.product_category?.category_name || "Unassigned",
                unit: prod.unit_of_measurement?.unit_name || "Units",
                unit_shortcut: prod.unit_of_measurement?.unit_shortcut || "PCS",
                cost: Number(prod.cost_per_unit) || 0,
                price: Number(prod.price_per_unit) || 0,
                stock,
                value
            };

            const isFG = has_versions === true || 
                         prod.product_category?.category_name?.toLowerCase().includes("finished") || 
                         prod.product_category?.category_name?.toLowerCase() === "fg";

            if (isFG) {
                finishedGoods.push(item);
            } else {
                rawMaterials.push(item);
            }
        });

        // Helper to check if a date falls within selected range
        const isWithinRange = (dateStr: string) => {
            if (!dateStr) return false;
            const date = new Date(dateStr.split("T")[0]);
            if (startDate) {
                const start = new Date(startDate);
                if (date < start) return false;
            }
            if (endDate) {
                const end = new Date(endDate);
                if (date > end) return false;
            }
            return true;
        };

        // 3. Aggregate wastage for time period from ledger adjustments
        let totalWastageQty = 0;
        let totalWastageVal = 0;
        const wastageItems: Record<number, { name: string; code: string; qty: number; value: number; reason: string }> = {};

        // A. Aggregate Raw Material / Stock Scrap from ledger adjustments
        ledger.forEach((entry: LedgerEntry) => {
            const dateStr = entry.documentDate || entry.created_date;
            if (!dateStr || !isWithinRange(dateStr)) return;

            const qty = Number(entry.quantity) || 0;
            const type = entry.documentType || "";
            const isWaste = qty < 0 && (
                type.toLowerCase().includes("scrap") || 
                type.toLowerCase().includes("loss") || 
                type.toLowerCase().includes("damage") || 
                type.toLowerCase().includes("waste") ||
                entry.documentDescription?.toLowerCase().includes("damage") ||
                entry.documentDescription?.toLowerCase().includes("scrap")
            );

            // Exclude Quality Scrap Deduction to avoid double counting legacy entries
            if (isWaste && type !== "Quality Scrap Deduction") {
                const absQty = Math.abs(qty);
                const prod = products.find((p: Product) => Number(p.product_id) === Number(entry.productId));
                const cost = prod ? (Number(prod.cost_per_unit) || 0) : 0;
                const value = absQty * cost;

                totalWastageQty += absQty;
                totalWastageVal += value;

                const pId = Number(entry.productId);
                if (!wastageItems[pId]) {
                    wastageItems[pId] = {
                        name: prod?.product_name || `Product #${pId}`,
                        code: prod?.product_code || `SKU-${pId}`,
                        qty: 0,
                        value: 0,
                        reason: type || "Scrap/Loss"
                    };
                }
                wastageItems[pId].qty += absQty;
                wastageItems[pId].value += value;
            }
        });

        // B. Aggregate Production Yield Wastage from Completed Job Orders
        jobOrders.forEach((jo: any) => {
            if (jo.status !== "Completed") return;
            const dateStr = jo.end_date || jo.created_on;
            if (!dateStr || !isWithinRange(dateStr)) return;

            const planned = Number(jo.target_quantity || 0);
            const actual = Number(jo.actual_quantity_produced || 0);
            const deviation = planned - actual;

            if (deviation > 0) {
                const pId = Number(jo.product_id);
                const prod = products.find((p: Product) => Number(p.product_id) === pId);
                const cost = prod ? (Number(prod.cost_per_unit) || 0) : 0;
                const value = deviation * cost;

                totalWastageQty += deviation;
                totalWastageVal += value;

                if (!wastageItems[pId]) {
                    wastageItems[pId] = {
                        name: prod?.product_name || `Product #${pId}`,
                        code: prod?.product_code || `SKU-${pId}`,
                        qty: 0,
                        value: 0,
                        reason: "Production Yield Shortfall"
                    };
                }
                wastageItems[pId].qty += deviation;
                wastageItems[pId].value += value;
            }
        });

        // 4. Aggregate Production for time period directly from product ledger
        let totalProducedQty = 0;
        let totalProducedVal = 0;
        const producedItems: Record<number, { name: string; code: string; qty: number; value: number }> = {};

        ledger.forEach((entry: LedgerEntry) => {
            if (entry.documentType !== "QA Receive" || Number(entry.quantity) <= 0) return;
            const dateStr = entry.documentDate || entry.created_date;
            if (!dateStr || !isWithinRange(dateStr)) return;

            const qty = Number(entry.quantity) || 0;
            const prod = products.find((p: Product) => Number(p.product_id) === Number(entry.productId));
            const cost = prod ? (Number(prod.cost_per_unit) || 0) : 0;
            const value = qty * cost;

            totalProducedQty += qty;
            totalProducedVal += value;

            const pId = Number(entry.productId);
            if (!producedItems[pId]) {
                producedItems[pId] = {
                    name: prod?.product_name || `Product #${pId}`,
                    code: prod?.product_code || `SKU-${pId}`,
                    qty: 0,
                    value: 0
                };
            }
            producedItems[pId].qty += qty;
            producedItems[pId].value += value;
        });

        // 5. Aggregate Sellout Reports for time period
        let totalSalesQty = 0;
        let totalSalesRevenue = 0;
        const salesItems: Record<number, { name: string; code: string; qty: number; revenue: number }> = {};

        invoices.forEach((inv: Invoice) => {
            if (inv.status?.toLowerCase() === "cancelled") return;
            const dateStr = inv.invoice_date || inv.created_date;
            if (!dateStr || !isWithinRange(dateStr)) return;

            const invNo = inv.invoice_no || inv.invoice_id;
            const details = invoiceDetails.filter((d: InvoiceDetail) => String(d.invoice_no) === String(invNo));

            details.forEach((d: InvoiceDetail) => {
                const qty = Number(d.quantity) || 0;
                const price = Number(d.unit_price) || 0;
                const net = Number(d.net_amount) || (qty * price);

                totalSalesQty += qty;
                totalSalesRevenue += net;

                const pId = Number(d.product_id);
                if (!salesItems[pId]) {
                    const prod = products.find((p: Product) => Number(p.product_id) === pId);
                    salesItems[pId] = {
                        name: prod?.product_name || `Product #${pId}`,
                        code: prod?.product_code || `SKU-${pId}`,
                        qty: 0,
                        revenue: 0
                    };
                }
                salesItems[pId].qty += qty;
                salesItems[pId].revenue += net;
            });
        });

        // 6. Calculate Maximum Producible finished goods based on current Raw Material Inventory
        const bomsRaw: Bom[] = bomsRes && bomsRes.ok ? (await bomsRes.json()).data || [] : [];
        const bomComponents: BomComponent[] = bomCompsRes && bomCompsRes.ok ? (await bomCompsRes.json()).data || [] : [];

        // Deduplicate BOMs: keep only the latest active BOM per unique product_id
        const uniqueBomsMap: Record<number, Bom> = {};
        bomsRaw.forEach((bom: Bom) => {
            if (bom && bom.product_id) {
                const pId = Number(bom.product_id);
                if (!uniqueBomsMap[pId] || (bom.bom_id && uniqueBomsMap[pId].bom_id && bom.bom_id > uniqueBomsMap[pId].bom_id)) {
                    uniqueBomsMap[pId] = bom;
                }
            }
        });
        const boms = Object.values(uniqueBomsMap);

        const producibleGoods = boms.map((bom: Bom) => {
            const fgProduct = products.find((p: Product) => p.product_id === bom.product_id);
            if (!fgProduct) return null;

            const comps = bomComponents.filter((bc: BomComponent) => bc.bom_id === bom.bom_id);
            if (comps.length === 0) return null;

            let minProducible = Infinity;
            const componentsDetails = comps.map((comp: BomComponent) => {
                const compProduct = products.find((p: Product) => p.product_id === comp.component_product_id);
                const name = compProduct ? compProduct.product_name : `Component ID: ${comp.component_product_id}`;
                const code = compProduct ? compProduct.product_code : `ID-${comp.component_product_id}`;
                const unit = compProduct?.unit_of_measurement?.unit_shortcut || "pcs";
                
                const available = stockMap[Number(comp.component_product_id)] || 0;
                const wastageFactor = 1 - (Number(comp.wastage_factor_percentage || 0) / 100);
                const quantityRequiredPerRun = Number(comp.quantity_required) / (wastageFactor > 0 ? wastageFactor : 1);
                
                const baseQty = Number(bom.base_quantity) || 1;
                const quantityRequiredPerUnit = quantityRequiredPerRun / baseQty;

                let maxWithThis = 0;
                if (quantityRequiredPerUnit > 0) {
                    maxWithThis = Math.floor(available / quantityRequiredPerUnit);
                }

                if (comp.component_type !== "by_product") {
                    if (maxWithThis < minProducible) {
                        minProducible = maxWithThis;
                    }
                }

                return {
                    product_id: Number(comp.component_product_id),
                    component_name: name,
                    component_code: code,
                    unit,
                    required_per_unit: quantityRequiredPerUnit,
                    available,
                    max_producible_with_this: maxWithThis
                };
            });

            const finalProducible = minProducible === Infinity ? 0 : minProducible;

            return {
                product_id: bom.product_id,
                product_name: fgProduct.product_name,
                product_code: fgProduct.product_code || `FG-${bom.product_id}`,
                category: fgProduct.product_category?.category_name || "FG",
                bom_name: bom.bom_name || `BOM v${bom.bom_id}`,
                base_quantity: Number(bom.base_quantity) || 1,
                max_producible: finalProducible,
                components: componentsDetails
            };
        }).filter(Boolean);

        // Calculate ongoing production runs progress breakdown
        // Calculate ongoing production runs progress breakdown
        const ongoingRuns = jobOrders.filter((jo: any) => ["In Progress", "Released", "On Hold"].includes(jo.status));
        const ongoingBreakdown = ongoingRuns.map((jo: any) => {
            const mainProduct = (products.find((p: Product) => Number(p.product_id) === Number(jo.product_id)) || {}) as any;
            const productName = mainProduct.product_name || "Unknown Product";
            const targetQty = Number(jo.target_quantity || 0);

            // Fetch tasks/routing steps for this job order
            const joTasks = tasks.filter((t: any) => Number(t.job_order_id) === Number(jo.job_order_id));
            const totalTasks = joTasks.length;
            const completedTasks = joTasks.filter((t: any) => t.status === "Completed" || t.status === "Skipped").length;

            const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
            const progressText = `${completedTasks} of ${totalTasks} operations completed`;

            return {
                jo_id: jo.job_order_no,
                status: jo.status,
                product_name: productName,
                quantity: targetQty,
                percentage: Number(percentage.toFixed(1)),
                progress_text: progressText,
                due_date: jo.end_date
            };
        });

        const totalPercentage = ongoingBreakdown.length > 0
            ? ongoingBreakdown.reduce((sum: number, run) => sum + run.percentage, 0) / ongoingBreakdown.length
            : 0;

        return NextResponse.json({
            ongoingProduction: {
                overallPercentage: Number(totalPercentage.toFixed(1)),
                runs: ongoingBreakdown
            },
            wastage: {
                totalQuantity: totalWastageQty,
                totalValue: totalWastageVal,
                items: Object.values(wastageItems)
            },
            production: {
                totalQuantity: totalProducedQty,
                totalValue: totalProducedVal,
                items: Object.values(producedItems)
            },
            inventory: {
                rawMaterials: {
                    totalSKUs: rawMaterials.length,
                    totalStock: rawMaterials.reduce((sum, item) => sum + item.stock, 0),
                    totalValue: rawMaterials.reduce((sum, item) => sum + item.value, 0),
                    items: rawMaterials.sort((a, b) => b.value - a.value).slice(0, 50)
                },
                finishedGoods: {
                    totalSKUs: finishedGoods.length,
                    totalStock: finishedGoods.reduce((sum, item) => sum + item.stock, 0),
                    totalValue: finishedGoods.reduce((sum, item) => sum + item.value, 0),
                    items: finishedGoods.sort((a, b) => b.value - a.value).slice(0, 50)
                }
            },
            sellout: {
                totalQuantity: totalSalesQty,
                totalRevenue: totalSalesRevenue,
                items: Object.values(salesItems).sort((a, b) => b.revenue - a.revenue).slice(0, 50)
            },
            producibleGoods,
            branches
        });
    } catch (e) {
        console.error("[Dashboard BFF GET] Error:", e);
        return NextResponse.json({ error: (e as { message?: string }).message || "Failed to compile dashboard reports" }, { status: 500 });
    }
}


