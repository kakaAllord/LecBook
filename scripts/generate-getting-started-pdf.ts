import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const OUTPUT_PATH = path.join(process.cwd(), "public", "getting-started-guide.pdf");

const ACCENT = "#4f46e5";
const MUTED = "#6b7280";
const TEXT = "#111827";

type Section = {
  title: string;
  intro?: string;
  steps: string[];
};

const SECTIONS: Section[] = [
  {
    title: "1. Logging In",
    intro: "Open the app in your browser and sign in with your lecturer account.",
    steps: [
      "Go to the app's login page.",
      "Enter your email and password, then click \"Sign in\".",
      "You'll land on the Dashboard once signed in. Your session stays active until you log out or it expires.",
      "Use the logout icon at the bottom of the sidebar to sign out.",
    ],
  },
  {
    title: "2. Dashboard",
    intro: "Your home screen — a quick snapshot of everything happening right now.",
    steps: [
      "Total Students, Courses, Today's Attendance and Assessments are shown as summary cards at the top.",
      "\"Quick Actions\" cards jump straight to Students, Courses, Attendance, Assessments or Reports.",
      "\"Recent Assessments\" lists the latest assessments you've created, with course and date.",
    ],
  },
  {
    title: "3. Courses",
    intro: "Set up the courses you teach before registering students against them.",
    steps: [
      "Open Courses from the sidebar.",
      "Click \"New Course\" and fill in Name, Level, Semester and Academic Year (e.g. Electrical Engineering, Level 5, Semester II, 2026).",
      "Use the search bar to find a course, or the pencil/trash icons on a row to edit or delete it.",
      "A course with students or assessments already linked to it cannot be deleted until those are removed.",
    ],
  },
  {
    title: "4. Students",
    intro: "Register every student against the course they belong to.",
    steps: [
      "Open Students from the sidebar and click \"Register Student\".",
      "Fill in Registration Number (must be unique), Full Name, Gender, Phone (optional), Course and Status.",
      "Use the search box and the Course / Status filters to narrow the list.",
      "Set a student's Status to Inactive instead of deleting them if they've left but you want to keep their history.",
    ],
  },
  {
    title: "5. Attendance",
    intro: "Mark attendance for a course, one date at a time.",
    steps: [
      "Open Attendance, choose a Course and a Date (defaults to today).",
      "Every active student in that course appears in a table. Click Present, Absent, Late or Excused for each student — Present is pre-selected by default.",
      "Add an optional remark per student, then click \"Save Attendance\".",
      "Saving the same course and date again updates that day's records instead of creating duplicates, so you can safely correct mistakes.",
      "Click \"View History\" to see past dates for a course with Present/Absent/Late/Excused totals, and click \"Edit\" on any date to reopen and adjust it.",
    ],
  },
  {
    title: "6. Assessment Types",
    intro: "Assessment types are fully customizable — nothing is hardcoded.",
    steps: [
      "Open Assessments, then \"Assessment Types\".",
      "Click \"New Type\" and set a Name, Max Marks, and an optional Description (e.g. Quiz — 20 marks, Practical — 50 marks).",
      "Create as many types as you need — Test, Assignment, Presentation, Project, Lab, or anything specific to your course.",
      "A type already used by an assessment cannot be deleted.",
    ],
  },
  {
    title: "7. Assessments & Marks",
    intro: "Create an assessment, then record marks for every student in that course.",
    steps: [
      "Open Assessments and click \"New Assessment\".",
      "Choose a Course, an Assessment Type, give it a Title (e.g. \"Quiz 1\") and a Date, then submit.",
      "You're taken straight to the marks entry screen, listing every active student in that course.",
      "Enter each student's marks — the system will not let you save a mark above the type's maximum (e.g. more than 20 for a Quiz worth 20).",
      "Marks can be revisited and edited at any time from the Assessments list.",
      "The page also shows a live Average, Highest and Lowest as you enter marks.",
    ],
  },
  {
    title: "8. Reports",
    intro: "Generate printable PDF reports at any time.",
    steps: [
      "Open Reports from the sidebar.",
      "Attendance Report: choose a Course and an optional date range, then \"Download PDF\" — it lists every student with their Present/Absent/Late/Excused counts and attendance percentage.",
      "Assessment Report: choose a Course to filter, then pick an Assessment and \"Download PDF\" — it lists every student's marks along with the average, highest and lowest scores.",
      "Every report is headed with your Institution Name, set on the Settings page.",
    ],
  },
  {
    title: "9. Settings",
    intro: "System-wide configuration used across the app and your reports.",
    steps: [
      "Open Settings from the sidebar.",
      "Set your Institution Name — it appears in the sidebar and at the top of every generated PDF report.",
      "This is also where you can re-download this Getting Started Guide at any time.",
    ],
  },
  {
    title: "Tips",
    steps: [
      "Toggle dark mode any time with the sun/moon icon at the bottom of the sidebar — your choice is remembered.",
      "Every list (Courses, Students) has a search bar and, where useful, filters and pagination.",
      "Deleting anything always asks for confirmation first, so accidental clicks are safe.",
    ],
  },
];

function addCoverPage(doc: PDFKit.PDFDocument, institutionName: string) {
  doc.rect(0, 0, doc.page.width, 230).fill(ACCENT);

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(28)
    .text("Getting Started Guide", 50, 90, { align: "left" });

  doc
    .font("Helvetica")
    .fontSize(14)
    .text("Lecturer Record Management System (LRMS)", 50, 130);

  doc.fontSize(11).text(institutionName, 50, 155);

  doc.fillColor(TEXT).font("Helvetica").fontSize(11);
  doc.moveDown(8);
  doc.text(
    "This guide walks you through every feature of the system, from signing in to generating your first reports. Work through it in order the first time, or jump straight to the section you need.",
    50,
    270,
    { width: doc.page.width - 100 }
  );

  doc.moveDown(2);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text("Contents", 50);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor(MUTED);
  for (const section of SECTIONS) {
    doc.text(section.title, 60);
  }
}

function addSection(doc: PDFKit.PDFDocument, section: Section) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
    doc.addPage();
  } else {
    doc.moveDown(1.2);
  }

  doc.font("Helvetica-Bold").fontSize(15).fillColor(ACCENT).text(section.title);
  doc
    .strokeColor("#e5e7eb")
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .stroke();
  doc.moveDown(0.5);

  if (section.intro) {
    doc.font("Helvetica-Oblique").fontSize(10.5).fillColor(MUTED).text(section.intro);
    doc.moveDown(0.4);
  }

  doc.font("Helvetica").fontSize(10.5).fillColor(TEXT);
  for (const step of section.steps) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
    }
    const bulletY = doc.y;
    doc.text("-", doc.page.margins.left, bulletY, { width: 12 });
    doc.text(step, doc.page.margins.left + 14, bulletY, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 14,
    });
    doc.moveDown(0.35);
  }
}

async function main() {
  const institutionName = process.argv[2] || "Your Institution Name";

  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  addCoverPage(doc, institutionName);
  doc.addPage();

  for (const section of SECTIONS) {
    addSection(doc, section);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`LRMS Getting Started Guide — page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 35, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
      });
  }

  doc.end();
  await done;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, Buffer.concat(chunks));
  console.log(`Getting started guide written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
