import * as React from "react";
import { type ComponentProps } from "react";
import { AppSidebarClient } from "@/components/shared/app-sidebar/app-sidebar-client";
import { getSidebarNavigation } from "@/actions/app-sidebar";
import { Sidebar } from "@/components/ui/sidebar";
import type { NavItem } from "@/types/navigation";

export async function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const items = await getSidebarNavigation("mm");

  const consolidationParent: NavItem = {
    title: "Consolidation",
    url: "#",
    slug: "consolidation",
    status: "active",
    iconName: "FileText",
    items: [
      {
        title: "Summary",
        url: "/mm/consolidation/summary",
        slug: "consolidation-summary",
        status: "active",
        iconName: "ChartNoAxesCombined",
      },
      {
        title: "Creation",
        url: "/mm/consolidation/creation",
        slug: "consolidation-creation",
        status: "active",
        iconName: "FileText",
      },
      {
        title: "Picking",
        url: "/mm/consolidation/picking",
        slug: "consolidation-picking",
        status: "active",
        iconName: "SquarePen",
      },
      {
        title: "Auditing",
        url: "/mm/consolidation/auditing",
        slug: "consolidation-auditing",
        status: "active",
        iconName: "Shield",
      },
    ],
  };

  // Replace old invoice-consolidation with new consolidation nav
  const filtered = items.filter(
    (i) => i.slug !== "invoice-consolidation"
  );

  const enhancedItems = filtered.some(
    (i) => i.slug === "consolidation"
  )
    ? filtered
    : [...filtered, consolidationParent];

  return (
    <AppSidebarClient
      {...props}
      initialItems={enhancedItems}
      subsystemTitle="Manufacturing Management"
    />
  );
}
