# Purchase Order Management Phase 0 Directus Setup

> Phase 2 reuses the same idempotent Directus setup command to add the six transaction-currency and tax-rate fields on `purchase_order_products`. Run `npm.cmd run setup:purchase-order-phase2` before deploying the Phase 2 application code.
>
> Phase 3 adds the approval-rule snapshot fields on `purchase_order`. Run `npm.cmd run setup:purchase-order-phase3` before deploying the Phase 3 application code. The migration is additive and existing Requested orders resolve and snapshot their rule on first action.

## Deployment Order

1. Back up the Directus database and record the current application commit.
2. Apply `database/purchase_order_management_phase_0.sql` to a dummy database.
3. Apply the script a second time and confirm it completes without duplicate objects or seed rows.
4. Run `npm.cmd run audit:purchase-order-phase0` against the dummy Directus instance.
5. Apply the SQL to the target database during a maintenance window.
6. In Directus, refresh the database schema and register the relations described below.
7. Configure role permissions, approval-role mappings, and missing bad-stock branches.
8. Run the audit script again before deploying any later PO workflow phase.

Phase 4 requires database-level product/parameter uniqueness. Prefer the composite `uq_product_qa_parameter` index from the SQL migration. When database access is unavailable, run `npm.cmd run setup:purchase-order-phase4` with temporary Directus Administrator credentials; it creates a hidden database-unique identity key and a blocking flow that populates it on create and prevents identity edits. Then run `npm.cmd run audit:purchase-order-phase4-uniqueness` and the same command with `-- --verify-write` using a temporary Administrator token. The write verification removes its temporary records before exiting.

Seed the representative Phase 4 QA fixtures with `npm.cmd run seed:purchase-order-phase4 -- --raw-product-id=<id> --packaging-product-id=<id>`. The command requires temporary Directus Administrator credentials, creates only missing masters, and never overwrites conflicting administrator values. Verify with `npm.cmd run audit:purchase-order-phase4-seeds -- --raw-product-id=<id> --packaging-product-id=<id>`.

Phase 0 does not enable new purchase-order, approval, receiving, or inventory-posting behavior.

## Directus Relations And Field Metadata

Register these relations after refreshing the schema:

| Collection and field | Related collection | Required behavior |
| --- | --- | --- |
| `purchase_order_products.job_order_id` | `manufacturing_job_orders.job_order_id` | Optional for buffer stock; required for MRP demand |
| `product_qa_specs.product_id` | `products.product_id` | Required |
| `product_qa_specs.parameter_id` | `purchase_order_qa_parameters.parameter_id` | Required |
| `purchase_order_receiving_qa_results.receiving_line_id` | `purchase_order_receiving.purchase_order_product_id` | Required |
| `purchase_order_receiving_qa_results.spec_id` | `product_qa_specs.spec_id` | Required |
| `purchase_order_approval_rules.product_category_id` | `categories.category_id` | Optional |
| `purchase_order_approval_history.purchase_order_id` | `purchase_order.purchase_order_id` | Required, read-only after creation |
| `purchase_order_approval_history.actor_id` | `user.user_id` | Required |
| `purchase_order_approval_role_permissions.role_id` | `roles.id` | Required |
| `purchase_order_approval_role_permissions.user_id` | `user.user_id` | User-specific fallback when ERP roles are unavailable |
| `branches.bad_stock_branch_id` | `branches.id` | Optional, but required before rejected receiving |

Configure enum choices exactly as stored by the migration. Keep `workflow_revision`, approval history, and QA result pass/fail fields visible to the service role but read-only in ordinary Directus forms.

## Application Authorization

The application uses the ERP session plus module assignments for end-user authorization. The Directus static token is a service identity and must not be treated as the acting user.

The deployed `DIRECTUS_STATIC_TOKEN` must resolve to the `Manufacturing Procurement Service` role or policy. An Administrator token is acceptable only while applying the setup script and must not remain configured in the application environment.

