import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

export async function fetchDensityFactors(): Promise<unknown[]> {
    try {
        const url = `${DIRECTUS_URL}/items/density_factors?limit=-1&sort=name&filter[isActive][_neq]=false`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) return [];
        return (await res.json()).data || [];
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to fetch density factors:", e);
        return [];
    }
}

export async function createDensityFactor(payload: {
    name: string;
    density: number;
    description?: string;
    is_system?: boolean;
}): Promise<unknown> {
    try {
        const url = `${DIRECTUS_URL}/items/density_factors`;
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                ...payload,
                is_system: !!payload.is_system,
                isActive: true
            })
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const errMsg = body.errors?.[0]?.message || `Directus failed: ${res.status}`;
            throw new Error(errMsg);
        }
        return (await res.json()).data;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to create density factor:", e);
        throw e;
    }
}

export async function deleteDensityFactor(id: number | string): Promise<boolean> {
    try {
        const url = `${DIRECTUS_URL}/items/density_factors/${id}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ isActive: false })
        });
        return res.ok;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to delete density factor:", e);
        return false;
    }
}


