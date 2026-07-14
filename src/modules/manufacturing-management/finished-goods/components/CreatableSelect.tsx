"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface CreatableSelectProps {
    options: { value: string; label: string }[];
    value?: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onCreateOption?: (name: string) => Promise<void> | void;
    onKeyDown?: React.KeyboardEventHandler<HTMLButtonElement>;
    "data-index"?: number;
    popoverClassName?: string;
    "aria-label"?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
}

export function CreatableSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select option...",
    disabled = false,
    className,
    onCreateOption,
    onKeyDown,
    "data-index": dataIndex,
    popoverClassName,
    "aria-label": ariaLabel,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
}: CreatableSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");

    // Find the label for the current value
    const selectedLabel = React.useMemo(() => {
        return options.find((opt) => opt.value === value)?.label;
    }, [options, value]);

    const handleCreate = async () => {
        if (!onCreateOption || !searchQuery.trim()) return;
        await onCreateOption(searchQuery.trim());
        setSearchQuery("");
        setOpen(false);
    };

    const filteredOptions = React.useMemo(() => {
        if (!searchQuery.trim()) return options;
        return options.filter((opt) =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [options, searchQuery]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", !value && "text-muted-foreground", className)}
                    disabled={disabled}
                    onKeyDown={onKeyDown}
                    data-index={dataIndex}
                    aria-label={ariaLabel}
                    aria-invalid={ariaInvalid}
                    aria-describedby={ariaDescribedBy}
                >
                    <span className="truncate">{selectedLabel || placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", popoverClassName)} align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={`Search ${placeholder.toLowerCase()}...`}
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                    />
                    <CommandList>
                        {filteredOptions.length === 0 && (
                            <CommandEmpty className="py-2 px-3 text-xs flex flex-col gap-2">
                                <span>No results found.</span>
                                {onCreateOption && searchQuery.trim() !== "" && (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="w-full text-[10px] inline-flex items-center gap-1 justify-center py-1 h-auto"
                                        onClick={handleCreate}
                                    >
                                        <Plus className="h-3 w-3" /> Create &quot;{searchQuery}&quot;
                                    </Button>
                                )}
                            </CommandEmpty>
                        )}
                        <CommandGroup>
                            {filteredOptions.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.value}
                                    onSelect={() => {
                                        onValueChange(opt.value);
                                        setOpen(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === opt.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {opt.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
