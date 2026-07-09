import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { SalesOrder, SalesOrderDetail, JobOrder } from "../types";
import { 
    fetchSalesOrders, 
    fetchSalesOrderDetails, 
    explodeBOM, 
    fetchQAStockBatches,
    getJobOrders,
    addJobOrder,
    modifyJobOrder,
    removeJobOrder
} from "../services/planning-api";

export function usePlanningEngineering() {
    const [activeTab, setActiveTab] = useState<"sales-orders" | "job-orders">("sales-orders");
    
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [soDetailsMap, setSoDetailsMap] = useState<Record<number, SalesOrderDetail[]>>({});
    const [loadingSO, setLoadingSO] = useState(true);
    const [loadingJOs, setLoadingJOs] = useState(true);

    // Pagination & Search & Hoisted Batch Selection States
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const selectedIdsRef = useRef(selectedIds);
    useEffect(() => {
        selectedIdsRef.current = selectedIds;
    }, [selectedIds]);

    const [selectedSO, setSelectedSO] = useState<SalesOrder | null>(null);
    const [soDetails, setSoDetails] = useState<SalesOrderDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Consolidated Batch Candidate State
    const [selectedBatchCandidate, setSelectedBatchCandidate] = useState<{
        productId: number;
        productName: string;
        totalQty: number;
        orders: { order_no: string; quantity: number; order_id: number }[];
    } | null>(null);

    // Job Orders list (now fetched from Directus)
    const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
    const [checkingInventoryId, setCheckingInventoryId] = useState<string | null>(null);
    const [procurementLoadingId, setProcurementLoadingId] = useState<string | null>(null);

    // Form inputs for scheduling a JO
    const [selectedDetailId, setSelectedDetailId] = useState<string>("");
    const [joNumber, setJoNumber] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [joQty, setJoQty] = useState(1);
    const [shiftOption, setShiftOption] = useState<string>("8");
    const [selectedBomVersionId, setSelectedBomVersionId] = useState<string>("");
    
    // Branches data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
    const [filterBranchId, setFilterBranchId] = useState<number | "">("");

    // Standalone & Personnel & Products data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [products, setProducts] = useState<any[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [users, setUsers] = useState<any[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [isStandaloneMode, setIsStandaloneMode] = useState(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedStandaloneProduct, setSelectedStandaloneProduct] = useState<any | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [selectedProductsList, setSelectedProductsList] = useState<any[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [productVersions, setProductVersions] = useState<Record<number, any[]>>({});

    const loadVersionsForProduct = async (productId: number) => {
        if (productVersions[productId]) return;
        try {
            const res = await fetch(`/api/manufacturing/finished-goods/versions?productId=${productId}`);
            if (res.ok) {
                const data = await res.json();
                setProductVersions(prev => ({ ...prev, [productId]: data }));
            }
        } catch (e) {
            console.error("Error loading versions for product:", productId, e);
        }
    };

    const loadProducts = async () => {
        try {
            const res = await fetch("/api/manufacturing/finished-goods/products");
            if (res.ok) {
                const data = await res.json();
                setProducts(data);
            }
        } catch (e) {
            console.error("Failed to load products:", e);
        }
    };

    const loadUsers = async () => {
        try {
            const res = await fetch("/api/manufacturing/planning-engineering?action=users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error("Failed to load users:", e);
        }
    };

    const loadSuppliers = async () => {
        try {
            const res = await fetch("/api/manufacturing/procurement/suppliers");
            if (res.ok) {
                const data = await res.json();
                setSuppliers(data);
            }
        } catch (e) {
            console.error("Failed to load suppliers:", e);
        }
    };

    // Load Branches
    const loadBranches = async () => {
        try {
            const res = await fetch("/api/manufacturing/procurement/qa-receiving?action=branches");
            if (res.ok) {
                const data = await res.json();
                setBranches(data);
                if (data.length > 0) {
                    setSelectedBranchId(data[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to load branches:", e);
        }
    };

    // Load Sales Orders & Details in paginated/search query format
    const loadSalesOrders = useCallback(async () => {
        setLoadingSO(true);
        try {
            const resData = await fetchSalesOrders({
                page,
                limit: 10,
                search: searchQuery,
                status: "For Consolidation",
                selectedIds: selectedIdsRef.current,
                excludeHasJo: true
            });
            setSalesOrders(resData.data);
            setSoDetailsMap(resData.detailsMap);
            setTotalPages(resData.meta.totalPages);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to fetch Sales Orders");
        } finally {
            setLoadingSO(false);
        }
    }, [page, searchQuery]);

    const loadJobOrders = useCallback(async () => {
        setLoadingJOs(true);
        try {
            const data = await getJobOrders();
            setJobOrders(data);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to load Job Orders");
        } finally {
            setLoadingJOs(false);
        }
    }, []);

    useEffect(() => {
        loadBranches();
        loadProducts();
        loadUsers();
        loadSuppliers();
    }, []);

    useEffect(() => {
        if (activeTab === "sales-orders") {
            loadSalesOrders();
        } else {
            loadJobOrders();
        }
    }, [activeTab, loadSalesOrders, loadJobOrders]);


    // Filtered Job Orders list based on filterBranchId selection
    const filteredJobOrders = useMemo(() => {
        if (!filterBranchId) return jobOrders;
        return jobOrders.filter(jo => Number(jo.branch_id) === Number(filterBranchId));
    }, [jobOrders, filterBranchId]);

    // Grouping helper: groups all approved Sales Order line items by Product ID to find consolidation candidates
    const consolidationCandidates = useMemo(() => {
        const candidates: Record<number, {
            productId: number;
            productName: string;
            totalQty: number;
            orders: { order_no: string; quantity: number; order_id: number }[];
        }> = {};

        salesOrders.forEach(so => {
            const details = soDetailsMap[so.order_id] || [];
            details.forEach(det => {
                const pId = det.product_id.product_id;
                const pName = det.product_id.product_name;
                if (!candidates[pId]) {
                    candidates[pId] = {
                        productId: pId,
                        productName: pName,
                        totalQty: 0,
                        orders: []
                    };
                }
                candidates[pId].totalQty += det.ordered_quantity;
                candidates[pId].orders.push({
                    order_no: so.order_no,
                    quantity: det.ordered_quantity,
                    order_id: so.order_id
                });
            });
        });

        return Object.values(candidates);
    }, [salesOrders, soDetailsMap]);

    // View line items when a Sales Order is selected (1:1 Flow)
    const handleSelectSO = async (so: SalesOrder) => {
        setSelectedBatchCandidate(null);
        setSelectedSO(so);
        setLoadingDetails(true);
        setSelectedDetailId("all"); // Default to scheduling all products inside the Sales Order
        
        // Generate Default JO Number
        setJoNumber(`JO-${so.order_no}-${Math.floor(1000 + Math.random() * 9000)}`);
        
        try {
            const data = await fetchSalesOrderDetails(so.order_id);
            setSoDetails(data);
            if (data.length > 0) {
                // Default quantity is the sum of all ordered items in the SO
                const totalQty = data.reduce((sum, d) => sum + Number(d.ordered_quantity || 0), 0);
                setJoQty(totalQty);
            }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to load SO details");
        } finally {
            setLoadingDetails(false);
        }
    };

    // View Candidate Group details for batch consolidation scheduling
    const handleSelectBatchCandidate = (candidate: typeof consolidationCandidates[0]) => {
        setSelectedSO(null);
        setSelectedBatchCandidate(candidate);
        setJoQty(candidate.totalQty);
        setDueDate("");
        setJoNumber(`JO-BATCH-${candidate.productName.substring(0,4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`);
    };

    // Triggered when selected item to schedule changes (1:1 Flow)
    const handleDetailChange = (detailIdStr: string) => {
        setSelectedDetailId(detailIdStr);
        if (detailIdStr === "all") {
            const totalQty = soDetails.reduce((sum, d) => sum + Number(d.ordered_quantity || 0), 0);
            setJoQty(totalQty);
        } else {
            const match = soDetails.find(d => String(d.detail_id) === detailIdStr);
            if (match) {
                setJoQty(Number(match.ordered_quantity));
            }
        }
    };

    const getProductCapacity = (productId: number) => {
        const p = products.find(prod => Number(prod.product_id) === Number(productId));
        if (!p) return 0;

        if (p.production_capacity_per_hour && Number(p.production_capacity_per_hour) > 0) {
            return Number(p.production_capacity_per_hour);
        }

        const parentId = p.parent_id && typeof p.parent_id === "object"
            ? Number((p.parent_id as { product_id: number | string }).product_id)
            : (p.parent_id ? Number(p.parent_id) : null);

        if (parentId) {
            const parent = products.find(prod => Number(prod.product_id) === Number(parentId));
            if (parent && parent.production_capacity_per_hour && Number(parent.production_capacity_per_hour) > 0) {
                const uomCount = Number(p.unit_of_measurement_count || 1);
                return Number(parent.production_capacity_per_hour) * uomCount;
            }
        }

        return 0;
    };


    const calculateDailyBreakdown = (productId: number, qty: number, shift: string, customCapacity?: number) => {
        const capacityPerHour = customCapacity !== undefined ? customCapacity : getProductCapacity(productId);
        if (!capacityPerHour || capacityPerHour <= 0) return null;
        
        const hoursPerDay = Number(shift);
        const dailyCapacity = capacityPerHour * hoursPerDay;
        const totalDays = Math.ceil(qty / dailyCapacity);
        
        const breakdown = [];
        let remainingQty = qty;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 1);
        
        for (let i = 1; i <= totalDays; i++) {
            const dayQty = Math.min(remainingQty, dailyCapacity);
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (i - 1));
            const dateString = currentDate.toISOString().split("T")[0];
            
            breakdown.push({
                day: i,
                date: dateString,
                quantity: dayQty,
                status: "Pending"
            });
            remainingQty -= dayQty;
        }
        return breakdown;
    };


    const handleCreateJobOrder = async () => {
        if (!dueDate || !joNumber.trim() || joQty <= 0) {
            toast.error("Please complete the Job Order scheduling form.");
            return;
        }

        if (!selectedBranchId) {
            toast.error("Please assign a target branch location.");
            return;
        }

        // Validate that all products have active BOMs and routing steps
        const validationProducts: { id: number; name: string }[] = [];
        if (selectedSO) {
            if (selectedDetailId === "all") {
                soDetails.forEach(d => {
                    validationProducts.push({ id: d.product_id.product_id, name: d.product_id.product_name });
                });
            } else {
                const detail = soDetails.find(d => String(d.detail_id) === selectedDetailId);
                if (detail) {
                    validationProducts.push({ id: detail.product_id.product_id, name: detail.product_id.product_name });
                }
            }
        } else if (selectedBatchCandidate) {
            validationProducts.push({ id: selectedBatchCandidate.productId, name: selectedBatchCandidate.productName });
        } else if (isStandaloneMode) {
            selectedProductsList.forEach(p => {
                validationProducts.push({ id: p.product_id, name: p.product_name });
            });
        }

        for (const prod of validationProducts) {
            try {
                const bomData = await explodeBOM(prod.id);
                if (!bomData.bom) {
                    toast.error(`Cannot generate Job Order: Product "${prod.name}" has no active BOM version.`);
                    return;
                }
                if (!bomData.routings || bomData.routings.length === 0) {
                    toast.error(`Cannot generate Job Order: Product "${prod.name}" has a BOM but has no routing/production steps defined.`);
                    return;
                }
            } catch (err) {
                console.error("BOM validation error:", err);
                toast.error(`Failed to validate BOM recipe for product "${prod.name}".`);
                return;
            }
        }

        let newJO: JobOrder;
        let salesOrderIds: number[] = [];

        if (selectedSO) {
            // 1:1 Flow
            if (selectedDetailId === "all") {
                if (jobOrders.some(jo => jo.jo_id === joNumber.trim())) {
                    toast.error("Job Order number already exists.");
                    return;
                }

                const firstProd = soDetails[0]?.product_id;
                if (!firstProd) return;

                newJO = {
                    jo_id: joNumber.trim(),
                    order_id: selectedSO.order_id,
                    order_no: selectedSO.order_no,
                    product_id: firstProd.product_id,
                    product_name: soDetails.map(d => d.product_id?.product_name || `Product #${d.product_id}`).join(", "),
                    quantity: joQty,
                    due_date: dueDate,
                    status: "Draft",
                    is_batched: false,
                    procurementStatus: "Idle",
                    branch_id: Number(selectedBranchId),
                    shiftOption: shiftOption,
                    dailyBreakdown: calculateDailyBreakdown(firstProd.product_id, joQty, shiftOption),
                    products: soDetails.map(d => ({
                        product_id: d.product_id.product_id,
                        product_name: d.product_id.product_name,
                        quantity: Number(d.ordered_quantity),
                        bom: null
                    }))
                };
            } else {
                const detail = soDetails.find(d => String(d.detail_id) === selectedDetailId);
                if (!detail) return;
 
                if (jobOrders.some(jo => jo.jo_id === joNumber.trim())) {
                    toast.error("Job Order number already exists.");
                    return;
                }
 
                newJO = {
                    jo_id: joNumber.trim(),
                    order_id: selectedSO.order_id,
                    order_no: selectedSO.order_no,
                    product_id: detail.product_id.product_id,
                    product_name: detail.product_id.product_name,
                    quantity: joQty,
                    due_date: dueDate,
                    status: "Draft",
                    is_batched: false,
                    procurementStatus: "Idle",
                    branch_id: Number(selectedBranchId),
                    shiftOption: shiftOption,
                    dailyBreakdown: calculateDailyBreakdown(detail.product_id.product_id, joQty, shiftOption),
                    bom: selectedBomVersionId ? { bom_id: Number(selectedBomVersionId) } : null
                };
            }
            salesOrderIds = [selectedSO.order_id];
        } else if (selectedBatchCandidate) {
            // Batched Consolidation Flow
            if (jobOrders.some(jo => jo.jo_id === joNumber.trim())) {
                toast.error("Job Order number already exists.");
                return;
            }

            const refSoNumbers = selectedBatchCandidate.orders.map(o => o.order_no).join(", ");

            newJO = {
                jo_id: joNumber.trim(),
                order_no: refSoNumbers,
                product_id: selectedBatchCandidate.productId,
                product_name: selectedBatchCandidate.productName,
                quantity: joQty,
                due_date: dueDate,
                status: "Draft",
                is_batched: true,
                procurementStatus: "Idle",
                branch_id: Number(selectedBranchId),
                shiftOption: shiftOption,
                dailyBreakdown: calculateDailyBreakdown(selectedBatchCandidate.productId, joQty, shiftOption)
            };
            salesOrderIds = selectedBatchCandidate.orders.map(o => o.order_id);
        } else if (isStandaloneMode) {
            // Forecast / Standalone Production Flow
            if (selectedProductsList.length === 0) {
                toast.error("Please add at least one product SKU to the Job Order detail lines.");
                return;
            }
            if (jobOrders.some(jo => jo.jo_id === joNumber.trim())) {
                toast.error("Job Order number already exists.");
                return;
            }

            const mainProd = selectedProductsList[0];
            const refNames = selectedProductsList.map(p => p.product_name).join(", ");

            newJO = {
                jo_id: joNumber.trim(),
                order_no: "Forecast",
                product_id: mainProd.product_id,
                product_name: refNames,
                quantity: selectedProductsList.reduce((sum, p) => sum + p.quantity, 0),
                due_date: dueDate,
                status: "Draft",
                is_batched: false,
                procurementStatus: "Idle",
                branch_id: Number(selectedBranchId),
                shiftOption: shiftOption,
                dailyBreakdown: calculateDailyBreakdown(mainProd.product_id, selectedProductsList.reduce((sum, p) => sum + p.quantity, 0), shiftOption),
                products: selectedProductsList.map(p => ({
                    product_id: p.product_id,
                    product_name: p.product_name,
                    quantity: p.quantity,
                    bom: p.bom_version_id ? { version: p.bom_version_id, version_name: p.bom_version_name } : null
                }))
            };
            salesOrderIds = [];
        } else {
            return;
        }

        try {
            await addJobOrder(newJO, salesOrderIds);
            toast.success(`Job Order ${newJO.jo_id} successfully generated!`);
            setSelectedSO(null);
            setSelectedBatchCandidate(null);
            setIsStandaloneMode(false);
            setSelectedStandaloneProduct(null);
            setSelectedProductsList([]);
            setShiftOption("8");
            setSelectedBomVersionId("");
            setActiveTab("job-orders");
            loadJobOrders();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to save Job Order to database");
        }
    };


    const handleUpdateProductCapacity = async (productId: number, capacity: number) => {
        try {
            const res = await fetch("/api/manufacturing/finished-goods/products", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ product_id: productId, production_capacity_per_hour: capacity })
            });
            if (res.ok) {
                // Update local products state
                setProducts(prev => prev.map(p => {
                    if (Number(p.product_id) === productId) {
                        return { ...p, production_capacity_per_hour: capacity };
                    }
                    return p;
                }));
                toast.success("Hourly capacity updated successfully.");
            } else {
                const errJson = await res.json();
                toast.error(errJson.error || "Failed to update product capacity.");
            }
        } catch (err) {
            console.error("Error updating product capacity:", err);
            toast.error("Failed to update product capacity.");
        }
    };

    // Step 3 & 4: Inventory check and FIFO allocation
    const handleRunFIFOInventoryCheck = async (jo: JobOrder) => {
        setCheckingInventoryId(jo.jo_id);
        try {
            const productsList = jo.products && jo.products.length > 0 ? jo.products : [{
                product_id: jo.product_id,
                product_name: jo.product_name,
                quantity: jo.quantity
            }];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const explodedProducts: any[] = [];
            const aggregatedComponents: Record<number, {
                component_product_id: number;
                component_name: string;
                totalRequired: number;
            }> = {};

            // 1. Explode BOM for each product and aggregate component requirements
            for (const p of productsList) {
                const customBomId = p.bom?.bom_id || jo.bom?.bom_id || undefined;
                const bomData = await explodeBOM(p.product_id, customBomId);
                if (!bomData.bom) {
                    toast.error(`No active BOM version found for ${p.product_name || `Product ID ${p.product_id}`}.`);
                    setCheckingInventoryId(null);
                    return;
                }
                if (!bomData.routings || bomData.routings.length === 0) {
                    toast.error(`Cannot proceed with Job Order: SKU "${p.product_name || `Product ID ${p.product_id}`}" has a BOM but has no routing/production steps defined.`);
                    setCheckingInventoryId(null);
                    return;
                }

                explodedProducts.push({
                    product_id: p.product_id,
                    product_name: p.product_name,
                    quantity: Number(p.quantity),
                    bom: bomData.bom,
                    components: bomData.components,
                    routings: bomData.routings
                });

                for (const component of bomData.components) {
                    const compProductId = component.component_product_id.product_id;
                    const compName = component.component_product_id.product_name;
                    const qtyRequiredPerUnit = Number(component.quantity_required);
                    const wastage = 1 + (Number(component.wastage_factor_percentage || 0) / 100);
                    const lineRequired = Number(p.quantity) * qtyRequiredPerUnit * wastage;

                    if (!aggregatedComponents[compProductId]) {
                        aggregatedComponents[compProductId] = {
                            component_product_id: compProductId,
                            component_name: compName,
                            totalRequired: 0
                        };
                    }
                    aggregatedComponents[compProductId].totalRequired += lineRequired;
                }
            }

            // 2. Perform live inventory lookup & FIFO allocation for the aggregated components
            const allocationResults: {
                component_product_id?: number;
                component_name: string;
                required: number;
                available: number;
                deficit: number;
                batches: { lot_number: string; expiration_date: string; quantity: number }[];
                has_bom?: boolean;
                bom_id?: number;
                base_quantity?: number;
            }[] = [];
            let hasShortage = false;

            for (const compIdStr of Object.keys(aggregatedComponents)) {
                const compId = Number(compIdStr);
                const aggregated = aggregatedComponents[compId];
                const totalRequired = aggregated.totalRequired;

                let stockBatches = [];
                try {
                    stockBatches = await fetchQAStockBatches(compId);
                } catch (err) {
                    console.error(err);
                }

                const validBatches = stockBatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .filter((item: any) => {
                        const matchesBranch = jo.branch_id ? Number(item.branch_id?.id || item.branch_id) === Number(jo.branch_id) : true;
                        return item.qa_status === "Passed" && Number(item.quantity_received) > 0 && matchesBranch;
                    })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .sort((a: any, b: any) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime());

                let allocatedQty = 0;
                const allocatedBatches = [];

                for (const batch of validBatches) {
                    if (allocatedQty >= totalRequired) break;
                    const availableInBatch = Number(batch.quantity_received);
                    const needed = totalRequired - allocatedQty;
                    const taken = Math.min(availableInBatch, needed);

                    allocatedQty += taken;
                    allocatedBatches.push({
                        lot_number: batch.lot_number || "Lot-N/A",
                        expiration_date: batch.expiration_date || "No Exp Date",
                        quantity: taken
                    });
                }

                const deficit = totalRequired - allocatedQty;
                if (deficit > 0) {
                    hasShortage = true;
                }

                let hasBom = false;
                let bomId = null;
                let baseQuantity = 1;
                if (deficit > 0) {
                    try {
                        const compBomData = await explodeBOM(compId);
                        if (compBomData && compBomData.bom) {
                            hasBom = true;
                            bomId = compBomData.bom.bom_id;
                            baseQuantity = Number(compBomData.bom.base_quantity || 1);
                        }
                    } catch (err) {
                        console.error(`Failed to check BOM for component ${aggregated.component_name}:`, err);
                    }
                }

                allocationResults.push({
                    component_product_id: compId,
                    component_name: aggregated.component_name,
                    required: totalRequired,
                    available: allocatedQty,
                    deficit: deficit > 0 ? deficit : 0,
                    batches: allocatedBatches,
                    has_bom: hasBom,
                    bom_id: bomId,
                    base_quantity: baseQuantity
                });
            }

            // 3. Prepare the update patch. Populate individual products details with their BOM structures.
            const updatedProducts = explodedProducts.map(ep => ({
                product_id: ep.product_id,
                bom: ep.bom,
                components: ep.components,
                routings: ep.routings,
                allocationResults: allocationResults
            }));

            const mainProduct = explodedProducts[0] || {};
            const patch = {
                status: (hasShortage ? "Shortage" : "Proceed") as "Shortage" | "Proceed",
                bom: mainProduct.bom,
                components: mainProduct.components,
                routings: mainProduct.routings,
                allocationResults,
                products: updatedProducts
            };

            await modifyJobOrder(jo.jo_id, patch);
            
            if (hasShortage) {
                toast.warning(`Inventory shortage detected for ${jo.jo_id}. Release halted.`);
            } else {
                toast.success(`FIFO inventory check passed. release authorized for ${jo.jo_id}!`);
            }
            
            loadJobOrders();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to process stock validation");
        } finally {
            setCheckingInventoryId(null);
        }
    };

    // Step 4B: Procurement flow trigger
    const handleTriggerProcurement = async (
        joId: string,
        supplierId: number,
        poNumber: string,
        lineItems: Array<{ product_id: number; quantity_ordered: number; base_unit_cost_php: number }>
    ) => {
        setProcurementLoadingId(joId);
        try {
            const totalCost = lineItems.reduce((sum, item) => sum + (item.quantity_ordered * item.base_unit_cost_php), 0);

            // Create shipment via API
            const shipmentRes = await fetch("/api/manufacturing/procurement/shipments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    shipmentData: {
                        reference_number: poNumber,
                        supplier_id: supplierId,
                        status: "Ordered",
                        total_foreign_currency: totalCost,
                        exchange_rate: 1,
                        total_php_value: totalCost,
                        date_received: null
                    },
                    lineItems: lineItems
                })
            });

            if (!shipmentRes.ok) {
                const err = await shipmentRes.json();
                throw new Error(err.error || "Failed to create incoming shipment");
            }

            // Update Job Order procurement status to Ordered
            await modifyJobOrder(joId, { procurementStatus: "Ordered" });
            toast.success(`Procurement PO ${poNumber} created successfully.`);
            loadJobOrders();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to trigger procurement");
        } finally {
            setProcurementLoadingId(null);
        }
    };

    // Progresses procurement stages (Ordered -> Approved -> En Route -> Received QA)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleProgressProcurement = async (jo: JobOrder, action: "Approve" | "Ship" | "QA", qaData?: any) => {
        setProcurementLoadingId(jo.jo_id);
        try {
            // Find the shipment first
            const shipmentRes = await fetch("/api/manufacturing/procurement/shipments");
            if (!shipmentRes.ok) throw new Error("Failed to load shipments list");
            const shipments = await shipmentRes.json();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
            const shipment = shipments.find((s: any) => s.reference_number.startsWith(`PO-${jo.jo_id}`));

            if (!shipment) {
                throw new Error(`Could not find the associated shipment starting with reference number PO-${jo.jo_id}`);
            }

            if (action === "Approve") {
                const shipPatchRes = await fetch("/api/manufacturing/procurement/shipments", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ shipmentId: shipment.shipment_id, status: "Approved" })
                });
                if (!shipPatchRes.ok) throw new Error("Failed to update shipment status to Approved");

                await modifyJobOrder(jo.jo_id, { procurementStatus: "Approved" });
                toast.success("Procurement PO approved!");
            } else if (action === "Ship") {
                const shipPatchRes = await fetch("/api/manufacturing/procurement/shipments", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ shipmentId: shipment.shipment_id, status: "En Route" })
                });
                if (!shipPatchRes.ok) throw new Error("Failed to update shipment status to En Route");

                await modifyJobOrder(jo.jo_id, { procurementStatus: "En Route" });
                toast.info("Materials cleared for freight transit! (Status: En Route)");
            } else if (action === "QA") {
                if (!qaData) throw new Error("QA inspection data is required");

                // Fetch shipment lines to get their line IDs
                const linesRes = await fetch(`/api/manufacturing/procurement/shipments?shipmentId=${shipment.shipment_id}`);
                if (!linesRes.ok) throw new Error("Failed to load shipment lines");
                const shipmentLines = await linesRes.json();

                interface QALineItem {
                    product_id: number;
                    quantity_received: number;
                    quantity_rejected?: number;
                    lot_number?: string;
                    expiration_date?: string;
                    rejection_reason?: string;
                    qa_status?: string;
                }
                interface ShipmentLine {
                    line_id: number;
                    product_id: number | { product_id: number };
                }

                const lineItemUpdates = (qaData.lineItems as QALineItem[])
                    .filter((item: QALineItem) => shipmentLines.some((sl: ShipmentLine) => Number(typeof sl.product_id === "object" && sl.product_id !== null ? sl.product_id.product_id : sl.product_id) === Number(item.product_id)))
                    .map((item: QALineItem) => {
                        const matchLine = shipmentLines.find((sl: ShipmentLine) => Number(typeof sl.product_id === "object" && sl.product_id !== null ? sl.product_id.product_id : sl.product_id) === Number(item.product_id)) as ShipmentLine;
                        return {
                            line_id: matchLine.line_id,
                            product_id: item.product_id,
                            quantity_received: item.quantity_received,
                            quantity_rejected: item.quantity_rejected || 0,
                            lot_number: item.lot_number,
                            expiration_date: item.expiration_date,
                            rejection_reason: item.rejection_reason || null,
                            qa_status: item.qa_status || "Passed"
                        };
                    });

                // Call the real QA receiving API
                const qaRes = await fetch("/api/manufacturing/procurement/qa-receiving", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        shipmentId: shipment.shipment_id,
                        referenceNumber: shipment.reference_number,
                        branchId: jo.branch_id,
                        lineItemUpdates: lineItemUpdates
                    })
                });

                if (!qaRes.ok) {
                    const err = await qaRes.json();
                    throw new Error(err.error || "Failed to submit QA inspection");
                }

                // Update Job Order procurement status to Received QA
                await modifyJobOrder(jo.jo_id, { procurementStatus: "Received QA" });
                toast.success("QA cleared incoming materials! Inventory has been updated.");

                // Re-run the real FIFO inventory check to resolve shortage status naturally!
                await handleRunFIFOInventoryCheck({
                    ...jo,
                    procurementStatus: "Received QA"
                });
            }

            loadJobOrders();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to progress procurement");
        } finally {
            setProcurementLoadingId(null);
        }
    };

    const handleCreatePrerequisiteJobOrder = async (
        parentJo: JobOrder,
        compName: string,
        compProductId: number,
        suggestedQty: number,
        customCapacity?: number,
        customShift?: string
    ) => {
        if (!parentJo.due_date) {
            toast.error("Parent Job Order due date is missing.");
            return;
        }

        // If customCapacity is supplied, update the master SKU's hourly capacity in database first!
        if (customCapacity !== undefined && customCapacity > 0) {
            try {
                const existing = getProductCapacity(compProductId);
                if (existing !== customCapacity) {
                    await handleUpdateProductCapacity(compProductId, customCapacity);
                }
            } catch (err) {
                console.error("Failed to auto-update master SKU capacity:", err);
            }
        }

        // Compute a due date that is 1 day before the parent JO's due date (or same if not valid)
        let prereqDueDate = parentJo.due_date;
        try {
            const d = new Date(parentJo.due_date);
            d.setDate(d.getDate() - 1);
            prereqDueDate = d.toISOString().split("T")[0];
        } catch (e) {
            console.error(e);
        }

        const prereqJoId = `JO-PREREQ-${compProductId}-${Math.floor(1000 + Math.random() * 9000)}`;

        const shift = customShift || "8";
        const dailyBreakdown = calculateDailyBreakdown(compProductId, suggestedQty, shift, customCapacity);

        const newJO: JobOrder = {
            jo_id: prereqJoId,
            order_no: `Prereq for ${parentJo.jo_id}`,
            product_id: compProductId,
            product_name: compName,
            quantity: suggestedQty,
            due_date: prereqDueDate,
            status: "Draft",
            is_batched: false,
            procurementStatus: "Idle",
            branch_id: parentJo.branch_id,
            shiftOption: shift,
            dailyBreakdown: dailyBreakdown
        };

        try {
            await addJobOrder(newJO, []);
            toast.success(`Prerequisite Job Order ${prereqJoId} generated successfully!`);
            loadJobOrders();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Failed to create prerequisite Job Order");
        }
    };

    const handleDeleteJO = async (joId: string) => {
        try {
            const success = await removeJobOrder(joId);
            if (success) {
                toast.info(`Job Order ${joId} removed.`);
                loadJobOrders();
            } else {
                toast.error("Failed to delete Job Order");
            }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Error deleting Job Order");
        }
    };

    return {
        activeTab,
        setActiveTab,
        salesOrders,
        soDetailsMap,
        loadingSO,
        loadingJOs,
        selectedSO,
        setSelectedSO,
        soDetails,
        loadingDetails,
        selectedBatchCandidate,
        setSelectedBatchCandidate,
        jobOrders,
        filteredJobOrders,
        checkingInventoryId,
        procurementLoadingId,
        selectedDetailId,
        joNumber,
        setJoNumber,
        dueDate,
        setDueDate,
        joQty,
        setJoQty,
        selectedBomVersionId,
        setSelectedBomVersionId,
        consolidationCandidates,
        branches,
        selectedBranchId,
        setSelectedBranchId,
        filterBranchId,
        setFilterBranchId,
        page,
        setPage,
        totalPages,
        searchQuery,
        setSearchQuery,
        selectedIds,
        setSelectedIds,
        handleSelectSO,
        handleSelectBatchCandidate,
        handleDetailChange,
        handleCreateJobOrder,
        handleRunFIFOInventoryCheck,
        handleTriggerProcurement,
        handleProgressProcurement,
        handleDeleteJO,
        handleCreatePrerequisiteJobOrder,
        products,
        users,
        suppliers,
        isStandaloneMode,
        setIsStandaloneMode,
        selectedStandaloneProduct,
        setSelectedStandaloneProduct,
        handleUpdateProductCapacity,
        selectedProductsList,
        setSelectedProductsList,
        productVersions,
        loadVersionsForProduct,
        shiftOption,
        setShiftOption,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        modifyJobOrder: async (joId: string, patch: any) => {
            await modifyJobOrder(joId, patch);
            await loadJobOrders();
        }
    };
}
