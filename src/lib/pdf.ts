import PDFDocument from "pdfkit";

export function bufferPdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      build(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function addReportHeader(
  doc: PDFKit.PDFDocument,
  institutionName: string,
  title: string,
  subtitle?: string
) {
  doc.fontSize(16).font("Helvetica-Bold").text(institutionName, { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(13).font("Helvetica-Bold").text(title, { align: "center" });
  if (subtitle) {
    doc.moveDown(0.1);
    doc.fontSize(10).font("Helvetica").fillColor("#555555").text(subtitle, { align: "center" });
    doc.fillColor("#000000");
  }
  doc.moveDown(0.3);
  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.8);
}

export function drawTableRow(
  doc: PDFKit.PDFDocument,
  columns: { text: string; width: number; align?: "left" | "right" | "center" }[],
  opts: { bold?: boolean; fontSize?: number } = {}
) {
  const startX = doc.page.margins.left;
  const y = doc.y;
  doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.fontSize ?? 9);

  let x = startX;
  for (const col of columns) {
    doc.text(col.text, x, y, { width: col.width, align: col.align ?? "left" });
    x += col.width;
  }
  doc.moveDown(0.5);
}
