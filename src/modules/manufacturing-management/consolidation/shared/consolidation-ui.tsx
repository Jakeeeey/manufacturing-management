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
        <div className={cn("min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_35%)] p-4 text-foreground md:p-8", className)}>
            <div className="mx-auto max-w-[1600px] space-y-6">{children}</div>
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
        <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
            <div className="flex flex-col gap-6 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
                <div className="flex items-center gap-4">
                    <div className="rounded-2xl bg-primary p-3.5 shadow-lg shadow-primary/20">
                        <Icon className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
                        <h1 className="text-2xl font-black uppercase italic tracking-tighter md:text-4xl">
                            {title} <span className="text-primary">{accent}</span>
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
                {controls && <div className="w-full lg:w-auto">{controls}</div>}
            </div>
        </section>
    );
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
    return (
        <label className={cn("space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground", className)}>
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
        <section className={cn("overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm", className)}>
            <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-5 xl:flex-row xl:items-end xl:justify-between md:px-7">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
                    <h2 className="mt-1 text-xl font-black uppercase tracking-tight">{title}</h2>
                </div>
                {controls}
            </div>
            {children}
        </section>
    );
}

export function ConsolidationStatusBadge({ status }: { status: string }) {
    return (
        <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider", statusStyles[status] || statusStyles.Pending)}>
            {status}
        </span>
    );
}

export function ConsolidationEmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
    return (
        <div className="flex min-h-72 flex-col items-center justify-center px-5 py-12 text-center text-muted-foreground">
            <Icon className="mb-4 h-12 w-12 opacity-40" />
            <p className="font-black uppercase tracking-widest">{title}</p>
            {description && <p className="mt-2 max-w-md text-sm">{description}</p>}
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
