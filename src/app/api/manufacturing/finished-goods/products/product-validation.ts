export type ProductEditValidationFields = Record<string, string>;

export class ProductEditValidationError extends Error {
    constructor(public readonly fields: ProductEditValidationFields) {
        super("Please complete the required product fields.");
        this.name = "ProductEditValidationError";
    }

    readonly status = 400;
    readonly code = "PRODUCT_REQUIRED_FIELDS";
}

export interface ValidatedProductEditDetails {
    title: string;
    sku: string;
    productBrand: number;
    productCategory: number;
    unitOfMeasurement: number;
    unitOfMeasurementCount: number;
    densityFactor: number;
    expectedYield: number;
    productShelfLife: number;
    productionCapacityPerHour: number;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null;
}

function readText(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function readPositiveId(value: unknown): number | null {
    const parsed = readNumber(value);
    return parsed !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validateProductEditDetails(input: unknown): ValidatedProductEditDetails {
    const fields: ProductEditValidationFields = {};
    const details = isRecord(input) ? input : {};

    const title = readText(details.title);
    if (!title) fields.title = "Product Title is required.";

    const sku = readText(details.sku);
    if (!sku) fields.sku = "SKU / Code is required.";

    const productBrand = readPositiveId(details.productBrand);
    if (productBrand === null) fields.productBrand = "Brand is required.";

    const productCategory = readPositiveId(details.productCategory);
    if (productCategory === null) fields.productCategory = "Category is required.";

    const unitOfMeasurement = readPositiveId(details.unit_of_measurement);
    if (unitOfMeasurement === null) fields.unit_of_measurement = "Base UOM is required.";

    const unitOfMeasurementCount = readNumber(details.unitOfMeasurementCount);
    if (unitOfMeasurementCount === null || unitOfMeasurementCount <= 0) {
        fields.unitOfMeasurementCount = "UOM Count must be greater than 0.";
    }

    const densityFactor = readNumber(details.densityFactor);
    if (densityFactor === null || densityFactor <= 0) {
        fields.densityFactor = "Density Factor must be greater than 0.";
    }

    const expectedYield = readNumber(details.expected_yield_percentage ?? details.expectedYieldPercent);
    if (expectedYield === null || expectedYield <= 0 || expectedYield > 100) {
        fields.expected_yield_percentage = "Expected Yield must be between 1 and 100.";
    }

    const productShelfLife = readNumber(details.productShelfLife);
    if (productShelfLife === null || productShelfLife <= 0) {
        fields.productShelfLife = "Shelf Life must be greater than 0.";
    }

    const productionCapacityPerHour = readNumber(details.productionCapacityPerHour);
    if (productionCapacityPerHour === null || productionCapacityPerHour <= 0) {
        fields.productionCapacityPerHour = "Capacity must be greater than 0.";
    }

    if (Object.keys(fields).length > 0) {
        throw new ProductEditValidationError(fields);
    }

    return {
        title,
        sku,
        productBrand: productBrand as number,
        productCategory: productCategory as number,
        unitOfMeasurement: unitOfMeasurement as number,
        unitOfMeasurementCount: unitOfMeasurementCount as number,
        densityFactor: densityFactor as number,
        expectedYield: expectedYield as number,
        productShelfLife: productShelfLife as number,
        productionCapacityPerHour: productionCapacityPerHour as number
    };
}
