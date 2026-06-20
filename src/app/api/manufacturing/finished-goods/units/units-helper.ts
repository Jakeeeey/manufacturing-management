import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { DirectusUnit } from "@/types/manufacturing";

export async function fetchAllUnits(): Promise<DirectusUnit[]> {
    try {
        const res = await fetch(`${DIRECTUS_URL}/items/units?limit=-1`, { headers, next: { revalidate: 60 } });
        if (!res.ok) throw new Error(`Directus failed to fetch units: ${res.status}`);
        const json = await res.json();
        return json.data || [];
    } catch (error) {
        console.error("[Manufacturing Directus API] Error fetching units:", error);
        return [];
    }
}


