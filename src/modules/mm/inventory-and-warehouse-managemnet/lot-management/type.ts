// Type definitions for Lot Management module

export interface InventoryType {
  inventory_type_id: number;
  type_name: string;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  lot_id: number;
  lot_name: string;
  inventory_type_id: number;
  max_batch_capacity: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number | null;
  // Populated from JOIN or separate query
  inventory_type_name?: string;
  // Occupied count is read-only, updated by external transaction module
  occupied_count?: number;
}

export interface CreateLotInput {
  inventory_type_id: number;
  max_batch_capacity?: number;
}

export interface UpdateLotMaxBatchInput {
  lot_id: number;
  max_batch_capacity: number;
}

export interface LotsResponse {
  lots: Lot[];
  success: boolean;
  message?: string;
}

export interface InventoryTypesResponse {
  inventoryTypes: InventoryType[];
  success: boolean;
  message?: string;
}

export interface CreateLotResponse {
  lot: Lot;
  success: boolean;
  message?: string;
}

export interface UpdateLotResponse {
  lot: Lot;
  success: boolean;
  message?: string;
}
