import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SalesOrder, SalesOrderDetail } from "../../sales-order/types";
import { 
    fetchSalesOrders, 
    fetchSalesOrderDetails, 
    approveSalesOrder, 
    updateSalesOrderStatus 
} from "../../sales-order/services/sales-order-api";

export function useSalesOrderApproval() {
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
    const [orderDetails, setOrderDetails] = useState<SalesOrderDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

    // Pagination and search states
    const [currentPage, setCurrentPage] = useState(1);
    const [limit] = useState(10);
    const [searchQuery, setSearchQuery] = useState("");
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const loadPendingOrders = async (page = currentPage, search = searchQuery) => {
        setLoading(true);
        try {
            const res = await fetchSalesOrders({
                page,
                limit,
                search,
                status: "For Approval" // Dedicated to approval workflow
            });
            setSalesOrders(res.data);
            setTotalCount(res.meta.totalCount);
            setTotalPages(res.meta.totalPages);
            setCurrentPage(res.meta.page);
        } catch (e: any) {
            toast.error(e.message || "Failed to load approval queue");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPendingOrders(currentPage, searchQuery);
    }, [currentPage, searchQuery]);

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
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

    const handleApprove = async (orderId: number) => {
        setUpdatingStatusId(orderId);
        try {
            await approveSalesOrder(orderId);
            toast.success("Sales Order approved! Released to production floor.");
            loadPendingOrders(currentPage, searchQuery);
            if (selectedOrder && selectedOrder.order_id === orderId) {
                setSelectedOrder(null);
                setOrderDetails([]);
            }
        } catch (e: any) {
            toast.error(e.message || "Approval failed");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const handleReject = async (orderId: number) => {
        setUpdatingStatusId(orderId);
        try {
            await updateSalesOrderStatus(orderId, "Draft");
            toast.success("Sales Order rejected and returned to Draft status.");
            loadPendingOrders(currentPage, searchQuery);
            if (selectedOrder && selectedOrder.order_id === orderId) {
                setSelectedOrder(null);
                setOrderDetails([]);
            }
        } catch (e: any) {
            toast.error(e.message || "Rejection failed");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const refreshData = () => {
        loadPendingOrders(currentPage, searchQuery);
    };

    return {
        salesOrders,
        loading,
        selectedOrder,
        setSelectedOrder,
        orderDetails,
        loadingDetails,
        updatingStatusId,
        currentPage,
        setCurrentPage,
        searchQuery,
        setSearchQuery: handleSearchChange,
        totalCount,
        totalPages,
        limit,
        viewOrderDetails,
        handleApprove,
        handleReject,
        refreshData
    };
}
