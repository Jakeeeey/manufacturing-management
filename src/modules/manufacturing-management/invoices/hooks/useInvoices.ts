// src/modules/manufacturing-management/invoices/hooks/useInvoices.ts

import { useState, useEffect, useCallback } from "react";
import { Invoice, InvoiceLineItem, PrinterAlignmentSettings } from "../types";
import { 
    fetchInvoices, 
    updateInvoiceStatus
} from "../services/invoices-api";
import { toast } from "sonner";

const ALIGNMENT_STORAGE_KEY = "vos_invoice_print_alignment";

const defaultAlignmentSettings: PrinterAlignmentSettings = {
    topMargin: 15,
    leftMargin: 15,
    lineHeight: 6,
    fontSize: 10,
    offsets: {
        invoiceDate: { x: 140, y: 15 },
        invoiceNo: { x: 140, y: 22 },
        customerName: { x: 25, y: 30 },
        customerAddress: { x: 25, y: 37 },
        customerTin: { x: 25, y: 44 },
        terms: { x: 140, y: 44 },
        tableStart: { y: 58 },
        colQty: { x: 15 },
        colUnit: { x: 30 },
        colDescription: { x: 50 },
        colUnitPrice: { x: 130 },
        colAmount: { x: 160 },
        totalAmount: { x: 160, y: 115 }
    }
};

export function useInvoices() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [detailsMap, setDetailsMap] = useState<Record<number, InvoiceLineItem[]>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [loadingDetails, setLoadingDetails] = useState<Record<number, boolean>>({});
    
    // Printer Alignment Settings
    const [alignment, setAlignment] = useState<PrinterAlignmentSettings>(defaultAlignmentSettings);

    // Load alignment settings from LocalStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(ALIGNMENT_STORAGE_KEY);
            if (saved) {
                try {
                    setAlignment(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse saved print alignments:", e);
                }
            }
        }
    }, []);

    // Save alignment settings
    const saveAlignmentSettings = (newSettings: PrinterAlignmentSettings) => {
        setAlignment(newSettings);
        if (typeof window !== "undefined") {
            localStorage.setItem(ALIGNMENT_STORAGE_KEY, JSON.stringify(newSettings));
            toast.success("Printer alignment calibration saved!");
        }
    };

    const resetAlignmentSettings = () => {
        saveAlignmentSettings(defaultAlignmentSettings);
    };

    // Fetch individual invoice details on demand
    const loadInvoiceDetails = useCallback(async (invoiceId: number) => {
        if (detailsMap[invoiceId] && detailsMap[invoiceId].length > 0) return;

        setLoadingDetails(prev => ({ ...prev, [invoiceId]: true }));
        try {
            const res = await fetch(`/api/manufacturing/sales-invoice?invoiceId=${invoiceId}`);
            if (res.ok) {
                const data = await res.json();
                setDetailsMap(prev => ({
                    ...prev,
                    [invoiceId]: data.details || []
                }));
            } else {
                toast.error("Failed to load invoice item details");
            }
        } catch (err) {
            console.error("Error loading invoice details:", err);
        } finally {
            setLoadingDetails(prev => ({ ...prev, [invoiceId]: false }));
        }
    }, [detailsMap]);

    // Load invoice registry
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const invoicesResult = await fetchInvoices();
            setInvoices(invoicesResult.data || []);
            setDetailsMap(invoicesResult.detailsMap || {});

        } catch (e) {
            const error = e as Error;
            console.error("Error loading invoices data:", e);
            toast.error(error.message || "Failed to load invoices");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Record invoice payment
    const handleRecordPayment = async (invoiceId: number, currentStatus: string, amount: number, paymentRef: string, paymentMethod: string) => {
        setSubmitting(true);
        try {
            await updateInvoiceStatus(invoiceId, undefined, undefined, {
                amount,
                method: paymentMethod,
                reference: paymentRef
            });
            toast.success("Payment successfully recorded!");
            await loadData();
            return true;
        } catch (e) {
            const error = e as Error;
            console.error("Error recording payment:", e);
            toast.error(error.message || "Failed to record payment");
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    // Cancel invoice
    const handleCancelInvoice = async (invoiceId: number) => {
        setSubmitting(true);
        try {
            await updateInvoiceStatus(invoiceId, "Cancelled", "Invoice cancelled by user.");
            toast.success("Invoice cancelled successfully!");
            await loadData();
            return true;
        } catch (e) {
            const error = e as Error;
            console.error("Error cancelling invoice:", e);
            toast.error(error.message || "Failed to cancel invoice");
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    return {
        invoices,
        detailsMap,
        loading,
        submitting,
        loadingDetails,
        loadInvoiceDetails,
        alignment,
        saveAlignmentSettings,
        resetAlignmentSettings,
        handleRecordPayment,
        handleCancelInvoice,
        refresh: loadData
    };
}
