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
  options: {
    layout?: "portrait" | "landscape";
    margin?: number;
    /**
     * Stamps "Generated on … · Page n of N" at the foot of every page. Reports
     * pass it; a sheet handed round loose needs its place in the set and its
     * date on each page, not only on the last.
     */
    footer?: { generatedAt: string };
  } = {}
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
      if (options.footer) stampPageFooters(doc, options.footer.generatedAt);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function stampPageFooters(doc: PDFKit.PDFDocument, generatedAt: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const { left, right, bottom } = doc.page.margins;
    const width = doc.page.width - left - right;
    const y = doc.page.height - bottom + 12;
    // Writing inside the bottom margin would make pdfkit start a new page;
    // lifting the margin for the duration keeps the footer on this one.
    doc.page.margins.bottom = 0;
    setFont(doc).fillColor("#888888");
    doc.text(`Generated on ${generatedAt}`, left, y, { width, align: "left", lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, left, y, { width, align: "right", lineBreak: false });
    doc.fillColor("#000000");
    doc.page.margins.bottom = bottom;
  }
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
 *
 * Continuation pages (`continued`) carry a one-line version instead: the
 * institution and title side by side, then the subtitle. The full header takes
 * a quarter of a landscape page, and repeating it on every page of a long
 * register cost a page in every four without telling the reader anything new.
 */
export function addReportHeader(
  doc: PDFKit.PDFDocument,
  institutionName: string,
  title: string,
  subtitle?: string,
  logoDataUrl?: string | null,
  opts: { continued?: boolean } = {}
) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;

  if (opts.continued) {
    setFont(doc, { bold: true, size: REPORT_SIZE.heading }).text(`${institutionName} · ${title}`, left, doc.y, {
      width,
      align: "center",
    });
  } else {
    if (logoDataUrl && drawLogo(doc, logoDataUrl, doc.y)) {
      doc.y += LOGO_SIZE + 6;
    }
    setFont(doc, { bold: true, size: REPORT_SIZE.title }).text(institutionName, left, doc.y, {
      width,
      align: "center",
    });
    doc.moveDown(0.15);
    setFont(doc, { bold: true, size: REPORT_SIZE.heading }).text(title, left, doc.y, { width, align: "center" });
  }
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
  doc.moveDown(opts.continued ? 0.6 : 0.8);
  doc.x = left;
}

/** The width between the side margins. */
export function usableWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/**
 * A section heading inside a report, left to the margin like a document's.
 * When there is no room for the heading and a couple of rows under it, it
 * starts a new page (through `newPage`) rather than sitting alone at the foot
 * of this one.
 */
export function addSectionTitle(doc: PDFKit.PDFDocument, title: string, newPage?: () => void) {
  if (newPage && needsPageBreak(doc, REPORT_SIZE.heading * 2 + ROW_HEIGHT * 3)) newPage();
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

/**
 * Writes text centred horizontally and vertically inside a cell, padded on
 * every side. Long text wraps onto further lines (the row has already been
 * sized to hold it) rather than being cut short: a register or mark sheet that
 * people sign has to show each name and number in full.
 */
export function drawCellText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { bold?: boolean; color?: string } = {}
) {
  setFont(doc, { bold: opts.bold });
  const inner = Math.max(1, width - CELL_PADDING * 2);
  doc.fillColor(opts.color ?? "#000000");
  const textHeight = doc.heightOfString(text, { width: inner, align: "center" });
  doc.text(text, x + CELL_PADDING, y + (height - textHeight) / 2, { width: inner, align: "center" });
  doc.fillColor("#000000");
}

/**
 * The height a row needs for its tallest cell, padding included, never
 * shorter than a single-line row. Verdict pills and ticks are one line.
 */
export function measureRow(doc: PDFKit.PDFDocument, cells: TableCell[], opts: { bold?: boolean } = {}) {
  let tallest = 0;
  for (const c of cells) {
    if (!c.text || c.tick !== undefined) continue;
    setFont(doc, { bold: opts.bold || Boolean(c.status) });
    tallest = Math.max(tallest, doc.heightOfString(c.text, { width: Math.max(1, c.width - CELL_PADDING * 2), align: "center" }));
  }
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
  // A single-line pill centred in the cell, so a row that grew for a wrapped
  // name does not stretch the verdict into a tall block.
  const pillHeight = Math.min(height, ROW_HEIGHT) - inset * 2;
  doc.save();
  doc.rect(x + inset, y + (height - pillHeight) / 2, width - inset * 2, pillHeight).fill(bg);
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
 * ways, then moves the cursor to the start of the next row. Every row grows to
 * fit its longest cell.
 *
 * When `newPage` is given and the row would run into the bottom margin, a page
 * is added and `newPage` is called first to draw that page's header (and the
 * table's own header row) — measured on the real row height, so a row that
 * wraps onto two lines never spills past the margin.
 */
export function drawTableRow(
  doc: PDFKit.PDFDocument,
  cells: TableCell[],
  opts: { bold?: boolean; height?: number; shade?: string; newPage?: () => void } = {}
) {
  const height = opts.height ?? measureRow(doc, cells, { bold: opts.bold });
  if (opts.newPage && needsPageBreak(doc, height)) {
    doc.addPage();
    opts.newPage();
  }

  const startX = doc.page.margins.left;
  const y = doc.y;

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
      drawCellText(doc, cell.text, x, y, cell.width, height, { bold: opts.bold });
    }
    x += cell.width;
  }
  // Advance by an explicit row height rather than doc.moveDown(), whose line-height
  // heuristic under-shoots for these fixed-position multi-column rows and causes overlap.
  doc.x = startX;
  doc.y = y + height;
}

/**
 * The width a column needs to hold its longest value on one line, padding
 * included, kept between `min` and `max`. Used for values whose length varies
 * by institution — registration numbers above all — so a short format does
 * not waste space and a long one does not wrap every row onto two lines.
 */
export function fitColumn(
  doc: PDFKit.PDFDocument,
  values: string[],
  opts: { min: number; max: number; bold?: boolean }
) {
  setFont(doc, { bold: opts.bold });
  const widest = Math.max(0, ...values.map((v) => doc.widthOfString(v)));
  return Math.min(opts.max, Math.max(opts.min, Math.ceil(widest + CELL_PADDING * 2 + 2)));
}

/**
 * The narrowest a column can be and still wrap `text` between words: its
 * longest word on one line, padding included, kept between `min` and `max`.
 * pdfkit splits a word that is wider than its column mid-way ("Continuou s"),
 * so a column holding a wrapping heading must never be narrower than this.
 */
export function wordFitWidth(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: { min: number; max: number; bold?: boolean }
) {
  // pdfkit measures each word with the space after it, so a column that only
  // just fits the bare word still splits it; measure it the same way.
  return fitColumn(doc, text.split(/\s+/).map((word) => `${word} `), opts);
}

/**
 * Widens `widths[flex]` so the columns fill `total` exactly. Reports size
 * their fixed columns for their content and let one column (usually the name)
 * take what is left, so every table meets the right margin.
 */
export function fillWidth(widths: number[], total: number, flex: number) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const out = [...widths];
  out[flex] += Math.max(0, total - sum);
  return out;
}

/** Light grey behind header rows, so the column names read as headings. */
export const HEADER_SHADE = "#f1f5f9";

/** True when another row of this height would run into the bottom margin. */
export function needsPageBreak(doc: PDFKit.PDFDocument, height = ROW_HEIGHT) {
  return doc.y + height > doc.page.height - doc.page.margins.bottom;
}
