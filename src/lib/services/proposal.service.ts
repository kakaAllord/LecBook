import dayjs from "dayjs";
import { bufferPdf } from "@/lib/pdf";
import { PROPOSAL } from "@/lib/content/proposal";
import type { Proposal, ProposalBlock } from "@/lib/content/proposal-types";

const INK = "#111827";
const MUTED = "#6b7280";
const ACCENT = "#4f46e5";
const RULE = "#d1d5db";

const TONE_COLORS = {
  note: { border: "#4f46e5", bg: "#eef2ff", title: "#3730a3" },
  warning: { border: "#d97706", bg: "#fffbeb", title: "#92400e" },
  positive: { border: "#059669", bg: "#ecfdf5", title: "#065f46" },
} as const;

/** Vertical room a block needs before it is worth starting on the current page. */
const MIN_ROOM = 60;

/**
 * Returns the text cursor to the left margin and the default ink.
 *
 * pdfkit keeps the x of the last explicitly positioned `text()` call and applies
 * it to the next unpositioned one, so anything drawn at an offset (a bullet, a
 * table cell, a card) would otherwise squeeze every following paragraph into a
 * narrow column on the right.
 */
function resetCursor(doc: PDFKit.PDFDocument) {
  doc.x = doc.page.margins.left;
  doc.fillColor(INK);
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function remaining(doc: PDFKit.PDFDocument) {
  return doc.page.height - doc.page.margins.bottom - doc.y;
}

function ensureRoom(doc: PDFKit.PDFDocument, needed: number) {
  if (remaining(doc) < needed) doc.addPage();
}

function drawCoverPage(doc: PDFKit.PDFDocument, proposal: Proposal) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  doc.y = 150;
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(42).text(proposal.title, left, doc.y);
  doc.moveDown(0.3);
  doc.fillColor(INK).font("Helvetica").fontSize(15).text(proposal.subtitle, { width: width * 0.85 });

  doc.moveDown(2);
  doc
    .strokeColor(ACCENT)
    .lineWidth(3)
    .moveTo(left, doc.y)
    .lineTo(left + 70, doc.y)
    .stroke();

  doc.moveDown(2);
  doc.fillColor(MUTED).font("Helvetica").fontSize(11);
  doc.text(proposal.preparedFor);
  doc.moveDown(0.3);
  doc.text(proposal.preparedBy);
  doc.moveDown(0.3);
  doc.text(`Date: ${dayjs().format("DD MMMM YYYY")}`);
  doc.moveDown(0.3);
  doc.text(proposal.version);

  doc.y = doc.page.height - doc.page.margins.bottom - 40;
  doc.fillColor(MUTED).fontSize(8.5).text(proposal.currencyNote, left, doc.y, { width });
}

function drawContents(doc: PDFKit.PDFDocument, proposal: Proposal) {
  doc.addPage();
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(16).text("Contents");
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(11).fillColor(INK);
  for (const section of proposal.sections) {
    doc.text(section.title, { paragraphGap: 5 });
  }
}

function drawSectionHeading(doc: PDFKit.PDFDocument, title: string) {
  ensureRoom(doc, 90);
  doc.moveDown(0.6);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(15).text(title);
  doc.moveDown(0.25);
  doc
    .strokeColor(RULE)
    .lineWidth(0.8)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.6);
}

