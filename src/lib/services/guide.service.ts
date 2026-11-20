import PDFDocument from "pdfkit";

const ACCENT = "#4f46e5";
const MUTED = "#6b7280";
const TEXT = "#111827";

type Role = "SUPER_ADMIN" | "ADMIN" | "LECTURER";

type Section = {
  title: string;
  intro?: string;
  steps: string[];
  /** Who this section is written for. Omitted means everybody. */
  roles?: Role[];
};

const ROLE_TITLES: Record<Role, string> = {
  SUPER_ADMIN: "for the Super Admin",
  ADMIN: "for Administrators",
  LECTURER: "for Lecturers",
};

/**
 * The guide is assembled for whoever asks for it. Each account signs into its
 * own workspace, so a lecturer should not be reading about adding courses and
 * an administrator should not be told to take a register they cannot open.
 */
const SECTIONS: Section[] = [
  {
    title: "1. Logging In",
    intro: "Open the app in your browser and sign in with the account you were given.",
    steps: [
      "Go to the app's login page.",
      'Enter your email and password, then click "Sign in".',
      "If you were sent an invite link instead, open it, choose a password, and sign in with that.",
      "You land on your Dashboard. What is on it, and the pages listed down the sidebar, depend on the account you signed in with — administrators and lecturers get different workspaces.",
      "Use the logout icon at the bottom of the sidebar to sign out.",
    ],
  },

  // ------------------------------------------------------------- super admin
  {
    title: "2. Dashboard",
    intro: "How the system is actually being used, which is what the operations account exists to read.",
    roles: ["SUPER_ADMIN"],
    steps: [
      "Engagement: active accounts, daily and monthly actives, and how many people came back over the last 7, 30 or 90 days.",
      "Devices: the phone, tablet and computer split, so you know which screen the work really happens on.",
      "Feature usage: which parts of the system carry the load — attendance, assessments, reports, account management.",
      "Onboarding health: accounts created against accounts that have actually been activated.",
      "Switch the window with the 7 / 30 / 90 day buttons at the top right.",
    ],
  },
  {
    title: "3. Users",
    intro: "Every administrator and lecturer on the system.",
    roles: ["SUPER_ADMIN"],
    steps: [
      "Search by name, email or staff ID, and filter by role or status.",
      '"Add administrator" creates an administrator account for this deployment: fill in their details and you are handed a one-time invite link to send them. It expires in 14 days.',
      "The open-in-new-tab icon signs you into that account's view — you see exactly what they see, with a read-only banner at the top and a button to return to your own account.",
      "The power icon activates or deactivates an account. A deactivated account cannot sign in again unless it is reactivated.",
      "Courses, students and lecturers are not created here: they belong to the administrator's own workspace.",
    ],
  },
  {
    title: "4. Logs",
    intro: "Recorded system activity, showing who did it and when.",
    roles: ["SUPER_ADMIN"],
    steps: [
      "Entries are colour-coded by action family — including authentication, accounts, courses, modules, students, attendance, settings and student exports.",
      "Click any line to expand it: the actor, the exact action, the record it touched, the IP address and the browser.",
      "Filter by actor, by action (or a whole family), by free text, and by a From/To range that accepts a date and a time.",
      '"Live tail" keeps the newest page refreshing on its own; pause it when you want to read.',
      '"Replay" walks the current selection forwards in time, one entry at a time, at 0.5x to 4x speed — useful for watching a session unfold in the order it happened.',
      'A "view-as" tag on a line means the action was taken while a super admin was viewing that account.',
    ],
  },

  // ----------------------------------------------------------- administrator
  {
    title: "2. Dashboard",
    intro: "The shape of the institution, and what is still half set up.",
    roles: ["ADMIN"],
    steps: [
      "Totals for students, courses, modules and lecturers sit across the top.",
      '"Needs your attention" lists the gaps: modules with no lecturer assigned, levels with no related module yet, courses with no students, and lecturers who have not opened their invite. Each line links to the page that closes it.',
      '"Students per course" and "Teaching load" show where the numbers are concentrated.',
      '"Attendance taken today" is every register saved across the institution today. Registers themselves are taken by lecturers in their own accounts.',
    ],
  },
  {
    title: "3. Courses and Modules",
    intro: "Set up what is taught before registering anyone against it.",
    roles: ["ADMIN"],
    steps: [
      'Open Courses and click "New Course": the name, and optionally its core module code — no level (e.g. Electrical Installation, EI100). A course is added only once; its students move up through Level I, II and III on it.',
      "Adding a course also adds its core module, with the same name. The core module is taught to that course at every level, from Level I to Level III. Renaming the course renames it. Its code is set on the course form, or later from the course's pencil icon or the Modules page.",
      'Open Modules and click "New Related Module" for the subjects every course shares at a level: a name, an optional code, and the Level (e.g. Communication Skills, CS101, Level I). A related module is the same for all courses at that level.',
      "Filter the Modules list by kind (core or related) and by level. A module with registers or assessments recorded against it cannot be deleted, and a related module's level cannot change once it has them.",
      "Use the search bar to find a record, or the pencil and trash icons on a row to edit or delete it.",
      "Deleting a course or module asks for confirmation first. Keep records that still matter rather than deleting their parent course or module.",
    ],
  },
  {
    title: "4. Students",
    intro: "Register every student against the course they belong to. This is the administrator's job — lecturers never register anyone.",
    roles: ["ADMIN"],
    steps: [
      'Open Students and click "Register Student".',
      "Fill in Registration Number (must be unique), Full Name, Gender, Phone (optional), Course, Level and Status. Level starts at Level I; choose another only for a student joining further on.",
      "Use the search box and the Course / Level / Status filters to narrow the list.",
      'To correct levels in bulk — for example when the system is first set up — tick the students and click "Set level".',
      'Once a year, click "Promote students" and choose the level. Everyone active at that level is listed as Passed, Not passed or No marks; Passed means every module they were marked in at that level reached its lecturer\'s pass mark. Those who passed are ticked already — untick or tick anyone, then confirm. They move up one level; from Level III they are marked Completed.',
      "The academic year is shown on that screen as a reminder of when to run it: Level I and II from January, Level III from June to July the following year, two semesters each. Nothing is promoted automatically.",
      "Set a student's Status to Inactive rather than deleting them if they have left but their history matters.",
      "The download icon on a row exports that one student's full record — attendance and marks — as a PDF or as text you can paste into a message.",
    ],
  },
  {
    title: "5. Lecturers",
    intro: "Add the people who teach, and decide what each of them teaches.",
    roles: ["ADMIN"],
    steps: [
      'Open Lecturers and click "Add lecturer". Fill in their details in full — they will not be asked to re-type any of it.',
      'Under "What they teach", add a line per module: choose the module, the level they teach it at, and the courses they teach it to. "Select all" ticks every level or every course at once.',
      "A core module is taught only to its own course, so you choose its level(s). A related module runs only at its own level, so you choose its courses.",
      "This is the only assignment there is: every active student at those levels on those courses appears in that lecturer's account automatically.",
      "On saving you are given a one-time invite link. Copy it and send it to them however you normally would; it expires in 14 days.",
      "The chain-link icon issues a fresh link if the old one was lost or expired. The power icon activates or deactivates the account.",
      "The pencil icon changes their details or what they teach at any time.",
    ],
  },

  // ---------------------------------------------------------------- lecturer
  {
    title: "2. Dashboard",
    intro: "Your own teaching at a glance.",
    roles: ["LECTURER"],
    steps: [
      "Your students, your modules and your assessments are counted across the top, along with whether today's register has been taken.",
      '"Attendance by module" shows how each of your modules is doing across every session recorded for it.',
      '"Below your attendance bar" lists the students who have fallen under the threshold you set in Settings, worst first.',
      '"Recent assessments" links straight back into marks entry.',
    ],
  },
  {
    title: "3. Students",
    intro: "Everyone at the levels and on the courses you teach.",
    roles: ["LECTURER"],
    steps: [
      "The roll is read-only: registration and corrections are the administrator's responsibility, so there is one record of a student rather than several.",
      "Search and filter to find someone quickly.",
      "The download icon exports one student's full record as a PDF or as text.",
      "If someone is missing, ask your administrator to check their course and level, or to assign you the module at their level.",
    ],
  },
  {
    title: "4. Attendance",
    intro: "Mark a register for one module, at one level, on one date.",
    roles: ["LECTURER"],
    steps: [
      'Open Attendance, choose a Module — each is listed with its level, e.g. "Electrical Installation Level I" — tick the courses sitting in the session, and pick the Date (defaults to today).',
      "Every active student at that level in those courses appears in a table. Mark each one Present or Absent — Present is pre-selected — and add a remark if you need to.",
      'Click "Save Attendance". Saving the same module and date again updates that day rather than duplicating it, so corrections are safe.',
      '"View History" lists past sessions with their totals. "Edit" reopens a day to change individual students.',
      "The spanner icon repairs a whole session filed wrongly — it moves every record to the right module, level, date or set of courses in one go.",
    ],
  },
  {
    title: "5. Assessments and Marks",
    intro: "Create an assessment against a module at a level, then record marks.",
    roles: ["LECTURER"],
    steps: [
      'Open Assessments and click "New Assessment".',
      "Choose the Module first (listed with its level), then tick the courses the assessment applies to.",
      'Name it (e.g. "Quiz 1"), say what it is marked out of — 100 unless you change it — and set its date, then submit.',
      "Each assessment stands on its own total. Nothing is shared between them: a quiz out of 20 and an exam out of 100 are both marked in full.",
      "You land straight on marks entry, listing every active student at that level on those courses. Marks above what the assessment is marked out of are rejected as you type.",
      "Average, highest and lowest update live as you enter marks, and marks can be revisited from the Assessments list at any time.",
      "The list holds the assessments of the modules and levels you are assigned, and nothing else — another lecturer's assessments never appear in it.",
    ],
  },

  // ------------------------------------------------------------------ shared
  {
    title: "6. Reports",
    intro: "Printable PDFs, and a student list you can also take as a spreadsheet, generated on demand.",
    roles: ["ADMIN", "LECTURER"],
    steps: [
      'Attendance Report: choose a module at its level, optionally one course and a date range, then "Download PDF" — a tick-sheet register, one row per student and one column per date, with totals, percentages and a signature column.',
      'Assessment Report: choose a module at its level and either one assessment or all of them, then "Download PDF". A single-assessment sheet gives each student their mark, that mark as a percentage of what the assessment was marked out of, and PASS or FAIL against your pass mark, under a header carrying the average, highest and lowest. The all-assessments summary averages each student\'s percentages across the module and judges that average the same way. Both include a signature column.',
      "Student Report: search for one student, then ask for either their attendance (any modules, at any level, any date range) or their marks (any modules, at any level, any assessments). Leaving a selection empty means all of it — for a lecturer, all of their own modules. Marks come back per module, each with its average and a PASS or FAIL, and one overall average across everything selected.",
      'Student List: pull out a list of students with their registration number, gender, phone, course, level and status. Choose a Status (All, Active, Inactive or Completed), and optionally a Module, a Level and a Course; the filters combine, so "Active, Level II, Plumbing" is one list. Choosing a module gives the students it is taught to and fixes the level to the module\'s. "Download PDF" prints it as a numbered list with totals by status and gender; "Download CSV" opens in Excel or any spreadsheet. A lecturer\'s list only ever holds students on the courses and levels they teach.',
      "Every academic report opens with the logo set by the administrator, centred at the top, with the Institution Name directly beneath it. Later pages carry a one-line heading with the institution, the report and what it covers, and every page is numbered and dated at the foot.",
      "Reports are set in Trebuchet MS at 10 to 12 point, with every table cell centred and padded so the printout reads as a tidy document. Long names, registration numbers and remarks are printed in full, wrapping onto a second line rather than being cut short. When a register has more dates, or a summary more assessments, than fit across one page, they continue on further pages, each labelled with the ones it holds (e.g. Sessions 9–16 of 22).",
    ],
  },
  {
    title: "7. Settings",
    intro: "How the institution presents itself.",
    roles: ["ADMIN"],
    steps: [
      "Set the Institution Name — it appears in the sidebar and at the top of every academic report PDF.",
      "Upload an Institution Logo; it is resized automatically and printed centred at the top of every report, above the name.",
      "This is also where you can re-download this guide at any time.",
      "Attendance thresholds and pass marks are not set here: each lecturer sets one pair of their own values, applied across the modules they teach.",
    ],
  },
  {
    title: "7. Settings",
    intro: "The bar your own students are measured against.",
    roles: ["LECTURER"],
    steps: [
      'Minimum Attendance Threshold: students below it are flagged "LOW" on your attendance reports and listed on your dashboard.',
      "Assessment Pass Mark: a student's result for a module is the average of the percentages they scored across its assessments. At or above the pass mark they are marked PASS on your reports, below it FAIL.",
      "Until you save your own figures the institution defaults apply — both are shown next to each field.",
      "This is also where you can re-download this guide at any time.",
    ],
  },
  {
    title: "Tips",
    steps: [
      "Toggle dark mode any time with the sun/moon icon at the bottom of the sidebar — your choice is remembered.",
      "Lists provide search, filters and pagination where they are useful for the records on that page.",
      "Every place you pick a course, module or assessment from a list has a search box: type a few letters of the name or code to narrow it. Where several can be ticked, \"Select all\" ticks everything the search is showing.",
      "Deleting anything always asks for confirmation first, so accidental clicks are safe.",
      "Typing a number and then scrolling the page will not change the number — marks stay exactly as you entered them.",
    ],
  },
];

