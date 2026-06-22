import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function fetchQuotationSnapshots(quoteId: number): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/quotation_snapshots?filter[quotation_id][_eq]=${quoteId}&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch quotation snapshots:", e);
        return [];
    }
}