function drawKpis(doc: PDFKit.PDFDocument, items: { value: string; label: string }[]) {
  ensureRoom(doc, 90);
  const width = contentWidth(doc);
  const gap = 10;
  const cardWidth = (width - gap * (items.length - 1)) / items.length;
  const top = doc.y;
  const height = 72;

  items.forEach((item, i) => {
    const x = doc.page.margins.left + i * (cardWidth + gap);
    doc.save();
    doc.roundedRect(x, top, cardWidth, height, 5).fill("#f8fafc");
    doc.restore();
    doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(15);
    doc.text(item.value, x + 10, top + 12, { width: cardWidth - 20 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8);
    doc.text(item.label, x + 10, top + 34, { width: cardWidth - 20 });
  });

  doc.y = top + height + 12;
  resetCursor(doc);
}

function drawCallout(
  doc: PDFKit.PDFDocument,
  tone: "note" | "warning" | "positive",
  title: string,
  text: string
) {
  const colors = TONE_COLORS[tone];
  const width = contentWidth(doc);
  const innerWidth = width - 26;

  doc.font("Helvetica-Bold").fontSize(10);
  const titleHeight = doc.heightOfString(title, { width: innerWidth });
  doc.font("Helvetica").fontSize(9.5);
  const textHeight = doc.heightOfString(text, { width: innerWidth });
  const boxHeight = titleHeight + textHeight + 22;

  ensureRoom(doc, boxHeight + 10);

  const top = doc.y;
  const left = doc.page.margins.left;

  doc.save();
  doc.rect(left, top, width, boxHeight).fill(colors.bg);
  doc.rect(left, top, 3, boxHeight).fill(colors.border);
  doc.restore();

  doc.fillColor(colors.title).font("Helvetica-Bold").fontSize(10);
  doc.text(title, left + 14, top + 9, { width: innerWidth });
  doc.fillColor(INK).font("Helvetica").fontSize(9.5);
  doc.text(text, left + 14, top + 11 + titleHeight, { width: innerWidth });

  doc.y = top + boxHeight + 10;
  resetCursor(doc);
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: { header: string; width: number; align?: "left" | "right" | "center" }[],
  rows: string[][],
  totalRow: boolean | undefined,
  caption: string | undefined
) {
  const left = doc.page.margins.left;
  const padding = 5;

  const rowHeight = (cells: string[], bold: boolean) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    let tallest = 0;
    cells.forEach((cell, i) => {
      const h = doc.heightOfString(cell, { width: columns[i].width - padding * 2 });
      if (h > tallest) tallest = h;
    });
    return tallest + padding * 2;
  };

  const drawHeader = () => {
    const height = rowHeight(
      columns.map((c) => c.header),
      true
    );
    // Capture the row's top before drawing: each doc.text call moves doc.y, so
    // reading it inside the column loop would stagger the headers downwards.
    const top = doc.y;
    doc.save();
    doc.rect(left, top, columns.reduce((sum, c) => sum + c.width, 0), height).fill("#f1f5f9");
    doc.restore();
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(9);
    let x = left;
    for (const col of columns) {
      doc.text(col.header, x + padding, top + padding, {
        width: col.width - padding * 2,
        align: col.align ?? "left",
      });
      x += col.width;
    }
    doc.y = top + height;
  };

  ensureRoom(doc, MIN_ROOM);
  drawHeader();

  rows.forEach((cells, rowIndex) => {
    const isTotal = Boolean(totalRow) && rowIndex === rows.length - 1;
    const height = rowHeight(cells, isTotal);

    if (remaining(doc) < height + 6) {
      doc.addPage();
      drawHeader();
    }

    const top = doc.y;
    if (isTotal) {
      doc.save();
      doc.rect(left, top, columns.reduce((sum, c) => sum + c.width, 0), height).fill("#f8fafc");
      doc.restore();
    }

    doc.fillColor(INK).font(isTotal ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    let x = left;
    cells.forEach((cell, i) => {
      doc.text(cell, x + padding, top + padding, {
        width: columns[i].width - padding * 2,
        align: columns[i].align ?? "left",
      });
      x += columns[i].width;
    });

    doc.y = top + height;
    doc
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .moveTo(left, doc.y)
      .lineTo(left + columns.reduce((sum, c) => sum + c.width, 0), doc.y)
      .stroke();
  });

  doc.moveDown(0.4);
  if (caption) {
    doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8).text(caption);
    doc.moveDown(0.3);
  }
  doc.moveDown(0.4);
  resetCursor(doc);
}

