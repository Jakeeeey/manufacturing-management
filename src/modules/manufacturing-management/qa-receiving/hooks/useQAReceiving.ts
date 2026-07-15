import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Shipment, Branch, ShipmentLineItem, Product, InspectionRow, StorageLot, QaSpecificationLoadState, QaSpecificationReadings } from "../types";
import { 
    fetchActiveShipments, 
    fetchBranches, 
    fetchShipmentDetails, 
    submitInspection, 
    fetchFifoInventory,
    fetchStorageLots,
    fetchProductQaSpecifications
} from "../services/qa-api";

const receivingQueueStatuses = new Set(["En Route", "Receiving (QA)", "Partially Received", "Received"]);

export function useQAReceiving() {
    const listController = useRef<AbortController | null>(null);
    const detailController = useRef<AbortController | null>(null);
    const fifoController = useRef<AbortController | null>(null);
    const [activeTab, setActiveTab] = useState<"inbound" | "fifo">("inbound");
    
    // Core data lists
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [storageLots, setStorageLots] = useState<StorageLot[]>([]);
    const [loadingShipments, setLoadingShipments] = useState(false);
    const [loadingBranches, setLoadingBranches] = useState(false);

    // Selected active container details
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [lineItems, setLineItems] = useState<ShipmentLineItem[]>([]);
    const [loadingLines, setLoadingLines] = useState(false);

    // Inspection form state
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");
    const [inspectionRows, setInspectionRows] = useState<Record<number, InspectionRow>>({});
    const [qaSpecificationStates, setQaSpecificationStates] = useState<Record<number, QaSpecificationLoadState>>({});
    const [qaReadings, setQaReadings] = useState<QaSpecificationReadings>({});

    // FIFO inventory screen states
    const [fifoBranchId, setFifoBranchId] = useState<string>("");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [fifoInventory, setFifoInventory] = useState<any[]>([]);
    const [loadingFifo, setLoadingFifo] = useState(false);
    const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
    const [fifoSearch, setFifoSearch] = useState("");
    const [showReceived, setShowReceived] = useState(false);

    const clearInspection = useCallback(() => {
        detailController.current?.abort();
        setSelectedShipment(null);
        setLineItems([]);
        setLoadingLines(false);
        setInspectionRows({});
        setSelectedBranchId("");
        setQaSpecificationStates({});
        setQaReadings({});
    }, []);

    // Filter states for shipments queue
    const [searchPO, setSearchPO] = useState("");
    const [searchStatus, setSearchStatus] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const filteredShipments = useMemo(() => {
        return shipments.filter(s => {
            // 1. PO# filter (case-insensitive search on reference_number or shipment_id)
            if (searchPO.trim()) {
                const poMatch = s.reference_number.toLowerCase().includes(searchPO.toLowerCase()) || 
                                String(s.shipment_id).includes(searchPO);
                if (!poMatch) return false;
            }

            // 2. Status filter
            if (searchStatus) {
                if (s.status !== searchStatus) return false;
            } else {
                // If no specific status is selected, follow showReceived logic
                if (!showReceived && s.status === "Received") return false;
            }

            // 3. Date range filter (using s.date_received or s.created_at)
            const dateStr = s.date_received || s.created_at?.split('T')[0];
            if (dateStr) {
                if (startDate && dateStr < startDate) return false;
                if (endDate && dateStr > endDate) return false;
            } else if (startDate || endDate) {
                return false;
            }

            return true;
        });
    }, [shipments, searchPO, searchStatus, startDate, endDate, showReceived]);

    const loadShipments = useCallback(async (filters: { search?: string; status?: string; startDate?: string; endDate?: string; includeReceived?: boolean } = {}) => {
        listController.current?.abort();
        const controller = new AbortController();
        listController.current = controller;
        setLoadingShipments(true);
        try {
            const data = await fetchActiveShipments(filters, controller.signal);
            setShipments(data || []);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (e.name !== "AbortError") {
                console.error(e);
                toast.error(e.message || "Failed to load active shipments");
            }
        } finally {
            if (!controller.signal.aborted) setLoadingShipments(false);
        }
    }, []);

    // Load base data
    useEffect(() => {
        loadBranches();
        loadStorageLots();
        return () => {
            listController.current?.abort();
            detailController.current?.abort();
            fifoController.current?.abort();
        };
    }, []);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void loadShipments({
                search: searchPO.trim() || undefined,
                status: searchStatus || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                includeReceived: showReceived
            });
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [searchPO, searchStatus, startDate, endDate, showReceived, loadShipments]);

    useEffect(() => {
        if (!selectedShipment || shipments.some(shipment => shipment.shipment_id === selectedShipment.shipment_id)) return;
        clearInspection();
    }, [shipments, selectedShipment, clearInspection]);

    const loadBranches = async () => {
        setLoadingBranches(true);
        try {
            const data = await fetchBranches();
            setBranches(data || []);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to load branch list");
        } finally {
            setLoadingBranches(false);
        }
    };

    const loadStorageLots = async () => {
        try {
            setStorageLots(await fetchStorageLots());
        } catch (e) {
            console.error(e);
            toast.error("Failed to load storage lots");
        }
    };

    const handleSelectShipment = async (shipment: Shipment) => {
        if (!receivingQueueStatuses.has(shipment.status)) {
            toast.error("This purchase order is not eligible for receiving.");
            clearInspection();
            return;
        }
        detailController.current?.abort();
        const controller = new AbortController();
        detailController.current = controller;
        setSelectedShipment(shipment);
        setQaSpecificationStates({});
        setQaReadings({});
        setLoadingLines(true);
        try {
            // Auto transition status to "Receiving (QA)" when opened/inspected
            if (shipment.status === "En Route") {
                try {
                    const transitionResponse = await fetch(`/api/manufacturing/purchase-orders/${shipment.shipment_id}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "Receiving (QA)" })
                    });
                    if (!transitionResponse.ok) {
                        const error = await transitionResponse.json().catch(() => ({}));
                        throw new Error(error.error || "Failed to start receiving inspection.");
                    }
                    // Update state locally
                    setShipments(prev => prev.map(s => s.shipment_id === shipment.shipment_id ? { ...s, status: "Receiving (QA)" } : s));
                    shipment.status = "Receiving (QA)";
                } catch (err) {
                    console.error("Failed to auto-transition shipment status to Receiving (QA):", err);
                    toast.error((err as Error).message || "Failed to start receiving inspection.");
                    clearInspection();
                    return;
                }
            }

            const lines = await fetchShipmentDetails(shipment.shipment_id, controller.signal);
            setLineItems(lines);

            // Prepopulate form states
            const rowsInit: Record<number, InspectionRow> = {};
            lines.forEach(l => {
                const prodName = l.product_id?.product_name?.toLowerCase() || "";
                // Guess if packaging based on name context
                const isPkg = prodName.includes("box") || prodName.includes("bottle") || prodName.includes("cap") || prodName.includes("sticker") || prodName.includes("packaging") || prodName.includes("plastic") || prodName.includes("wrapper");
                
                rowsInit[l.line_id] = {
                    receivedQty: "",
                    acceptedQty: "",
                    boQty: "",
                    batchNumber: "",
                    lotId: "",
                    expirationDate: "",
                    rejectionReason: l.rejection_reason || "",
                    qaStatus: "", // Must default to an unselected placeholder state
                    isPackaging: isPkg
                };
            });
            setInspectionRows(rowsInit);

            // Pre-select the receiving branch defined in the original Purchase Order / Procurement record
            if (shipment.branch_id) {
                setSelectedBranchId(shipment.branch_id.toString());
            } else if (branches.length > 0) {
                setSelectedBranchId(branches[0].id.toString());
            } else {
                setSelectedBranchId("");
            }

            const productIds = [...new Set(lines.map(line => Number(line.product_id?.product_id)).filter(productId => Number.isSafeInteger(productId) && productId > 0))];
            setQaSpecificationStates(Object.fromEntries(productIds.map(productId => [productId, {
                status: "loading" as const,
                specifications: [],
                error: null
            }])));
            setLoadingLines(false);

            await Promise.all(productIds.map(async productId => {
                try {
                    const specifications = await fetchProductQaSpecifications(productId, controller.signal);
                    if (controller.signal.aborted) return;
                    setQaSpecificationStates(previous => ({
                        ...previous,
                        [productId]: { status: "loaded", specifications, error: null }
                    }));
                } catch (error) {
                    if (controller.signal.aborted || (error as Error).name === "AbortError") return;
                    setQaSpecificationStates(previous => ({
                        ...previous,
                        [productId]: {
                            status: "error",
                            specifications: [],
                            error: (error as Error).message || "Failed to load the product QA checklist."
                        }
                    }));
                }
            }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (e.name !== "AbortError") {
                console.error(e);
                toast.error(e.message || "Failed to load shipment lines");
            }
        } finally {
            if (!controller.signal.aborted) setLoadingLines(false);
        }
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleUpdateRow = (lineId: number, field: string, value: any) => {
        setInspectionRows(prev => {
            const updatedRow = {
                ...prev[lineId],
                [field]: value
            };
            
            // If receivedQty or acceptedQty is updated, compute boQty dynamically
            if (field === "receivedQty" || field === "acceptedQty") {
                const recVal = field === "receivedQty" ? value : updatedRow.receivedQty;
                const accVal = field === "acceptedQty" ? value : updatedRow.acceptedQty;
                
                if (recVal !== "" && accVal !== "") {
                    // BO qty = shortfall only — never negative.
                    // If accepted > received, BO = 0 (over-acceptance; all received plus extras are logged as accepted)
                    const newBoQty = Math.max(0, Number(recVal) - Number(accVal));
                    updatedRow.boQty = newBoQty;
                } else {
                    updatedRow.boQty = "";
                }
            }
            
            return {
                ...prev,
                [lineId]: updatedRow
            };
        });
    };

    const handleUpdateQaReading = (lineId: number, specId: number, value: string) => {
        setQaReadings(previous => ({
            ...previous,
            [lineId]: {
                ...previous[lineId],
                [specId]: value
            }
        }));
    };

    const qaSubmissionBlockReason = useMemo(() => {
        if (lineItems.length === 0) return null;
        const productIds = [...new Set(lineItems.map(line => Number(line.product_id?.product_id)))];
        for (const productId of productIds) {
            const state = qaSpecificationStates[productId];
            if (!state || state.status === "loading") return "Wait for all applicable QA checklists to finish loading.";
            if (state.status === "error") return "QA checklist configuration could not be verified. Receiving is blocked to protect inventory records.";
        }
        if (productIds.some(productId => qaSpecificationStates[productId]?.specifications.length > 0)) {
            return "This shipment uses dynamic QA specifications. Complete movement preview and transactional QA result persistence before posting it to inventory.";
        }
        return null;
    }, [lineItems, qaSpecificationStates]);

    const handleSubmitInspection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedShipment) return;
        if (qaSubmissionBlockReason) {
            toast.error(qaSubmissionBlockReason);
            return;
        }
        if (!selectedBranchId) {
            toast.error("Please select a receiving warehouse branch");
            return;
        }

        // Validation for new fields and QA constraints
        for (const line of lineItems) {
            const row = inspectionRows[line.line_id];
            if (!row) continue;

            const name = line.product_id?.product_name || `Item ${line.product_id}`;

            if (row.receivedQty === "" || isNaN(Number(row.receivedQty))) {
                toast.error(`Please enter Received Quantity for: ${name}`);
                return;
            }

            if (row.acceptedQty === "" || isNaN(Number(row.acceptedQty))) {
                toast.error(`Please enter Accepted Quantity for: ${name}`);
                return;
            }

            if (!row.qaStatus || row.qaStatus === "") {
                toast.error(`Please select QA Status Decision for: ${name}`);
                return;
            }

            if (!row.batchNumber || !row.batchNumber.trim()) {
                toast.error(`Please enter Supplier Batch Number for: ${name}`);
                return;
            }

            if (!row.lotId || !Number.isInteger(Number(row.lotId)) || Number(row.lotId) <= 0) {
                toast.error(`Please select a Storage Lot for: ${name}`);
                return;
            }

            const received = Number(row.receivedQty);
            const accepted = Number(row.acceptedQty);
            // BO is always the shortfall (non-negative). When accepted > received, BO = 0.
            const bo = Math.max(0, received - accepted);
            const ordered = Number(line.quantity_ordered || 0);

            if (received < 0 || accepted < 0) {
                toast.error(`Quantities cannot be negative for: ${name}`);
                return;
            }

            // When accepted ≤ received: the standard reconciliation check applies.
            // When accepted > received: this is an over-acceptance event (supplier delivered more
            // than what was physically counted as "received", e.g., loose items found during inspection).
            // We allow it but require remarks.
            if (accepted <= received && received !== accepted + bo) {
                toast.error(`Discrepancy for ${name}: Received Qty (${received}) must equal Accepted Qty (${accepted}) + BO Qty (${bo}).`);
                return;
            }

            // Expiration rule for raw materials
            if (!row.isPackaging && !row.expirationDate && accepted > 0) {
                toast.error(`Expiration Date is mandatory for Raw Material: ${name}`);
                return;
            }

            // Warning when received qty exceeds ordered qty
            if (received > ordered) {
                if (!row.rejectionReason || !row.rejectionReason.trim()) {
                    toast.error(`Over-shipment detected: Received (${received}) > Ordered (${ordered}) for ${name}. Remarks are required.`);
                    return;
                }
                toast.warning(`Over-shipment: ${received} units received vs ${ordered} ordered.`);
            }

            // Remarks validation:
            // 1. If BO Qty > 0, remarks field is mandatory
            if (bo > 0 && (!row.rejectionReason || !row.rejectionReason.trim())) {
                toast.error(`Remarks are mandatory for ${name} because there is a Bad Order quantity (${bo} units).`);
                return;
            }

            // 2. Any logistics discrepancy needs an audit explanation.
            if (received !== ordered && (!row.rejectionReason || !row.rejectionReason.trim())) {
                toast.error(`Remarks are mandatory for ${name} due to logistics discrepancy (Received: ${received}, Ordered: ${ordered}).`);
                return;
            }

            // 3. If Accepted Qty > Received Qty (over-acceptance / bonus stock), remarks field is mandatory
            if (accepted > received && (!row.rejectionReason || !row.rejectionReason.trim())) {
                toast.error(`Remarks are mandatory for ${name} because Accepted Qty (${accepted}) exceeds Received Qty (${received}). Please document the source of extra units.`);
                return;
            }
        }

        const branchIdNum = parseInt(selectedBranchId);
        const branchName = branches.find(b => b.id === branchIdNum)?.branch_name || "Selected Branch";

        setLoadingLines(true);
        try {
            const lineItemUpdates = lineItems.map(line => {
                const row = inspectionRows[line.line_id]!;
                const received = Number(row.receivedQty || 0);
                const accepted = Number(row.acceptedQty || 0);
                // BO = shortfall only — never negative. Over-accepted units are all written to accepted stock.
                const bo = Math.max(0, received - accepted);

                return {
                    line_id: line.line_id,
                    product_id: line.product_id.product_id,
                    quantity_received: received,
                    quantity_accepted: accepted,
                    quantity_rejected: bo, // BO Qty (shortfall, non-negative)
                    batch_no: row.batchNumber.trim(),
                    lot_id: Number(row.lotId),
                    expiration_date: row.expirationDate ? row.expirationDate.replace(/\//g, "-") : null,
                    rejection_reason: row.rejectionReason || null,
                    qa_status: row.qaStatus
                };
            });

            await submitInspection({
                shipmentId: selectedShipment.shipment_id,
                referenceNumber: selectedShipment.reference_number,
                branchId: branchIdNum,
                branchName,
                lineItemUpdates
            });

            toast.success(`Shipment successfully logged to ${branchName} and transitioned to 'Received'.`);
            clearInspection();
            loadShipments();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "An error occurred during inspection logging");
        } finally {
            setLoadingLines(false);
        }
    };

    // Load FIFO inventory breakdown
    const handleLoadFifoInventory = async (branchId: string) => {
        fifoController.current?.abort();
        setFifoBranchId(branchId);
        if (!branchId) {
            setFifoInventory([]);
            return;
        }

        const controller = new AbortController();
        fifoController.current = controller;
        setLoadingFifo(true);
        try {
            const items = await fetchFifoInventory(branchId, controller.signal);

            // Group by product and create batches list
            const groupedMap: Record<number, {
                product: Product;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                batches: any[];
                totalQty: number;
                isPackaging: boolean;
            }> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
            items.forEach((item: any) => {
                const prod = item.product_id;
                if (!prod) return;

                const prodId = prod.product_id;
                const prodName = prod.product_name.toLowerCase();
                const isPkg = prodName.includes("box") || prodName.includes("bottle") || prodName.includes("cap") || prodName.includes("sticker") || prodName.includes("packaging") || prodName.includes("plastic") || prodName.includes("wrapper");

                if (!groupedMap[prodId]) {
                    groupedMap[prodId] = {
                        product: prod,
                        batches: [],
                        totalQty: 0,
                        isPackaging: isPkg
                    };
                }

                groupedMap[prodId].batches.push({
                    lot_number: item.lot_number || "BATCH-N/A",
                    expiration_date: item.expiration_date,
                    received_qty: Number(item.quantity_received || 0),
                    reception_date: item.shipment_id?.date_received || item.shipment_id?.created_at?.split('T')[0] || "N/A",
                    shipment_ref: item.shipment_id?.reference_number || "N/A",
                    qa_status: item.qa_status || "Passed"
                });

                groupedMap[prodId].totalQty += Number(item.quantity_received || 0);
            });

            // Apply sorting for FIFO:
            // - Raw materials: Closest expiration date first
            // - Packaging: Oldest reception date first (FIFO)
            const groupedList = Object.values(groupedMap).map(group => {
                if (group.isPackaging) {
                    group.batches.sort((a, b) => new Date(a.reception_date).getTime() - new Date(b.reception_date).getTime());
                } else {
                    group.batches.sort((a, b) => {
                        if (!a.expiration_date) return 1;
                        if (!b.expiration_date) return -1;
                        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
                    });
                }
                return group;
            });

            setFifoInventory(groupedList);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (e.name !== "AbortError") {
                console.error(e);
                toast.error(e.message || "Failed to load branch inventory ledger");
            }
        } finally {
            if (!controller.signal.aborted) setLoadingFifo(false);
        }
    };

    const toggleProductExpand = (prodId: number) => {
        setExpandedProducts(prev => ({
            ...prev,
            [prodId]: !prev[prodId]
        }));
    };

    const filteredFifoList = useMemo(() => {
        return fifoInventory.filter(item => {
            const query = fifoSearch.toLowerCase();
            return (
                item.product.product_name.toLowerCase().includes(query) ||
                item.product.product_code.toLowerCase().includes(query)
            );
        });
    }, [fifoInventory, fifoSearch]);

    return {
        activeTab,
        setActiveTab,
        shipments,
        branches,
        storageLots,
        loadingShipments,
        loadingBranches,
        selectedShipment,
        setSelectedShipment,
        lineItems,
        setLineItems,
        loadingLines,
        selectedBranchId,
        setSelectedBranchId,
        inspectionRows,
        qaSpecificationStates,
        qaReadings,
        qaSubmissionBlockReason,
        handleSelectShipment,
        handleUpdateRow,
        handleUpdateQaReading,
        handleSubmitInspection,
        clearInspection,
        fifoBranchId,
        fifoInventory,
        loadingFifo,
        expandedProducts,
        fifoSearch,
        setFifoSearch,
        showReceived,
        setShowReceived,
        filteredShipments,
        filteredFifoList,
        handleLoadFifoInventory,
        toggleProductExpand,

        // Expose new filter states
        searchPO,
        setSearchPO,
        searchStatus,
        setSearchStatus,
        startDate,
        setStartDate,
        endDate,
        setEndDate
    };
}
