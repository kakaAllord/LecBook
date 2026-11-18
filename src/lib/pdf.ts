import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

/**
 * Every report the system prints shares one look: Trebuchet MS, nothing smaller
 * than 10pt or larger than 12pt, and every table cell centred both ways with
 * enough padding to read as a neat document rather than a data dump.
 *
 * Trebuchet MS is a Microsoft font and cannot be fetched at runtime, so it is
 * read from `assets/fonts/` when someone has placed the licensed files there.
 * Until they do, reports fall back to Helvetica rather than failing — a report
 * in the wrong typeface is better than no report.
 */
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const FONT_FILES = { regular: "trebuc.ttf", bold: "trebucbd.ttf" };

export const REPORT_FONT = { regular: "Report", bold: "Report-Bold" } as const;

export const REPORT_SIZE = { title: 12, heading: 11, body: 10 } as const;

/** Space between a cell's border and its text, on every side. */
export const CELL_PADDING = 5;

/** A single-line row at the body size, padding included. */
export const ROW_HEIGHT = Math.ceil(REPORT_SIZE.body * 1.25 + CELL_PADDING * 2);

function fontSource(file: string, fallback: string) {
  const full = path.join(FONT_DIR, file);
  return fs.existsSync(full) ? full : fallback;
}

function registerReportFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(REPORT_FONT.regular, fontSource(FONT_FILES.regular, "Helvetica"));
  doc.registerFont(REPORT_FONT.bold, fontSource(FONT_FILES.bold, "Helvetica-Bold"));
  doc.font(REPORT_FONT.regular).fontSize(REPORT_SIZE.body);
}

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
      registerReportFonts(doc);
      build(doc);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/** Sets the report typeface at a size inside the 10–12pt band. */
export function setFont(doc: PDFKit.PDFDocument, opts: { bold?: boolean; size?: number } = {}) {
  return doc.font(opts.bold ? REPORT_FONT.bold : REPORT_FONT.regular).fontSize(opts.size ?? REPORT_SIZE.body);
}

const LOGO_SIZE = 52;

function drawLogo(doc: PDFKit.PDFDocument, logoDataUrl: string, y: number) {
  try {
    const base64 = logoDataUrl.slice(logoDataUrl.indexOf(",") + 1);
    const buffer = Buffer.from(base64, "base64");
    const x = (doc.page.width - LOGO_SIZE) / 2;
    doc.image(buffer, x, y, { fit: [LOGO_SIZE, LOGO_SIZE], align: "center", valign: "center" });
    return true;
  } catch {
    // Ignore malformed/corrupt logo data rather than failing report generation.
    return false;
  }
}

/**
 * The logo sits centred at the very top, with the institution's name directly
 * beneath it, then the report title and its subtitle.
 */
export function addReportHeader(
  doc: PDFKit.PDFDocument,
  institutionName: string,
  title: string,
  subtitle?: string,
  logoDataUrl?: string | null
) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  if (logoDataUrl && drawLogo(doc, logoDataUrl, doc.y)) {
    doc.y += LOGO_SIZE + 6;
  }

  setFont(doc, { bold: true, size: REPORT_SIZE.title }).text(institutionName, left, doc.y, {
    width,
    align: "center",
  });
  doc.moveDown(0.15);
  setFont(doc, { bold: true, size: REPORT_SIZE.heading }).text(title, left, doc.y, { width, align: "center" });
  if (subtitle) {
    doc.moveDown(0.15);
    setFont(doc).fillColor("#555555").text(subtitle, left, doc.y, { width, align: "center" });
    doc.fillColor("#000000");
  }
  doc.moveDown(0.4);
  doc
    .strokeColor("#cccccc")
    .lineWidth(1)
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .stroke();
  doc.moveDown(0.8);
  doc.x = left;
}

/** A section heading inside a report, left to the margin like a document's. */
export function addSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.4);
  setFont(doc, { bold: true, size: REPORT_SIZE.heading }).fillColor("#111827").text(title, doc.page.margins.left);
  doc.moveDown(0.3);
  setFont(doc).fillColor("#000000");
}

/** A line of body text at the margin, for notes, summaries and empty states. */
export function addParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: { bold?: boolean; color?: string; align?: "left" | "center" | "right" } = {}
) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  setFont(doc, { bold: opts.bold })
    .fillColor(opts.color ?? "#000000")
    .text(text, left, doc.y, { width, align: opts.align ?? "left" });
  doc.fillColor("#000000");
}

export function addGeneratedFooter(doc: PDFKit.PDFDocument, when: string) {
  doc.moveDown(1);
  addParagraph(doc, `Generated on ${when}`, { color: "#888888", align: "right" });
}

