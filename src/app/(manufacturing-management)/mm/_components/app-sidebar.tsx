"use client";

import {
  Bot,
  ChartNoAxesCombined,
  CircleCheckBig,
  ClipboardList,
  FileXCorner,
  LayoutDashboard,
  ShoppingCart,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NavMain } from "./nav-main";

const data = {
  navMain: [
    {
      title: "Product Management",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "SKU Creation",
          url: "/mm/product-management/sku-creation",
          icon: ClipboardList,
        },
        {
          title: "Product Masterlist",
          url: "/mm/product-management/product-masterlist",
          icon: ClipboardList,
        },
        {
          title: "Product Catalog",
          url: "/mm/product-management/product-catalog",
          icon: ShoppingCart,
        },
      ],
    },
    {
      title: "Purchase Order",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Purchase Order Creation",
          url: "/mm/purchase-order/purchase-order-creation",
          icon: ClipboardList,
        },
        {
          title: "Purchase Order Approval",
          url: "/mm/purchase-order/purchase-order-approval",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Inventory",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Lot Registration",
          url: "/mm/inventory/lot-registration",
          icon: ClipboardList,
        },
        {
          title: "Lot and Batch Traceability",
          url: "/mm/inventory/lot-and-batch-traceability",
          icon: ClipboardList,
        },
        {
          title: "Raw Material",
          url: "/mm/inventory/raw-material",
          icon: ClipboardList,
        },
        {
          title: "Good Stock",
          url: "/mm/inventory/good-stock",
          icon: ClipboardList,
        },
        {
          title: "Bad Stock",
          url: "/mm/inventory/bad-stock",
          icon: ClipboardList,
        },
        {
          title: "Expiry and Shelf Life",
          url: "/mm/inventory/expiry-and-shelf-life",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Reports",
      url: "/mm/reports",
      icon: ClipboardList,
    },
    {
      title: "Calendar of Schedule",
      url: "/mm/calendar-of-schedule",
      icon: ClipboardList,
    },
    {
      title: "BI and Financials",
      url: "/mm/bi-and-financials",
      icon: ClipboardList,
    },
    {
      title: "File Management",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Raw Material Registration",
          url: "/mm/file-management/raw-material-registration",
          icon: ClipboardList,
        },
        {
          title: "Packaging Registration",
          url: "/mm/file-management/packaging-registration",
          icon: ClipboardList,
        },
        {
          title: "Supplier Registration",
          url: "/mm/file-management/supplier-registration",
          icon: ShoppingCart,
        },
      ],
    },
    {
      title: "Inbound",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Receiving",
          url: "/mm/inbound/receiving",
          icon: ClipboardList,
        },
        {
          title: "Sales Return",
          url: "/mm/inbound/sales-return",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Outbound",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Deliveries",
          url: "/mm/outbound/deliveries",
          icon: ClipboardList,
        },
        {
          title: "Return to Supplier",
          url: "/mm/outbound/return-to-supplier",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Planning and Engineering",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "MRP Engine",
          url: "#",
          icon: Bot,
          items: [
            {
              title: "Demand-Driven (Sales Orders)",
              url: "/mm/planning-and-engineering/mrp-engine/demand-driven",
              icon: ClipboardList,
            },
            {
              title: "Material-Driven (Consumption)",
              url: "/mm/planning-and-engineering/mrp-engine/material-driven",
              icon: ClipboardList,
            },
          ],
        },
        {
          title: "Bill of Materials and Recipes",
          url: "/mm/planning-and-engineering/bill-of-materials-and-recipes",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Production and Quality",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Scheduling",
          url: "/mm/production-and-quality/scheduling",
          icon: ClipboardList,
        },
        {
          title: "Shop Floor",
          url: "/mm/production-and-quality/shop-floor",
          icon: ClipboardList,
        },
        {
          title: "Final QA",
          url: "/mm/production-and-quality/final-qa",
          icon: ShoppingCart,
        },
      ],
    },
    {
      title: "Sales Order",
      url: "/mm/sales-order",
      icon: ClipboardList,
    },
    {
      title: "Quality Assurance Configuration",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Production Process",
          url: "/mm/quality-assurance-configuration/production-process",
          icon: ClipboardList,
        },
        {
          url: "/mm/quality-assurance-configuration/qa-production-setup-checklist",
          title: "QA Production Setup Checklist",
          icon: ClipboardList,
        },
      ],
    },
  ],
};

export function AppSidebar({
  className,
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      {...props}
      className={cn(
        "border-r border-sidebar-border/60 dark:border-white/20",
        "shadow-sm dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_16px_40px_-24px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/main-dashboard">
                <div className="flex aspect-square size-10 items-center justify-center overflow-hidden">
                  <Image
                    src="/vertex_logo_black.png"
                    alt="VOS Logo"
                    width={40}
                    height={40}
                    className="h-9 w-10 object-contain"
                    priority
                  />
                </div>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">VOS Web</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Manufacturing Management
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <div className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">
          Platform
        </div>

        <ScrollArea
          className={cn(
            "min-h-0 flex-1",
            "[&_[data-radix-scroll-area-viewport]>div]:block",
            "[&_[data-radix-scroll-area-viewport]>div]:w-full",
            "[&_[data-radix-scroll-area-viewport]>div]:min-w-0",
          )}
        >
          <div className="w-full min-w-0">
            <NavMain items={data.navMain} />
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="p-0">
        <Separator />
        <div className="py-3 text-center text-xs text-muted-foreground">
          VOS Web v2.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
