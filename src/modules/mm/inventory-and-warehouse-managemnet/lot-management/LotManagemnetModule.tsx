"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusIcon, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Lot, InventoryType } from "./type";
import { fetchLots, fetchInventoryTypes } from "./providers/fetchProvider";
import { CreateLotDialog } from "./components/CreateLotDialog";
import { EditMaxBatchDialog } from "./components/EditMaxBatchDialog";
import { Input } from "@/components/ui/input";
import { LotManagementTable } from "./components/LotManagementTable";

export default function LotManagementModule() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [selectedInventoryType, setSelectedInventoryType] = useState<string>("all");
  const [selectedLotName, setSelectedLotName] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<Lot | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [lotsResult, typesResult] = await Promise.all([
        fetchLots(),
        fetchInventoryTypes(),
      ]);

      if (lotsResult.success) {
        setLots(lotsResult.lots);
      } else {
        toast.error(lotsResult.message || "Failed to load lots");
      }

      if (typesResult.success) {
        setInventoryTypes(typesResult.inventoryTypes);
      } else {
        toast.error(typesResult.message || "Failed to load inventory types");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter lots by inventory type, lot name, and search query
  const filteredLots = lots.filter((lot) => {
    // Filter by inventory type
    const matchesType =
      selectedInventoryType === "all" ||
      lot.inventory_type_id === Number(selectedInventoryType);

    // Debug first lot
    if (lot.lot_id === 1 && selectedInventoryType !== "all") {
      console.log('Filter debug:', {
        lot_name: lot.lot_name,
        lot_inventory_type_id: lot.inventory_type_id,
        selected_inventory_type: selectedInventoryType,
        selected_as_number: Number(selectedInventoryType),
        matches: matchesType,
      });
    }

    // Filter by lot name
    const matchesLotName =
      selectedLotName === "all" ||
      lot.lot_name === selectedLotName;

    // Filter by search query (lot name or inventory type name)
    const matchesSearch =
      searchQuery.trim() === "" ||
      lot.lot_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lot.inventory_type_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesType && matchesLotName && matchesSearch;
  });

  // Sort lots by lot_name (lot1, lot2, ...)
  const sortedLots = [...filteredLots].sort((a, b) => {
    const numA = parseInt(a.lot_name.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.lot_name.replace(/\D/g, "")) || 0;
    return numA - numB;
  });

  // Get unique lot names for the filter dropdown (sorted)
  const uniqueLotNames = Array.from(new Set(lots.map(lot => lot.lot_name))).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.replace(/\D/g, "")) || 0;
    return numA - numB;
  });

  // Pagination calculations
  const totalRows = sortedLots.length;
  const totalPages = Math.ceil(totalRows / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLots = sortedLots.slice(startIndex, endIndex);
  const showingFrom = totalRows === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(endIndex, totalRows);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedInventoryType, selectedLotName, searchQuery, itemsPerPage]);

  // Check if a lot is full
  const isLotFull = (lot: Lot) => {
    const occupied = lot.occupied_count || 0;
    return occupied >= lot.max_batch_capacity;
  };

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    loadData();
    toast.success("Lot created successfully");
  };

  const handleEditSuccess = () => {
    setEditingLot(null);
    loadData();
    toast.success("Max batch capacity updated successfully");
  };

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lot Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage static lot locations and batch capacity for warehouse inventory
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by lot name or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1">
            {/* Inventory Type Filter */}
            <div className="w-48">
              <Select
                value={selectedInventoryType}
                onValueChange={setSelectedInventoryType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Inventory Types" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">All Inventory Types</SelectItem>
                  {inventoryTypes.map((type) => (
                    <SelectItem
                      key={type.inventory_type_id}
                      value={type.inventory_type_id.toString()}
                    >
                      {type.type_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lot Name Filter */}
            <div className="w-32">
              <Select
                value={selectedLotName}
                onValueChange={setSelectedLotName}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Lots" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  <SelectItem value="all">All Lots</SelectItem>
                  {uniqueLotNames.map((lotName) => (
                    <SelectItem
                      key={lotName}
                      value={lotName}
                    >
                      {lotName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create lot
          </Button>
        </div>
      </div>

      {/* Table */}
      <LotManagementTable
        lots={paginatedLots}
        isLoading={isLoading}
        isLotFull={isLotFull}
        onEditLot={setEditingLot}
      />

      {/* Pagination */}
      {totalRows > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Showing {showingFrom} to {showingTo} of {totalRows} row(s)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateLotDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        inventoryTypes={inventoryTypes}
        onSuccess={handleCreateSuccess}
      />

      {editingLot && (
        <EditMaxBatchDialog
          open={!!editingLot}
          onOpenChange={(open) => !open && setEditingLot(null)}
          lot={editingLot}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}