/** Shortens text with an ellipsis until it fits the width at the current font. */
function fitText(doc: PDFKit.PDFDocument, text: string, width: number) {
  if (doc.widthOfString(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Writes one line of text centred horizontally and vertically inside a cell,
 * padded on every side and clipped with an ellipsis rather than spilling into
 * the next cell.
 */
export function drawCellText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { bold?: boolean; color?: string; wrap?: boolean } = {}
) {
  setFont(doc, { bold: opts.bold });
  const inner = Math.max(1, width - CELL_PADDING * 2);
  doc.fillColor(opts.color ?? "#000000");
  if (opts.wrap) {
    const textHeight = doc.heightOfString(text, { width: inner, align: "center" });
    doc.text(text, x + CELL_PADDING, y + (height - textHeight) / 2, { width: inner, align: "center" });
  } else {
    const line = fitText(doc, text, inner);
    doc.text(line, x + CELL_PADDING, y + (height - doc.currentLineHeight()) / 2, {
      width: inner,
      align: "center",
      lineBreak: false,
    });
  }
  doc.fillColor("#000000");
}

/**
 * The height a wrapping row needs for its tallest cell, padding included, never
 * shorter than a single-line row.
 */
function wrappedRowHeight(doc: PDFKit.PDFDocument, cells: TableCell[], bold?: boolean) {
  setFont(doc, { bold });
  const tallest = Math.max(
    ...cells.map((c) => (c.text ? doc.heightOfString(c.text, { width: Math.max(1, c.width - CELL_PADDING * 2) }) : 0))
  );
  return Math.max(ROW_HEIGHT, Math.ceil(tallest + CELL_PADDING * 2));
}

export function drawTick(doc: PDFKit.PDFDocument, x: number, y: number, size = 9) {
  doc.save();
  doc
    .strokeColor("#059669")
    .lineWidth(1.4)
    .moveTo(x, y + size * 0.5)
    .lineTo(x + size * 0.35, y + size * 0.85)
    .lineTo(x + size, y)
    .stroke();
  doc.restore();
}

/** A tick centred in its cell. */
export function drawCellTick(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  const size = 9;
  drawTick(doc, x + (width - size) / 2, y + (height - size) / 2, size);
}

/** A green or red verdict pill centred in its cell. */
export function drawStatusCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  positive: boolean
) {
  const bg = positive ? "#dcfce7" : "#fee2e2";
  const fg = positive ? "#166534" : "#991b1b";
  const inset = 3;
  doc.save();
  doc.rect(x + inset, y + inset, width - inset * 2, height - inset * 2).fill(bg);
  doc.restore();
  drawCellText(doc, label, x, y, width, height, { bold: true, color: fg });
}

export function drawRowGrid(doc: PDFKit.PDFDocument, x: number, y: number, widths: number[], height: number) {
  doc.save();
  doc.strokeColor("#bbbbbb").lineWidth(0.5);
  let cx = x;
  for (const width of widths) {
    doc.rect(cx, y, width, height).stroke();
    cx += width;
  }
  doc.restore();
}

export type TableCell = {
  text: string;
  width: number;
  /** Paints a verdict pill instead of plain text. */
  status?: { positive: boolean };
  /** Draws a tick when true, leaves the cell empty when false. */
  tick?: boolean;
};

/**
 * Draws one bordered row at the current position, every cell centred both
 * ways, then moves the cursor to the start of the next row. A wrapping row
 * (used for headers) lets long labels run onto further lines and grows to fit
 * them instead of cutting them short.
 */
export function drawTableRow(
  doc: PDFKit.PDFDocument,
  cells: TableCell[],
  opts: { bold?: boolean; height?: number; shade?: string; wrap?: boolean } = {}
) {
  const startX = doc.page.margins.left;
  const y = doc.y;
  const height = opts.height ?? (opts.wrap ? wrappedRowHeight(doc, cells, opts.bold) : ROW_HEIGHT);

  if (opts.shade) {
    const total = cells.reduce((sum, c) => sum + c.width, 0);
    doc.save();
    doc.rect(startX, y, total, height).fill(opts.shade);
    doc.restore();
  }

  drawRowGrid(
    doc,
    startX,
    y,
    cells.map((c) => c.width),
    height
  );

  let x = startX;
  for (const cell of cells) {
    if (cell.status) {
      if (cell.text) drawStatusCell(doc, x, y, cell.width, height, cell.text, cell.status.positive);
    } else if (cell.tick !== undefined) {
      if (cell.tick) drawCellTick(doc, x, y, cell.width, height);
    } else if (cell.text) {
      drawCellText(doc, cell.text, x, y, cell.width, height, { bold: opts.bold, wrap: opts.wrap });
    }
    x += cell.width;
  }
  // Advance by an explicit row height rather than doc.moveDown(), whose line-height
  // heuristic under-shoots for these fixed-position multi-column rows and causes overlap.
  doc.x = startX;
  doc.y = y + height;
}

/** Light grey behind header rows, so the column names read as headings. */
export const HEADER_SHADE = "#f1f5f9";

/** True when another row of this height would run into the bottom margin. */
export function needsPageBreak(doc: PDFKit.PDFDocument, height = ROW_HEIGHT) {
  return doc.y + height > doc.page.height - doc.page.margins.bottom;
}
