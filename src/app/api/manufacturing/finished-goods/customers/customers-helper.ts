import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function fetchCustomers(search?: string, includeInactive = false): Promise<unknown[]> {
    try {
        let url = `${DIRECTUS_URL}/items/customer?limit=250&sort=customer_name`;
        if (!includeInactive) {
            url += `&filter[isActive][_eq]=true`;
        }
        if (search && search.trim()) {
            url += `&search=${encodeURIComponent(search.trim())}`;
        }
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch customers:", e);
        return [];
    }
}

export async function createCustomer(payload: {
    customer_code: string;
    customer_name: string;
    encoder_id: number;
    customer_tin?: string;
    contact_number?: string;
    customer_email?: string;
    store_name?: string;
    brgy?: string;
    city?: string;
    province?: string;
    isActive?: number;
    latitude?: number | null;
    longitude?: number | null;
}): Promise<unknown> {
    try {
        const url = `${DIRECTUS_URL}/items/customer`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...payload,
                isActive: payload.isActive !== undefined ? payload.isActive : 1
            })
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const errMsg = body.errors?.[0]?.message || `Directus failed: ${res.status}`;
            throw new Error(errMsg);
        }
        const json = await res.json();
        return json.data;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to create customer:", e);
        throw e;
    }
}

export async function updateCustomer(id: number | string, payload: Partial<{
    customer_code: string;
    customer_name: string;
    customer_tin?: string;
    contact_number?: string;
    customer_email?: string;
    store_name?: string;
    brgy?: string;
    city?: string;
    province?: string;
    isActive?: number;
    latitude?: number | null;
    longitude?: number | null;
}>): Promise<unknown> {
    try {
        const url = `${DIRECTUS_URL}/items/customer/${id}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const errMsg = body.errors?.[0]?.message || `Directus failed: ${res.status}`;
            throw new Error(errMsg);
        }
        const json = await res.json();
        return json.data;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to update customer:", e);
        throw e;
    }
}

export async function deleteCustomer(id: number | string): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/customer/${id}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ isActive: 0 })
        });
        return res.ok;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to soft-delete customer:", e);
        return false;
    }
}


