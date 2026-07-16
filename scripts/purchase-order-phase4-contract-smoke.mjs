import assert from "node:assert/strict";
import fs from "node:fs";
import {
    evaluateQaChecklist,
    evaluateQaReading,
    mapQaParameter,
    parseQaCriticalFlag,
    parseQaParameterDataType,
    PurchaseQaConfigurationError,
    validateProductQaSpecification
} from "../src/app/api/manufacturing/qa/_purchase-specification-domain.ts";

assert.deepEqual(mapQaParameter({
    parameter_id: 7,
    parameter_name: "Moisture Content",
    data_type: "Numeric",
    unit_of_measure: "%",
    description: "Moisture reading"
}), {
    parameterId: 7,
    parameterName: "Moisture Content",
    dataType: "Numeric",
    unitOfMeasure: "%",
    description: "Moisture reading"
});
assert.throws(
    () => mapQaParameter({ parameter_id: 0, parameter_name: "Invalid", data_type: "Numeric" }),
    PurchaseQaConfigurationError
);
for (const criticalValue of [true, 1, "1"]) assert.equal(parseQaCriticalFlag(criticalValue), true);
for (const criticalValue of [false, 0, "0"]) assert.equal(parseQaCriticalFlag(criticalValue), false);
for (const invalidCriticalValue of [null, undefined, "", "true", "false", 2]) {
    assert.throws(() => parseQaCriticalFlag(invalidCriticalValue), PurchaseQaConfigurationError);
}
assert.equal(parseQaParameterDataType("Numeric"), "Numeric");
assert.equal(parseQaParameterDataType("Boolean"), "Boolean");
assert.equal(parseQaParameterDataType("Text"), "Text");
for (const invalidType of ["numeric", "boolean", "text", "Decimal", "", null, undefined]) {
    assert.throws(() => parseQaParameterDataType(invalidType), PurchaseQaConfigurationError);
}

for (const dataType of ["Boolean", "Text"]) {
    assert.equal(mapQaParameter({
        parameter_id: dataType === "Boolean" ? 8 : 9,
        parameter_name: `${dataType} check`,
        data_type: dataType
    }).dataType, dataType);
}

const parameter = (dataType) => mapQaParameter({
    parameter_id: dataType === "Numeric" ? 1 : dataType === "Boolean" ? 2 : 3,
    parameter_name: `${dataType} parameter`,
    data_type: dataType,
    unit_of_measure: dataType === "Numeric" ? "%" : null
});
const specification = (dataType, overrides = {}) => validateProductQaSpecification({
    specId: 1,
    productId: 10,
    parameterId: parameter(dataType).parameterId,
    parameter: parameter(dataType),
    targetMin: dataType === "Numeric" ? 5 : null,
    targetMax: dataType === "Numeric" ? 10 : null,
    expectedText: dataType === "Boolean" ? "Yes" : dataType === "Text" ? "Acceptable" : null,
    isCritical: false,
    ...overrides
});

const numeric = specification("Numeric");
assert.equal(evaluateQaReading(numeric, 5).status, "passed");
assert.equal(evaluateQaReading(numeric, "10").status, "passed");
assert.equal(evaluateQaReading(numeric, 4.99).status, "failed");
assert.equal(evaluateQaReading(numeric, 10.01).status, "failed");
assert.equal(evaluateQaReading(numeric, "").status, "incomplete");
assert.equal(evaluateQaReading(numeric, "not-a-number").status, "incomplete");
assert.equal(evaluateQaReading(specification("Numeric", { targetMin: 5, targetMax: null }), 100).status, "passed");
assert.equal(evaluateQaReading(specification("Numeric", { targetMin: null, targetMax: 10 }), -100).status, "passed");
assert.equal(evaluateQaReading(specification("Numeric", { targetMin: 5, targetMax: 5 }), 5).status, "passed");
assert.throws(() => specification("Numeric", { targetMin: null, targetMax: null }), PurchaseQaConfigurationError);
assert.throws(() => specification("Numeric", { targetMin: 11, targetMax: 10 }), PurchaseQaConfigurationError);