/** The sections written for one account, or all of them when no role is given. */
function sectionsFor(role?: Role) {
  return role
    ? SECTIONS.filter((section) => !section.roles || section.roles.includes(role))
    : SECTIONS;
}

function addCoverPage(
  doc: PDFKit.PDFDocument,
  institutionName: string,
  sections: Section[],
  role?: Role
) {
  doc.rect(0, 0, doc.page.width, 230).fill(ACCENT);

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(28).text("Getting Started Guide", 50, 90, { align: "left" });

  doc.font("Helvetica").fontSize(14).text("Lecturer Record Management System (LRMS)", 50, 130);

  doc.fontSize(11).text(role ? `${institutionName} — ${ROLE_TITLES[role]}` : institutionName, 50, 155);

  doc.fillColor(TEXT).font("Helvetica").fontSize(11);
  doc.moveDown(8);
  doc.text(
    role
      ? "This guide covers the account you signed in with, from your first login to generating your reports. Work through it in order the first time, or jump straight to the section you need."
      : "This guide covers all three accounts the system is built around — the super admin who operates it, the administrator who runs the institution's records, and the lecturer who teaches.",
    50,
    270,
    { width: doc.page.width - 100 }
  );

  doc.moveDown(2);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text("Contents", 50);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor(MUTED);
  for (const section of sections) {
    const audience = !role && section.roles ? ` (${section.roles.map((r) => ROLE_TITLES[r]).join(", ")})` : "";
    doc.text(`${section.title}${audience}`, 60);
  }
}

