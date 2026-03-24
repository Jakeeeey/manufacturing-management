"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Lot } from "../type";
import { updateLotMaxBatch } from "../providers/fetchProvider";

interface EditMaxBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: Lot;
  onSuccess: () => void;
}

export function EditMaxBatchDialog({
  open,
  onOpenChange,
  lot,
  onSuccess,
}: EditMaxBatchDialogProps) {
  const [maxBatch, setMaxBatch] = useState<string>(lot.max_batch_capacity.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update max batch when lot changes
  useEffect(() => {
    setMaxBatch(lot.max_batch_capacity.toString());
  }, [lot.max_batch_capacity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const maxBatchNum = parseInt(maxBatch);
    if (isNaN(maxBatchNum) || maxBatchNum < 1) {
      toast.error("Max batch capacity must be a positive number");
      return;
    }

    const occupiedCount = lot.occupied_count || 0;
    if (maxBatchNum < occupiedCount) {
      toast.error(
        `Max batch capacity cannot be lower than current occupied count (${occupiedCount})`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await updateLotMaxBatch({
        lot_id: lot.lot_id,
        max_batch_capacity: maxBatchNum,
      });

      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update lot";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Max Batch Capacity</DialogTitle>
          <DialogDescription>
            Update the maximum batch capacity for {lot.lot_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="lot-name">Lot</Label>
              <Input
                id="lot-name"
                value={lot.lot_name}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="occupied">Current Occupied</Label>
              <Input
                id="occupied"
                value={lot.occupied_count || 0}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                New max batch must be greater than or equal to occupied count
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="max-batch">Max Batch Capacity</Label>
              <Input
                id="max-batch"
                type="number"
                min={lot.occupied_count || 1}
                value={maxBatch}
                onChange={(e) => setMaxBatch(e.target.value)}
                placeholder={lot.max_batch_capacity.toString()}
              />
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
              {isSubmitting ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
