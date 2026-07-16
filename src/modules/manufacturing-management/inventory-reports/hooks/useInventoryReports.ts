import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
    MovementFilters,
    ProductLookup,
    BranchLookup,
    LotLookup,
    ProductReportNode,
    BatchReportEntry
} from "../types";
import {
    fetchInventoryData,
    fetchLotsList,
    RawProduct,
    RawBranch,
    RawBatch
} from "../services/inventory-reports-api";

export function useInventoryReports() {
    const [activeProductType, setActiveProductType] = useState<number>(388); // Default: 388 (Finished Goods)
    const [filters, setFilters] = useState<MovementFilters>({
        productId: null,
        branchId: null,
        lotId: null,
        batchNo: "",
        startDate: "",
        endDate: ""
    });

    // Reset product SKU filter if active product type changes
    useEffect(() => {
        setFilters((prev) => ({
            ...prev,
            productId: null
        }));
    }, [activeProductType]);

    const [searchQuery, setSearchQuery] = useState("");
    const [batches, setBatches] = useState<RawBatch[]>([]);
    const [loading, setLoading] = useState(false);

    // Lookup states
    const [products, setProducts] = useState<ProductLookup[]>([]);
    const [branches, setBranches] = useState<BranchLookup[]>([]);
    const [lotsList, setLotsList] = useState<LotLookup[]>([]);

    // Raw products state from BFF (includes UOM shortcut details)
    const [rawProducts, setRawProducts] = useState<RawProduct[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [lotsData, invData] = await Promise.all([
                fetchLotsList().catch(() => []),
                fetchInventoryData().catch(() => ({ products: [], batches: [], branches: [] }))
            ]);

            setLotsList(lotsData);
            setRawProducts(invData.products || []);
            setBatches(invData.batches || []);

            // Map products for dropdown lookup options
            const mappedProducts: ProductLookup[] = (invData.products || []).map((p: RawProduct) => {
                const typeVal = p.product_type;
                const productTypeId = typeVal && typeof typeVal === "object"
                    ? Number(typeVal.id)
                    : (typeVal !== undefined && typeVal !== null ? Number(typeVal) : undefined);
                return {
                    productId: p.product_id,
                    productName: p.product_name,
                    productCode: p.product_code,
                    productType: productTypeId
                };
            });
            setProducts(mappedProducts);

            // Map branches for dropdown lookup options
            const mappedBranches: BranchLookup[] = (invData.branches || []).map((b: RawBranch) => ({
                branchId: b.id,
                branchName: b.branch_name
            }));
            setBranches(mappedBranches);
        } catch (e) {
            console.error("Failed to load inventory reports data:", e);
            toast.error("Failed to load inventory data");
        } finally {
            setLoading(false);
        }
    }, []);

    // Connect to Server-Sent Events (SSE) stream for real-time inventory updates
    useEffect(() => {
        const eventSource = new EventSource("/api/manufacturing/inventory/movements/stream");

        eventSource.addEventListener("movement", () => {
            // Trigger a silent reload of inventory lots when a movement occurs in the background
            loadData();
        });

        eventSource.addEventListener("error", (err) => {
            console.error("[SSE] EventSource error, auto-reconnecting...", err);
        });

        return () => {
            eventSource.close();
        };
    }, [loadData]);

    // Initial load
    useEffect(() => {
        loadData();
    }, [loadData]);

    const setSingleFilter = (key: keyof MovementFilters, value: unknown) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value
        }));
    };

    // Client-side Grouping and Hierarchical Tree aggregation (Product -> Lots breakdown)
    const groupedData = useMemo<ProductReportNode[]>(() => {
        if (rawProducts.length === 0 && batches.length === 0) return [];

        // Build lookup maps for performance
        const branchMap = new Map<number, string>();
        branches.forEach((b) => branchMap.set(b.branchId, b.branchName));

        const lotMap = new Map<number, LotLookup>();
        lotsList.forEach((l) => lotMap.set(l.lotId, l));

        const productUOMMap = new Map<number, string>();
        rawProducts.forEach((p) => {
            const uom = p.unit_of_measurement?.unit_shortcut || "units";
            productUOMMap.set(p.product_id, uom);
        });

        // 1. Filter batches (inventory lot assignments) based on top filters
        const filteredBatches = batches.filter((b) => {
            // Branch filter (null means All Branches)
            if (filters.branchId !== null && b.branch_id !== filters.branchId) {
                return false;
            }

            // Location Lot filter (null means All Locations)
            if (filters.lotId !== null && b.lot_id !== filters.lotId) {
                return false;
            }

            // Product filter (null means All Products)
            if (filters.productId !== null && b.product_id !== filters.productId) {
                return false;
            }

            // Product type filter (Finished Goods, Raw Materials, Packaging Items)
            const matchedProduct = rawProducts.find((p) => p.product_id === b.product_id);
            if (!matchedProduct) return false;

            const typeVal = matchedProduct.product_type;
            const productTypeId = typeVal && typeof typeVal === "object"
                ? Number(typeVal.id)
                : (typeVal !== undefined && typeVal !== null ? Number(typeVal) : null);

            if (productTypeId !== activeProductType) {
                return false;
            }

            // Manufacturing Date filter (exact match against created_on date portion)
            if (filters.startDate) {
                const createdDate = b.created_on ? b.created_on.split("T")[0] : null;
                if (createdDate !== filters.startDate) {
                    return false;
                }
            }

            // Expiry Date filter (exact match against expiration_date date portion)
            if (filters.endDate) {
                const expiryDate = b.expiration_date ? b.expiration_date.split("T")[0] : null;
                if (expiryDate !== filters.endDate) {
                    return false;
                }
            }

            // Search query filter (matches product code/name, lot name, or batch number)
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase();
                const matchedProduct = rawProducts.find((p) => p.product_id === b.product_id);
                const prodName = matchedProduct?.product_name?.toLowerCase() || "";
                const prodCode = matchedProduct?.product_code?.toLowerCase() || "";
                const lotName = b.lot_name?.toLowerCase() || "";
                const batchNo = b.batch_no?.toLowerCase() || b.lot_number?.toLowerCase() || "";

                if (
                    !prodName.includes(query) &&
                    !prodCode.includes(query) &&
                    !lotName.includes(query) &&
                    !batchNo.includes(query)
                ) {
                    return false;
                }
            }

            return true;
        });

        // 2. Group filtered batches by Product ID
        const productNodesMap = new Map<number, ProductReportNode>();

        filteredBatches.forEach((b) => {
            let node = productNodesMap.get(b.product_id);
            if (!node) {
                const matchedProduct = rawProducts.find((p) => p.product_id === b.product_id);
                node = {
                    productId: b.product_id,
                    productName: matchedProduct?.product_name || `Product #${b.product_id}`,
                    productCode: matchedProduct?.product_code || `SKU-${b.product_id}`,
                    uomShortcut: productUOMMap.get(b.product_id) || "units",
                    totalAvailable: 0,
                    lots: []
                };
                productNodesMap.set(b.product_id, node);
            }

            // Resolve Lot max capacity and space utilization
            const lotId = b.lot_id ? Number(b.lot_id) : null;
            const lotInfo = lotId !== null ? lotMap.get(lotId) : null;
            const maxCapacity = lotInfo?.maxBatchCapacity || 10;
            const quantity = Number(b.quantity_received || 0);

            // Look up branch name
            const branchName = branchMap.get(b.branch_id) || `Branch #${b.branch_id}`;

            const lotEntry: BatchReportEntry = {
                lineId: b.line_id,
                productId: b.product_id,
                branchId: b.branch_id,
                branchName,
                lotId,
                lotName: b.lot_name || "Unassigned",
                maxBatchCapacity: maxCapacity,
                sourceDocumentNo: b.source_reference || "N/A",
                transactionType: b.transaction_type || (b.source_type ? String(b.source_type).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Legacy Stock"),
                batchNo: b.batch_no || b.lot_number || "LOT-N/A",
                quantity,
                unitCost: Number(b.final_landed_unit_cost || b.base_unit_cost_php || 0),
                qaStatus: b.qa_status || "Passed",
                remarks: b.remarks || b.rejection_reason || null,
                expiryDate: b.expiration_date || null,
                createdOn: b.created_on || null
            };

            node.lots.push(lotEntry);
        });

        // 3. Finalize total available quantities per product and sort
        const result: ProductReportNode[] = [];
        productNodesMap.forEach((node) => {
            // Compute Level 1 Total Stock
            node.totalAvailable = node.lots.reduce((acc, lot) => acc + lot.quantity, 0);

            // Sort nested lots: Branch name ➔ Lot name ➔ Batch number
            node.lots.sort((a, b) => {
                const branchCompare = a.branchName.localeCompare(b.branchName);
                if (branchCompare !== 0) return branchCompare;
                const lotCompare = a.lotName.localeCompare(b.lotName);
                if (lotCompare !== 0) return lotCompare;
                return a.batchNo.localeCompare(b.batchNo);
            });

            // Filter out products with no active lots (matches the "Search method" requirement)
            if (node.lots.length > 0) {
                result.push(node);
            }
        });

        // Sort products alphabetically by product name
        return result.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [batches, rawProducts, branches, lotsList, filters, searchQuery, activeProductType]);

    return {
        filters,
        searchQuery,
        setSearchQuery,
        batches,
        loading,
        products,
        branches,
        lotsList,
        loadMovements: loadData,
        loadLookups: () => Promise.resolve(),
        setSingleFilter,
        groupedData,
        rawProducts,
        activeProductType,
        setActiveProductType
    };
}
