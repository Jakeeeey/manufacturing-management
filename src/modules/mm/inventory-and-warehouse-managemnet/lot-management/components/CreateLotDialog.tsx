"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { InventoryType } from "../type";
import { createLot } from "../providers/fetchProvider";

interface CreateLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryTypes: InventoryType[];
  onSuccess: () => void;
}

export function CreateLotDialog({
  open,
  onOpenChange,
  inventoryTypes,
  onSuccess,
}: CreateLotDialogProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [maxBatch, setMaxBatch] = useState<string>("10");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedType) {
      toast.error("Please select an inventory type");
      return;
    }

    const maxBatchNum = parseInt(maxBatch);
    if (isNaN(maxBatchNum) || maxBatchNum < 1) {
      toast.error("Max batch capacity must be a positive number");
      return;
    }

    setIsSubmitting(true);
    try {
      await createLot({
        inventory_type_id: parseInt(selectedType),
        max_batch_capacity: maxBatchNum,
      });

      // Reset form
      setSelectedType("");
      setMaxBatch("10");

      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create lot";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      // Reset form when closing
      if (!newOpen) {
        setSelectedType("");
        setMaxBatch("10");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Lot</DialogTitle>
          <DialogDescription>
            Create a new static lot location for warehouse inventory. The lot name
            will be auto-generated.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="inventory-type">Inventory Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="inventory-type">
                  <SelectValue placeholder="Select inventory type" />
                </SelectTrigger>
                <SelectContent>
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

            <div className="grid gap-2">
              <Label htmlFor="max-batch">Max Batch Capacity</Label>
              <Input
                id="max-batch"
                type="number"
                min="1"
                value={maxBatch}
                onChange={(e) => setMaxBatch(e.target.value)}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of batches this lot can hold
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create lot"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
