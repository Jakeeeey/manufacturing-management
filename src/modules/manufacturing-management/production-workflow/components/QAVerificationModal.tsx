"use client";

import React from "react";
import { CheckSquare, Camera, Upload, X, AlertTriangle, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { JobOrder, QaTaskInfo } from "../types";

interface QAVerificationModalProps {
    showQADialog: boolean;
    setShowQADialog: (show: boolean) => void;
    qaTaskInfo: QaTaskInfo | null;
    setQaTaskInfo: (info: null) => void;
    actualQty: string;
    setActualQty: (qty: string) => void;
    qaComments: string;
    setQaComments: (comments: string | ((prev: string) => string)) => void;
    isQALoading: boolean;
    uploadedPhotos: string[];
    setUploadedPhotos: (photos: string[]) => void;
    uploading: boolean;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleRemovePhoto: (id: string) => Promise<void>;
    handleVerifyQAForTask: (
        jo: JobOrder,
        productId: number,
        routingId: number,
        qaStatus: "Passed" | "Pending",
        actualQty?: number,
        comments?: string,
        photos?: string[],
        skipQA?: boolean
    ) => Promise<void>;
}

export function QAVerificationModal({
    showQADialog,
    setShowQADialog,
    qaTaskInfo,
    setQaTaskInfo,
    actualQty,
    setActualQty,
    qaComments,
    setQaComments,
    isQALoading,
    uploadedPhotos,
    setUploadedPhotos,
    uploading,
    handlePhotoUpload,
    handleRemovePhoto,
    handleVerifyQAForTask
}: QAVerificationModalProps) {
    if (!showQADialog || !qaTaskInfo) return null;

    const exp = qaTaskInfo.expected;
    const act = parseFloat(actualQty);
    const hasDiscrepancy = !isNaN(act) && act < exp;
    const loss = exp - act;

    const handleClose = () => {
        setShowQADialog(false);
        setQaTaskInfo(null);
        setUploadedPhotos([]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                        <CheckSquare className="h-4.5 w-4.5 text-emerald-500" />
                        Step Yield QA Check-in
                    </h3>
                    <button
                        onClick={handleClose}
                        className="text-muted-foreground hover:text-foreground transition-colors border-none bg-transparent cursor-pointer text-xs"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-4 text-xs">
                    {/* Current Step Info */}
                    <div className="p-3 bg-slate-955/40 border border-slate-800 rounded-xl text-xs space-y-0.5">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Active Operation Step</span>
                        <span className="font-extrabold text-foreground text-sm">{qaTaskInfo.taskName}</span>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">Expected Qty</label>
                                <input
                                    type="number"
                                    disabled
                                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-muted-foreground font-semibold cursor-not-allowed"
                                    value={qaTaskInfo.expected}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase mb-1">Actual Yield Qty</label>
                                <input
                                    type="number"
                                    step="any"
                                    className="w-full bg-slate-955 border border-slate-800 rounded-lg px-3 py-2 text-xs text-foreground font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    value={actualQty}
                                    onChange={(e) => setActualQty(e.target.value)}
                                    placeholder="Enter quantity"
                                />
                            </div>
                        </div>

                        {/* Preset Yield Buttons for Easy Tablet Tap */}
                        <div className="space-y-1">
                            <span className="block text-[8px] font-bold text-muted-foreground/60 uppercase">Quick Adjustments (Taps)</span>
                            <div className="flex flex-wrap gap-1">
                                <button
                                    type="button"
                                    onClick={() => setActualQty(qaTaskInfo.expected.toString())}
                                    className="px-2 py-1 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold cursor-pointer hover:bg-slate-850"
                                >
                                    Match Expected (100%)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentVal = parseFloat(actualQty) || 0;
                                        setActualQty(Math.max(0, currentVal - 1).toString());
                                    }}
                                    className="px-2 py-1 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold cursor-pointer hover:bg-slate-850"
                                >
                                    -1 Unit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentVal = parseFloat(actualQty) || 0;
                                        setActualQty(Math.max(0, currentVal - 5).toString());
                                    }}
                                    className="px-2 py-1 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold cursor-pointer hover:bg-slate-850"
                                >
                                    -5 Units
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentVal = parseFloat(actualQty) || 0;
                                        setActualQty(Math.max(0, currentVal - 10).toString());
                                    }}
                                    className="px-2 py-1 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold cursor-pointer hover:bg-slate-850"
                                >
                                    -10 Units
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentVal = parseFloat(actualQty) || 0;
                                        setActualQty((currentVal + 1).toString());
                                    }}
                                    className="px-2 py-1 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold cursor-pointer hover:bg-slate-850"
                                >
                                    +1 Unit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentVal = parseFloat(actualQty) || 0;
                                        setActualQty((currentVal + 5).toString());
                                    }}
                                    className="px-2 py-1 bg-slate-950 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold cursor-pointer hover:bg-slate-850"
                                >
                                    +5 Units
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Yield Loss warning */}
                    {hasDiscrepancy && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-start gap-2.5">
                            <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-amber-400" />
                            <div className="space-y-0.5">
                                <span className="font-extrabold block text-[10px]">Yield Discrepancy (Loss of {loss.toFixed(1)} Units)</span>
                                <span className="text-[9px] text-muted-foreground leading-normal block">We notice you produced fewer units than expected. Please make sure to leave a comment below explaining the cause (e.g. scrap, defective oven, operator error).</span>
                            </div>
                        </div>
                    )}

                    {/* Physical observations Comments */}
                    <div className="space-y-2">
                        <label className="block text-[9px] font-bold text-muted-foreground uppercase">Shop Floor Logs & QA Comments</label>
                        <textarea
                            className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[70px] placeholder:text-muted-foreground font-semibold"
                            value={qaComments}
                            onChange={(e) => setQaComments(e.target.value)}
                            placeholder="e.g. Oven temperature adjusted, physical count completed, scrap generated..."
                        />
                        
                        {/* Quick Comment Templates */}
                        <div className="space-y-1">
                            <span className="block text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider">Quick Templates (Tap to add)</span>
                            <div className="flex flex-wrap gap-1">
                                {[
                                    "All output passed QA successfully",
                                    "Yield loss due to cutting scrap",
                                    "Oven temperature adjusted",
                                    "Slight deviation in dimensions, approved",
                                    "Defective material sorted out",
                                    "Calibration run batch",
                                    "Machine jam cleared, output verified"
                                ].map(tpl => (
                                    <button
                                        key={tpl}
                                        type="button"
                                        onClick={() => setQaComments(prev => {
                                            if (!prev) return tpl;
                                            return prev.trim().endsWith(".") || prev.trim().endsWith(",") ? `${prev} ${tpl}` : `${prev}, ${tpl}`;
                                        })}
                                        className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg text-[9px] font-bold cursor-pointer transition-all active:scale-[0.97]"
                                    >
                                        + {tpl}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Photo capture uploads */}
                    <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                            <label className="block text-[9px] font-bold text-muted-foreground uppercase">Upload Completion Photo(s) <span className="text-destructive font-black">* Required</span></label>
                            {uploading && (
                                <div className="flex items-center gap-1 text-[9px] text-primary font-bold animate-pulse">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Uploading...</span>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                            <label className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border border-dashed border-slate-700 bg-slate-905/40 hover:bg-slate-800/20 hover:border-emerald-500/50 cursor-pointer transition-all active:scale-[0.98] ${uploading ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}>
                                <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-500">
                                    <Camera className="h-4.5 w-4.5" />
                                </div>
                                <div className="text-center">
                                    <span className="block text-[11px] font-bold text-foreground">Capture Photo</span>
                                    <span className="block text-[8px] text-muted-foreground mt-0.5 font-medium">Use device camera</span>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    disabled={uploading}
                                    onChange={handlePhotoUpload}
                                />
                            </label>

                            <label className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border border-dashed border-slate-700 bg-slate-905/40 hover:bg-slate-800/20 hover:border-emerald-500/50 cursor-pointer transition-all active:scale-[0.98] ${uploading ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}>
                                <div className="p-2 rounded-full bg-primary/10 text-primary">
                                    <Upload className="h-4.5 w-4.5" />
                                </div>
                                <div className="text-center">
                                    <span className="block text-[11px] font-bold text-foreground">Browse File</span>
                                    <span className="block text-[8px] text-muted-foreground mt-0.5 font-medium">Image files only</span>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    disabled={uploading}
                                    onChange={handlePhotoUpload}
                                />
                            </label>
                        </div>

                        {/* Uploaded items lists with directus previews */}
                        {uploadedPhotos.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                                <span className="block text-[8px] font-bold text-muted-foreground/60 uppercase">Uploaded Attachments ({uploadedPhotos.length})</span>
                                <div className="flex flex-wrap gap-2">
                                    {uploadedPhotos.map(id => (
                                        <div key={id} className="h-14 w-14 border border-slate-800 bg-slate-950 rounded-xl overflow-hidden relative group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={`${process.env.NEXT_PUBLIC_DIRECTUS_URL || "http://vtc:8074"}/assets/${id}?width=80&height=80&fit=cover`}
                                                alt="QA attachment preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePhoto(id)}
                                                className="absolute inset-0 bg-red-900/80 items-center justify-center opacity-0 group-hover:opacity-100 flex transition-opacity duration-150 border-none cursor-pointer text-white"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Confirm Dialog Trigger Button */}
                <div className="border-t border-slate-850 pt-4 flex gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-slate-800 rounded-xl border border-slate-800 bg-transparent transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={isQALoading || uploading || (uploadedPhotos.length === 0)}
                        onClick={async () => {
                            const actNum = parseFloat(actualQty);
                            if (isNaN(actNum) || actNum < 0) {
                                toast.error("Please enter a valid actual quantity produced.");
                                return;
                            }
                            if (uploadedPhotos.length === 0) {
                                toast.error("QA verify requires at least one completion photo upload for compliance audit logs.");
                                return;
                            }
                            
                            try {
                                await handleVerifyQAForTask(
                                    qaTaskInfo.jo,
                                    qaTaskInfo.productId,
                                    qaTaskInfo.routingId,
                                    "Passed",
                                    actNum,
                                    qaComments,
                                    uploadedPhotos
                                );
                                handleClose();
                            } catch (err) {
                                toast.error((err as Error).message || "Failed to save QA log");
                            }
                        }}
                        className="flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 rounded-xl border-none transition-all cursor-pointer shadow-md shadow-emerald-950/20"
                    >
                        {isQALoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving Log...
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4 stroke-[3px]" />
                                Approve & Pass
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
