"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PencilIcon } from "lucide-react";
import type { Lot } from "../type";

interface LotManagementTableProps {
  lots: Lot[];
  isLoading: boolean;
  isLotFull: (lot: Lot) => boolean;
  onEditLot: (lot: Lot) => void;
}

export function LotManagementTable({ lots, isLoading, isLotFull, onEditLot }: LotManagementTableProps) {
  return (
    <div className="flex-1 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
      <Table>
        <TableHeader className="border-b border-gray-200 dark:border-gray-700">
          <TableRow className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
            <TableHead>Lot</TableHead>
            <TableHead>Inventory Type</TableHead>
            <TableHead>Batch Occupied</TableHead>
            <TableHead>Max Batch</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="border-b border-gray-200 dark:border-gray-700">
              <TableCell colSpan={5} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : lots.length === 0 ? (
            <TableRow className="border-b border-gray-200 dark:border-gray-700">
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No lots found. Create one to get started.
              </TableCell>
            </TableRow>
          ) : (
            lots.map((lot) => {
              const isFull = isLotFull(lot);
              return (
                <TableRow
                  key={lot.lot_id}
                  className={isFull ? "bg-red-50 dark:bg-red-950/20 border-b border-gray-200 dark:border-gray-700 hover:bg-red-100 dark:hover:bg-red-950/30" : "border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900"}
                >
                  <TableCell className="font-medium h-14">{lot.lot_name}</TableCell>
                  <TableCell className="h-14">{lot.inventory_type_name || "Unknown"}</TableCell>
                  <TableCell className="h-14">
                    <div className="flex items-center gap-2">
                      <span>{lot.occupied_count || 0}</span>
                      {isFull && (
                        <Badge variant="destructive" className="text-xs">
                          full
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="h-14">
                    <span>{lot.max_batch_capacity}</span>
                  </TableCell>
                  <TableCell className="text-right h-14">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditLot(lot)}
                      className="h-8 w-8 p-0"
                      title="Edit max batch capacity"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