function drawBlock(doc: PDFKit.PDFDocument, block: ProposalBlock) {
  const width = contentWidth(doc);

  switch (block.type) {
    case "lead":
      ensureRoom(doc, MIN_ROOM);
      doc.fillColor(INK).font("Helvetica").fontSize(12).text(block.text, { width, lineGap: 2.5 });
      doc.moveDown(0.7);
      break;

    case "paragraph":
      ensureRoom(doc, 40);
      doc.fillColor(INK).font("Helvetica").fontSize(10).text(block.text, { width, lineGap: 1.8 });
      doc.moveDown(0.6);
      break;

    case "subheading":
      ensureRoom(doc, 60);
      doc.moveDown(0.3);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(11.5).text(block.text, { width });
      doc.moveDown(0.4);
      break;

    case "bullets":
      for (const item of block.items) {
        ensureRoom(doc, 34);
        const top = doc.y;
        doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(10).text("•", doc.page.margins.left, top, {
          width: 12,
        });
        doc.fillColor(INK).font("Helvetica").fontSize(10);
        doc.text(item, doc.page.margins.left + 14, top, { width: width - 14, lineGap: 1.5 });
        doc.moveDown(0.35);
      }
      doc.moveDown(0.4);
      resetCursor(doc);
      break;

    case "numbered":
      block.items.forEach((item, i) => {
        ensureRoom(doc, 34);
        const top = doc.y;
        doc
          .fillColor(ACCENT)
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(`${i + 1}.`, doc.page.margins.left, top, { width: 16 });
        doc.fillColor(INK).font("Helvetica").fontSize(10);
        doc.text(item, doc.page.margins.left + 18, top, { width: width - 18, lineGap: 1.5 });
        doc.moveDown(0.35);
      });
      doc.moveDown(0.4);
      resetCursor(doc);
      break;

    case "table":
      drawTable(doc, block.columns, block.rows, block.totalRow, block.caption);
      break;

    case "callout":
      drawCallout(doc, block.tone, block.title, block.text);
      break;

    case "kpis":
      drawKpis(doc, block.items);
      break;

    case "spacer":
      doc.moveDown(1);
      break;
  }
}

function addPageFurniture(doc: PDFKit.PDFDocument, proposal: Proposal) {
  const range = doc.bufferedPageRange();
  // Skip the cover: page numbering starts on the contents page.
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(range.start + i);

    // The footer sits below the text margin. pdfkit adds a fresh page whenever
    // text crosses the bottom margin, so drop the margin for the write and put
    // it back afterwards — otherwise stamping footers doubles the page count.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const bottom = doc.page.height - savedBottom + 14;
    doc
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .moveTo(doc.page.margins.left, bottom - 6)
      .lineTo(doc.page.width - doc.page.margins.right, bottom - 6)
      .stroke();

    doc.fillColor(MUTED).font("Helvetica").fontSize(8);
    doc.text(`${proposal.title} — ${proposal.subtitle}`, doc.page.margins.left, bottom, {
      width: contentWidth(doc) - 40,
      lineBreak: false,
    });
    doc.text(`${i}`, doc.page.margins.left, bottom, {
      width: contentWidth(doc),
      align: "right",
      lineBreak: false,
    });

    doc.page.margins.bottom = savedBottom;
  }
}

export async function generateProposalPdf(proposal: Proposal = PROPOSAL) {
  const pdf = await bufferPdf(
    (doc) => {
      drawCoverPage(doc, proposal);
      drawContents(doc, proposal);

      for (const section of proposal.sections) {
        if (section.pageBreak) doc.addPage();
        drawSectionHeading(doc, section.title);
        for (const block of section.blocks) {
          drawBlock(doc, block);
        }
      }

      addPageFurniture(doc, proposal);
    },
    // Roomier margins than the operational reports: this is a document to read,
    // not a table to scan.
    { margin: 56 }
  );

  return {
    pdf,
    filename: `${proposal.title}-Business-Proposal-${dayjs().format("YYYYMMDD")}.pdf`,
  };
}
