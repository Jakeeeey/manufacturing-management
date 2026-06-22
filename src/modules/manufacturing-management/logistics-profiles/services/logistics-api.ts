import { Vehicle, Route } from "../types";

export async function fetchLogisticsProfiles(): Promise<{ vehicles: Vehicle[]; routes: Route[] }> {
    try {
        const res = await fetch("/api/manufacturing/logistics-profiles", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch logistics profiles from server");
        return await res.json();
    } catch (e) {
        console.error("[Logistics API Service] Error fetching profiles:", e);
        return { vehicles: [], routes: [] };
    }
}

export async function saveLogisticsProfile(type: "vehicle" | "route", data: Vehicle | Route): Promise<boolean> {
    try {
        const res = await fetch("/api/manufacturing/logistics-profiles", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ type, data })
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Server responded with ${res.status}`);
        }
        return true;
    } catch (e) {
        console.error(`[Logistics API Service] Error saving ${type} profile:`, e);
        throw e;
    }
}

export async function deleteLogisticsProfile(type: "vehicle" | "route", id: number): Promise<boolean> {
    try {
        const res = await fetch(`/api/manufacturing/logistics-profiles?type=${type}&id=${id}`, {
            method: "DELETE"
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Server responded with ${res.status}`);
        }
        return true;
    } catch (e) {
        console.error(`[Logistics API Service] Error deleting ${type} profile with ID ${id}:`, e);
        throw e;
    }
}
