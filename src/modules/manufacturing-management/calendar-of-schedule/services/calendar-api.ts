import { IncomingShipment } from "../types";

async function handleResponse(res: Response, fallbackMessage: string) {
    if (!res.ok) {
        let errMsg = fallbackMessage;
        try {
            const data = await res.json();
            if (data && data.error) errMsg = data.error;
        } catch {}
        throw new Error(errMsg);
    }
    return res.json();
}

export async function fetchShipments(): Promise<IncomingShipment[]> {
    const res = await fetch("/api/manufacturing/procurement/shipments");
    return handleResponse(res, "Failed to load shipments");
}
