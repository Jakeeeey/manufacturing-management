import * as React from "react";
import { type ComponentProps } from "react";
import { AppSidebarClient } from "@/components/shared/app-sidebar/app-sidebar-client";
import { getSidebarNavigation } from "@/actions/app-sidebar";
import { Sidebar } from "@/components/ui/sidebar";
import type { NavItem } from "@/types/navigation";

export async function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const items = await getSidebarNavigation("mm");

  const invoiceConsolidationItem: NavItem = {
    title: "Invoice Consolidation",
    url: "/mm/invoice-consolidation",
    slug: "invoice-consolidation",
    status: "active",
    iconName: "FileText",
  };

  const enhancedItems = items.some(
    (i) => i.slug === "invoice-consolidation"
  )
    ? items
    : [...items, invoiceConsolidationItem];

  return (
    <AppSidebarClient
      {...props}
      initialItems={enhancedItems}
      subsystemTitle="Manufacturing Management"
    />
  );
}

