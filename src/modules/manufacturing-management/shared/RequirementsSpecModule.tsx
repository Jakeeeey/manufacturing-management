"use client";

import React, { useState } from "react";
import { ClipboardList, User, Award, CheckSquare, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

interface RequirementSpec {
    title: string;
    targetUser: string;
    userStory: string;
    functions: string[];
}

const SPECS_REGISTRY: Record<string, RequirementSpec> = {
    "suppliers": {
        title: "Suppliers & Vendors Directory",
        targetUser: "Procurement Team",
        userStory: "As a Procurement Officer, I want to manage supplier profiles and track currency options so we ensure raw material purchases map to valid contracts.",
        functions: [
            "Maintain supplier registry with tax identifiers (TIN) and banking info.",
            "Associate base transaction currencies (USD, PHP, etc.) per supplier.",
            "Record delivery lead times and shipment capabilities.",
            "Track vendor contracts and valid price listings."
        ]
    },
    "incoming-shipments": {
        title: "Incoming Shipments & Freight Log",
        targetUser: "Logistics Team & Cost Accountant",
        userStory: "As a Logistics Coordinator, I want to track arrival dates and Bill of Lading (BL) details so we can align raw inventory arrivals with production schedules.",
        functions: [
            "Log shipment PO references, vessel details, container sizes, and BL numbers.",
            "Track dynamic status phases (Shipped, Port of Origin, Customs, Received).",
            "Log estimated time of arrival (ETA) versus actual arrival date.",
            "Trigger automated alerts for customs clearing document submissions."
        ]
    },
    "shipment-expenses": {
        title: "Shipment Expenses Allocation (Landed Cost Engine)",
        targetUser: "Logistics Coordinator & Cost Accountant",
        userStory: "As a Cost Accountant, I want to attribute custom duties, brokerages, trucking, and shipping line charges directly to an incoming cargo container so the inventory values reflect full acquisition costs.",
        functions: [
            "Add brokerage, customs duties, freight, trucking, and insurance charges.",
            "Attribute local costs by volume, weight, or commercial value ratios.",
            "Link expenses to a specific incoming shipment ID.",
            "Compute dynamically rolled-up Landed Cost indicators per raw inventory item."
        ]
    },
    "raw-materials": {
        title: "Raw Materials Master",
        targetUser: "Procurement & Warehousing",
        userStory: "As an Operations Manager, I want a read-only consolidated view of raw materials and packaging items with their computed unit costs so we can audit landed cost histories.",
        functions: [
            "Display list of all raw ingredients, containers, caps, and boxes.",
            "Audit logs showing live landed costs from recent incoming shipment rolls.",
            "Map base storage UOMs (Metric Tons, Drums) against recipe consumption UOMs.",
            "Display current stock availability metrics across active warehouse locations."
        ]
    },
    "clients": {
        title: "Customer Directory & Tin Registry",
        targetUser: "Sales Team",
        userStory: "As a Sales Manager, I want to look up customer billing profiles and tax registers so we can issue valid pricing quotations.",
        functions: [
            "Register corporate customers with verified TIN and billing addresses.",
            "Configure default credit thresholds and aging allowance settings.",
            "Link client profiles with pricing logs and margins indexes."
        ]
    },
    "quotation-builder": {
        title: "Quotation Builder Core",
        targetUser: "Pricing Analyst & Sales Team",
        userStory: "As a Pricing Analyst, I want to compile multi-tier quotations and attach delivery profiles so that pricing reflects customized margins.",
        functions: [
            "Build customizable draft quotation spreadsheets.",
            "Retrieve finished goods base unit costs dynamically.",
            "Attach shipping logs and delivery profile multipliers.",
            "Trigger manager approval routes if gross margins drop below critical levels."
        ]
    },
    "cost-snapshots": {
        title: "Cost Snapshots & Auditing",
        targetUser: "Cost Accountant & Finance Manager",
        userStory: "As an Auditor, I want to review frozen snapshots of recipe costs captured at quotation issuance so that historical pricing variances remain inspectable.",
        functions: [
            "Freeze pricing snapshots upon invoice/quotation confirmation.",
            "Archive historical bill-of-materials and routing structures.",
            "Generate comparison grids between quote cost structure and live costs."
        ]
    },
    "logistics-profiles": {
        title: "Logistics Profiles Configurations",
        targetUser: "System Admins & Operations",
        userStory: "As a Logistics Manager, I want to set default delivery trip costs (fuel, helper fee, driver allowance) so the quotation engine automates dispatch overhead.",
        functions: [
            "Maintain baseline delivery vehicle templates.",
            "Configure flat-rates or dynamic fuel indexes per shipping route.",
            "Incorporate toll fees and allowance metrics."
        ]
    },
    "forex-manager": {
        title: "Forex Rate Manager",
        targetUser: "Finance Admins",
        userStory: "As a Treasury Officer, I want to update currency indices so we have real-time landed cost conversion multipliers.",
        functions: [
            "Synchronize USD to PHP conversion multipliers.",
            "Maintain daily historical currency tables.",
            "Lock specific forex ratios for active raw procurement shipments."
        ]
    },
    "uom-conversions": {
        title: "UOM Conversions & Density Matrix",
        targetUser: "Production & Engineering",
        userStory: "As an Operations Specialist, I want to configure conversion ratios (e.g., converting Metric Tons purchased to Liters consumed via density parameters) so recipes utilize matching scales.",
        functions: [
            "Configure volumetric to gravimetric density factors per oil type.",
            "Define conversion matrices (Metric Tons ➔ Kilograms ➔ Liters).",
            "Enforce standardized UOM validation rules on recipe creations."
        ]
    },
    "approval-workflows": {
        title: "Approval Threshold Workflows",
        targetUser: "System Administrators & Directors",
        userStory: "As a Finance Director, I want to dictate threshold rules so that quotes with weak margins require executive approvals before sending.",
        functions: [
            "Define gross margin approval tiers (e.g. GM approval needed if margin < 15%).",
            "Establish alert rules and notifications for pending approvals.",
            "Track approvals, rejections, and review comment histories."
        ]
    },
    "cost-variance": {
        title: "Cost Variance Analytics & Dashboards",
        targetUser: "Executive Team & Cost Accountants",
        userStory: "As a Finance Director, I want to see visual trends of standard manufacturing costs versus actual landed costs so we can adjust retail pricing matrices.",
        functions: [
            "Plot standard costing averages against landed cost changes.",
            "Flag specific ingredients experiencing persistent cost spikes.",
            "Export data sheets for executive margin planning."
        ]
    },
    "manufacturing-qa": {
        title: "Manufacturing Quality Assurance (JO Inspection)",
        targetUser: "QA Inspectors & Production Supervisors",
        userStory: "As a Quality Assurance Inspector, I want a dedicated command console to audit completed or active Job Orders, record quality control check results (Pass/Fail count), and log defect reasons so that only approved batches are released to Finished Goods inventory.",
        functions: [
            "Retrieve active/completed Job Orders from the floor queue.",
            "Record validation counts (Pass Qty, Fail Qty, defect details).",
            "Log audit checkpoints, inspect dates, and inspector assignments.",
            "Release approved quantities to the Finished Goods master inventory."
        ]
    }
};

export default function RequirementsSpecModule({ slug }: { slug: string }) {
    const specKey = slug.toLowerCase().replace("/mm/", "");
    const spec = SPECS_REGISTRY[specKey] || {
        title: "Module In Development",
        targetUser: "Operations & Finance Users",
        userStory: `As a VOS ERP user, I want to access the ${specKey || "requested"} module to run my business operations.`,
        functions: [
            "Standard module interface templates.",
            "Dynamic data connections with database entities.",
            "Security checks and permission scopes."
        ]
    };

    const [feedback, setFeedback] = useState("");
    const [alignmentSelected, setAlignmentSelected] = useState<string>("aligned");

    const handleSubmitFeedback = (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedback.trim()) {
            toast.error("Feedback cannot be blank");
            return;
        }
        
        // Simulating submission for client alignment meeting
        toast.success(`Feedback recorded! Status: ${alignmentSelected.toUpperCase()}`);
        setFeedback("");
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-background rounded-xl border space-y-8">
            {/* Header / Title */}
            <div className="flex items-start justify-between border-b pb-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                        <ClipboardList className="h-3.5 w-3.5" />
                        Scoping Spec Sheet
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-2">{spec.title}</h1>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1.5 rounded-lg border">
                    <User className="h-3.5 w-3.5" />
                    Target: {spec.targetUser}
                </div>
            </div>

            {/* Layout */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Specs Section */}
                <div className="md:col-span-2 space-y-6">
                    {/* User Story (Why) */}
                    <div className="rounded-xl border bg-muted/10 p-5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                            <Award className="h-4 w-4 text-primary" />
                            User Story (The &quot;Why&quot;)
                        </div>
                        <p className="text-sm font-medium leading-relaxed italic text-foreground/80">
                            &quot;{spec.userStory}&quot;
                        </p>
                    </div>

                    {/* Functions Expected (What) */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-emerald-500" />
                            Expected Functional Scopes (The &quot;What&quot;)
                        </h3>
                        <div className="space-y-2">
                            {spec.functions.map((f, i) => (
                                <div key={i} className="flex gap-2 text-sm items-start border bg-card p-3 rounded-lg">
                                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold mt-0.5">
                                        {i + 1}
                                    </span>
                                    <span className="text-muted-foreground">{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Alignment Panel */}
                <div className="md:col-span-1 rounded-xl border bg-card p-5 shadow-sm space-y-4 h-fit">
                    <h3 className="text-sm font-bold flex items-center gap-1.5 border-b pb-2">
                        <MessageSquare className="h-4 w-4 text-amber-500" />
                        Client Alignment
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                        Use this sandbox to capture client changes or validation approvals during scoping meetings.
                    </p>

                    <form onSubmit={handleSubmitFeedback} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">Alignment Status</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAlignmentSelected("aligned")}
                                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all ${
                                        alignmentSelected === "aligned"
                                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                                            : "bg-transparent border-border hover:bg-muted"
                                    }`}
                                >
                                    Aligned
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAlignmentSelected("changes")}
                                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all ${
                                        alignmentSelected === "changes"
                                            ? "bg-amber-500/10 border-amber-500 text-amber-600"
                                            : "bg-transparent border-border hover:bg-muted"
                                    }`}
                                >
                                    Needs Review
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">Meeting Feedback Notes</label>
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="Type client requested modifications or comments..."
                                rows={4}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
                        >
                            <Send className="h-3 w-3" />
                            Submit Feedback
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