function addSection(doc: PDFKit.PDFDocument, section: Section, role?: Role) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
    doc.addPage();
  } else {
    doc.moveDown(1.2);
  }

  // Without a role the reader is getting all three workspaces at once, so each
  // section has to say whose it is.
  const heading =
    !role && section.roles
      ? `${section.title} — ${section.roles.map((r) => ROLE_TITLES[r]).join(", ")}`
      : section.title;
  doc.font("Helvetica-Bold").fontSize(15).fillColor(ACCENT).text(heading);
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

export async function generateGettingStartedGuide(
  institutionName: string,
  role?: Role
): Promise<Buffer> {
  const sections = sectionsFor(role);
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise<void>((resolve, reject) => {
    doc.on("end", () => resolve());
    doc.on("error", reject);
  });

  addCoverPage(doc, institutionName, sections, role);
  doc.addPage();

  for (const section of sections) {
    addSection(doc, section, role);
  }

  const range = doc.bufferedPageRange();
  const bottomMargin = doc.page.margins.bottom;
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Writing this close to the bottom edge sits inside the page's bottom margin, which
    // makes pdfkit treat it as an overflow and silently append a blank page for the "next"
    // line instead of stamping the current one. Drop the margin just for this write so the
    // footer lands on the page we just switched to.
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`LRMS Getting Started Guide — page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - 35, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
      });
    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
  await done;

  return Buffer.concat(chunks);
}
