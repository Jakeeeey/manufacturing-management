"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    allocateInvoice,
    fetchBranches,
    fetchInvoiceReservations,
    releaseInvoice,
} from "../services/manufacturing-invoicing-api";
import type { Branch, InvoiceReservationStatus, InvoiceReservationSummary } from "../types";

export type ReservationStatusFilter = "All" | InvoiceReservationStatus;
export type ReservationAction = "allocate" | "release";

export function useManufacturingInvoicing() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [invoices, setInvoices] = useState<InvoiceReservationSummary[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<ReservationStatusFilter>("All");
    const [loadingBranches, setLoadingBranches] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [submitting, setSubmitting] = useState<{ invoiceId: number; action: ReservationAction } | null>(null);

    useEffect(() => {
        const timeout = window.setTimeout(() => setDebouncedSearch(search), 350);
        return () => window.clearTimeout(timeout);
    }, [search]);

    useEffect(() => {
        const controller = new AbortController();
        setLoadingBranches(true);
        fetchBranches(controller.signal)
            .then(setBranches)
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") return;
                setError(reason instanceof Error ? reason.message : "Failed to load branches");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingBranches(false);
            });

        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!selectedBranchId) {
            setInvoices([]);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError("");
        fetchInvoiceReservations(selectedBranchId, debouncedSearch, controller.signal)
            .then((response) => setInvoices(response.invoices || []))
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") return;
                setInvoices([]);
                setError(reason instanceof Error ? reason.message : "Failed to load invoice reservations");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [debouncedSearch, refreshKey, selectedBranchId]);

    const filteredInvoices = invoices.filter(
        (invoice) => statusFilter === "All" || invoice.status === statusFilter,
    );

    const summary = {
        All: invoices.length,
        Unallocated: invoices.filter((invoice) => invoice.status === "Unallocated").length,
        Partial: invoices.filter((invoice) => invoice.status === "Partial").length,
        Reserved: invoices.filter((invoice) => invoice.status === "Reserved").length,
    };

    function changeBranch(value: number | null) {
        setSelectedBranchId(value);
        setSearch("");
        setStatusFilter("All");
        setError("");
    }

    async function runAction(invoiceId: number, action: ReservationAction) {
        setSubmitting({ invoiceId, action });
        try {
            const result = action === "allocate"
                ? await allocateInvoice(invoiceId)
                : await releaseInvoice(invoiceId);
            toast.success(result.message || (action === "allocate"
                ? "Invoice inventory reserved successfully"
                : "Invoice reservations released successfully"));
            setRefreshKey((value) => value + 1);
        } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : "Reservation action failed");
        } finally {
            setSubmitting(null);
        }
    }

    return {
        branches,
        selectedBranchId,
        filteredInvoices,
        search,
        statusFilter,
        summary,
        loadingBranches,
        loading,
        error,
        submitting,
        setSearch,
        setStatusFilter,
        changeBranch,
        runAction,
        refresh: () => setRefreshKey((value) => value + 1),
    };
}
