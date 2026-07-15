# 📋 API Specification: Real-Time Inventory Movements BFF Endpoint

This document outlines the technical specification for the Next.js Backend-for-Frontend (BFF) API route designed to manage transactions and query records from the `inventory_movements` table. 

This endpoint serves as a secure gateway between client dashboards and the Directus Cloud API, supporting transactional write operations and real-time reporting updates for material stock balances, audit trails, and lot locations.

---

## 🏗️ BFF Endpoint Architecture

The BFF sits in the Next.js server routing environment, securing Directus credentials and mapping client payloads to the database schema.

```
+------------------+         REST / SSE         +-------------------+       REST API       +-------------------+
|  Client Browser  |  =======================>  |   Next.js BFF     |  ==================> |   Directus Cloud  |
|  (QA/Warehouse)  |  <=======================  |  (Route Handler)  |  <================== |    MySQL Engine   |
+------------------+     JSON / Live Stream     +-------------------+     Static Token     +-------------------+
```

### Key API Capabilities:
1.  **Transactional POST Writes**: Inserts rows into the `inventory_movements` collection when shipments are received, work orders are issued, or adjustments are logged.
2.  **Filterable GET Queries**: Fetches movements filtered by product, branch, lot, batch code, or date.
3.  **Real-Time Data Access**:
    *   **Cursor-Based Polling**: Allows dashboards to fetch changes that occurred after a specific `movement_id` or timestamp.
    *   **Server-Sent Events (SSE) Streaming**: Exposes an SSE endpoint that streams new inventory movements to client dashboards in real-time as they are written.

---

## 🔌 API Endpoints Definition

### 1. Read Inventory Movements
*   **Path**: `/api/manufacturing/inventory/movements`
*   **Method**: `GET`
*   **Description**: Retrieves a filtered list of inventory ledger lines. Uses a cursor-based approach for fast querying.
*   **Headers**:
    ```http
    Cache-Control: no-store, no-cache, must-revalidate
    ```

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `productId` | `number` | No | Filter by product master ID |
| `branchId` | `number` | No | Filter by destination or source branch ID |
| `lotId` | `number` | No | Filter by specific inventory lot location |
| `batchNo` | `string` | No | Search for specific batch/lot code (matches via partial text) |
| `sinceId` | `number` | No | Cursor: returns only movements with `movement_id` greater than this value (for real-time polling) |
| `limit` | `number` | No | Maximum records to return (Default: 100, Max: 500) |

#### Sample Request:
```http
GET /api/manufacturing/inventory/movements?branchId=12&sinceId=117 HTTP/1.1
Host: localhost:3000
```

#### Sample Response (`200 OK`):
```json
{
  "success": true,
  "cursor": {
    "lastId": 119,
    "count": 2
  },
  "data": [
    {
      "movement_id": 118,
      "product_id": 412,
      "lot_id": 5589,
      "branch_id": 12,
      "transaction_type_id": 1,
      "source_document_id": 4810,
      "source_document_no": "REC-2026-0915A",
      "batch_no": "LOT-COCOS-202607-01",
      "expiry_date": "2027-07-15",
      "manufacturing_date": "2026-07-15",
      "quantity": 250.0000,
      "created_by": 84,
      "created_at": "2026-07-15T10:18:31.000Z",
      "remarks": "Passed dynamic QA check. Moisture 0.10%."
    },
    {
      "movement_id": 119,
      "product_id": 412,
      "lot_id": 5590,
      "branch_id": 182,
      "transaction_type_id": 2,
      "source_document_id": 4810,
      "source_document_no": "REC-2026-0915A",
      "batch_no": "LOT-COCOS-202607-01",
      "expiry_date": "2027-07-15",
      "manufacturing_date": "2026-07-15",
      "quantity": 15.0000,
      "created_by": 84,
      "created_at": "2026-07-15T10:18:32.000Z",
      "remarks": "Rejected: Moisture 0.28% exceeds max limit."
    }
  ]
}
```

---

