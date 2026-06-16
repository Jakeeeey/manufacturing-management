"use client";

import React from "react";
import { useCalendarOfSchedule } from "./hooks/useCalendarOfSchedule";
import { CalendarGrid } from "./components/CalendarGrid";
import { ScheduleDetailsPanel } from "./components/ScheduleDetailsPanel";

export default function CalendarOfScheduleModule() {
    const {
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
    } = useCalendarOfSchedule();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
                <div>
                    <h3 className="text-base font-bold text-foreground">Calendar of Schedule</h3>
                    <p className="text-xs text-muted-foreground">Monitor production floor schedules, scheduled runs, and trace incoming material shipments (ETA) on a monthly visual cockpit.</p>
                </div>
                
                {/* Filter Selector tabs */}
                <div className="flex rounded-lg border bg-muted/10 p-0.5 text-xs font-bold w-fit">
                    <button
                        onClick={() => setFilterMode("all")}
                        className={`px-3 py-1 rounded-md transition-colors ${
                            filterMode === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        All Schedules
                    </button>
                    <button
                        onClick={() => setFilterMode("jo")}
                        className={`px-3 py-1 rounded-md transition-colors ${
                            filterMode === "jo" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Job Orders Only
                    </button>
                    <button
                        onClick={() => setFilterMode("shipments")}
                        className={`px-3 py-1 rounded-md transition-colors ${
                            filterMode === "shipments" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Incoming ETAs
                    </button>
                </div>
            </div>

            {/* Calendar & Details Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                
                {/* Main Calendar View (Left Column) */}
                <div className="lg:col-span-3">
                    <CalendarGrid
                        currentDate={currentDate}
                        jobOrders={jobOrders}
                        shipments={shipments}
                        filterMode={filterMode}
                        loadingShipments={loadingShipments}
                        handleSelectJO={handleSelectJO}
                        handleSelectShipment={handleSelectShipment}
                        nextMonth={nextMonth}
                        prevMonth={prevMonth}
                        handleResetDate={handleResetDate}
                    />
                </div>

                {/* Details side Panel (Right Column) */}
                <div className="space-y-6">
                    <ScheduleDetailsPanel
                        selectedJO={selectedJO}
                        setSelectedJO={setSelectedJO}
                        selectedShipment={selectedShipment}
                        setSelectedShipment={setSelectedShipment}
                    />
                </div>

            </div>
        </div>
    );
}
