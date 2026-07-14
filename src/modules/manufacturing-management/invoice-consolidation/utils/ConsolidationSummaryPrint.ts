interface PrintDetail {
    productName: string;
    productCode: string;
    productId: number;
    orderedQuantity: number;
    pickedQuantity: number;
    appliedQuantity: number;
}

interface PrintInvoice {
    invoiceNo: string;
    invoiceId: number;
}

interface PrintData {
    consolidatorNo: string;
    branchName: string;
    status: string;
    createdAt: string;
    details: PrintDetail[];
    invoices: PrintInvoice[];
}

export async function generateConsolidationPDF(data: PrintData) {
    const jsPDFModule = await import("jspdf");
    const JsPDFClass = (jsPDFModule.default || jsPDFModule.jsPDF) as unknown as typeof import("jspdf").jsPDF;

    const autoTableModule = await import("jspdf-autotable");
    const autoTable = (autoTableModule.default || autoTableModule) as unknown as typeof import("jspdf-autotable").default;

    const doc = new JsPDFClass();

    const totalOrdered = data.details.reduce((s, d) => s + d.orderedQuantity, 0);
    const totalPicked = data.details.reduce((s, d) => s + d.pickedQuantity, 0);
    const totalShort = Math.max(0, totalOrdered - totalPicked);
    const progress = totalOrdered > 0 ? (totalPicked / totalOrdered) * 100 : 0;

    doc.setFontSize(16).setFont("helvetica", "bold");
    doc.text("CONSOLIDATION SUMMARY", 14, 16);

    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(80, 80, 80);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 196, 16, { align: "right" });

    doc.setFontSize(10).setFont("helvetica", "bold").setTextColor(0, 0, 0);
    doc.text(`Batch: ${data.consolidatorNo}`, 14, 24);
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(`Branch: ${data.branchName}`, 14, 30);
    doc.text(`Status: ${data.status}`, 14, 35);
    doc.text(`Created: ${new Date(data.createdAt).toLocaleDateString()}`, 14, 40);
    doc.text(`Invoices: ${data.invoices.length}`, 100, 30);
    doc.text(`Products: ${data.details.length}`, 100, 35);
    doc.text(`Progress: ${totalPicked}/${totalOrdered} (${progress.toFixed(0)}%)`, 100, 40);
    if (totalShort > 0) {
        doc.setTextColor(220, 100, 50);
        doc.text(`Shortage: ${totalShort}`, 100, 45);
        doc.setTextColor(0, 0, 0);
    }

    const bodyRows = data.details.map((d) => {
        const itemProgress = d.orderedQuantity > 0 ? (d.pickedQuantity / d.orderedQuantity) * 100 : 0;
        const shortage = d.pickedQuantity < d.orderedQuantity;
        return [
            d.productName.toUpperCase(),
            d.productCode || "-",
            String(d.productId),
            String(d.orderedQuantity),
            String(d.pickedQuantity),
            shortage ? `${d.pickedQuantity}/${d.orderedQuantity}` : "OK",
            `${itemProgress.toFixed(0)}%`,
        ];
    });

    autoTable(doc, {
        startY: totalShort > 0 ? 52 : 48,
        head: [["PRODUCT", "CODE", "ID", "ORDERED", "PICKED", "STATUS", "DONE"]],
        body: bodyRows,
        theme: "grid",
        headStyles: { textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7, fillColor: [240, 240, 240], cellPadding: 1.5 },
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
        columnStyles: {
            0: { cellWidth: "auto" },
            1: { cellWidth: 20 },
            2: { cellWidth: 12, halign: "center" },
            3: { cellWidth: 14, halign: "center" },
            4: { cellWidth: 14, halign: "center" },
            5: { cellWidth: 16, halign: "center" },
            6: { cellWidth: 12, halign: "center" },
        },
        didDrawPage: (d: { pageNumber: number }) => {
            doc.setFontSize(7).setTextColor(161, 161, 170);
            doc.text(
                `Batch: ${data.consolidatorNo} | Page ${d.pageNumber}`,
                14,
                doc.internal.pageSize.height - 8
            );
        },
    });

    const extDoc = doc as unknown as { lastAutoTable: { finalY: number } };
    let finalY = extDoc.lastAutoTable.finalY + 10;

    if (finalY > 260) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(0, 0, 0);
    doc.text("INVOICES IN THIS BATCH", 14, finalY);

    const invRows = data.invoices.map((inv) => [inv.invoiceNo, `#${inv.invoiceId}`]);
    autoTable(doc, {
        startY: finalY + 4,
        head: [["INVOICE NO", "INVOICE ID"]],
        body: invRows,
        theme: "grid",
        headStyles: { textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7, fillColor: [240, 240, 240] },
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
    });

    const extDoc2 = doc as unknown as { lastAutoTable: { finalY: number } };
    let sigY = extDoc2.lastAutoTable.finalY + 14;
    if (sigY > 270) {
        doc.addPage();
        sigY = 20;
    }

    doc.setDrawColor(0, 0, 0).setLineWidth(0.2);
    doc.line(14, sigY, 80, sigY);
    doc.setFontSize(7).setTextColor(80, 80, 80).text("PREPARED BY", 14, sigY + 4);
    doc.line(120, sigY, 186, sigY);
    doc.text("VERIFIED BY", 120, sigY + 4);

    doc.save(`CONSOLIDATION_${data.consolidatorNo}.pdf`);
}
