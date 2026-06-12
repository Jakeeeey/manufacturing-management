import { 
    Product, 
    Brand, 
    Category, 
    Unit, 
    ProductVersion, 
    BOMItem, 
    RoutingStep,
    ProductOverhead,
    BFFCatalogProduct
} from "../types";

/**
 * Client-side services for Finished Goods interacting with the Next.js API BFF.
 */

export async function fetchProducts(search?: string, limit: number = 100): Promise<Product[]> {
    const query = new URLSearchParams();
    if (search) query.append("search", search);
    query.append("limit", String(limit));

    const res = await fetch(`/api/manufacturing/finished-goods/products?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch products from BFF");
    const data = await res.json();
    
    // Map Directus model to local Product interface
    return data.map((p: BFFCatalogProduct) => ({
        id: String(p.product_id),
        sku: p.product_code || `SKU-${p.product_id}`,
        title: p.product_name,
        description: p.description || "",
        barcode: p.barcode || "",
        baseUom: p.unit_of_measurement?.unit_shortcut || "PCS",
        expectedYieldPercent: 100,
        targetSellingPrice: Number(p.price_per_unit || 0),
        parentProduct: p.parent_id === null,
        bom: [],
        routings: [],
        densityFactor: p.density_factor ? Number(p.density_factor) : 1.0,
        product_brand: p.product_brand ? Number(p.product_brand) : undefined,
        product_category: p.product_category ? Number(p.product_category) : undefined
    }));
}

export async function fetchBrands(): Promise<Brand[]> {
    const res = await fetch("/api/manufacturing/finished-goods/brands");
    if (!res.ok) throw new Error("Failed to fetch brands from BFF");
    return res.json();
}

export async function fetchCategories(): Promise<Category[]> {
    const res = await fetch("/api/manufacturing/finished-goods/categories");
    if (!res.ok) throw new Error("Failed to fetch categories from BFF");
    return res.json();
}

export async function fetchUnits(): Promise<Unit[]> {
    const res = await fetch("/api/manufacturing/finished-goods/units");
    if (!res.ok) throw new Error("Failed to fetch units from BFF");
    return res.json();
}

export async function fetchVersions(productId: number): Promise<ProductVersion[]> {
    const res = await fetch(`/api/manufacturing/finished-goods/versions?productId=${productId}`);
    if (!res.ok) throw new Error("Failed to fetch versions from BFF");
    return res.json();
}

export async function fetchBOMDetails(productId: number, versionId: number, forexRate?: number): Promise<{
    bomId: number;
    expectedYieldPercent: number;
    version: string;
    versionId: number;
    ingredients: BOMItem[];
    routings: RoutingStep[];
    customOverhead?: number;
    overheads?: ProductOverhead[];
} | null> {
    const query = new URLSearchParams({
        productId: String(productId),
        versionId: String(versionId)
    });
    if (forexRate) {
        query.append("forexRate", String(forexRate));
    }
    const res = await fetch(`/api/manufacturing/finished-goods/bom-details?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch BOM details from BFF");
    return res.json();
}


export async function saveBOMDetails(
    productId: number,
    bomId: number,
    details: {
        title: string;
        sku: string;
        barcode: string;
        baseUom: string;
        expectedYieldPercent: number;
        targetSellingPrice: number;
        densityFactor: number;
        productBrand?: number;
        productCategory?: number;
        customOverhead?: number;
    },
    ingredients: BOMItem[],
    routings: RoutingStep[],
    overheads?: ProductOverhead[]
): Promise<{ success: boolean; rollup?: unknown }> {
    const res = await fetch("/api/manufacturing/finished-goods/bom-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, bomId, details, ingredients, routings, overheads })
    });
    if (!res.ok) throw new Error("Failed to save BOM details via BFF");
    return res.json();
}

export async function registerProduct(
    productDetails: {
        product_name: string;
        product_code: string;
        barcode?: string;
        price_per_unit?: number;
        density_factor?: number;
        unit_of_measurement?: number;
        product_brand?: number;
        product_category?: number;
    },
    versionName: string
): Promise<{ success: boolean; productId: number; bom: unknown }> {
    const res = await fetch("/api/manufacturing/finished-goods/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productDetails, versionName })
    });
    if (!res.ok) throw new Error("Failed to register product via BFF");
    return res.json();
}

export async function registerNewVersion(
    productId: number,
    baseBomId: number | null,
    expectedYield: number,
    bomName: string,
    versionName: string
): Promise<{ success: boolean; bom: unknown }> {
    const res = await fetch("/api/manufacturing/finished-goods/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, baseBomId, expectedYield, bomName, versionName })
    });
    if (!res.ok) throw new Error("Failed to register version via BFF");
    return res.json();
}

export async function createBrand(brandName: string): Promise<{ success: boolean; brand: Brand }> {
    const res = await fetch("/api/manufacturing/finished-goods/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: brandName })
    });
    if (!res.ok) throw new Error("Failed to create brand via BFF");
    return res.json();
}

export async function createCategory(categoryName: string): Promise<{ success: boolean; category: Category }> {
    const res = await fetch("/api/manufacturing/finished-goods/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_name: categoryName })
    });
    if (!res.ok) throw new Error("Failed to create category via BFF");
    return res.json();
}
