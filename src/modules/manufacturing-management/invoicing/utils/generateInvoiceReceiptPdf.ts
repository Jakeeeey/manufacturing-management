import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PrintableInvoice } from "../types";

const money = (value: number) => new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

export function generateInvoiceReceiptPdf(invoice: PrintableInvoice) {
    const doc = new jsPDF({ unit: "mm", format: [210, 265] });
    doc.setProperties({ title: `${invoice.receiptType.type} ${invoice.invoiceNo}`, subject: "Sales Invoice", author: "VOS Manufacturing Management" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(invoice.receiptType.type.toUpperCase(), 105, 14, { align: "center" });
    doc.setFontSize(9);
    doc.text(`NO. ${invoice.invoiceNo}`, 195, 14, { align: "right" });
    doc.setLineWidth(0.25);
    doc.line(15, 18, 195, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const fields = [
        ["DATE", invoice.invoiceDate, "PO NO.", invoice.poNo || "N/A"],
        ["CUSTOMER", invoice.customerName, "SALESMAN", invoice.salesmanName],
        ["STORE", invoice.storeName, "TERMS", invoice.paymentTermName],
        ["ADDRESS", invoice.customerAddress || "N/A", "TIN", invoice.customerTin],
    ];
    let y = 25;
    for (const [leftLabel, leftValue, rightLabel, rightValue] of fields) {
        doc.setFont("helvetica", "bold");
        doc.text(`${leftLabel}:`, 15, y);
        doc.text(`${rightLabel}:`, 125, y);
        doc.setFont("helvetica", "normal");
        doc.text(String(leftValue), 38, y, { maxWidth: 82 });
        doc.text(String(rightValue), 148, y, { maxWidth: 47 });
        y += 6;
    }

    autoTable(doc, {
        startY: 51,
        margin: { left: 15, right: 15 },
        head: [["DESCRIPTION", "QTY", "UNIT", "PRICE", "DISCOUNT", "AMOUNT"]],
        body: invoice.lines.map((line) => [
            `${line.productName}${line.productCode ? `\n${line.productCode}` : ""}`,
            money(line.quantity),
            line.unit,
            money(line.unitPrice),
            money(line.discountAmount),
            money(line.netAmount),
        ]),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7, cellPadding: 2, lineColor: [80, 80, 80], lineWidth: 0.15 },
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 73 }, 1: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });

    const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 70;
    y = Math.min(Math.max(tableEnd + 8, 185), 225);
    const vatable = invoice.totals.net - invoice.totals.vat;
    const totals = [
        ["GROSS", invoice.totals.gross],
        ["DISCOUNT", invoice.totals.discount],
        ["VATABLE SALES", vatable],
        ["VAT", invoice.totals.vat],
        ["TOTAL AMOUNT DUE", invoice.totals.net],
    ] as const;
    for (const [label, value] of totals) {
        doc.setFont("helvetica", label === "TOTAL AMOUNT DUE" ? "bold" : "normal");
        doc.text(label, 135, y);
        doc.text(money(value), 195, y, { align: "right" });
        y += 6;
    }
    doc.line(135, y - 4, 195, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Sales Order: ${invoice.orderNo}`, 15, 250);
    doc.text(`Status: ${invoice.transactionStatus}`, 195, 250, { align: "right" });
    return doc;
}