for (const expectedText of ["true", "TRUE", "Yes", "1"]) {
    const boolean = specification("Boolean", { expectedText });
    assert.equal(boolean.expectedText, "true");
    assert.equal(evaluateQaReading(boolean, true).status, "passed");
    assert.equal(evaluateQaReading(boolean, "yes").status, "passed");
    assert.equal(evaluateQaReading(boolean, 0).status, "failed");
}
for (const expectedText of ["false", "FALSE", "No", "0"]) {
    assert.equal(specification("Boolean", { expectedText }).expectedText, "false");
}
assert.equal(evaluateQaReading(specification("Boolean"), "unknown").status, "incomplete");
assert.throws(() => specification("Boolean", { expectedText: "maybe" }), PurchaseQaConfigurationError);
assert.throws(() => specification("Boolean", { expectedText: "" }), PurchaseQaConfigurationError);

const textSpecification = specification("Text", { expectedText: "  Acceptable  " });
assert.equal(textSpecification.expectedText, "Acceptable");
assert.equal(evaluateQaReading(textSpecification, " acceptable ").status, "passed");
assert.equal(evaluateQaReading(textSpecification, "Rejected").status, "failed");
assert.equal(evaluateQaReading(textSpecification, " ").status, "incomplete");
assert.equal(evaluateQaReading(textSpecification, null).status, "incomplete");
assert.throws(() => specification("Text", { expectedText: "" }), PurchaseQaConfigurationError);

const allPassed = evaluateQaChecklist([
    { specification: specification("Numeric", { specId: 11, isCritical: true }), reading: 7 },
    { specification: specification("Text", { specId: 12, isCritical: false }), reading: "acceptable" }
]);
assert.equal(allPassed.complete, true);
assert.equal(allPassed.forceRejected, false);
assert.equal(allPassed.requiredQaStatus, null);

const nonCriticalFailure = evaluateQaChecklist([
    { specification: specification("Numeric", { specId: 21, isCritical: false }), reading: 20 }
]);
assert.equal(nonCriticalFailure.complete, true);
assert.equal(nonCriticalFailure.hasNonCriticalFailure, true);
assert.equal(nonCriticalFailure.forceRejected, false);
assert.deepEqual(nonCriticalFailure.failedNonCriticalSpecIds, [21]);

const criticalFailure = evaluateQaChecklist([
    { specification: specification("Numeric", { specId: 32, isCritical: true }), reading: 20 },
    { specification: specification("Text", { specId: 31, isCritical: true, parameter: { ...parameter("Text"), parameterName: "Appearance" } }), reading: "Rejected" }
]);
assert.equal(criticalFailure.complete, true);
assert.equal(criticalFailure.hasCriticalFailure, true);
assert.equal(criticalFailure.forceRejected, true);
assert.equal(criticalFailure.requiredQaStatus, "Rejected");
assert.deepEqual(criticalFailure.failedCriticalSpecIds, [31, 32]);
assert.equal(criticalFailure.rejectionReason, "Critical QA failure: Appearance, Numeric parameter.");

const criticalAndIncomplete = evaluateQaChecklist([
    { specification: specification("Boolean", { specId: 41, isCritical: true }), reading: false },
    { specification: specification("Text", { specId: 42, isCritical: false }), reading: "" }
]);
assert.equal(criticalAndIncomplete.complete, false);
assert.equal(criticalAndIncomplete.forceRejected, true);

const criticalPassNonCriticalFail = evaluateQaChecklist([
    { specification: specification("Boolean", { specId: 51, isCritical: true }), reading: true },
    { specification: specification("Numeric", { specId: 52, isCritical: false }), reading: 20 }
]);
assert.equal(criticalPassNonCriticalFail.hasCriticalFailure, false);
assert.equal(criticalPassNonCriticalFail.hasNonCriticalFailure, true);
assert.equal(criticalPassNonCriticalFail.requiredQaStatus, null);

assert.deepEqual(evaluateQaChecklist([]), {
    complete: true,
    hasCriticalFailure: false,
    hasNonCriticalFailure: false,
    forceRejected: false,
    requiredQaStatus: null,
    failedCriticalSpecIds: [],
    failedNonCriticalSpecIds: [],
    rejectionReason: null,
    evaluations: []
});

