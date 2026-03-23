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
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Product Masterlist",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Product Catalog",
          url: "#",
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
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Purchase Order Approval",
          url: "#",
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
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Lot and Batch Traceability",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Raw Material",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Good Stock",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Bad Stock",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Expiry and Shelf Life",
          url: "#",
          icon: ClipboardList,
        },
      ],
    },
    {
      title: "Reports",
      url: "#",
      icon: ClipboardList,
    },
    {
      title: "Calendar of Schedule",
      url: "#",
      icon: ClipboardList,
    },
    {
      title: "BI and Financials",
      url: "#",
      icon: ClipboardList,
    },
    {
      title: "File Management",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Raw Material Registration",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Packaging Registration",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Supplier Registration",
          url: "#",
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
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Sales Return",
          url: "#",
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
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Return to Supplier",
          url: "#",
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
          icon: ClipboardList,
        },
        {
          title: "Bill of Materials and Recipes",
          url: "#",
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
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Shop Floor",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "Final QA",
          url: "#",
          icon: ShoppingCart,
        },
      ],
    },
    {
      title: "Sales Order",
      url: "#",
      icon: ClipboardList,
    },
    {
      title: "Quality Assurance Configuration",
      url: "#",
      icon: Bot,
      items: [
        {
          title: "Production Process",
          url: "#",
          icon: ClipboardList,
        },
        {
          title: "QA Production Setup Checklist",
          url: "#",
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
                    Customer Relationship Management
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
