"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

export interface SelectOption {
    value: string | number;
    label: string;
    sublabel?: string;
}

interface SearchableSelectProps {
    options: SelectOption[];
    value: string | number;
    onChange: (value: string | number) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    icon?: React.ReactNode;
    className?: string;
    required?: boolean;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select an option...",
    searchPlaceholder = "Type to search...",
    disabled = false,
    icon,
    className = "",
    required = false
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Selected option object
    const selectedOption = useMemo(() => {
        return options.find(opt => String(opt.value) === String(value)) || null;
    }, [options, value]);

    // Filtered options based on search input
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return options;
        const term = searchTerm.toLowerCase().trim();
        return options.filter(opt =>
            opt.label.toLowerCase().includes(term) ||
            (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
        );
    }, [options, searchTerm]);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleSelect = (val: string | number) => {
        onChange(val);
        setIsOpen(false);
        setSearchTerm("");
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(prev => !prev)}
                disabled={disabled}
                data-required={required}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs bg-background border border-border rounded-xl font-semibold transition-all hover:bg-muted/30 focus:outline-hidden focus:ring-2 focus:ring-primary/20 ${
                    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                } ${isOpen ? "ring-2 ring-primary/20 border-primary" : ""}`}
            >
                <div className="flex items-center gap-2.5 truncate">
                    {icon && <span className="text-primary shrink-0">{icon}</span>}
                    <span className={`truncate ${selectedOption ? "text-foreground font-bold" : "text-muted-foreground font-normal"}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : ""}`} />
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-64">
                    {/* Search Bar Input */}
                    <div className="p-2 border-b border-border bg-muted/30 relative shrink-0">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-medium"
                        />
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto p-1 divide-y divide-border/20">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => {
                                const isSelected = String(opt.value) === String(value);
                                return (
                                    <button
                                        key={String(opt.value)}
                                        type="button"
                                        onClick={() => handleSelect(opt.value)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition-all ${
                                            isSelected
                                                ? "bg-primary/10 text-primary font-bold"
                                                : "hover:bg-muted text-foreground hover:text-foreground font-medium"
                                        }`}
                                    >
                                        <div className="truncate pr-2">
                                            <div className="truncate">{opt.label}</div>
                                            {opt.sublabel && (
                                                <div className="text-[10px] text-muted-foreground font-mono truncate">{opt.sublabel}</div>
                                            )}
                                        </div>
                                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                                No matching options found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