const parametersRoute = fs.readFileSync(new URL("../src/app/api/manufacturing/qa/parameters/route.ts", import.meta.url), "utf8");
const specificationsRoute = fs.readFileSync(new URL("../src/app/api/manufacturing/qa/specifications/route.ts", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../src/app/api/manufacturing/qa/_purchase-specifications.ts", import.meta.url), "utf8");
const phase0Sql = fs.readFileSync(new URL("../database/purchase_order_management_phase_0.sql", import.meta.url), "utf8");
const uniquenessAudit = fs.readFileSync(new URL("./purchase-order-phase4-uniqueness-audit.mjs", import.meta.url), "utf8");
const uniquenessSetup = fs.readFileSync(new URL("./apply-purchase-order-phase4-directus.mjs", import.meta.url), "utf8");
const qaSeed = fs.readFileSync(new URL("./seed-purchase-order-phase4-qa.mjs", import.meta.url), "utf8");
const qaReceivingService = fs.readFileSync(new URL("../src/modules/manufacturing-management/qa-receiving/services/qa-api.ts", import.meta.url), "utf8");
const qaReceivingHook = fs.readFileSync(new URL("../src/modules/manufacturing-management/qa-receiving/hooks/useQAReceiving.ts", import.meta.url), "utf8");
const qaChecklist = fs.readFileSync(new URL("../src/modules/manufacturing-management/qa-receiving/components/ProductQaChecklist.tsx", import.meta.url), "utf8");
const qaInspectionForm = fs.readFileSync(new URL("../src/modules/manufacturing-management/qa-receiving/components/ShipmentInspectionForm.tsx", import.meta.url), "utf8");
const adminBoundaryAudit = fs.readFileSync(new URL("./purchase-order-phase4-admin-boundary-audit.mjs", import.meta.url), "utf8");

assert.match(parametersRoute, /PURCHASE_ORDER_MODULE_PATHS\.receiving/);
assert.match(specificationsRoute, /PURCHASE_ORDER_MODULE_PATHS\.receiving/);
assert.match(specificationsRoute, /productId: z\.coerce\.number\(\)\.int\(\)\.positive\(\)/);
assert.match(service, /filter\[product_id\]\[_eq\]/);
assert.match(service, /filter\[parameter_id\]\[_in\]/);
assert.doesNotMatch(service, /parameter_id\.parameter_name/);
assert.doesNotMatch(parametersRoute, /export async function (POST|PATCH|DELETE)/);
assert.doesNotMatch(specificationsRoute, /export async function (POST|PATCH|DELETE)/);
assert.match(phase0Sql, /CALL pom_add_index_if_missing\([\s\S]*?'product_qa_specs'[\s\S]*?'uq_product_qa_parameter'[\s\S]*?UNIQUE INDEX `uq_product_qa_parameter` \(`product_id`, `parameter_id`\)/);
assert.match(uniquenessAudit, /--verify-write/);
assert.match(uniquenessAudit, /finally/);
assert.match(uniquenessAudit, /method: "DELETE"/);
assert.match(uniquenessSetup, /product_parameter_key/);
assert.match(uniquenessSetup, /items\.create/);
assert.match(uniquenessSetup, /items\.update/);
assert.match(uniquenessSetup, /is_unique: true/);
assert.match(qaSeed, /argument\("raw-product-id"\)/);
assert.match(qaSeed, /argument\("packaging-product-id"\)/);
assert.match(qaSeed, /Moisture Content/);
assert.match(qaSeed, /Seal Integrity/);
assert.match(qaSeed, /Print Quality/);
assert.match(qaSeed, /createdSpecificationIds\.reverse\(\)/);
assert.match(qaReceivingService, /\/api\/manufacturing\/qa\/specifications\?/);
assert.match(qaReceivingService, /signal/);
assert.match(qaReceivingHook, /new Set\(lines\.map/);
assert.match(qaReceivingHook, /fetchProductQaSpecifications\(productId, controller\.signal\)/);
assert.match(qaReceivingHook, /Record<number, QaSpecificationLoadState>/);
assert.match(qaReceivingHook, /Record<number, Record<number, string>>|QaSpecificationReadings/);
assert.match(qaReceivingHook, /movement preview and transactional QA result persistence/i);
assert.doesNotMatch(qaReceivingService, /qaReadings/);
assert.match(qaChecklist, /type="number"/);
assert.match(qaChecklist, /aria-pressed/);
assert.match(qaChecklist, /type="text"/);
assert.match(qaChecklist, /evaluateQaReading/);
assert.match(qaChecklist, /Critical/);
assert.match(qaInspectionForm, /Movement Preview Required/);
assert.match(adminBoundaryAudit, /Manufacturing Procurement Service/);
assert.match(adminBoundaryAudit, /mutationActions = new Set\(\["create", "update", "delete", "share"\]\)/);
assert.match(adminBoundaryAudit, /Administrator-backed; replacement remains explicitly deferred/);

console.log("Purchase Order Phase 4 contract smoke tests passed through checkpoint 8.");