### 2. Stream Inventory Movements (Real-Time SSE)
*   **Path**: `/api/manufacturing/inventory/movements/stream`
*   **Method**: `GET`
*   **Description**: Establishes a persistent Server-Sent Events (SSE) connection that streams ledger entries to the client as they are generated.
*   **Headers**:
    ```http
    Content-Type: text/event-stream
    Cache-Control: no-cache, no-transform
    Connection: keep-alive
    ```

#### Sample Stream Output:
```http
event: initial
data: {"message":"Connection established","timestamp":"2026-07-15T10:28:45.000Z"}

event: movement
data: {"movement_id":120,"product_id":412,"lot_id":5589,"branch_id":12,"quantity":50.0000,"remarks":"Work order production yield"}

event: movement
data: {"movement_id":121,"product_id":305,"lot_id":1102,"branch_id":12,"quantity":-20.0000,"remarks":"BOM material consumption"}
```

---

### 3. Log Inventory Movements
*   **Path**: `/api/manufacturing/inventory/movements`
*   **Method**: `POST`
*   **Description**: Inserts one or more ledger movements. Enforces data validation and transactional safety (all movements in the request must succeed, or all fail).
*   **Body Content-Type**: `application/json`

#### Validation Rules (Zod Schema):
*   `product_id`: Positive integer, required.
*   `lot_id`: Positive integer, required.
*   `branch_id`: Positive integer, required.
*   `transaction_type_id`: Integer, required (Maps to: `1` = QA Pass, `2` = QA Reject, `3` = Work Issue, `4` = WO Yield, `5` = Adjustment).
*   `source_document_id`: Integer, required.
*   `source_document_no`: Non-empty string, optional.
*   `batch_no`: Non-empty string, required.
*   `expiry_date`: Valid date string (YYYY-MM-DD), optional.
*   `manufacturing_date`: Valid date string (YYYY-MM-DD), optional.
*   `quantity`: Decimal number, required (signed depending on transaction type).
*   `remarks`: String, optional.

#### Sample Request Body:
```json
{
  "movements": [
    {
      "product_id": 412,
      "lot_id": 5589,
      "branch_id": 12,
      "transaction_type_id": 1,
      "source_document_id": 4810,
      "source_document_no": "REC-2026-0915A",
      "batch_no": "LOT-COCOS-202607-01",
      "expiry_date": "2027-07-15",
      "manufacturing_date": "2026-07-15",
      "quantity": 250.0000,
      "remarks": "Passed dynamic QA check. Moisture 0.10%."
    }
  ]
}
```

#### Sample Response (`201 Created`):
```json
{
  "success": true,
  "message": "Successfully posted 1 inventory movement",
  "data": [
    {
      "movement_id": 118,
      "product_id": 412,
      "lot_id": 5589,
      "branch_id": 12,
      "transaction_type_id": 1,
      "source_document_id": 4810,
      "source_document_no": "REC-2026-0915A",
      "batch_no": "LOT-COCOS-202607-01",
      "expiry_date": "2027-07-15",
      "manufacturing_date": "2026-07-15",
      "quantity": 250.0000,
      "created_by": 84,
      "created_at": "2026-07-15T10:18:31.000Z",
      "remarks": "Passed dynamic QA check. Moisture 0.10%."
    }
  ]
}
```

---

## 🛡️ Error Handling and Status Codes

The API returns standard HTTP status codes and a error message JSON format:

```json
{
  "success": false,
  "error": "Detailed error message goes here",
  "code": "ERROR_CODE"
}
```

| Status Code | Code | Reason |
| :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_FAILED` | Payload fails schema validation, or missing required fields. |
| `401 Unauthorized` | `UNAUTHORIZED` | Token is invalid, expired, or missing. |
| `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` | User does not have authorization to write to this branch or write ledger adjustments. |
| `422 Unprocessable Entity` | `INSUFFICIENT_STOCK` | A negative movement exceeds available stock levels. |
| `500 Internal Error` | `DIRECTUS_FAILURE` | Connection issues with Directus Cloud or database timeouts. |
