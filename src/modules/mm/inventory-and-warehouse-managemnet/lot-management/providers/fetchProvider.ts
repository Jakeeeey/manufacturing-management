// fetchProvider.ts - Data fetching operations for Lot Management
import type {
  LotsResponse,
  InventoryTypesResponse,
  CreateLotInput,
  CreateLotResponse,
  UpdateLotMaxBatchInput,
  UpdateLotResponse,
} from "../type";

const API_BASE_PATH = "/api/mm/inventory-and-warehouse-management/lot-management";

/**
 * Fetch all lots with their inventory type information and occupied count
 */
export async function fetchLots(): Promise<LotsResponse> {
  try {
    const response = await fetch(API_BASE_PATH, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to fetch lots" }));
      return {
        lots: [],
        success: false,
        message: error.message || "Failed to fetch lots",
      };
    }

    const data = await response.json();
    return {
      lots: data.lots || [],
      success: true,
    };
  } catch (error) {
    console.error("Error fetching lots:", error);
    return {
      lots: [],
      success: false,
      message: "Network error while fetching lots",
    };
  }
}

/**
 * Fetch all inventory types
 */
export async function fetchInventoryTypes(): Promise<InventoryTypesResponse> {
  try {
    const response = await fetch(`${API_BASE_PATH}?type=inventory-types`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to fetch inventory types" }));
      return {
        inventoryTypes: [],
        success: false,
        message: error.message || "Failed to fetch inventory types",
      };
    }

    const data = await response.json();
    return {
      inventoryTypes: data.inventoryTypes || [],
      success: true,
    };
  } catch (error) {
    console.error("Error fetching inventory types:", error);
    return {
      inventoryTypes: [],
      success: false,
      message: "Network error while fetching inventory types",
    };
  }
}

/**
 * Create a new lot
 */
export async function createLot(input: CreateLotInput): Promise<CreateLotResponse> {
  try {
    const response = await fetch(API_BASE_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to create lot" }));
      throw new Error(error.message || "Failed to create lot");
    }

    const data = await response.json();
    return {
      lot: data.lot,
      success: true,
      message: "Lot created successfully",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error while creating lot";
    console.error("Error creating lot:", error);
    throw new Error(message);
  }
}

/**
 * Update the max batch capacity of a lot
 */
export async function updateLotMaxBatch(input: UpdateLotMaxBatchInput): Promise<UpdateLotResponse> {
  try {
    const response = await fetch(API_BASE_PATH, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to update lot" }));
      throw new Error(error.message || "Failed to update lot");
    }

    const data = await response.json();
    return {
      lot: data.lot,
      success: true,
      message: "Max batch capacity updated successfully",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error while updating lot";
    console.error("Error updating lot:", error);
    throw new Error(message);
  }
}
