"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useProductionWorkflow } from "./hooks/useProductionWorkflow";
import { OperatorQueue } from "./components/OperatorQueue";
import { WorkflowStation } from "./components/WorkflowStation";
import { OperatorAssignmentModal } from "./components/OperatorAssignmentModal";
import { QAVerificationModal } from "./components/QAVerificationModal";
import { FinishedGoodsReceiptModal } from "./components/FinishedGoodsReceiptModal";

export default function ProductionWorkflowModule() {
    const {
        jobOrders,
        users,
        loading,
        selectedJoId,
        setSelectedJoId,
        selectedJO,
        productsList,
        allStepsCompleted,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredJOs,
        activeJOs,
        selectedDayNum,
        setSelectedDayNum,
        activeAssigningTask,
        setActiveAssigningTask,
        assigningStepKeys,
        operatorSearchText,
        setOperatorSearchText,
        userWorkloads,
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
        yieldQties,
        setYieldQties,
        lotNumbers,
        setLotNumbers,
        expiryDates,
        setExpiryDates,
        submittingReceipt,
        completedReceipt,
        setCompletedReceipt,
        handlePhotoUpload,
        handleRemovePhoto,
        handleOpenQADialog,
        handlePrintReceipt,
        handleUpdateJO,
        handleToggleOperatorForTask,
        handleVerifyQAForTask,
        handleSubmitFinishedReceipt
    } = useProductionWorkflow();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-xs font-semibold">Loading Shop Floor Production Workspace...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left 1/3: Active Production Queue */}
                <div className={selectedJoId ? "hidden lg:block" : "block"}>
                    <OperatorQueue
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        filteredJOs={filteredJOs}
                        activeJOs={activeJOs}
                        selectedJoId={selectedJoId}
                        setSelectedJoId={setSelectedJoId}
                    />
                </div>

                {/* Right 2/3: Selected Workflow Operator Station */}
                <div className={`${selectedJoId ? "block" : "hidden lg:block"} lg:col-span-2 space-y-6`}>
                    <WorkflowStation
                        selectedJO={selectedJO}
                        selectedDayNum={selectedDayNum}
                        setSelectedDayNum={setSelectedDayNum}
                        handleUpdateJO={handleUpdateJO}
                        productsList={productsList}
                        assigningStepKeys={assigningStepKeys}
                        setActiveAssigningTask={setActiveAssigningTask}
                        setOperatorSearchText={setOperatorSearchText}
                        users={users}
                        handleToggleOperatorForTask={handleToggleOperatorForTask}
                        handleOpenQADialog={handleOpenQADialog}
                        handleVerifyQAForTask={handleVerifyQAForTask}
                        allStepsCompleted={allStepsCompleted}
                        handleSubmitFinishedReceipt={handleSubmitFinishedReceipt}
                        yieldQties={yieldQties}
                        setYieldQties={setYieldQties}
                        lotNumbers={lotNumbers}
                        setLotNumbers={setLotNumbers}
                        expiryDates={expiryDates}
                        setExpiryDates={setExpiryDates}
                        submittingReceipt={submittingReceipt}
                        activeJOs={activeJOs}
                        onBackToQueue={() => setSelectedJoId(null)}
                    />
                </div>
            </div>

            {/* Overlays */}
            <OperatorAssignmentModal
                activeAssigningTask={activeAssigningTask}
                setActiveAssigningTask={setActiveAssigningTask}
                operatorSearchText={operatorSearchText}
                setOperatorSearchText={setOperatorSearchText}
                jobOrders={jobOrders}
                users={users}
                userWorkloads={userWorkloads}
                assigningStepKeys={assigningStepKeys}
                handleToggleOperatorForTask={handleToggleOperatorForTask}
            />

            <QAVerificationModal
                showQADialog={showQADialog}
                setShowQADialog={setShowQADialog}
                qaTaskInfo={qaTaskInfo}
                setQaTaskInfo={setQaTaskInfo}
                actualQty={actualQty}
                setActualQty={setActualQty}
                qaComments={qaComments}
                setQaComments={setQaComments}
                isQALoading={isQALoading}
                uploadedPhotos={uploadedPhotos}
                setUploadedPhotos={setUploadedPhotos}
                uploading={uploading}
                handlePhotoUpload={handlePhotoUpload}
                handleRemovePhoto={handleRemovePhoto}
                handleVerifyQAForTask={handleVerifyQAForTask}
            />

            <FinishedGoodsReceiptModal
                completedReceipt={completedReceipt}
                onClose={() => setCompletedReceipt(null)}
                onPrint={handlePrintReceipt}
            />
        </div>
    );
}
