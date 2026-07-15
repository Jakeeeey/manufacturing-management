export interface DirectusQaParameter {
    parameter_id?: unknown;
    parameter_name?: unknown;
    data_type?: unknown;
    unit_of_measure?: unknown;
    description?: unknown;
}

export type QaParameterDataType = "Numeric" | "Boolean" | "Text";

export interface PurchaseQaParameter {
    parameterId: number;
    parameterName: string;
    dataType: QaParameterDataType;
    unitOfMeasure: string | null;
    description: string | null;
}

interface ProductQaSpecificationBase {
    specId: number;
    productId: number;
    parameterId: number;
    isCritical: boolean;
}

export interface NumericQaSpecification extends ProductQaSpecificationBase {
    parameter: PurchaseQaParameter & { dataType: "Numeric" };
    targetMin: number | null;
    targetMax: number | null;
    expectedText: null;
}

export interface BooleanQaSpecification extends ProductQaSpecificationBase {
    parameter: PurchaseQaParameter & { dataType: "Boolean" };
    targetMin: null;
    targetMax: null;
    expectedText: "true" | "false";
}

export interface TextQaSpecification extends ProductQaSpecificationBase {
    parameter: PurchaseQaParameter & { dataType: "Text" };
    targetMin: null;
    targetMax: null;
    expectedText: string;
}

export type ProductQaSpecification = NumericQaSpecification | BooleanQaSpecification | TextQaSpecification;
export type QaReadingStatus = "passed" | "failed" | "incomplete";

export interface QaReadingEvaluation {
    status: QaReadingStatus;
    normalizedReading: string | null;
}

export interface ProductQaSpecificationInput {
    specId: number;
    productId: number;
    parameterId: number;
    isCritical: unknown;
    parameter: PurchaseQaParameter;
    targetMin: number | null;
    targetMax: number | null;
    expectedText: string | null;
}

export interface QaChecklistReading {
    specification: ProductQaSpecification;
    reading: unknown;
}

export interface QaChecklistItemEvaluation extends QaReadingEvaluation {
    specId: number;
    parameterName: string;
    isCritical: boolean;
}

export interface QaChecklistDecision {
    complete: boolean;
    hasCriticalFailure: boolean;
    hasNonCriticalFailure: boolean;
    forceRejected: boolean;
    requiredQaStatus: "Rejected" | null;
    failedCriticalSpecIds: number[];
    failedNonCriticalSpecIds: number[];
    rejectionReason: string | null;
    evaluations: QaChecklistItemEvaluation[];
}

export class PurchaseQaConfigurationError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export function requiredPositiveInteger(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new PurchaseQaConfigurationError(422, `QA configuration has an invalid ${field}.`);
    }
    return parsed;
}

export function nullableString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function nullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new PurchaseQaConfigurationError(422, "QA configuration has an invalid numeric target.");
    }
    return parsed;
}

export function parseQaParameterDataType(value: unknown): QaParameterDataType {
    if (value === "Numeric" || value === "Boolean" || value === "Text") return value;
    throw new PurchaseQaConfigurationError(422, "QA parameter has an unsupported data type.");
}

export function parseQaCriticalFlag(value: unknown): boolean {
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0") return false;
    throw new PurchaseQaConfigurationError(422, "QA specification has an invalid critical flag.");
}

function parseBoolean(value: unknown): boolean | null {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") return true;
    if (normalized === "false" || normalized === "no" || normalized === "0") return false;
    return null;
}

export function validateProductQaSpecification(input: ProductQaSpecificationInput): ProductQaSpecification {
    const base = {
        specId: input.specId,
        productId: input.productId,
        parameterId: input.parameterId,
        isCritical: parseQaCriticalFlag(input.isCritical)
    };

    if (input.parameter.dataType === "Numeric") {
        if (input.targetMin === null && input.targetMax === null) {
            throw new PurchaseQaConfigurationError(422, "Numeric QA specification requires at least one threshold.");
        }
        if (input.targetMin !== null && input.targetMax !== null && input.targetMin > input.targetMax) {
            throw new PurchaseQaConfigurationError(422, "Numeric QA specification minimum cannot exceed its maximum.");
        }
        return {
            ...base,
            parameter: { ...input.parameter, dataType: "Numeric" },
            targetMin: input.targetMin,
            targetMax: input.targetMax,
            expectedText: null
        };
    }

    if (input.parameter.dataType === "Boolean") {
        const expected = parseBoolean(input.expectedText);
        if (expected === null) {
            throw new PurchaseQaConfigurationError(422, "Boolean QA specification requires a valid expected value.");
        }
        return {
            ...base,
            parameter: { ...input.parameter, dataType: "Boolean" },
            targetMin: null,
            targetMax: null,
            expectedText: expected ? "true" : "false"
        };
    }

    const expectedText = nullableString(input.expectedText);
    if (!expectedText) {
        throw new PurchaseQaConfigurationError(422, "Text QA specification requires an expected value.");
    }
    return {
        ...base,
        parameter: { ...input.parameter, dataType: "Text" },
        targetMin: null,
        targetMax: null,
        expectedText
    };
}

