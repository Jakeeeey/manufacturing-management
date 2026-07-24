import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
    Pending: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Picking: "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    Picked: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    Audited: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export function ConsolidationShell({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("p-2 text-foreground sm:p-4", className)}>
            <div className="mx-auto space-y-4">{children}</div>
        </div>
    );
}

export function ConsolidationHeader({
    icon: Icon,
    eyebrow,
    title,
    accent,
    description,
    controls,
}: {
    icon: LucideIcon;
    eyebrow: string;
    title: string;
    accent: string;
    description: string;
    controls?: ReactNode;
}) {
    return (
        <section className="rounded-xl border bg-card shadow-sm">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-primary">{eyebrow}</p>
                        <h1 className="text-sm font-black uppercase tracking-wide">
                            {title} <span className="text-primary">{accent}</span>
                        </h1>
                        <p className="text-[10px] text-muted-foreground">{description}</p>
                    </div>
                </div>
                {controls && <div className="w-full sm:w-auto">{controls}</div>}
            </div>
        </section>
    );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <label className={cn("space-y-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground", className)}>
            <span>{label}</span>
            {children}
        </label>
    );
}

export function ConsolidationSection({
    eyebrow,
    title,
    controls,
    children,
    className,
}: {
    eyebrow: string;
    title: string;
    controls?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("rounded-xl border bg-card shadow-sm", className)}>
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-primary/70">{eyebrow}</p>
                    <h2 className="text-xs font-black uppercase tracking-wide">{title}</h2>
                </div>
                {controls}
            </div>
            {children}
        </section>
    );
}

export function ConsolidationStatusBadge({ status }: { status: string }) {
    return (
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", statusStyles[status] || statusStyles.Pending)}>
            {status}
        </span>
    );
}

export function ConsolidationEmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: ReactNode }) {
    return (
        <div className="flex min-h-72 flex-col items-center justify-center px-4 py-12 text-center text-muted-foreground">
            <Icon className="mb-4 h-12 w-12 opacity-40" />
            <p className="text-xs font-black uppercase tracking-wider">{title}</p>
            {description && <p className="mt-1 max-w-md text-[10px]">{description}</p>}
        </div>
    );
}

export function formatConsolidationNumber(value: number): string {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function formatConsolidationDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
