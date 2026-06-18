import { useState, useEffect } from "react";
import { JobOrder, IncomingShipment } from "../types";
import { fetchShipments } from "../services/calendar-api";

export function useCalendarOfSchedule() {
    const [currentDate, setCurrentDate] = useState(new Date());
// eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [jobOrders, setJobOrders] = useState<JobOrder[]>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("vos_job_orders");
            if (saved) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error(e);
                }
            }
        }
        return [];
    });
    
    // Shipments state
    const [shipments, setShipments] = useState<IncomingShipment[]>([]);
    const [loadingShipments, setLoadingShipments] = useState(false);
    
    // Filter controls
    const [filterMode, setFilterMode] = useState<"all" | "jo" | "shipments">("all");
    
    // Selected entity detail pane
    const [selectedJO, setSelectedJO] = useState<JobOrder | null>(null);
    const [selectedShipment, setSelectedShipment] = useState<IncomingShipment | null>(null);

    const loadData = async () => {
        setLoadingShipments(true);
        try {
            const data = await fetchShipments();
            setShipments(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingShipments(false);
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
