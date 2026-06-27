// Philippine Standard Geographic Code (PSGC) API Service
// Client-side helper to dynamically pull Philippine regions, provinces, cities, and barangays in real-time.

export interface PSGCItem {
    code: string;
    name: string;
}

export async function fetchPHProvinces(): Promise<PSGCItem[]> {
    try {
        const res = await fetch("https://psgc.gitlab.io/api/provinces/", { cache: "force-cache" });
        if (!res.ok) throw new Error("Failed to fetch provinces");
        const data = await res.json();
        
        // Ensure data is array and map properly
        const list = Array.isArray(data) ? data : [];
        return list.map((item: any) => ({
            code: item.code,
            name: item.name
        })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error("[PSGC API] Error loading provinces:", e);
        return [];
    }
}

export async function fetchPHCities(provinceCode: string): Promise<PSGCItem[]> {
    if (!provinceCode) return [];
    try {
        const res = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`, { cache: "force-cache" });
        if (!res.ok) throw new Error("Failed to fetch cities");
        const data = await res.json();
        
        const list = Array.isArray(data) ? data : [];
        return list.map((item: any) => ({
            code: item.code,
            name: item.name
        })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error(`[PSGC API] Error loading cities for province ${provinceCode}:`, e);
        return [];
    }
}

export async function fetchPHBarangays(cityCode: string): Promise<PSGCItem[]> {
    if (!cityCode) return [];
    try {
        const res = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays/`, { cache: "force-cache" });
        if (!res.ok) throw new Error("Failed to fetch barangays");
        const data = await res.json();
        
        const list = Array.isArray(data) ? data : [];
        return list.map((item: any) => ({
            code: item.code,
            name: item.name
        })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error(`[PSGC API] Error loading barangays for city ${cityCode}:`, e);
        return [];
    }
}
