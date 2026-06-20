export interface StoreType {
    id: number;
    store_type: string;
}

export interface Customer {
    id: number | string;
    customer_code: string;
    customer_name: string;
    customer_tin?: string;
    contact_number?: string;
    customer_email?: string;
    store_name?: string;
    store_type_id?: number | string | { id: number | string; store_type: string };
    brgy?: string;
    city?: string;
    province?: string;
    isActive?: number | boolean;
    created_at?: string;
    latitude?: number | null;
    longitude?: number | null;
}
