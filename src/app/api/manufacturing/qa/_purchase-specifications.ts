import { procurementDirectusFetch } from "../procurement/_directus";
import {
    type DirectusQaParameter,
    mapQaParameter,
    nullableNumber,
    nullableString,
    type ProductQaSpecification,
    type PurchaseQaParameter,
    PurchaseQaConfigurationError,
    requiredPositiveInteger,
    validateProductQaSpecification
} from "./_purchase-specification-domain";

export { PurchaseQaConfigurationError } from "./_purchase-specification-domain";

interface DirectusProductQaSpecification {
    spec_id?: unknown;
    product_id?: unknown;
    parameter_id?: unknown;
    target_min?: unknown;
    target_max?: unknown;
    expected_text?: unknown;
    is_critical?: unknown;
}

function responseRows<T>(body: unknown): T[] {
    if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data)) {
        throw new PurchaseQaConfigurationError(503, "QA master data returned an invalid response.");
    }
    return body.data as T[];
}

export async function fetchPurchaseQaParameters(): Promise<PurchaseQaParameter[]> {
    const params = new URLSearchParams({
        fields: "parameter_id,parameter_name,data_type,unit_of_measure,description",
        sort: "parameter_name",
        limit: "-1"
    });
    const response = await procurementDirectusFetch(`/items/purchase_order_qa_parameters?${params.toString()}`);
    if (!response.ok) {
        throw new PurchaseQaConfigurationError(503, "Unable to load QA parameters.");
    }
    return responseRows<DirectusQaParameter>(await response.json()).map(mapQaParameter);
}

export async function fetchProductQaSpecifications(productId: number): Promise<ProductQaSpecification[]> {
    const params = new URLSearchParams({
        "filter[product_id][_eq]": String(productId),
        fields: "spec_id,product_id,parameter_id,target_min,target_max,expected_text,is_critical",
        limit: "-1"
    });
    const response = await procurementDirectusFetch(`/items/product_qa_specs?${params.toString()}`);
    if (!response.ok) {
        console.error("Directus product QA specification read failed:", response.status, await response.text());
        throw new PurchaseQaConfigurationError(503, "Unable to load product QA specifications.");
    }
    const rows = responseRows<DirectusProductQaSpecification>(await response.json());
    if (rows.length === 0) return [];

    const parameterIds = [...new Set(rows.map(row => requiredPositiveInteger(row.parameter_id, "parameter ID")))];
    const parameterParams = new URLSearchParams({
        "filter[parameter_id][_in]": parameterIds.join(","),
        fields: "parameter_id,parameter_name,data_type,unit_of_measure,description",
        limit: String(parameterIds.length)
    });
    const parameterResponse = await procurementDirectusFetch(`/items/purchase_order_qa_parameters?${parameterParams.toString()}`);
    if (!parameterResponse.ok) {
        console.error("Directus purchase QA parameter read failed:", parameterResponse.status, await parameterResponse.text());
        throw new PurchaseQaConfigurationError(503, "Unable to load QA parameters for this product.");
    }
    const parameterById = new Map(
        responseRows<DirectusQaParameter>(await parameterResponse.json())
            .map(row => mapQaParameter(row))
            .map(parameter => [parameter.parameterId, parameter])
    );

    return rows.map(row => {
        const parameterId = requiredPositiveInteger(row.parameter_id, "parameter ID");
        const parameter = parameterById.get(parameterId);
        if (!parameter) {
            throw new PurchaseQaConfigurationError(422, "Product QA specification is missing its parameter.");
        }
        return validateProductQaSpecification({
            specId: requiredPositiveInteger(row.spec_id, "specification ID"),
            productId: requiredPositiveInteger(row.product_id, "product ID"),
            parameterId,
            targetMin: nullableNumber(row.target_min),
            targetMax: nullableNumber(row.target_max),
            expectedText: nullableString(row.expected_text),
            isCritical: row.is_critical,
            parameter
        });
    }).sort((left, right) => left.parameter.parameterName.localeCompare(right.parameter.parameterName));
}