| Capability | Required module | Additional requirement |
| --- | --- | --- |
| Encode purchase orders | `/mm/incoming-shipments` | Active ERP user |
| Plant approval | `/mm/approval` | Active ADMIN or USER with module access |
| Finance approval | `/mm/approval` | Active ADMIN or USER with module access |
| QA receiving | `/mm/qa-receiving` | Active ERP user |
| Maintain QA masters | Directus Admin | Administrative role only |

Phase 3 uses module access because the current ERP role model exposes only ADMIN and USER. The `purchase_order_approval_role_permissions` collection remains available for a future separation-of-duties rollout but is not enforced in this phase. Encoders may approve or reject their own requests. The fail-closed rule requires Finance approval until business-approved rules are configured.

Replacement of the Administrator-backed static token remains explicitly deferred. The audit reports the restricted-token identity and unused Plant/Finance mappings as warnings.

## Static-Token Permissions

Grant the Manufacturing static-token role:

- Read/filter: `transaction_status`, `payment_status`, `inventory_transaction_types`, `branches`, `categories`, `products`, `manufacturing_job_orders`, `roles`, `user`, `user_access_modules`, and `modules`.
- Read/create/update/filter: `purchase_order`, `purchase_order_products`, `purchase_order_receiving`, and `inventory_lots`.
- Read/create/filter: `inventory_movements`, `purchase_order_receiving_qa_results`, and `purchase_order_approval_history`.
- Read/filter: `purchase_order_qa_parameters`, `product_qa_specs`, `purchase_order_approval_rules`, and `purchase_order_approval_role_permissions`.
- No update/delete: `purchase_order_approval_history`, `purchase_order_receiving_qa_results`, and `inventory_movements`.

Do not grant QA master creation or mutation to the Manufacturing service role during Phase 0. QA masters are maintained by a Directus administrator for the first release.

Verify this boundary with:

```powershell
npm.cmd run audit:purchase-order-phase4-admin-boundary
```

The audit fails if the `Manufacturing Procurement Service` policy can create, update, delete, or share QA parameters or product specifications. The currently configured `DIRECTUS_STATIC_TOKEN` is Administrator-backed; replacing that shared token remains deferred and is reported as a warning. The Manufacturing BFF exposes read-only QA master routes and must not add mutation handlers while this limitation remains.

## Required Seed Verification

- Inventory statuses: `1`, `3`, `6`, `7`, `9`, `11`, `12`, and `13`.
- Payment statuses: `1`, `3`, `4`, `5`, and `8`.
- Accepted movement: `Purchase Receiving QA`, direction `IN`, origin `purchase_order_receiving`.
- Rejected movement: `QA Reject / Bad Order Receipt`, direction `IN`, origin `purchase_order_receiving`.
- Branch mappings: `181 -> 182`, `183 -> 184`, and `185 -> 186`.
- Branch `163` remains unconfigured and cannot accept rejected receiving.

## Rollback

Application rollback is performed by redeploying the previous application commit. The added schema is backward-compatible and should remain in place during an application rollback.

Dropping Phase 0 tables or columns is destructive and must not be automated. If permanent database rollback is approved:

1. Export approval, QA, and purchase-order data created after deployment.
2. Remove Directus relations and permissions for the new fields and collections.
3. Drop new foreign keys before dropping tables or columns.
4. Remove `branches.bad_stock_branch_id` only after clearing its values.
5. Remove the QA-reject movement type only when no `inventory_movements` row references it.
6. Restore the pre-deployment database backup if any migration statement partially failed.

## Completion Evidence

Save the following with the release ticket:

- Database backup identifier and migration timestamp.
- First and second migration execution results.
- Phase 0 audit output with secrets removed.
- Directus permission screenshots.
- Approval-role and branch-mapping screenshots.
- Browser smoke-test screenshots for the three existing routes.
