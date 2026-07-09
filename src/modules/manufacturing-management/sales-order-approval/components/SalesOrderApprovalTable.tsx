import React, { useState, useEffect } from "react";
import { DollarSign, Eye, Check, X, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { SalesOrder } from "../../sales-order/types";

interface SalesOrderApprovalTableProps {
    salesOrders: SalesOrder[];
    updatingStatusId: number | null;
    viewOrderDetails: (so: SalesOrder) => void;
    handleApprove: (orderId: number) => void;
    handleReject: (orderId: number) => void;
    
    // Pagination & Filter props
    currentPage: number;
    setCurrentPage: (page: number) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    totalCount: number;
    totalPages: number;
    limit: number;
    
    // New Filter props
    statusFilter?: string;
    setStatusFilter?: (status: string) => void;
    customerCodeFilter?: string;
    setCustomerCodeFilter?: (code: string) => void;
    dateFromFilter?: string;
    setDateFromFilter?: (date: string) => void;
    dateToFilter?: string;
    setDateToFilter?: (date: string) => void;
}

export function SalesOrderApprovalTable({
    salesOrders,
    updatingStatusId,
    viewOrderDetails,
    handleApprove,
    handleReject,
    currentPage,
    setCurrentPage,
    searchQuery,
    setSearchQuery,
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    limit
}: SalesOrderApprovalTableProps) {
    const [localSearch, setLocalSearch] = useState(searchQuery);
    const [localCustomerSearch, setLocalCustomerSearch] = useState(customerCodeFilter || "");
    const [isCustomerFocused, setIsCustomerFocused] = useState(false);
    const [customersList, setCustomersList] = useState<{ id: number; customer_name: string; customer_code: string }[]>([]);

    useEffect(() => {
        fetch("/api/manufacturing/customer?limit=-1&fields=id,customer_name,customer_code")
            .then(res => res.ok ? res.json() : [])
            .then(data => setCustomersList(data.data || data))
            .catch(err => console.error(err));
    }, []);

    const filteredCustomers = customersList.filter(c => 
        c.customer_name.toLowerCase().includes(localCustomerSearch.toLowerCase()) ||
        c.customer_code.toLowerCase().includes(localCustomerSearch.toLowerCase())
    );

    useEffect(() => {
        setLocalSearch(searchQuery);
    }, [searchQuery]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(localSearch);
    };

    // O(1) dynamic page number list generator with ellipsis
    const getPageNumbers = () => {
        const pages: number[] = [];
        const maxVisible = 1; 
        
        pages.push(1);
        
        const start = Math.max(2, currentPage - maxVisible);
        const end = Math.min(totalPages - 1, currentPage + maxVisible);
        
        if (start > 2) {
            pages.push(-1); 
        }
        
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        if (end < totalPages - 1) {
            pages.push(-2); 
        }
        
        if (totalPages > 1) {
            pages.push(totalPages);
        }
        
        return pages;
    };

    return (
        <div className="space-y-4">
            {/* Filters Header */}
            <div className="flex flex-col gap-3 bg-card p-4 rounded-xl border shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full">
                    <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-xs flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search pending orders..."
                                value={localSearch}
                                onChange={(e) => {
                                    setLocalSearch(e.target.value);
                                    if (e.target.value === "") {
                                        setSearchQuery("");
                                    }
                                }}
                                className="w-full bg-background pl-9 pr-3 py-2 text-xs rounded-lg border border-input focus:ring-1 focus:ring-primary focus:border-primary outline-none text-foreground font-medium"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-3 py-2 rounded-lg text-xs transition-all shadow-xs"
                        >
                            Search
                        </button>
                    </form>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                        <div className="relative w-full sm:w-48">
                            <input
                                type="text"
                                placeholder="Filter Customer..."
                                value={localCustomerSearch}
                                onFocus={() => setIsCustomerFocused(true)}
                                onBlur={() => setTimeout(() => setIsCustomerFocused(false), 200)}
                                onChange={(e) => {
                                    setLocalCustomerSearch(e.target.value);
                                    if (e.target.value === "" && setCustomerCodeFilter) {
                                        setCustomerCodeFilter("");
                                    }
                                }}
                                className="w-full bg-background px-3 py-2 text-xs rounded-lg border border-input focus:ring-1 focus:ring-primary focus:border-primary outline-none text-foreground font-medium"
                            />
                            {isCustomerFocused && (
                                <div className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border bg-card shadow-xl divide-y">
                                    {filteredCustomers.map(c => (
                                        <button
                                            type="button"
                                            key={c.id}
                                            onClick={() => {
                                                setLocalCustomerSearch(c.customer_name);
                                                setIsCustomerFocused(false);
                                                if (setCustomerCodeFilter) setCustomerCodeFilter(c.customer_code);
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs hover:bg-primary hover:text-primary-foreground text-foreground transition-colors"
                                        >
                                            {c.customer_name} ({c.customer_code})
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <input
                            type="date"
                            value={dateFromFilter || ""}
                            onChange={(e) => setDateFromFilter && setDateFromFilter(e.target.value)}
                            title="Start Date"
                            className="bg-background border border-input rounded-lg px-2 py-2 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                        <span className="text-muted-foreground text-xs font-bold">-</span>
                        <input
                            type="date"
                            value={dateToFilter || ""}
                            onChange={(e) => setDateToFilter && setDateToFilter(e.target.value)}
                            title="End Date"
                            className="bg-background border border-input rounded-lg px-2 py-2 text-xs font-medium text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                        
                        <div className="flex items-center gap-1.5 ml-2">
                            <select
                                value={statusFilter || "For Approval"}
                                onChange={(e) => setStatusFilter && setStatusFilter(e.target.value)}
                                className="bg-background border border-input rounded-lg px-3 py-2 text-xs font-bold text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                            >
                                <option value="All">All Statuses</option>
                                <option value="For Approval">For Approval</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="text-xs text-muted-foreground font-bold bg-muted/30 px-3 py-2 rounded-lg border">
                    Queue: <span className="text-foreground">{totalCount} results</span>
                </div>
            </div>

            {salesOrders.length === 0 ? (
                <div className="text-center p-12 border rounded-xl bg-card shadow-sm">
                    <DollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-foreground">All Sales Orders Approved</h4>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        {searchQuery 
                            ? "No pending approval matches your search query." 
                            : "There are no sales orders currently waiting for approval."}
                    </p>
                    {searchQuery && (
                        <button
                            onClick={() => {
                                setLocalSearch("");
                                setSearchQuery("");
                            }}
                            className="mt-3 bg-muted border hover:bg-muted/80 text-foreground font-bold px-3 py-1.5 rounded-lg text-xs transition-all"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-hidden border rounded-xl bg-card shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead className="bg-muted/50 border-b">
                                <tr>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Order No.</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Customer</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Order Date</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase">Delivery Date</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Selling Total</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-right">Gross Total</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Status</th>
                                    <th className="p-3 font-semibold text-muted-foreground uppercase text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {salesOrders.map(so => (
                                    <tr key={so.order_id} className="hover:bg-muted/30 transition-colors">
                                        <td className="p-3 font-bold text-foreground">{so.order_no}</td>
                                        <td className="p-3 font-semibold text-foreground">
                                            {so.customer_name ? (
                                                <span>
                                                    {so.customer_name}{" "}
                                                    <span className="text-[10px] text-muted-foreground font-mono font-normal">({so.customer_code})</span>
                                                </span>
                                            ) : (
                                                so.customer_code
                                            )}
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {so.order_date ? new Date(so.order_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "N/A"}
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {so.delivery_date ? new Date(so.delivery_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "N/A"}
                                        </td>
                                        <td className="p-3 text-right font-bold text-primary">₱{(Number(so.net_amount) || 0).toFixed(2)}</td>
                                        <td className="p-3 text-right font-bold text-muted-foreground">₱{(Number(so.total_amount) || 0).toFixed(2)}</td>
                                        <td className="p-3 text-center">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 whitespace-nowrap">
                                                {so.order_status || "For Approval"}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => viewOrderDetails(so)}
                                                    className="inline-flex items-center justify-center p-1.5 rounded-md border bg-background hover:bg-muted text-muted-foreground transition-all"
                                                    title="Review details"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    disabled={updatingStatusId !== null}
                                                    onClick={() => handleApprove(so.order_id)}
                                                    className="inline-flex items-center justify-center p-1.5 rounded-md border border-emerald-200 hover:bg-emerald-50 text-emerald-600 dark:border-emerald-950 dark:hover:bg-emerald-950/20 transition-all disabled:opacity-50"
                                                    title="Approving the SO will lock this record for Master Schedule Planning."
                                                >
                                                    {updatingStatusId === so.order_id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                </button>
                                                <button
                                                    disabled={updatingStatusId !== null}
                                                    onClick={() => handleReject(so.order_id)}
                                                    className="inline-flex items-center justify-center p-1.5 rounded-md border border-rose-200 hover:bg-rose-50 text-rose-600 dark:border-rose-950 dark:hover:bg-rose-950/20 transition-all disabled:opacity-50"
                                                    title="Reject & Edit"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    {totalCount > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between border-t bg-muted/20 px-4 py-3 rounded-b-xl gap-2.5">
                            <span className="text-[11px] text-muted-foreground font-medium text-center sm:text-left">
                                Showing page <span className="font-bold text-foreground">{currentPage}</span> of <span className="font-bold text-foreground">{totalPages || 1}</span> ({totalCount} total results)
                            </span>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        className="inline-flex items-center justify-center p-1.5 rounded-md border bg-background hover:bg-muted text-muted-foreground disabled:opacity-40 disabled:hover:bg-background transition-all"
                                        title="Previous Page"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    
                                    {getPageNumbers().map((p, idx) => {
                                        if (p < 0) {
                                            return (
                                                <span key={`dots-${idx}`} className="text-muted-foreground px-1 text-xs select-none">
                                                    ...
                                                </span>
                                            );
                                        }
                                        return (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p)}
                                                className={`h-7 w-7 inline-flex items-center justify-center rounded-md text-xs font-bold transition-all border ${
                                                    currentPage === p
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-background hover:bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}

                                    <button
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                        className="inline-flex items-center justify-center p-1.5 rounded-md border bg-background hover:bg-muted text-muted-foreground disabled:opacity-40 disabled:hover:bg-background transition-all"
                                        title="Next Page"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
