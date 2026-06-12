import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Supplier, IncomingShipment, ShipmentLineItem, ShipmentExpense, RawMaterial } from "../types";
import { 
    fetchSuppliers, 
    createSupplier, 
    fetchShipments, 
    fetchShipmentLineItems, 
    createShipment, 
    fetchShipmentExpenses, 
    saveAndAllocateExpenses, 
    fetchRawMaterials,
    updateShipmentStatus
} from "../services/procurement-api";

export function useProcurement(defaultTab: string = "suppliers") {
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [loading, setLoading] = useState(false);

    // Data lists
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [shipments, setShipments] = useState<IncomingShipment[]>([]);
    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);

    // Selected items
    const [selectedShipment, setSelectedShipment] = useState<IncomingShipment | null>(null);
    const [selectedShipmentLines, setSelectedShipmentLines] = useState<ShipmentLineItem[]>([]);
    const [selectedShipmentExpenses, setSelectedShipmentExpenses] = useState<ShipmentExpense[]>([]);

    // Modals
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [isShipmentModalOpen, setIsShipmentModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

    // Forms
    const [supplierForm, setSupplierForm] = useState({
        supplier_name: "",
        supplier_shortcut: "",
        tin_number: "",
        phone_number: "",
        email_address: "",
        address: "",
        city: "",
        state_province: "",
        country: "Philippines",
        postal_code: "",
        contact_person: "",
        payment_terms: "Cash On Delivery",
        delivery_terms: "Delivery",
        notes_or_comments: ""
    });

    const [shipmentForm, setShipmentForm] = useState({
        reference_number: "",
        supplier_id: "",
        exchange_rate: "58.00",
        total_foreign_currency: "0",
        total_php_value: "0",
        status: "Ordered" as const
    });

    const [shipmentLinesForm, setShipmentLinesForm] = useState<Array<{
        parent_product_id: string;
        product_id: string;
        product_name?: string;
        product_code?: string;
        selected_uom?: string;
        quantity_ordered: string;
        base_unit_cost_php: string;
        uom_options?: any[];
    }>>([{ parent_product_id: "", product_id: "", quantity_ordered: "", base_unit_cost_php: "" }]);

    const [expenseAllocationForm, setExpenseAllocationForm] = useState<{
        allocation_method: "Value" | "Weight" | "Volume";
        expenses: Array<{ overhead_id: string; expense_type: string; amount_php: string }>;
    }>({
        allocation_method: "Value",
        expenses: [{ overhead_id: "", expense_type: "", amount_php: "" }]
    });

    // Initial load
    useEffect(() => {
        loadSuppliers();
        loadShipments();
        loadRawMaterials();
    }, []);

    // Sync loaded expenses with the form state
    useEffect(() => {
        if (selectedShipmentExpenses && selectedShipmentExpenses.length > 0) {
            setExpenseAllocationForm({
                allocation_method: selectedShipmentExpenses[0].allocation_method === "By Weight" ? "Weight" :
                                   selectedShipmentExpenses[0].allocation_method === "By Volume" ? "Volume" : "Value",
                expenses: selectedShipmentExpenses.map(x => ({
                    overhead_id: x.overhead_id ? String(typeof x.overhead_id === "object" ? (x.overhead_id as any).id : x.overhead_id) : "",
                    expense_type: x.expense_type || (x.overhead_id && typeof x.overhead_id === "object" ? (x.overhead_id as any).overhead_name : ""),
                    amount_php: String(x.amount_php || "")
                }))
            });
        } else {
            setExpenseAllocationForm({
                allocation_method: "Value",
                expenses: [{ overhead_id: "", expense_type: "", amount_php: "" }]
            });
        }
    }, [selectedShipmentExpenses]);

    // Load sub-details when shipment is selected
    useEffect(() => {
        if (selectedShipment) {
            loadShipmentDetails(selectedShipment.shipment_id);
        } else {
            setSelectedShipmentLines([]);
            setSelectedShipmentExpenses([]);
        }
    }, [selectedShipment]);

    async function loadSuppliers() {
        try {
            const data = await fetchSuppliers();
            setSuppliers(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load suppliers");
        }
    }

    async function loadShipments() {
        try {
            const data = await fetchShipments();
            setShipments(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load incoming shipments");
        }
    }

    async function loadRawMaterials() {
        try {
            const data = await fetchRawMaterials();
            setRawMaterials(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load raw materials");
        }
    }

    async function loadShipmentDetails(shipmentId: number) {
        setLoading(true);
        try {
            const [lines, exps] = await Promise.all([
                fetchShipmentLineItems(shipmentId),
                fetchShipmentExpenses(shipmentId)
            ]);
            setSelectedShipmentLines(lines);
            setSelectedShipmentExpenses(exps);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load shipment details");
        } finally {
            setLoading(false);
        }
    }

    const handleCreateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supplierForm.supplier_name.trim()) {
            toast.error("Supplier Name is required");
            return;
        }
        try {
            await createSupplier(supplierForm);
            toast.success("Supplier created successfully");
            setIsSupplierModalOpen(false);
            setSupplierForm({
                supplier_name: "",
                supplier_shortcut: "",
                tin_number: "",
                phone_number: "",
                email_address: "",
                address: "",
                city: "",
                state_province: "",
                country: "Philippines",
                postal_code: "",
                contact_person: "",
                payment_terms: "Cash On Delivery",
                delivery_terms: "Delivery",
                notes_or_comments: ""
            });
            loadSuppliers();
        } catch (e) {
            console.error(e);
            toast.error("Failed to create supplier");
        }
    };

    const handleCreateShipment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shipmentForm.reference_number.trim()) {
            toast.error("Reference Number/BL is required");
            return;
        }
        if (!shipmentForm.supplier_id) {
            toast.error("Supplier is required");
            return;
        }

        const validLines = shipmentLinesForm.filter(l => l.product_id && l.quantity_ordered && l.base_unit_cost_php);
        if (validLines.length === 0) {
            toast.error("At least one product item is required");
            return;
        }

        try {
            const linesPayload = validLines.map(l => ({
                product_id: parseInt(l.product_id),
                quantity_ordered: parseFloat(l.quantity_ordered),
                base_unit_cost_php: parseFloat(l.base_unit_cost_php)
            }));

            const totalPhp = linesPayload.reduce((acc, curr) => acc + (curr.quantity_ordered * curr.base_unit_cost_php), 0);
            const rate = parseFloat(shipmentForm.exchange_rate) || 58.00;

            const shipmentPayload = {
                reference_number: shipmentForm.reference_number,
                supplier_id: parseInt(shipmentForm.supplier_id),
                exchange_rate: rate,
                total_foreign_currency: totalPhp / rate,
                total_php_value: totalPhp,
                status: shipmentForm.status
            };

            await createShipment(shipmentPayload, linesPayload);
            toast.success("Shipment registered successfully");
            setIsShipmentModalOpen(false);
            setShipmentForm({
                reference_number: "",
                supplier_id: "",
                exchange_rate: "58.00",
                total_foreign_currency: "0",
                total_php_value: "0",
                status: "Ordered"
            });
            setShipmentLinesForm([{ parent_product_id: "", product_id: "", quantity_ordered: "", base_unit_cost_php: "" }]);
            loadShipments();
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to save incoming shipment");
        }
    };

    const handleAllocateExpenses = async (
        e: React.FormEvent, 
        shipmentId: number, 
        targetStatus: any,
        lineItemUpdates?: any[]
    ) => {
        e.preventDefault();
        const validExps = expenseAllocationForm.expenses.filter(x => x.overhead_id && x.amount_php);
        
        try {
            const expsPayload = validExps.map(x => ({
                overhead_id: parseInt(x.overhead_id),
                expense_type: x.expense_type || "",
                amount_php: parseFloat(x.amount_php)
            }));

            // Map UI allocation method to DB ENUM values ('By Value', 'By Weight', 'By Volume')
            const dbAllocationMethod = 
                expenseAllocationForm.allocation_method === "Weight" ? "By Weight" :
                expenseAllocationForm.allocation_method === "Volume" ? "By Volume" : "By Value";

            await saveAndAllocateExpenses(
                shipmentId,
                targetStatus,
                expsPayload,
                dbAllocationMethod,
                lineItemUpdates
            );
            toast.success("Landed costs calculated and updated successfully");
            setIsExpenseModalOpen(false);
            
            // Reload active selections
            loadShipments();
            loadRawMaterials();
            if (selectedShipment && selectedShipment.shipment_id === shipmentId) {
                const updatedShip = shipments.find(s => s.shipment_id === shipmentId);
                if (updatedShip) {
                    setSelectedShipment({ ...updatedShip, status: targetStatus });
                } else {
                    setSelectedShipment(null);
                }
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to allocate expenses");
        }
    };

    const handleUpdateShipmentStatus = async (shipmentId: number, status: "Ordered" | "Approved" | "En Route" | "Receiving (QA)" | "Received") => {
        setLoading(true);
        try {
            await updateShipmentStatus(shipmentId, status);
            toast.success(`Shipment status updated to ${status}`);
            await Promise.all([loadShipments(), loadRawMaterials()]);
            if (selectedShipment && selectedShipment.shipment_id === shipmentId) {
                setSelectedShipment(prev => prev ? { ...prev, status } : null);
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to update shipment status");
        } finally {
            setLoading(false);
        }
    };

    return {
        activeTab,
        setActiveTab,
        loading,
        suppliers,
        shipments,
        rawMaterials,
        selectedShipment,
        setSelectedShipment,
        selectedShipmentLines,
        selectedShipmentExpenses,
        isSupplierModalOpen,
        setIsSupplierModalOpen,
        isShipmentModalOpen,
        setIsShipmentModalOpen,
        isExpenseModalOpen,
        setIsExpenseModalOpen,
        supplierForm,
        setSupplierForm,
        shipmentForm,
        setShipmentForm,
        shipmentLinesForm,
        setShipmentLinesForm,
        expenseAllocationForm,
        setExpenseAllocationForm,
        handleCreateSupplier,
        handleCreateShipment,
        handleAllocateExpenses,
        handleUpdateShipmentStatus
    };
}