export function evaluateQaReading(specification: ProductQaSpecification, reading: unknown): QaReadingEvaluation {
    if (specification.parameter.dataType === "Numeric") {
        if (reading === null || reading === undefined || (typeof reading === "string" && !reading.trim())) {
            return { status: "incomplete", normalizedReading: null };
        }
        const numericReading = Number(reading);
        if (!Number.isFinite(numericReading)) return { status: "incomplete", normalizedReading: null };
        const passed = (specification.targetMin === null || numericReading >= specification.targetMin)
            && (specification.targetMax === null || numericReading <= specification.targetMax);
        return { status: passed ? "passed" : "failed", normalizedReading: String(numericReading) };
    }

    if (specification.parameter.dataType === "Boolean") {
        const booleanReading = parseBoolean(reading);
        if (booleanReading === null) return { status: "incomplete", normalizedReading: null };
        const normalizedReading = booleanReading ? "true" : "false";
        return {
            status: normalizedReading === specification.expectedText ? "passed" : "failed",
            normalizedReading
        };
    }

    if (typeof reading !== "string" || !reading.trim()) {
        return { status: "incomplete", normalizedReading: null };
    }
    if (specification.expectedText === null) {
        throw new PurchaseQaConfigurationError(422, "Text QA specification requires an expected value.");
    }
    const normalizedReading = reading.trim();
    return {
        status: normalizedReading.toLowerCase() === specification.expectedText.toLowerCase() ? "passed" : "failed",
        normalizedReading
    };
}

export function evaluateQaChecklist(readings: QaChecklistReading[]): QaChecklistDecision {
    const evaluations = readings.map(({ specification, reading }) => ({
        specId: specification.specId,
        parameterName: specification.parameter.parameterName,
        isCritical: specification.isCritical,
        ...evaluateQaReading(specification, reading)
    }));
    const failedCritical = evaluations
        .filter(evaluation => evaluation.status === "failed" && evaluation.isCritical)
        .sort((left, right) => left.specId - right.specId);
    const failedNonCritical = evaluations
        .filter(evaluation => evaluation.status === "failed" && !evaluation.isCritical)
        .sort((left, right) => left.specId - right.specId);
    const hasCriticalFailure = failedCritical.length > 0;
    const failedCriticalNames = failedCritical
        .map(evaluation => evaluation.parameterName)
        .sort((left, right) => left.localeCompare(right));

    return {
        complete: evaluations.every(evaluation => evaluation.status !== "incomplete"),
        hasCriticalFailure,
        hasNonCriticalFailure: failedNonCritical.length > 0,
        forceRejected: hasCriticalFailure,
        requiredQaStatus: hasCriticalFailure ? "Rejected" : null,
        failedCriticalSpecIds: failedCritical.map(evaluation => evaluation.specId),
        failedNonCriticalSpecIds: failedNonCritical.map(evaluation => evaluation.specId),
        rejectionReason: hasCriticalFailure ? `Critical QA failure: ${failedCriticalNames.join(", ")}.` : null,
        evaluations
    };
}

export function mapQaParameter(row: DirectusQaParameter): PurchaseQaParameter {
    const parameterName = nullableString(row.parameter_name);
    if (!parameterName) {
        throw new PurchaseQaConfigurationError(422, "QA parameter configuration is incomplete.");
    }
    return {
        parameterId: requiredPositiveInteger(row.parameter_id, "parameter ID"),
        parameterName,
        dataType: parseQaParameterDataType(row.data_type),
        unitOfMeasure: nullableString(row.unit_of_measure),
        description: nullableString(row.description)
    };
}
