import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";
import { 
    DirectusSupplier, 
    DirectusProductPerSupplier 
} from "@/types/manufacturing";

export async function fetchSuppliers(): Promise<DirectusSupplier[]> {
    try {
        const res = await fetch(`${DIRECTUS_URL}/items/suppliers?filter[isActive][_eq]=true&sort=supplier_name&limit=-1`, { headers, cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch suppliers");
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        console.error("[Manufacturing Directus API] Error fetching suppliers:", e);
        return [];
    }
}

export async function createSupplier(supplierData: Record<string, unknown>): Promise<unknown> {
    try {
        const url = `${DIRECTUS_URL}/items/suppliers`;
        
        // Populate database-required fields that aren't exposed in the UI form
        const payload = {
            supplier_type: "TRADE",
            date_added: new Date().toISOString().split('T')[0],
            ...supplierData,
            isActive: 1
        };

        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            let errorMsg = `Failed to create supplier: ${res.status}`;
            try {
                const errorJson = await res.json();
                if (errorJson.errors && errorJson.errors[0]?.message) {
                    errorMsg = errorJson.errors[0].message;
                }
            } catch {}
            throw new Error(errorMsg);
        }
        return (await res.json()).data;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to create supplier:", e);
        throw e;
    }
}
export async function updateSupplier(supplierId: number, supplierData: Record<string, unknown>): Promise<unknown> {
    try {
        const url = `${DIRECTUS_URL}/items/suppliers/${supplierId}`;
        const res = await fetch(url, {
            method: "PATCH",
            headers,
            body: JSON.stringify(supplierData)
        });
        if (!res.ok) {
            let errorMsg = `Failed to update supplier: ${res.status}`;
            try {
                const errorJson = await res.json();
                if (errorJson.errors && errorJson.errors[0]?.message) {
                    errorMsg = errorJson.errors[0].message;
                }
            } catch {}
            throw new Error(errorMsg);
        }
        return (await res.json()).data;
    } catch (e) {
        console.error("[Manufacturing Directus API] Failed to update supplier:", e);
        throw e;
    }
}


export async function fetchProductsBySupplier(supplierId: number): Promise<DirectusProductPerSupplier[]> {
    try {
        const url = `${DIRECTUS_URL}/items/product_per_supplier?filter[supplier_id][_eq]=${supplierId}&fields=id,supplier_id,product_id.*,product_id.unit_of_measurement.*&limit=-1`;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch products for supplier");
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        console.error("[Manufacturing Directus API] Error fetching products for supplier:", e);
        return [];
    }
}


