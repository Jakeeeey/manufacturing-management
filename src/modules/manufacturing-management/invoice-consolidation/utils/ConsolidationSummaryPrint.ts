interface PrintInvoiceProduct {
    productName: string;
    productCode: string;
    quantity: number;
}

interface PrintInvoice {
    invoiceNo: string;
    customerName: string;
    products: PrintInvoiceProduct[];
}

interface PrintDetail {
    productName: string;
    brand: string;
    category: string;
    unit: string;
    orderedQuantity: number;
    pickedQuantity: number;
}

interface PrintData {
    consolidatorNo: string;
    branchName: string;
    status: string;
    createdAt: string;
    details: PrintDetail[];
    invoices: PrintInvoice[];
    totalInvoices: number;
}

export async function generateConsolidationPDF(data: PrintData) {
    const jsPDFModule = await import("jspdf");
    const JsPDFClass = (jsPDFModule.default || jsPDFModule.jsPDF) as unknown as typeof import("jspdf").jsPDF;

    const autoTableModule = await import("jspdf-autotable");
    const autoTable = (autoTableModule.default || autoTableModule) as unknown as typeof import("jspdf-autotable").default;

    const doc = new JsPDFClass();

    const pageWidth = doc.internal.pageSize.width;

    // ── Header ──
    doc.setFontSize(12).setFont("helvetica", "bold");
    doc.text("WAREHOUSE PICKING WORKSHEET", pageWidth / 2, 10, { align: "center" });

    doc.setFontSize(7).setFont("helvetica", "normal");
    doc.text("Vertex Terminal - Manufacturing", pageWidth / 2, 14, { align: "center" });

    // ── Batch Info Block ──
    doc.setFontSize(8).setFont("helvetica", "bold");
    doc.text(`Batch No:`, 8, 21);
    doc.setFont("helvetica", "normal");
    doc.text(data.consolidatorNo, 27, 21);

    doc.setFont("helvetica", "bold");
    doc.text(`Branch:`, 108, 21);
    doc.setFont("helvetica", "normal");
    doc.text(data.branchName, 124, 21);

    doc.setFont("helvetica", "bold");
    doc.text(`Status:`, 8, 26);
    doc.setFont("helvetica", "normal");
    doc.text(data.status, 27, 26);

    doc.setFont("helvetica", "bold");
    doc.text(`Created:`, 108, 26);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(data.createdAt).toLocaleDateString(), 124, 26);

    doc.setFont("helvetica", "bold");
    doc.text(`Invoices:`, 8, 31);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.totalInvoices}`, 27, 31);

    doc.setFont("helvetica", "bold");
    doc.text(`Products:`, 108, 31);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.details.length}`, 124, 31);

    // ── Product Lines Table ──
    const sortedDetails = [...data.details].sort((a, b) =>
        a.brand.localeCompare(b.brand, undefined, { sensitivity: "base" }) ||
        a.category.localeCompare(b.category, undefined, { sensitivity: "base" }) ||
        a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" })
    );
    const bodyRows = sortedDetails.map((d) => [
        d.brand,
        d.category,
        d.productName,
        d.unit,
        String(d.orderedQuantity),
        "",
    ]);

    autoTable(doc, {
        startY: 35,
        margin: { left: 8, right: 8 },
        head: [["BRAND", "CATEGORY", "PRODUCT NAME", "UNIT", "ORD QTY", "PICKED"]],
        body: bodyRows,
        theme: "grid",
        headStyles: {
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 6.5,
            fillColor: [240, 240, 240],
            cellPadding: 1,
            halign: "center",
        },
        styles: {
            fontSize: 6.5,
            cellPadding: 0.8,
            textColor: [0, 0, 0],
        },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 34 },
            2: { cellWidth: "auto" },
            3: { cellWidth: 15, halign: "center" },
            4: { cellWidth: 17, halign: "center" },
            5: { cellWidth: 17, halign: "center" },
        },
        didDrawPage: (d: { pageNumber: number }) => {
            doc.setFontSize(7).setTextColor(161, 161, 170);
            doc.text(
                `${data.consolidatorNo} | Page ${d.pageNumber}`,
                14,
                doc.internal.pageSize.height - 8
            );
        },
    });

    // ── Invoice Summary Section ──
    const extDoc = doc as unknown as { lastAutoTable: { finalY: number } };
    let currentY = extDoc.lastAutoTable.finalY + 8;

    if (currentY > 240) {
        doc.addPage();
        currentY = 20;
    }

    doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 0, 0);
    doc.text("INVOICE SUMMARY", 8, currentY);
    currentY += 2;

    const invoiceRows = data.invoices.flatMap((invoice) => {
        if (invoice.products.length === 0) {
            return [[invoice.invoiceNo, invoice.customerName, "No product details", "-", "-"]];
        }

        return invoice.products.map((product, index) => [
            index === 0 ? invoice.invoiceNo : "",
            index === 0 ? invoice.customerName : "",
            product.productName,
            product.productCode || "-",
            String(product.quantity),
        ]);
    });

    autoTable(doc, {
        startY: currentY,
        margin: { left: 8, right: 8, bottom: 10 },
        head: [["INVOICE", "CUSTOMER", "PRODUCT", "CODE", "QTY"]],
        body: invoiceRows,
        theme: "grid",
        headStyles: {
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fontSize: 5.5,
            fillColor: [245, 245, 245],
            cellPadding: 0.6,
        },
        styles: {
            fontSize: 5.5,
            cellPadding: 0.5,
            textColor: [0, 0, 0],
            lineColor: [210, 210, 210],
            lineWidth: 0.1,
            overflow: "linebreak",
        },
        columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 30 },
            2: { cellWidth: "auto" },
            3: { cellWidth: 26 },
            4: { cellWidth: 12, halign: "center" },
        },
        didDrawPage: (pageData: { pageNumber: number }) => {
            doc.setFontSize(7).setTextColor(161, 161, 170);
            doc.text(
                `${data.consolidatorNo} | Page ${pageData.pageNumber}`,
                14,
                doc.internal.pageSize.height - 8
            );
        },
    });

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

    // Retained as a no-op boundary so the signature layout remains isolated
    // from the compact summary rendering above.
    for (const inv of [] as PrintInvoice[]) {
        if (currentY > 255) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(8).setFont("helvetica", "bold");
        doc.text(`${inv.invoiceNo}  —  ${inv.customerName}`, 14, currentY);
        currentY += 3;

        if (inv.products.length > 0) {
            const invProdRows = inv.products.map((p) => [
                p.productName.toUpperCase(),
                p.productCode || "-",
                String(p.quantity),
            ]);

            autoTable(doc, {
                startY: currentY,
                head: [["PRODUCT", "CODE", "QTY"]],
                body: invProdRows,
                theme: "plain",
                headStyles: {
                    textColor: [80, 80, 80],
                    fontStyle: "bold",
                    fontSize: 6.5,
                    fillColor: [245, 245, 245],
                    cellPadding: 1,
                },
                styles: {
                    fontSize: 6.5,
                    cellPadding: 1,
                    textColor: [0, 0, 0],
                    lineColor: [220, 220, 220],
                    lineWidth: { bottom: 0.1 },
                },
                columnStyles: {
                    0: { cellWidth: "auto" },
                    1: { cellWidth: 22 },
                    2: { cellWidth: 14, halign: "center" },
                },
                margin: { left: 14 },
                tableWidth: 120,
            });

            const extDoc2 = doc as unknown as { lastAutoTable: { finalY: number } };
            currentY = extDoc2.lastAutoTable.finalY + 4;
        } else {
            doc.setFontSize(7).setFont("helvetica", "italic").setTextColor(120, 120, 120);
            doc.text("No product details", 18, currentY);
            currentY += 4;
        }
    }

    // ── Signature Lines ──
    currentY = Math.max(currentY + 8, extDoc.lastAutoTable.finalY + 10);
    if (currentY > 265) {
        doc.addPage();
        currentY = 20;
    }

    doc.setDrawColor(0, 0, 0).setLineWidth(0.3);

    // Prepared by
    doc.line(14, currentY, 85, currentY);
    doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 0, 0);
    doc.text("PREPARED BY", 14, currentY + 4);
    doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(80, 80, 80);
    doc.text("Name & Signature", 14, currentY + 8);
    doc.text("Date:", 14, currentY + 12);

    // Checked by
    doc.line(105, currentY, 186, currentY);
    doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 0, 0);
    doc.text("CHECKED BY", 105, currentY + 4);
    doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(80, 80, 80);
    doc.text("Name & Signature", 105, currentY + 8);
    doc.text("Date:", 105, currentY + 12);

    currentY += 18;

    // Approved by
    if (currentY + 18 < doc.internal.pageSize.height - 10) {
        doc.line(14, currentY, 85, currentY);
        doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 0, 0);
        doc.text("APPROVED BY", 14, currentY + 4);
        doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(80, 80, 80);
        doc.text("Name & Signature", 14, currentY + 8);
        doc.text("Date:", 14, currentY + 12);

        doc.line(105, currentY, 186, currentY);
        doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 0, 0);
        doc.text("RECEIVED BY", 105, currentY + 4);
        doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(80, 80, 80);
        doc.text("Name & Signature", 105, currentY + 8);
        doc.text("Date:", 105, currentY + 12);
    }

    doc.save(`WORKSHEET_${data.consolidatorNo}.pdf`);
}
