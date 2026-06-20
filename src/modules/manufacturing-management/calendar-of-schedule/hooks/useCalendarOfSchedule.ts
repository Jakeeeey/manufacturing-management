import { useState, useEffect } from "react";
import { JobOrder, IncomingShipment } from "../types";
import { fetchShipments } from "../services/calendar-api";

export function useCalendarOfSchedule() {
    const [currentDate, setCurrentDate] = useState(new Date());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
    
    // Shipments state
    const [shipments, setShipments] = useState<IncomingShipment[]>([]);
    const [loadingShipments, setLoadingShipments] = useState(false);
    const [loadingJOs, setLoadingJOs] = useState(false);
    
    // Filter controls
    const [filterMode, setFilterMode] = useState<"all" | "jo" | "shipments">("all");
    
    // Selected entity detail pane
    const [selectedJO, setSelectedJO] = useState<JobOrder | null>(null);
    const [selectedShipment, setSelectedShipment] = useState<IncomingShipment | null>(null);

    const loadData = async () => {
        setLoadingShipments(true);
        setLoadingJOs(true);
        try {
            const [shipmentsRes, joRes] = await Promise.allSettled([
                fetchShipments(),
                fetch("/api/manufacturing/planning-engineering").then(res => {
                    if (!res.ok) throw new Error("Failed to load Job Orders");
                    return res.json();
                })
            ]);
            
            if (shipmentsRes.status === "fulfilled") {
                setShipments(shipmentsRes.value);
            } else {
                console.error("Error fetching shipments:", shipmentsRes.reason);
            }
            
            if (joRes.status === "fulfilled") {
                // Map camelCase fields if necessary, but route.ts already returns mapped fields
                setJobOrders(joRes.value);
            } else {
                console.error("Error fetching job orders:", joRes.reason);
            }
        } catch (e) {
            console.error("Error loading calendar schedule data:", e);
        } finally {
            setLoadingShipments(false);
            setLoadingJOs(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const nextMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const prevMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleSelectJO = (jo: JobOrder) => {
        setSelectedShipment(null);
        setSelectedJO(jo);
    };

    const handleSelectShipment = (ship: IncomingShipment) => {
        setSelectedJO(null);
        setSelectedShipment(ship);
    };

    const handleResetDate = () => {
        setCurrentDate(new Date());
    };

    return {
        currentDate,
        jobOrders,
        shipments,
        loadingShipments,
        filterMode,
        setFilterMode,
        selectedJO,
        setSelectedJO,
        selectedShipment,
        setSelectedShipment,
        nextMonth,
        prevMonth,
        handleSelectJO,
        handleSelectShipment,
        handleResetDate
    };
}
