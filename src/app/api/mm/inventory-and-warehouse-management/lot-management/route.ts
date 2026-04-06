// API Route for Lot Management and Inventory Types
// Handles:
// - GET (fetch lots or inventory types based on query param)
// - POST (create lot)
// - PATCH (update lot max batch)
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
const COOKIE_NAME = "vos_access_token";

/**
 * Type for Directus lot response - inventory_type_id can be either a number or an expanded object
 */
interface DirectusLot {
  lot_id: number;
  lot_name: string;
  inventory_type_id: number | { inventory_type_id: number; type_name: string };
  max_batch_capacity: number;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

/**
 * Helper to get Directus headers
 */
function getDirectusHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DIRECTUS_TOKEN}`,
  };
}

/**
 * Get current Philippine time (UTC+8)
 */
function getCurrentPhilippineTime(): string {
  const now = new Date();
  // Add 8 hours (28800000 milliseconds) for Philippine time
  const philippineTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return philippineTime.toISOString();
}

/**
 * Decode JWT payload to get user information
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Get user ID from JWT token in cookies
 */
async function getUserIdFromToken(): Promise<number> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    throw new Error("No authentication token found");
  }

  const payload = decodeJwtPayload(token);

  // Try different possible field names for user ID
  const userId =
    payload?.user_id ||
    payload?.userId ||
    payload?.id ||
    payload?.sub;

  if (!userId || typeof userId !== "number") {
    // If userId is a string, try to parse it
    if (typeof userId === "string") {
      const parsed = parseInt(userId);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    throw new Error("Invalid user ID in token");
  }

  return Number(userId);
}

/**
 * GET /api/mm/inventory-and-warehouse-management/lot-management
 * Fetch all lots with their inventory type information and occupied count
 *
 * GET /api/mm/inventory-and-warehouse-management/lot-management?type=inventory-types
 * Fetch all inventory types
 */
export async function GET(req: NextRequest) {
  try {
    // Check if requesting inventory types
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type');

    if (type === 'inventory-types') {
      // Fetch inventory types from Directus
      const response = await fetch(`${DIRECTUS_BASE_URL}/items/manufacturing_inventory_type`, {
        method: "GET",
        headers: getDirectusHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Failed to fetch inventory types" }));
        return NextResponse.json(
          { success: false, message: error.message || "Failed to fetch inventory types" },
          { status: response.status }
        );
      }

      const data = await response.json();

      return NextResponse.json({
        success: true,
        inventoryTypes: data.data || [],
      });
    }

    // Default: Fetch lots with inventory type relationship
    const lotsResponse = await fetch(
      `${DIRECTUS_BASE_URL}/items/lots?fields=*,inventory_type_id.inventory_type_id,inventory_type_id.type_name`,
      {
        method: "GET",
        headers: getDirectusHeaders(),
        cache: "no-store",
      }
    );

    if (!lotsResponse.ok) {
      const error = await lotsResponse.json().catch(() => ({ message: "Failed to fetch lots" }));
      return NextResponse.json(
        { success: false, message: error.message || "Failed to fetch lots" },
        { status: lotsResponse.status }
      );
    }

    const lotsData = await lotsResponse.json();

    // Transform Directus response to match our type
    const lots = (lotsData.data || []).map((lot: DirectusLot) => {
      // Extract inventory_type_id - handle both object and number cases
      const inventoryTypeId = typeof lot.inventory_type_id === 'object'
        ? lot.inventory_type_id?.inventory_type_id
        : lot.inventory_type_id;

      const inventoryTypeName = typeof lot.inventory_type_id === 'object'
        ? lot.inventory_type_id?.type_name
        : "Unknown";

      // For debugging - log the first lot
      if (lot.lot_id === 1) {
        console.log('Sample lot data:', {
          original_inventory_type_id: lot.inventory_type_id,
          extracted_id: inventoryTypeId,
          extracted_name: inventoryTypeName,
        });
      }

      return {
        lot_id: lot.lot_id,
        lot_name: lot.lot_name,
        inventory_type_id: Number(inventoryTypeId),
        inventory_type_name: inventoryTypeName || "Unknown",
        max_batch_capacity: lot.max_batch_capacity,
        created_at: lot.created_at,
        updated_at: lot.updated_at,
        created_by: lot.created_by,
        updated_by: lot.updated_by,
        // For now, occupied_count is 0 (will be calculated by transaction module)
        occupied_count: 0,
      };
    });

    return NextResponse.json({
      success: true,
      lots,
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { success: false, message: "Network error while fetching data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mm/inventory-and-warehouse-management/lot-management
 * Create a new lot (Directus will auto-increment lot_id)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { inventory_type_id, max_batch_capacity = 10 } = body;

    if (!inventory_type_id) {
      return NextResponse.json(
        { success: false, message: "inventory_type_id is required" },
        { status: 400 }
      );
    }

    // Get user ID from JWT token
    const userId = await getUserIdFromToken();

    // Get the next lot number by counting existing lots
    const existingLotsResponse = await fetch(
      `${DIRECTUS_BASE_URL}/items/lots?aggregate[count]=lot_id`,
      {
        method: "GET",
        headers: getDirectusHeaders(),
        cache: "no-store",
      }
    );

    let nextLotNumber = 1;
    if (existingLotsResponse.ok) {
      const existingData = await existingLotsResponse.json();
      const count = existingData.data?.[0]?.count?.lot_id || 0;
      nextLotNumber = count + 1;
    }

    const lotName = `lot${nextLotNumber}`;

    // Get current Philippine time
    const now = getCurrentPhilippineTime();

    // Create the lot in Directus
    const response = await fetch(`${DIRECTUS_BASE_URL}/items/lots`, {
      method: "POST",
      headers: getDirectusHeaders(),
      body: JSON.stringify({
        lot_name: lotName,
        inventory_type_id,
        max_batch_capacity,
        created_by: userId,
        created_at: now,
        updated_at: now,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to create lot" }));
      return NextResponse.json(
        { success: false, message: error.errors?.[0]?.message || "Failed to create lot" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      lot: data.data,
      message: "Lot created successfully",
    });
  } catch (error) {
    console.error("Error creating lot:", error);
    const message = error instanceof Error ? error.message : "Network error while creating lot";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mm/inventory-and-warehouse-management/lot-management
 * Update max batch capacity of a lot
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { lot_id, max_batch_capacity } = body;

    if (!lot_id || max_batch_capacity === undefined) {
      return NextResponse.json(
        { success: false, message: "lot_id and max_batch_capacity are required" },
        { status: 400 }
      );
    }

    // Get user ID from JWT token
    const userId = await getUserIdFromToken();

    // Get current Philippine time
    const now = getCurrentPhilippineTime();

    // Update the lot in Directus
    const response = await fetch(`${DIRECTUS_BASE_URL}/items/lots/${lot_id}`, {
      method: "PATCH",
      headers: getDirectusHeaders(),
      body: JSON.stringify({
        max_batch_capacity,
        updated_by: userId,
        updated_at: now,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Failed to update lot" }));
      return NextResponse.json(
        { success: false, message: error.errors?.[0]?.message || "Failed to update lot" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      lot: data.data,
      message: "Max batch capacity updated successfully",
    });
  } catch (error) {
    console.error("Error updating lot:", error);
    const message = error instanceof Error ? error.message : "Network error while updating lot";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
