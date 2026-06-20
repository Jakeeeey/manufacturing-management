import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function fetchAllOverheadTypes(): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/overhead_types?limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed fetching overhead types:", e);
        return [];
    }
}

export async function createOverheadType(name: string): Promise<unknown> {
    try {
        const url = `${DIRECTUS_URL}/items/overhead_types`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ overhead_name: name })
        });
        if (!res.ok) return null;
        return (await res.json()).data;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to create overhead type:", e);
        return null;
    }
}


