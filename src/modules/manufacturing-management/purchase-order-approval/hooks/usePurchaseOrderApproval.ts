import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { IncomingShipment, ShipmentLineItem, Supplier } from "../../procurement/types";
import type { PurchaseOrderListQuery } from "../../purchase-order/types";
import { fetchSuppliers } from "../../procurement/services/procurement-api";
import {
    fetchPurchaseOrderLines,
    fetchPurchaseOrders,
    submitPurchaseOrderApproval,
    updatePurchaseOrderStatus
} from "../../purchase-order/services/purchase-order-api";

export function usePurchaseOrderApproval() {
    const [loading, setLoading] = useState(false);
    const [shipments, setShipments] = useState<IncomingShipment[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [selectedShipment, setSelectedShipment] = useState<IncomingShipment | null>(null);
    const [selectedShipmentLines, setSelectedShipmentLines] = useState<ShipmentLineItem[]>([]);
    const listController = useRef<AbortController | null>(null);
    const detailController = useRef<AbortController | null>(null);
    const lastQuery = useRef<PurchaseOrderListQuery>({ limit: 100 });

    const load = useCallback(async (query: PurchaseOrderListQuery = lastQuery.current) => {
        lastQuery.current = query;
        listController.current?.abort();
        const controller = new AbortController();
        listController.current = controller;
        setLoading(true);
        try {
            const [orders, supplierRows] = await Promise.all([
                fetchPurchaseOrders(query, controller.signal),
                fetchSuppliers()
            ]);
            setShipments(orders.data);
            setSuppliers(supplierRows);
        } catch (error) {
            if ((error as Error).name !== "AbortError") toast.error((error as Error).message || "Failed to load approval queue.");
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        return () => {
            listController.current?.abort();
            detailController.current?.abort();
        };
    }, [load]);

    useEffect(() => {
        detailController.current?.abort();
        if (!selectedShipment) {
            setSelectedShipmentLines([]);
            return;
        }
        const controller = new AbortController();
        detailController.current = controller;
        fetchPurchaseOrderLines(selectedShipment.shipment_id, controller.signal)
            .then(setSelectedShipmentLines)
            .catch(error => {
                if (error.name !== "AbortError") toast.error(error.message || "Failed to load purchase-order details.");
            });
        return () => controller.abort();
    }, [selectedShipment]);

    const approve = async (id: number, eta: string, approvedPrices: Record<number, number>) => {
        await submitPurchaseOrderApproval(id, { action: "approve", lead_time_receiving: eta, approvedPrices });
        await load();
    };

    const reject = async (id: number, remarks: string) => {
        await submitPurchaseOrderApproval(id, { action: "reject", remarks });
        await load();
    };

    const updateStatus = async (id: number, status: IncomingShipment["status"]) => {
        await updatePurchaseOrderStatus(id, status);
        await load();
    };

    return {
        loading, shipments, suppliers, selectedShipment, setSelectedShipment, selectedShipmentLines, approve, reject, updateStatus, load
    };
}
