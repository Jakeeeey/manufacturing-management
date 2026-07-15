# 📋 Production, Shop Floor, & Quality Assurance Workflow Guide

This document details the concurrent operational lifecycle of the VOS ERP system across **Planning & Scheduling**, **Shop Floor Execution**, and **Quality Assurance (QA)**. It maps how these parallel modules communicate asynchronously through a shared database ledger.

---

## 🔄 Concurrent Operational Lifecycle

```
========================================================================================
  VOS MANUFACTURING  |  CONCURRENT WORKFLOW MANAGEMENT  |  LEAN STACK SYNC
========================================================================================
  [PLANNING LANE: Active]     [PRODUCTION LANE: Active]     [QUALITY ASSURANCE: Active]
========================================================================================
```

### 🧬 Data-Flow & Concurrency Architecture

In a live factory environment, Planners, Operators, and QA Inspectors perform tasks in parallel. The flowchart below illustrates how these three concurrent routes interface with the shared relational database state.

```mermaid
flowchart TB
    %% Style classes
    classDef planning fill:#eff6ff,stroke:#2563eb,stroke-width:2px,color:#1e3a8a;
    classDef shopfloor fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d;
    classDef qa fill:#fffbeb,stroke:#d97706,stroke-width:2px,color:#78350f;
    classDef db fill:#fef2f2,stroke:#dc2626,stroke-width:2px,color:#7f1d1d;

    %% Shared DB Hub
    subgraph Database["🗄️ Central Database (Shared Ledger State)"]
        IM[("inventory_movements\n(Ledger Logs)")]:::db
        IL[("inventory_lots\n(QA Status Cache)")]:::db
        JO[("manufacturing_job_orders\n(Production Orders)")]:::db
    end

    %% Modules
    subgraph PE["📐 Planning & Engineering Route"]
        direction TB
        A1["1. Read Stock Levels & Alerts"]:::planning
        A2["2. Schedule & Assign Operators"]:::planning
        A3["3. Dispatch Job Order ('Proceed')"]:::planning
        A1 --> A2 --> A3
    end

    subgraph PW["⚙️ Shop Floor Production Route"]
        direction TB
        B1["1. Poll Active Jobs Queue"]:::shopfloor
        B2["2. Complete Routing Tasks"]:::shopfloor
        B3["3. Close Shift & Log Yield/WIP"]:::shopfloor
        B1 --> B2 --> B3
    end

    subgraph MQ["🧪 Quality Assurance Route"]
        direction TB
        C1["1. Poll Quarantine Holds"]:::qa
        C2["2. Perform QA Audits & Assays"]:::qa
        C3["3. Release Approved Batches"]:::qa
        C1 --> C2 --> C3
    end

    %% Flow lines mapping module interactions to DB
    %% Planning interactions
    IM -.->|Reads balances| A1
    IL -.->|Checks Passed lots| A1
    A3 ===>|Writes JO details| JO

    %% Production interactions
    JO ===>|Reads active jobs| B1
    IL -.->|Reads material stock| B3
    B3 ===>|Writes yield/consumption| IM
    B3 ===>|Inserts 'Pending' WIP lot| IL

    %% QA interactions
    IL -.->|Reads quarantined lots| C1
    C3 ===>|Patches lot status to 'Passed'| IL
```

---

## 🛠️ Step-by-Step Phase Breakdown

### 1. 📐 Planning & Scheduling
*   **Access Route**: `/mm/planning-engineering`
*   **Key Source Files**:
    *   Frontend View: [PlanningEngineeringModule.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/planning-engineering/PlanningEngineeringModule.tsx)
    *   BFF Logic Helper: [inventory-helper.ts](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/app/api/manufacturing/planning-engineering/helpers/inventory-helper.ts)

| Step | Action Name | System Operation | Database Interaction |
| :---: | :--- | :--- | :--- |
| **01** | **Check Shortages** | Reads safety stocks (`maintaining_quantity`) and explodes BOM demand. | Queries sum of `inventory_movements` filtered by branch & `Passed` lots. |
| **02** | **Consolidate** | Groups pending sales demands or creates raw material buffer jobs. | Prepares draft job order schedules. |
| **03** | **Dispatch** | Assigns operator personnel to routing sequences and dispatches job. | Updates `manufacturing_job_orders.status` to `'Proceed'`. |

---

### 2. ⚙️ Shop Floor Production (Production Workflow)
*   **Access Route**: `/mm/production-workflow`
*   **Key Source Files**:
    *   Frontend View: [JobOrderShiftLogModal.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/production-workflow/components/JobOrderShiftLogModal.tsx)
    *   BFF Closure API: [shift-run-log/route.ts](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/app/api/manufacturing/production/shift-run-log/route.ts)

| Step | Action Name | System Operation | Database Interaction |
| :---: | :--- | :--- | :--- |
| **01** | **Routing Progress** | Operators check into sequence tasks, recording run and machine hours. | Inserts progress tracking logs. |
| **02** | **Step QA Gates** | Inspectors clear pH, weight, or moisture checks before unlocking next steps. | Writes step verification checks to QA checklist table. |
| **03** | **Shift Closing** | Supervisor enters batch code (`batch_no`), yield qty, and actual raw consumed. | Inserts consumption logs (`-quantity`) and yield outputs (`+quantity`) to `inventory_movements` ledger; adds new snapshot lot to `inventory_lots` with `Pending` status. |

---

### 3. 🧪 Quality Control & Final Release
*   **Access Route**: `/mm/manufacturing-qa`
*   **Key Source Files**:
    *   Frontend View: [FinalQAReleases.tsx](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/modules/manufacturing-management/manufacturing-qa/components/FinalQAReleases.tsx)
    *   BFF Release API: [final-qa/route.ts](file:///C:/Users/Admin/WebstormProjects/manufacturing-management/src/app/api/manufacturing/production/final-qa/route.ts)

| Step | Action Name | System Operation | Database Interaction |
| :---: | :--- | :--- | :--- |
| **01** | **Quarantine Poll** | Displays recently completed production batches waiting for QC release. | Queries `inventory_lots` where `qa_status` is `Pending` or `QA Hold`. |
| **02** | **QA Audits** | QA inspector logs microbiological assays, seal strengths, and label checks. | Saves checklist audit logs to `manufacturing_final_qa_releases`. |
| **03** | **Batch Release** | Supervisor approves the batch. This unlocks the stock for inventory shipments. | Patches `inventory_lots.qa_status` to `Passed` (or `Failed` if rejected), enabling it to be allocated by Planning. |
