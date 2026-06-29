# QA Task List: Manufacturing Management

This document tracks the progress of debugging and implementation tasks identified in the **QA - MANUFACTURING** report.

---

## Phase 1: General UI & Core Functionality

### 1. UI Enhancements & Fixes
- [x] **1a (Low)**: **Dark Mode for Email Input**
  - *Description*: The email icon and input box on the login/change-password pages do not respond to the dark mode toggle. They remain in light mode styling when dark mode is active.
- [x] **1b (Low)**: **Not Responsive Views**
  - *Description*: UI layout and table scaling issues under the *UOM Conversions & Density Matrix* view.

### 2. Core Functionality & Security
- [x] **2a (Critical)**: **Change Password Endpoint Error**
  - *Description*: Form submission for changing password fails with a 404 Endpoint Error & JSON parsing failure. Check the API route handler.
- [x] **2b (Normal)**: **Log In Activity Module**
  - *Description*: Set up the log-in activity log if not yet available.
- [x] **2c (Critical)**: **Audit Logs Read-Only Enforcement**
  - *Description*: Remove the "Clear Logs" button and logic from the *Audit Calculation Logs* view to maintain standard auditing compliance.
- [x] **2d (Normal)**: **UOM Conversion Duplicate Entry Prevention & Sorting**
  - *Description*: 
    - Prevent spamming/submitting duplicate conversion transactions with identical parameters (Amount, UOM, Computed Value).
    - Sort the audit log by timestamp in descending order (Newest on Top).
- [x] **2e (Normal/Low)**: **FOREX Manager Adjustments**
  - *Description*: 
    - Check if restricted to USD only.
    - Remove the duplicate/extra Peso sign in the UI.
    - Add complete hours, minutes, and seconds timestamps to the audit logs (currently showing only the date).
    - Disable/prevent duplicate creation on spamming "Apply & Save FX Settings".
- [x] **2f (Normal/High)**: **Approval Thresholds Validation & UI Cleanups**
  - *Description*:
    - Hide internal rule database details (e.g., `Triggered Rule ID: 1 | Limit: < 15%`) from the warning banner.
    - Remove the rule ID column in the threshold registry table.
    - Prevent saving active duplicate rules (show error: *"An active rule with this threshold trigger already exists."*).

---

## Phase 2: Sourcing, Suppliers & Navigation

### 1. Navigation & Directory Restructuring
- [x] **Tabs Removal**: Delete the redundant horizontal tab bar in Sourcing views.
- [x] **Breadcrumbs Sync**: Update the root category breadcrumb from "Manufacturing" to match the sidebar's parent folder name ("Sourcing & Supply Chain").

### 2. Supplier Registration & Directory
- [x] **2a (Critical)**: **Supplier Duplicate Constraint Handler**
  - *Description*: Catch backend database constraint violations (duplicate TIN, code, or name) and prevent false success toast notifications.
- [x] **2b (Normal)**: **Form Persistence & Validation Messages**
  - *Description*: If supplier registration fails, keep the modal open and show validation: *"This Supplier Name already exists. Please choose a unique name."*
- [x] **2c (Critical)**: **Required Fields Visual Indicator**
  - *Description*: Add a red asterisk `*` to mandatory fields (Supplier Name, Code, Payment, Address).
- [x] **2d (Critical)**: **New Fields Registration**
  - *Description*: Add fields to registration: *Province*, *Country*, *Delivery Terms*, and *Currency*.
- [x] **2e (Normal)**: **Delivery Terms Selector**
  - *Description*: Add selector field for Delivery Terms in the form.
- [x] **2f (High)**: **TIN Verified Badge Logic**
  - *Description*: Do not show "Verified" status by default if the record is saved with a blank TIN number.
- [x] **2g (High)**: **Region Scope Dynamic Configuration**
  - *Description*: Avoid hardcoding the fallback region scope to "Domestic (Philippines)". Support international vendors without regional constraints.
- [x] **2h (Low)**: **Header UI Cleanup**
  - *Description*: Remove the "SUPPLIER ID" element from the top-right corner of the active supplier header card.

---

## Phase 3: Sourcing & Logistics

### 1. Incoming Shipments
- [x] **Status Automation**: Remove manual "Initial Status" dropdown. Automate transitions: *Ordered* (on register) -> *En Route* (on tracking update/Departed) -> *Receiving (QA)* (on checklist open).
- [x] **Centralized FX Rate**: Make Customs FX Rate input read-only. Auto-pull live/historical rate from FOREX module. Allow override only for Finance Managers with validation warnings.
- [x] **PO / Bill of Lading Number**: Auto-generate consistent code patterns.
- [x] **UI Layout Overlaps**: Fix product search dropdown cutoff, "Register Shipment" button cropping, and "Remove" text overlapping.
- [x] **Duplicate Prevention**: Validate and prevent selecting identical raw products in different manifest rows.
- [x] **Dropdown Filters**: Filter product search lists based on the selected Vendor.
- [x] **Manifest Table Format**: Adjust columns to: *Product Name | UOM | Qty | Unit price (uneditable) | ImpFreight Cost*.
- [x] **Exchange Rate Calculations**: Ensure exchange rate updates dynamically when related input fields change.
- [x] **State Control**: Replace state-hopping toggle pills with explicit action buttons.
- [x] **Missing Database Fields**: Ensure `encoder_id`, `Approver_id`, `Receiver_id`, and `Date_approved` update properly on transaction submit.
- [x] **Post Status Defaults**: Prevent newly registered shipments from automatically defaulting to a "Posted" status.
- [x] **Default Input Errors**: Clean up backend UI defaults (such as payment_type = 1 and branch_id = 182) and expose missing inputs to UI.
 
