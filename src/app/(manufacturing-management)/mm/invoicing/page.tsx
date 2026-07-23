import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NavUser } from "@/components/shared/app-sidebar/nav-user";
import { cookies } from "next/headers";
import InvoicingModule from "@/modules/manufacturing-management/invoicing/InvoicingModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headerUser(token?: string) {
    try {
        const payload = JSON.parse(Buffer.from((token?.split(".")[1] || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
        const first = payload.Firstname || payload.FirstName || payload.firstName || payload.firstname || payload.first_name || "";
        const last = payload.LastName || payload.Lastname || payload.lastName || payload.lastname || payload.last_name || "";
        const email = payload.email || payload.Email || "";
        return { name: [first, last].filter(Boolean).join(" ") || email || "User", email, avatar: "/avatars/shadcn.jpg" };
    } catch { return { name: "User", email: "", avatar: "/avatars/shadcn.jpg" }; }
}

export default async function InvoicingPage() {
    const user = headerUser((await cookies()).get("vos_access_token")?.value);
    return <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-10 flex h-14 shrink-0 items-center justify-between overflow-hidden border-b bg-background shadow-sm sm:h-16">
            <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden px-3 sm:px-4"><SidebarTrigger className="-ml-1 shrink-0" /><Separator orientation="vertical" className="mr-2 hidden shrink-0 data-[orientation=vertical]:h-4 sm:block" /><Breadcrumb><BreadcrumbList><BreadcrumbItem className="hidden md:block"><BreadcrumbLink href="#">Manufacturing</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator className="hidden md:block" /><BreadcrumbItem><BreadcrumbPage>Sales Order Invoicing</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb></div>
            <div className="flex h-full shrink-0 items-center px-2 sm:px-4"><NavUser user={user} /></div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background p-2 sm:p-4"><InvoicingModule /></main>
    </div>;
}
