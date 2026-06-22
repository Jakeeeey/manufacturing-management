import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function fetchPaymentTerms(): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/payment_terms?limit=-1&sort=payment_name`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch payment terms:", e);
        return [];
    }
}