### 2. Shipment Expenses & Raw Materials
- [x] **Combobox Upgrades**: Add combobox controls for *Active Cargo Shipment* and *Duties, Logistics, Brokerage Expenses*.
- [x] **Expense UI Sync**: Refresh UI automatically after adding subsequent sessions of "additional" expenses.
- [x] **Expense Table DB Failures**: Investigate database write failures in the `shipment_expenses` table.
- [x] **Raw Materials State Clearing**: Clear creation form state completely when modal is closed.
- [x] **Material Duplicate Validation**: Enforce backend and frontend validation against duplicate Material Names.
- [x] **Inventory Categorization**: Categorize items into raw materials, packaging, and finished goods inside database.
 
### 3. Client Directory
- [x] **Input Constraints**: Limit contact number and TIN number to digits only with a max length constraint.
- [x] **Asterisk Indicators**: Add red asterisks to mandatory labels.
- [x] **Soft-Delete Toggle**: Replace delete trash icon with a deactivation toggle or archive icon.
- [x] **Read-Only States**: Disable both Edit and Deactivate buttons if client status is already "Inactive".
- [x] **Client Creation Foreign Key Error**: Resolve `store_type` foreign key constraint error when registering client.
- [x] **Geolocation Safe Origin Error**: Handle non-secure geolocation API errors gracefully (instead of generic "Failed to get coordinates" toasts).

### 4. Logistics, Fleet & Routes
- [x] **Trip Cost Simulator**:
  - Add search bar for Fleet Vehicle and Target Route.
  - Filter out inactive vehicles.
  - Fix divide-by-zero Infinity calculation errors when vehicle capacity is 0 (show `-` or `No Data`).
- [x] **Fleet Registry**:
  - Replace delete icons with "Deactivate Vehicle" actions.
  - Disable default registration auto-fill logic.
  - Handle duplicate plate number errors gracefully (instead of 400 crash).
  - Add Fuel Type field dropdown.
  - Support search filtering on Plate Number, Weight/Volumetric Capacity, and dropdown status selectors.
  - Remove unique constraint on `branch_id`.
- [x] **Shipping Routes**:
  - Add location search bar above the route map using auto-focus.
  - Add required field validation (red asterisk) for Route Name / Destination.

---

## Phase 4: Operations Planning & Production Execution

### 1. Operations Planning & BOM Engine
- [x] **Missing Production Steps Fallback**: Implement alert/logic for generating Job Orders (JO) for items with missing routing.
- [x] **BOM Constraint Enforcement**: Freeze/block Job Order progress if the SKU has no active BOM.
- [x] **Product vs. Quantity Decoupling**: Make the order quantity uneditable; input quantity in target field only.
- [x] **BOM Version Selection**: Add dropdown selector for BOM Version when creating Job Orders.
- [x] **UOM Specification**: Display explicit unit of measurement for committed target quantities.
- [x] **Independent Production Capacity**: Calculate scheduling runs and capacity limits independently for each product instead of a combined batch dataset.
- [x] **Active Released List Cleanups**: Remove released sales orders from the list once all items have a Job Order generated.

### 2. Floor Job Orders & Production execution
- [x] **Detailed Modals**: Show general overview in main UI, move actions and detailed workflows to a dedicated modal on click.
- [x] **Employee Filter**: Filter operator lists to users with "Production Staff" positions and add a search bar.
- [x] **Delete Button Removal**: Remove "Delete" action entirely from Floor Job Orders.
- [x] **Assigned Workers Save Bug**: Resolve worker assignment UI state saving failure in "Assigned Personnel for Payroll Run" card.
- [x] **Label Standards**: Standardize naming between "Machine Rate / Hr" and "OH (Factory Overhead)".
- [x] **Dynamic Completion Buttons**:
  - Disable "QA Pass & Complete Task" by default until an operator is assigned.
  - Map dynamic button labels: `QA Pass & Complete Task` if `requires_qa` is true; `Complete Task` if false.
- [x] **QA-Floor Status Sync**: Automatically transition Floor Job Order step statuses to "Done" in real-time when marked completed in QA.
- [x] **Routing Steps Logic Fix**: Check `requires_qa` boolean configuration to dynamically render step templates and buttons correctly.
