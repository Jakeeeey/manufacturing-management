import { useState, useEffect, useRef } from "react";
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
    const [selectedOrder, setSelectedOrderState] = useState<SalesOrder | null>(null);
    const [orderDetails, setOrderDetails] = useState<SalesOrderDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

    // Pagination and search states
    const [currentPage, setCurrentPage] = useState(1);
    const [limit] = useState(10);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("For Approval");
    const [customerCodeFilter, setCustomerCodeFilter] = useState("");
    const [dateFromFilter, setDateFromFilter] = useState("");
    const [dateToFilter, setDateToFilter] = useState("");
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const listAbortRef = useRef<AbortController | null>(null);
    const detailAbortRef = useRef<AbortController | null>(null);
    const listRequestIdRef = useRef(0);
    const detailRequestIdRef = useRef(0);
    const selectedOrderIdRef = useRef<number | null>(null);

    const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

    const setSelectedOrder = (order: SalesOrder | null) => {
        detailAbortRef.current?.abort();
        detailAbortRef.current = null;
        detailRequestIdRef.current += 1;
        selectedOrderIdRef.current = order?.order_id ?? null;
        setSelectedOrderState(order);

        if (!order) {
            setOrderDetails([]);
            setLoadingDetails(false);
        }
    };

    const loadPendingOrders = async (
        page = currentPage, 
        search = searchQuery, 
        status = statusFilter, 
        customer = customerCodeFilter, 
        dateFrom = dateFromFilter, 
        dateTo = dateToFilter
    ) => {
        listAbortRef.current?.abort();
        const controller = new AbortController();
        const requestId = ++listRequestIdRef.current;
        listAbortRef.current = controller;
        setLoading(true);
        try {
            const res = await fetchSalesOrders({
                page,
                limit,
                search,
                status,
                customerCode: customer,
                dateFrom,
                dateTo
            }, {
                signal: controller.signal
            });
            if (requestId !== listRequestIdRef.current) return;
            setSalesOrders(res.data);
            setTotalCount(res.meta.totalCount);
            setTotalPages(res.meta.totalPages);
            setCurrentPage(res.meta.page);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (!isAbortError(e) && requestId === listRequestIdRef.current) {
                toast.error(e.message || "Failed to load approval queue");
            }
        } finally {
            if (requestId === listRequestIdRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        loadPendingOrders(currentPage, searchQuery, statusFilter, customerCodeFilter, dateFromFilter, dateToFilter);
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, searchQuery, statusFilter, customerCodeFilter, dateFromFilter, dateToFilter]);

    useEffect(() => () => {
        listRequestIdRef.current += 1;
        detailRequestIdRef.current += 1;
        listAbortRef.current?.abort();
        detailAbortRef.current?.abort();
    }, []);

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        setCurrentPage(1);
    };

    const viewOrderDetails = async (order: SalesOrder) => {
        setSelectedOrder(order);
        detailAbortRef.current?.abort();
        const controller = new AbortController();
        const requestId = ++detailRequestIdRef.current;
        detailAbortRef.current = controller;
        setLoadingDetails(true);
        try {
            const data = await fetchSalesOrderDetails(order.order_id, { signal: controller.signal });
            if (requestId !== detailRequestIdRef.current || selectedOrderIdRef.current !== order.order_id) return;
            setOrderDetails(data);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (!isAbortError(e) && requestId === detailRequestIdRef.current) {
                toast.error(e.message || "Failed to load order details");
            }
        } finally {
            if (requestId === detailRequestIdRef.current) {
                setLoadingDetails(false);
            }
        }
    };

    const handleApprove = async (orderId: number) => {
        setUpdatingStatusId(orderId);
        try {
            await approveSalesOrder(orderId);
            toast.success("Sales Order approved! Released to production floor.");
            loadPendingOrders(currentPage, searchQuery, statusFilter, customerCodeFilter, dateFromFilter, dateToFilter);
            if (selectedOrder && selectedOrder.order_id === orderId) {
                setSelectedOrder(null);
            }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            loadPendingOrders(currentPage, searchQuery, statusFilter, customerCodeFilter, dateFromFilter, dateToFilter);
            if (selectedOrder && selectedOrder.order_id === orderId) {
                setSelectedOrder(null);
            }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            toast.error(e.message || "Rejection failed");
        } finally {
            setUpdatingStatusId(null);
        }
    };

    const refreshData = () => {
        loadPendingOrders(currentPage, searchQuery, statusFilter, customerCodeFilter, dateFromFilter, dateToFilter);
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
        statusFilter,
        setStatusFilter,
        customerCodeFilter,
        setCustomerCodeFilter,
        dateFromFilter,
        setDateFromFilter,
        dateToFilter,
        setDateToFilter,
        totalCount,
        totalPages,
        limit,
        viewOrderDetails,
        handleApprove,
        handleReject,
        refreshData
    };
}
