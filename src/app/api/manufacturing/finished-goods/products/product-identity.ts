import { DIRECTUS_URL, headers } from "@/app/api/manufacturing/directus-api";

type DirectusIdentityProduct = {
    product_id: number;
    product_name: string;
    parent_id?: number | null;
    unit_of_measurement?: number | { unit_id?: number | string } | null;
};

type DirectusIdentityUnit = {
    unit_id: number;
    unit_name?: string | null;
    unit_shortcut?: string | null;
};

export class ProductIdentityError extends Error {
    constructor(
        message: string,
        public readonly status: 400 | 404 | 409 | 503 = 400,
        public readonly code?: string
    ) {
        super(message);
        this.name = "ProductIdentityError";
    }
}

export interface ProductIdentityInput {
    productName?: string | null;
    parentId?: number | string | null;
    unitId?: number | string | null;
    productId?: number;
}

export interface ProductIdentity {
    productName: string;
    parentId: number | null;
    unitId: number;
    descriptionKey: string;
}

function normalizeText(value: string | null | undefined): string {
    return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeProductSku(value: string | null | undefined): string {
    return String(value || "").trim();
}

function parseOptionalId(value: number | string | null | undefined, fieldName: string): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ProductIdentityError(`${fieldName} must be a valid identifier.`);
    }
    return parsed;
}

async function fetchCurrentProduct(productId: number): Promise<DirectusIdentityProduct> {
    const res = await fetch(
        `${DIRECTUS_URL}/items/products/${productId}?fields=product_id,product_name,parent_id,unit_of_measurement`,
        { headers, cache: "no-store" }
    );
    if (res.status === 404) {
        throw new ProductIdentityError("The product does not exist.", 404);
    }
    if (!res.ok) {
        throw new ProductIdentityError("Unable to load the current product identity.", 503);
    }
    const json = await res.json();
    if (!json.data) {
        throw new ProductIdentityError("The product does not exist.", 404);
    }
    return json.data as DirectusIdentityProduct;
}

async function fetchParentProduct(parentId: number): Promise<DirectusIdentityProduct> {
    const res = await fetch(
        `${DIRECTUS_URL}/items/products/${parentId}?fields=product_id,product_name,parent_id`,
        { headers, cache: "no-store" }
    );
    if (res.status === 404) {
        throw new ProductIdentityError("The selected parent product does not exist.", 400);
    }
    if (!res.ok) {
        throw new ProductIdentityError("Unable to validate the selected parent product.", 503);
    }
    const json = await res.json();
    if (!json.data) {
        throw new ProductIdentityError("The selected parent product does not exist.", 400);
    }
    const parent = json.data as DirectusIdentityProduct;
    if (parent.parent_id !== null && parent.parent_id !== undefined) {
        throw new ProductIdentityError("A child product cannot be used as a parent.");
    }
    return parent;
}

async function fetchUnit(unitId: number): Promise<DirectusIdentityUnit> {
    const res = await fetch(
        `${DIRECTUS_URL}/items/units/${unitId}?fields=unit_id,unit_name,unit_shortcut`,
        { headers, cache: "no-store" }
    );
    if (res.status === 404) {
        throw new ProductIdentityError("The selected unit of measurement does not exist.", 400);
    }
    if (!res.ok) {
        throw new ProductIdentityError("Unable to validate the selected unit of measurement.", 503);
    }
    const json = await res.json();
    if (!json.data) {
        throw new ProductIdentityError("The selected unit of measurement does not exist.", 400);
    }
    return json.data as DirectusIdentityUnit;
}

export async function resolveProductIdentity(input: ProductIdentityInput): Promise<ProductIdentity> {
    const currentProduct = input.productId ? await fetchCurrentProduct(input.productId) : null;
    const parentId = parseOptionalId(
        input.parentId !== undefined ? input.parentId : currentProduct?.parent_id,
        "parent_id"
    );
    const unitId = parseOptionalId(
        input.unitId !== undefined
            ? input.unitId
            : typeof currentProduct?.unit_of_measurement === "object"
                ? currentProduct.unit_of_measurement?.unit_id
                : currentProduct?.unit_of_measurement,
        "unit_of_measurement"
    );

    if (!unitId) {
        throw new ProductIdentityError("A valid unit of measurement is required.");
    }

    const parent = parentId ? await fetchParentProduct(parentId) : null;
    const productName = normalizeText(parent?.product_name || input.productName || currentProduct?.product_name);
    if (!productName) {
        throw new ProductIdentityError("A product name is required.");
    }

    const unit = await fetchUnit(unitId);
    const unitLabel = normalizeText(unit.unit_shortcut || unit.unit_name).toUpperCase();
    if (!unitLabel) {
        throw new ProductIdentityError("The selected unit of measurement has no usable identifier.");
    }

    return {
        productName,
        parentId,
        unitId,
        descriptionKey: `${productName} - ${unitLabel}`
    };
}

export async function ensureProductIdentityAvailable(
    descriptionKey: string,
    currentProductId?: number
): Promise<void> {
    const query = new URLSearchParams({
        "filter[description][_eq]": descriptionKey,
        fields: "product_id",
        limit: "10"
    });
    const res = await fetch(`${DIRECTUS_URL}/items/products?${query.toString()}`, {
        headers,
        cache: "no-store"
    });
    if (!res.ok) {
        throw new ProductIdentityError("Unable to verify whether the generated product identity is available.", 503);
    }
    const json = await res.json();
    const conflict = (json.data || []).find(
        (product: { product_id?: number | string }) => Number(product.product_id) !== Number(currentProductId)
    );
    if (conflict) {
        throw new ProductIdentityError(
            "A product with this parent product and unit of measurement already exists.",
            409,
            "PRODUCT_PARENT_UOM_CONFLICT"
        );
    }
}

export async function ensureProductSkuAvailable(
    productCode: string | null | undefined,
    currentProductId?: number
): Promise<string> {
    const normalizedSku = normalizeProductSku(productCode);
    if (!normalizedSku) {
        throw new ProductIdentityError(
            "A SKU / code is required.",
            400,
            "PRODUCT_SKU_REQUIRED"
        );
    }

    const query = new URLSearchParams({
        "filter[product_code][_eq]": normalizedSku,
        fields: "product_id",
        limit: "10"
    });
    const res = await fetch(`${DIRECTUS_URL}/items/products?${query.toString()}`, {
        headers,
        cache: "no-store"
    });
    if (!res.ok) {
        throw new ProductIdentityError("Unable to verify whether the SKU is available.", 503);
    }

    const json = await res.json();
    const currentId = currentProductId === undefined ? null : Number(currentProductId);
    const conflict = (json.data || []).find(
        (product: { product_id?: number | string }) => Number(product.product_id) !== currentId
    );
    if (conflict) {
        throw new ProductIdentityError(
            "A product with this SKU already exists. Please choose a unique SKU.",
            409,
            "PRODUCT_SKU_CONFLICT"
        );
    }

    return normalizedSku;
}
