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
    updateShipmentStatus,
    registerRawMaterial,
    updateSupplier
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
    const [supplierError, setSupplierError] = useState<string | null>(null);
    const [supplierForm, setSupplierForm] = useState({
        supplier_name: "",
        supplier_shortcut: "",
        tin_number: "",
        phone_number: "",
        email_address: "",
        address: "",
        city: "",
        brgy: "",
        state_province: "",
        country: "Philippines",
        postal_code: "",
        contact_person: "",
        payment_terms: "Cash On Delivery",
        delivery_terms: "Delivery",
        currency: "PHP",
        notes_or_comments: ""
    });

    const [isEditingSupplier, setIsEditingSupplier] = useState(false);
    const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);

    // Reset error & editing status when supplier modal opens/closes
    useEffect(() => {
        if (isSupplierModalOpen) {
            setSupplierError(null);
        } else {
            setSupplierError(null);
            setIsEditingSupplier(false);
            setEditingSupplierId(null);
        }
    }, [isSupplierModalOpen]);

    const [shipmentForm, setShipmentForm] = useState({
        reference_number: "",
        supplier_id: "",
        exchange_rate: "58.00",
        total_foreign_currency: "0",
        total_php_value: "0",
        status: "Ordered" as const,
        date_received: new Date().toISOString().split("T")[0]
    });

    const [shipmentLinesForm, setShipmentLinesForm] = useState<Array<{
        parent_product_id: string;
        product_id: string;
        product_name?: string;
        product_code?: string;
        selected_uom?: string;
        quantity_ordered: string;
        base_unit_cost_php: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    overhead_id: x.overhead_id ? String(typeof x.overhead_id === "object" ? (x.overhead_id as any).id : x.overhead_id) : "",
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    function parseCreationError(errorMsg: string): string {
        const msg = errorMsg.toLowerCase();
        if (msg.includes("supplier_name") || msg.includes("name already exists") || msg.includes("unique") && msg.includes("name")) {
            return "This Supplier Name already exists. Please choose a unique name.";
        }
        if (msg.includes("tin_number") || msg.includes("tin already registered") || msg.includes("unique") && msg.includes("tin")) {
            return "This TIN Number is already registered. Please enter a unique TIN.";
        }
        if (msg.includes("supplier_shortcut") || msg.includes("shortcut") || msg.includes("code") && msg.includes("unique")) {
            return "This Supplier Code already exists. Please choose a unique code.";
        }
        return errorMsg;
    }

    const handleCreateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        setSupplierError(null);
        if (!supplierForm.supplier_name.trim()) {
            setSupplierError("Supplier Corporate Name is required");
            toast.error("Supplier Corporate Name is required");
            return;
        }
        if (!supplierForm.supplier_shortcut.trim()) {
            setSupplierError("Supplier Code/Shortcut is required");
            toast.error("Supplier Code/Shortcut is required");
            return;
        }
        if (!supplierForm.address.trim()) {
            setSupplierError("Business Street Address is required");
            toast.error("Business Street Address is required");
            return;
        }

        try {
            // Destructure currency so we do not send it directly to database (avoiding column error)
            const { currency, ...restOfSupplier } = supplierForm;
            const notes = restOfSupplier.notes_or_comments || "";
            const currencyTag = `[Currency: ${currency || "PHP"}]`;
            const finalNotes = notes.trim() ? `${notes.trim()}\n\n${currencyTag}` : currencyTag;
            
            const payload = {
                ...restOfSupplier,
                notes_or_comments: finalNotes
            };

            if (isEditingSupplier && editingSupplierId) {
                await updateSupplier(editingSupplierId, payload);
                toast.success("Supplier updated successfully");
            } else {
                await createSupplier(payload);
                toast.success("Supplier created successfully");
            }

            setIsSupplierModalOpen(false);
            setIsEditingSupplier(false);
            setEditingSupplierId(null);
            setSupplierForm({
                supplier_name: "",
                supplier_shortcut: "",
                tin_number: "",
                phone_number: "",
                email_address: "",
                address: "",
                city: "",
                brgy: "",
                state_province: "",
                country: "Philippines",
                postal_code: "",
                contact_person: "",
                payment_terms: "Cash On Delivery",
                delivery_terms: "Delivery",
                currency: "PHP",
                notes_or_comments: ""
            });
            setSupplierError(null);
            loadSuppliers();
        } catch (e) {
            console.error(e);
            const rawMsg = (e as Error).message || "Failed to submit supplier";
            const userFriendlyMsg = parseCreationError(rawMsg);
            setSupplierError(userFriendlyMsg);
            toast.error(userFriendlyMsg);
        }
    };

    const handleStartEditSupplier = (supplier: Supplier) => {
        const notes = supplier.notes_or_comments || "";
        const match = notes.match(/\[Currency:\s*(\w+)\]/);
        const currency = match ? match[1] : "PHP";
        const cleanNotes = notes.replace(/\[Currency:\s*\w+\]/, "").trim();

        setSupplierForm({
            supplier_name: supplier.supplier_name || "",
            supplier_shortcut: supplier.supplier_shortcut || "",
            tin_number: supplier.tin_number || "",
            phone_number: supplier.phone_number || "",
            email_address: supplier.email_address || "",
            address: supplier.address || "",
            city: supplier.city || "",
            brgy: supplier.brgy || "",
            state_province: supplier.state_province || "",
            country: supplier.country || "Philippines",
            postal_code: supplier.postal_code || "",
            contact_person: supplier.contact_person || "",
            payment_terms: supplier.payment_terms || "Cash On Delivery",
            delivery_terms: supplier.delivery_terms || "Delivery",
            currency: currency,
            notes_or_comments: cleanNotes
        });

        setIsEditingSupplier(true);
        setEditingSupplierId(supplier.id);
        setIsSupplierModalOpen(true);
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
            setLoading(true);
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
                status: shipmentForm.status,
                date_received: shipmentForm.date_received
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
                status: "Ordered",
                date_received: new Date().toISOString().split("T")[0]
            });
            setShipmentLinesForm([{ parent_product_id: "", product_id: "", quantity_ordered: "", base_unit_cost_php: "" }]);
            loadShipments();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to save incoming shipment");
        } finally {
            setLoading(false);
        }
    };

    const handleAllocateExpenses = async (
        e: React.FormEvent, 
        shipmentId: number, 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetStatus: any,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to update shipment status");
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterRawMaterial = async (
        productDetails: {
            product_name: string;
            product_code: string;
            description?: string;
            barcode?: string;
            cost_per_unit?: number;
            density_factor?: number;
            unit_of_measurement?: number;
            price_per_unit?: number;
        },
        supplierIds?: number[]
    ): Promise<boolean> => {
        setLoading(true);
        try {
            await registerRawMaterial(productDetails, supplierIds);
            toast.success(`Successfully registered raw material "${productDetails.product_name}"`);
            await loadRawMaterials();
            return true;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to register raw material");
            return false;
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
        supplierError,
        setSupplierError,
        shipmentForm,
        setShipmentForm,
        shipmentLinesForm,
        setShipmentLinesForm,
        expenseAllocationForm,
        setExpenseAllocationForm,
        isEditingSupplier,
        editingSupplierId,
        handleStartEditSupplier,
        handleCreateSupplier,
        handleCreateShipment,
        handleAllocateExpenses,
        handleUpdateShipmentStatus,
        handleRegisterRawMaterial
    };
}
