// src/modules/manufacturing-management/sales-return/hooks/useSalesReturn.ts

import { useState, useEffect, useCallback } from "react";
import { SalesReturn, SalesReturnDetail, PendingInvoiceForReturn, InvoiceDetailItem } from "../types";
import { 
    fetchSalesReturns, 
    fetchSalesReturnDetails, 
    createSalesReturn, 
    fetchInvoicesForReturn 
} from "../services/sales-return-api";
import { toast } from "sonner";

export function useSalesReturn() {
    const [returns, setReturns] = useState<SalesReturn[]>([]);
    const [detailsMap, setDetailsMap] = useState<Record<string, SalesReturnDetail[]>>({});
    
    // Pending Invoices
    const [invoices, setInvoices] = useState<PendingInvoiceForReturn[]>([]);
    const [invoicesDetailsMap, setInvoicesDetailsMap] = useState<Record<number, InvoiceDetailItem[]>>({});
    
    const [loading, setLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch returns
            const returnsList = await fetchSalesReturns();
            setReturns(returnsList || []);

            // Fetch invoices
            const invoicesResult = await fetchInvoicesForReturn();
            setInvoices(invoicesResult.data || []);
            setInvoicesDetailsMap(invoicesResult.detailsMap || {});

            // Batch load details for returns
            const detailPromises = (returnsList || []).map(async (ret) => {
                try {
                    const details = await fetchSalesReturnDetails(ret.return_number);
                    return { key: ret.return_number, data: details };
                } catch (err) {
                    console.error(`Error loading details for return ${ret.return_number}:`, err);
                    return { key: ret.return_number, data: [] };
                }
            });

            const resolvedDetails = await Promise.all(detailPromises);
            const map: Record<string, SalesReturnDetail[]> = {};
            resolvedDetails.forEach((item) => {
                map[item.key] = item.data;
            });
            setDetailsMap(map);
        } catch (e) {
            console.error("Error loading sales returns data:", e);
            toast.error((e as { message?: string }).message || "Failed to load customer returns data");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateReturn = async (payload: {
        invoice_id: number;
        return_number?: string;
        return_date: string;
        customer_id?: number | null;
        remarks?: string;
        branch_id?: number;
        items: { product_id: number; quantity: number; unit_price: number }[];
    }) => {
        setSubmitting(true);
        try {
            await createSalesReturn(payload);
            toast.success(`Sales Return successfully processed! Items returned to stock.`);
            await loadData();
            return true;
        } catch (e) {
            console.error("Error submitting sales return:", e);
            toast.error((e as { message?: string }).message || "Failed to submit sales return");
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    return {
        returns,
        detailsMap,
        invoices,
        invoicesDetailsMap,
        loading,
        submitting,
        handleCreateReturn,
        refresh: loadData
    };
}
