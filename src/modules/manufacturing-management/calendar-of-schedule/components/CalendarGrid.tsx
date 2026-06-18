import React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { JobOrder, IncomingShipment } from "../types";

interface CalendarGridProps {
    currentDate: Date;
    jobOrders: JobOrder[];
    shipments: IncomingShipment[];
    filterMode: "all" | "jo" | "shipments";
    loadingShipments: boolean;
    handleSelectJO: (jo: JobOrder) => void;
    handleSelectShipment: (ship: IncomingShipment) => void;
    nextMonth: () => void;
    prevMonth: () => void;
    handleResetDate: () => void;
}

export function CalendarGrid({
    currentDate,
    jobOrders,
    shipments,
    filterMode,
    loadingShipments,
    handleSelectJO,
    handleSelectShipment,
    nextMonth,
    prevMonth,
    handleResetDate
}: CalendarGridProps) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const daysArray: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
        daysArray.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
        daysArray.push(i);
    }

    return (
        <div className="border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col relative">
            {loadingShipments && (
                <div className="absolute inset-0 bg-background/30 backdrop-blur-xs z-30 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            )}

            {/* Calendar Month Selector Header */}
            <div className="flex justify-between items-center px-6 py-4 bg-muted/15 border-b">
                <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    <span className="font-extrabold text-foreground text-sm tracking-tight">
                        {monthNames[month]} {year}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 rounded-lg border hover:bg-muted text-muted-foreground transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleResetDate}
                        className="px-3 py-1 border hover:bg-muted text-xs font-semibold text-muted-foreground rounded-lg transition-all"
                    >
                        Today
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 rounded-lg border hover:bg-muted text-muted-foreground transition-all"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Weekday Titles */}
            <div className="grid grid-cols-7 border-b text-center py-2 bg-muted/5 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 divide-x divide-y min-h-[500px]">
                {daysArray.map((dayNum, index) => {
                    if (dayNum === null) {
                        return <div key={`empty-${index}`} className="p-2 bg-muted/5" />;
                    }

                    // Format date matching the string formats YYYY-MM-DD
                    const cellMonthStr = String(month + 1).padStart(2, "0");
                    const cellDayStr = String(dayNum).padStart(2, "0");
                    const cellDateStr = `${year}-${cellMonthStr}-${cellDayStr}`;

                    // Find JOS and Shipments matching this cell's date
                    const cellJOs = (filterMode === "all" || filterMode === "jo") 
                        ? jobOrders.filter(jo => jo.due_date === cellDateStr)
                        : [];
                        
                    const cellShipments = (filterMode === "all" || filterMode === "shipments")
                        ? shipments.filter(s => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const deliveryDate = s.estimated_delivery_date || s.actual_delivery_date || (s as any).date_received || (s as any).created_at || "";
                            return deliveryDate.split("T")[0] === cellDateStr;
                        })
                        : [];

                    const today = new Date();
                    const isToday = today.getDate() === dayNum && today.getMonth() === month && today.getFullYear() === year;

                    return (
                        <div key={dayNum} className="p-2 min-h-[90px] flex flex-col justify-between hover:bg-muted/10 transition-colors">
                            {/* Date Number Label */}
                            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                isToday 
                                    ? "bg-primary text-primary-foreground font-black" 
                                    : "text-foreground"
                            }`}>
                                {dayNum}
                            </span>

                            {/* Event pills list */}
                            <div className="space-y-1 mt-2 flex-1 flex flex-col justify-end">
                                {/* Shipments Events (ETA Blue) */}
                                {cellShipments.map(ship => (
                                    <button
                                        key={`ship-${ship.shipment_id}`}
                                        onClick={() => handleSelectShipment(ship)}
                                        className="w-full text-left truncate px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20 transition-transform hover:scale-98"
                                        title={`Cargo ETA: ${ship.reference_number} (${ship.status})`}
                                    >
                                        🚢 {ship.reference_number}
                                    </button>
                                ))}

                                {/* Job Orders Events */}
                                {cellJOs.map(jo => {
                                    let bgClass = "bg-muted text-muted-foreground border-border";
                                    if (jo.status === "Proceed") bgClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                                    else if (jo.status === "Shortage") bgClass = "bg-destructive/10 text-destructive border-destructive/20";

                                    return (
                                        <button
                                            key={`jo-${jo.jo_id}`}
                                            onClick={() => handleSelectJO(jo)}
                                            className={`w-full text-left truncate px-1.5 py-0.5 rounded text-[10px] font-semibold border ${bgClass} transition-transform hover:scale-98`}
                                            title={`Job Order: ${jo.jo_id} - ${jo.product_name}`}
                                        >
                                            {jo.is_batched ? "🔄 " : "⚙️ "}
                                            {jo.jo_id.replace("JO-", "")}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
