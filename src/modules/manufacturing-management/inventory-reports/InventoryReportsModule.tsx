"use client";

import React from "react";
import { useInventoryReports } from "./hooks/useInventoryReports";
import InventoryMovementReport from "./components/InventoryMovementReport";

export default function InventoryReportsModule() {
    const store = useInventoryReports();

    return (
        <div className="space-y-4">
            <InventoryMovementReport {...store} />
        </div>
    );
}
