import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Shipment, Branch, ShipmentLineItem, Product, InspectionRow } from "../types";
import { 
    fetchActiveShipments, 
    fetchBranches, 
    fetchShipmentDetails, 
    submitInspection, 
    fetchFifoInventory 
} from "../services/qa-api";

export function useQAReceiving() {
    const [activeTab, setActiveTab] = useState<"inbound" | "fifo">("inbound");
    
    // Core data lists
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loadingShipments, setLoadingShipments] = useState(false);
    const [loadingBranches, setLoadingBranches] = useState(false);

    // Selected active container details
    const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
    const [lineItems, setLineItems] = useState<ShipmentLineItem[]>([]);
    const [loadingLines, setLoadingLines] = useState(false);

    // Inspection form state
    const [selectedBranchId, setSelectedBranchId] = useState<string>("");
    const [inspectionRows, setInspectionRows] = useState<Record<number, InspectionRow>>({});

    // FIFO inventory screen states
    const [fifoBranchId, setFifoBranchId] = useState<string>("");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [fifoInventory, setFifoInventory] = useState<any[]>([]);
    const [loadingFifo, setLoadingFifo] = useState(false);
    const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
    const [fifoSearch, setFifoSearch] = useState("");
    const [showReceived, setShowReceived] = useState(false);

    const filteredShipments = useMemo(() => {
        return shipments.filter(s => {
            if (showReceived) {
                return ["Ordered", "Approved", "En Route", "Receiving (QA)", "Received"].includes(s.status);
            }
            return ["Ordered", "Approved", "En Route", "Receiving (QA)"].includes(s.status);
        });
    }, [shipments, showReceived]);

    // Load base data
    useEffect(() => {
        loadShipments();
        loadBranches();
    }, []);

    const loadShipments = async () => {
        setLoadingShipments(true);
        try {
            const data = await fetchActiveShipments();
            setShipments(data || []);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to load active shipments");
        } finally {
            setLoadingShipments(false);
        }
    };

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

    const handleSelectShipment = async (shipment: Shipment) => {
        setSelectedShipment(shipment);
        setLoadingLines(true);
        try {
            // Auto transition status to "Receiving (QA)" when opened/inspected
            if (shipment.status !== "Receiving (QA)" && shipment.status !== "Received") {
                try {
                    await fetch("/api/manufacturing/procurement/shipments", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ shipmentId: shipment.shipment_id, status: "Receiving (QA)" })
                    });
                    // Update state locally
                    setShipments(prev => prev.map(s => s.shipment_id === shipment.shipment_id ? { ...s, status: "Receiving (QA)" } : s));
                    shipment.status = "Receiving (QA)";
                } catch (err) {
                    console.error("Failed to auto-transition shipment status to Receiving (QA):", err);
                }
            }

            const lines = await fetchShipmentDetails(shipment.shipment_id);
            setLineItems(lines);

            // Prepopulate form states
            const rowsInit: Record<number, InspectionRow> = {};
            lines.forEach(l => {
                const prodName = l.product_id?.product_name?.toLowerCase() || "";
                // Guess if packaging based on name context
                const isPkg = prodName.includes("box") || prodName.includes("bottle") || prodName.includes("cap") || prodName.includes("sticker") || prodName.includes("packaging") || prodName.includes("plastic") || prodName.includes("wrapper");
                
                rowsInit[l.line_id] = {
                    acceptedQty: "",
                    lotNumber: "",
                    expirationDate: "",
                    rejectionReason: l.rejection_reason || "",
                    qaStatus: l.qa_status || "Passed",
                    isPackaging: isPkg
                };
            });
            setInspectionRows(rowsInit);
            // Pre-select first branch if available
            if (branches.length > 0 && !selectedBranchId) {
                setSelectedBranchId(branches[0].id.toString());
            }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to load shipment lines");
        } finally {
            setLoadingLines(false);
        }
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleUpdateRow = (lineId: number, field: string, value: any) => {
        setInspectionRows(prev => ({
            ...prev,
            [lineId]: {
                ...prev[lineId],
                [field]: value
            }
        }));
    };

    const handleSubmitInspection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedShipment) return;
        if (!selectedBranchId) {
            toast.error("Please select a receiving warehouse branch");
            return;
        }

        // Validation for expiration and batch rules
        for (const line of lineItems) {
            const row = inspectionRows[line.line_id];
            if (!row) continue;

            const name = line.product_id?.product_name || `Item ${line.product_id}`;

            if (row.acceptedQty === "") {
                toast.error(`Please enter Accepted Quantity for: ${name}`);
                return;
            }

            const accepted = Number(row.acceptedQty);

            // Expiration rule for raw materials
            if (!row.isPackaging && !row.expirationDate && accepted > 0) {
                toast.error(`Expiration Date is mandatory for Raw Material: ${name}`);
                return;
            }

            // Batch/lot number rule for packaging
            if (row.isPackaging && !row.lotNumber.trim() && accepted > 0) {
                toast.error(`Batch / Lot Number is mandatory for Packaging item: ${name}`);
                return;
            }
        }

        const branchIdNum = parseInt(selectedBranchId);
        const branchName = branches.find(b => b.id === branchIdNum)?.branch_name || "Selected Branch";

        setLoadingLines(true);
        try {
            const lineItemUpdates = lineItems.map(line => {
                const row = inspectionRows[line.line_id]!;
                const qtyOrdered = Number(line.quantity_ordered || 0);
                const accepted = Number(row.acceptedQty || 0);
                const qtyRejected = Math.max(0, qtyOrdered - accepted);

                return {
                    line_id: line.line_id,
                    product_id: line.product_id.product_id,
                    quantity_received: accepted,
                    quantity_rejected: qtyRejected,
                    lot_number: row.lotNumber || null,
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
            setSelectedShipment(null);
            setLineItems([]);
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
        setFifoBranchId(branchId);
        if (!branchId) {
            setFifoInventory([]);
            return;
        }

        setLoadingFifo(true);
        try {
            const items = await fetchFifoInventory(branchId);

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
            console.error(e);
            toast.error(e.message || "Failed to load branch inventory ledger");
        } finally {
            setLoadingFifo(false);
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
        handleSelectShipment,
        handleUpdateRow,
        handleSubmitInspection,
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
        toggleProductExpand
    };
}
