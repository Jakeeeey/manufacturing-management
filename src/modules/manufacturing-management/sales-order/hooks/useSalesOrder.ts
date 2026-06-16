import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SalesOrder, SalesOrderDetail, QuotationHeader } from "../types";
import { 
    fetchSalesOrders, 
    fetchSalesOrderDetails, 
    approveSalesOrder, 
    convertQuotationToSalesOrder, 
    fetchQuotationPipeline,
    updateSalesOrderDetails,
    updateSalesOrderStatus
} from "../services/sales-order-api";

export function useSalesOrder() {
    const [activeTab, setActiveTab] = useState<"sales-orders" | "quote-pipeline">("sales-orders");
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [quotes, setQuotes] = useState<QuotationHeader[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [orderDetails, setOrderDetails] = useState<SalesOrderDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    const [convertingId, setConvertingId] = useState<number | null>(null);
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
    const [savingQuantities, setSavingQuantities] = useState(false);

    // Load Sales Orders
    const loadSalesOrders = async () => {
        setLoading(true);
        try {
            const data = await fetchSalesOrders();
            setSalesOrders(data);
        } catch (e: any) {
            toast.error(e.message || "Failed to fetch sales orders");
        } finally {
            setLoading(false);
        }
    };

    // Load Quotations for pipeline
    const loadQuotes = async () => {
        try {
            const data = await fetchQuotationPipeline();
            // Filter only Draft or pending quotes (not converted yet)
            setQuotes(data.filter((q: any) => q.status !== "Converted to SO"));
        } catch (e: any) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadSalesOrders();
        loadQuotes();
    }, [activeTab]);

    const viewOrderDetails = async (order: SalesOrder) => {
        setSelectedOrder(order);
        setLoadingDetails(true);
        try {
            const data = await fetchSalesOrderDetails(order.order_id);
            setOrderDetails(data);
        } catch (e: any) {
            toast.error(e.message || "Failed to load order details");
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleApproveOrder = async (orderId: number) => {
        setUpdatingStatusId(orderId);
        try {
            await approveSalesOrder(orderId);
            toast.success("Sales Order approved! Ready for Operations scheduling.");
            loadSalesOrders();
            if (selectedOrder && selectedOrder.order_id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, order_status: "For Consolidation" } : null);
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to update status");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleUpdateQuantities = async (orderId: number, details: { detail_id: number; ordered_quantity: number }[]) => {
        setSavingQuantities(true);
        try {
            await updateSalesOrderDetails(orderId, details);
            toast.success("Quantities updated successfully!");
            loadSalesOrders();
            // Refresh details
            const data = await fetchSalesOrderDetails(orderId);
            setOrderDetails(data);
            if (selectedOrder && selectedOrder.order_id === orderId) {
                const totalAmount = data.reduce((acc, item) => acc + Number(item.net_amount || 0), 0);
                setSelectedOrder(prev => prev ? { ...prev, total_amount: totalAmount, net_amount: totalAmount - Number(prev.discount_amount || 0) } : null);
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to update quantities");
        } finally {
            setSavingQuantities(false);
        }
    };

    const handleSubmitForApproval = async (orderId: number) => {
        setUpdatingStatusId(orderId);
        try {
            await updateSalesOrderStatus(orderId, "For Approval");
            toast.success("Sales Order submitted for approval!");
            loadSalesOrders();
            if (selectedOrder && selectedOrder.order_id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, order_status: "For Approval" } : null);
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to submit for approval");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleConvertQuote = async (quoteId: number) => {
        setConvertingId(quoteId);
        try {
            const data = await convertQuotationToSalesOrder(quoteId);
            toast.success(`Converted successfully to Sales Order: ${data.order_no}`);
            loadQuotes();
            loadSalesOrders();
        } catch (e: any) {
            toast.error(e.message || "Failed to convert quote");
        } finally {
            setConvertingId(null);
        }
    };

    const refreshData = () => {
        loadSalesOrders();
        loadQuotes();
    };

    return {
        activeTab,
        setActiveTab,
        salesOrders,
        quotes,
        loading,
        selectedOrder,
        setSelectedOrder,
        orderDetails,
        loadingDetails,
        convertingId,
        updatingStatusId,
        savingQuantities,
        viewOrderDetails,
        handleApproveOrder,
        handleConvertQuote,
        handleUpdateQuantities,
        handleSubmitForApproval,
        refreshData
    };
}
