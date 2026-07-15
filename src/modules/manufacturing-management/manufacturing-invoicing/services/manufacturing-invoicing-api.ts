import type {
    Branch,
    InvoiceReservationActionResponse,
    InvoiceReservationResponse,
} from "../types";

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
    if (!refreshPromise) {
        refreshPromise = fetch("/api/auth/refresh", {
            method: "POST",
            cache: "no-store",
        })
            .then((response) => response.ok)
            .catch(() => false)
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

async function fetchWithSessionRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, init);
    if (response.status !== 401) return response;

    const refreshed = await refreshAccessToken();
    return refreshed ? fetch(input, init) : response;
}

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(body?.message || body?.error || fallbackMessage);
    }

    return body as T;
}

export async function fetchBranches(signal?: AbortSignal): Promise<Branch[]> {
    const response = await fetchWithSessionRetry("/api/manufacturing/branches", {
        cache: "no-store",
        signal,
    });
    return parseResponse<Branch[]>(response, "Failed to load branches");
}

export async function fetchInvoiceReservations(
    branchId: number,
    search: string,
    signal?: AbortSignal,
): Promise<InvoiceReservationResponse> {
    const query = new URLSearchParams({ branchId: String(branchId) });
    if (search.trim()) query.set("search", search.trim());

    const response = await fetchWithSessionRetry(
        `/api/manufacturing/invoicing?${query.toString()}`,
        { cache: "no-store", signal },
    );
    return parseResponse<InvoiceReservationResponse>(response, "Failed to load invoice reservations");
}

async function updateInvoiceReservation(
    action: "allocate" | "release",
    invoiceId: number,
): Promise<InvoiceReservationActionResponse> {
    const response = await fetchWithSessionRetry(`/api/manufacturing/invoicing/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
    });
    const result = await parseResponse<InvoiceReservationActionResponse | null>(
        response,
        action === "allocate" ? "Failed to allocate invoice inventory" : "Failed to release invoice reservations",
    );
    return result || {};
}

export function allocateInvoice(invoiceId: number) {
    return updateInvoiceReservation("allocate", invoiceId);
}

export function releaseInvoice(invoiceId: number) {
    return updateInvoiceReservation("release", invoiceId);
}
