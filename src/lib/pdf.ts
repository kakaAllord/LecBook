import PDFDocument from "pdfkit";

export function bufferPdf(
  build: (doc: PDFKit.PDFDocument) => void,
  options: { layout?: "portrait" | "landscape"; margin?: number } = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      // Set here rather than mutated later: pdfkit applies the document margin
      // to every page it creates, so a per-page override does not carry.
      margin: options.margin ?? 40,
      layout: options.layout ?? "portrait",
      bufferPages: true,
    });
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

function drawLogo(doc: PDFKit.PDFDocument, logoDataUrl: string, y: number) {
  try {
    const base64 = logoDataUrl.slice(logoDataUrl.indexOf(",") + 1);
    const buffer = Buffer.from(base64, "base64");
    doc.image(buffer, doc.page.margins.left, y, { fit: [44, 44] });
  } catch {
    // Ignore malformed/corrupt logo data rather than failing report generation.
  }
}

export function addReportHeader(
  doc: PDFKit.PDFDocument,
  institutionName: string,
  title: string,
  subtitle?: string,
  logoDataUrl?: string | null
) {
  const headerTop = doc.y;
  if (logoDataUrl) {
    drawLogo(doc, logoDataUrl, headerTop);
  }
  doc.fontSize(16).font("Helvetica-Bold").text(institutionName, { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(13).font("Helvetica-Bold").text(title, { align: "center" });
  if (subtitle) {
    doc.moveDown(0.1);
    doc.fontSize(10).font("Helvetica").fillColor("#555555").text(subtitle, { align: "center" });
    doc.fillColor("#000000");
  }
  doc.moveDown(0.3);
  if (logoDataUrl && doc.y < headerTop + 48) {
    doc.y = headerTop + 48;
  }
  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.8);
}

export function drawTick(doc: PDFKit.PDFDocument, x: number, y: number, size = 8) {
  doc.save();
  doc
    .strokeColor("#059669")
    .lineWidth(1.3)
    .moveTo(x, y + size * 0.5)
    .lineTo(x + size * 0.35, y + size * 0.85)
    .lineTo(x + size, y)
    .stroke();
  doc.restore();
}

export function drawStatusCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  label: string,
  positive: boolean
) {
  const bg = positive ? "#dcfce7" : "#fee2e2";
  const fg = positive ? "#166534" : "#991b1b";
  doc.save();
  doc.rect(x + 3, y - 3, width - 6, rowHeight - 4).fill(bg);
  doc.restore();
  doc.fillColor(fg).font("Helvetica-Bold").fontSize(7.5).text(label, x, y, { width, align: "center" });
  doc.fillColor("#000000").font("Helvetica").fontSize(8);
}

export function drawRowGrid(doc: PDFKit.PDFDocument, x: number, y: number, widths: number[], rowHeight: number) {
  doc.save();
  doc.strokeColor("#bbbbbb").lineWidth(0.5);
  let cx = x;
  for (const width of widths) {
    doc.rect(cx, y, width, rowHeight).stroke();
    cx += width;
  }
  doc.restore();
}

export function drawTableRow(
  doc: PDFKit.PDFDocument,
  columns: { text: string; width: number; align?: "left" | "right" | "center"; ellipsis?: boolean }[],
  opts: { bold?: boolean; fontSize?: number; rowHeight?: number } = {}
) {
  const startX = doc.page.margins.left;
  const y = doc.y;
  const fontSize = opts.fontSize ?? 9;
  const rowHeight = opts.rowHeight ?? fontSize * 1.7;
  doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);

  drawRowGrid(
    doc,
    startX,
    y,
    columns.map((c) => c.width),
    rowHeight
  );

  let x = startX;
  for (const col of columns) {
    doc.text(col.text, x + 2, y + 2, { width: col.width - 4, align: col.align ?? "left", ellipsis: col.ellipsis });
    x += col.width;
  }
  // Advance by an explicit row height rather than doc.moveDown(), whose line-height
  // heuristic under-shoots for these fixed-position multi-column rows and causes overlap.
  doc.y = y + rowHeight;
}
