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

    // Pagination, Search, and Status states
    const [currentPage, setCurrentPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // Load Sales Orders
    const loadSalesOrders = async (page = currentPage, search = searchQuery, status = statusFilter) => {
        setLoading(true);
        try {
            const res = await fetchSalesOrders({
                page,
                limit,
                search,
                status: status === "All" ? "" : status
            });
            setSalesOrders(res.data);
            setTotalCount(res.meta.totalCount);
            setTotalPages(res.meta.totalPages);
            setCurrentPage(res.meta.page);
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
        if (activeTab === "sales-orders") {
            loadSalesOrders(currentPage, searchQuery, statusFilter);
        } else {
            loadQuotes();
        }
    }, [activeTab, currentPage, searchQuery, statusFilter]);

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        setCurrentPage(1);
    };

    const handleStatusChange = (status: string) => {
        setStatusFilter(status);
        setCurrentPage(1);
    };

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
            loadSalesOrders(currentPage, searchQuery, statusFilter);
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
            loadSalesOrders(currentPage, searchQuery, statusFilter);
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
            loadSalesOrders(currentPage, searchQuery, statusFilter);
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
            loadSalesOrders(currentPage, searchQuery, statusFilter);
        } catch (e: any) {
            toast.error(e.message || "Failed to convert quote");
        } finally {
            setConvertingId(null);
        }
    };

    const refreshData = () => {
        loadSalesOrders(currentPage, searchQuery, statusFilter);
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
        refreshData,
        currentPage,
        setCurrentPage,
        limit,
        setLimit,
        searchQuery,
        setSearchQuery: handleSearchChange,
        statusFilter,
        setStatusFilter: handleStatusChange,
        totalCount,
        totalPages
    };
}
