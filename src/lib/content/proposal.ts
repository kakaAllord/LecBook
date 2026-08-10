import type { Proposal } from "@/lib/content/proposal-types";

/**
 * The business proposal, as editable content.
 *
 * Every figure below is a working assumption, not a quote — they are gathered
 * here (rather than scattered through prose) so they can be revised in one pass
 * as real hosting bills, support hours and deal sizes come in.
 *
 * Currency: Kenyan Shillings, with US Dollar equivalents at KES 130 = USD 1.
 */
export const PROPOSAL: Proposal = {
  title: "LecBook",
  subtitle: "A proposal to digitise attendance, assessment and academic records",
  preparedFor: "Prepared for: College leadership and procurement",
  preparedBy: "Prepared by: WickTechs",
  version: "Version 1.1 · Draft for discussion",
  currencyNote: "All figures in Kenyan Shillings (KES). USD equivalents at KES 130 = USD 1.",

  sections: [
    // ---------------------------------------------------------------- 1
    {
      title: "1. Executive summary",
      blocks: [
        {
          type: "lead",
          text: "Every lecturer in the college keeps the same three records — who attended, what they scored, and who is at risk of failing. Today those records live in paper registers and personal spreadsheets. LecBook puts them in one place, so the college can answer questions about a student in seconds rather than by hunting through files.",
        },
        {
          type: "paragraph",
          text: "This proposal sets out what the system does, what it costs us to run, what we propose to charge, and the terms we recommend. It is written to be read by a principal and a procurement officer, not by an engineer.",
        },
        {
          type: "kpis",
          items: [
            { value: "KES 150,000", label: "Typical annual subscription\n(301–1,000 students)" },
            { value: "KES 45,000", label: "One-time setup, migration\nand training" },
            { value: "~10x", label: "Estimated return against\nlecturer time recovered" },
          ],
        },
        {
          type: "paragraph",
          text: "The commercial model is a single annual subscription that includes hosting, security, updates and support, plus a one-time implementation fee. We deliberately do not charge separately for uptime, bug fixes, security patches or backups — section 6 explains why that matters.",
        },
      ],
    },

    // ---------------------------------------------------------------- 2
    {
      title: "2. The problem this solves",
      blocks: [
        {
          type: "paragraph",
          text: "Attendance and assessment records are the college's evidence base. They decide who sits an exam, who repeats a module, and what the college reports to its regulator. When that evidence lives on paper, four things go wrong:",
        },
        {
          type: "numbered",
          items: [
            "Registers are slow to compile. A lecturer marking a roll by hand, then totalling it at the end of term, spends hours per module on arithmetic a computer does instantly.",
            "Records go missing. A misplaced register is unrecoverable, and the students in it lose their attendance history with it.",
            "Disputes cannot be settled. When a student says they attended, there is often no way to prove otherwise — and no record of who marked them absent or when.",
            "Nobody sees the pattern until it is too late. A student drifting below the attendance threshold is only noticed at the end of the semester, when intervention is no longer possible.",
          ],
        },
        {
          type: "callout",
          tone: "note",
          title: "The cost of the status quo is real, even though it is invisible",
          text: "Take 25 lecturers spending three hours a week each on registers, mark sheets and totals, across a 36-week academic year, valued at KES 500 an hour. That is roughly KES 1.35 million of academic staff time a year spent on clerical work. Recovering even a third of it is worth several times the cost of this system.",
        },
      ],
    },

    // ---------------------------------------------------------------- 3
    {
      title: "3. What the college gets",
      blocks: [
        {
          type: "subheading",
          text: "For lecturers",
        },
        {
          type: "bullets",
          items: [
            "Their students are already in the system. The administrator registers students and assigns each lecturer the modules they teach; a lecturer signs in and their class is simply there.",
            "Attendance is marked in a few taps per session, on a phone or a computer, with everyone defaulted to present.",
            "Assessments and marks are recorded per module, with the system enforcing the marks cap so totals cannot drift.",
            "A printable register with a signature column, so the paper trail and the digital record agree.",
            "Any session saved against the wrong module, date or class can be corrected without re-marking the whole roll.",
          ],
        },
        { type: "subheading", text: "For administrators" },
        {
          type: "bullets",
          items: [
            "One place to register students, define courses and modules, and add lecturers.",
            "Lecturers are onboarded by sending a one-time link — no shared passwords, and no administrator ever knows a lecturer's password. The administrator account itself is created the same way.",
            "Accounts can be deactivated the moment someone leaves, preventing that account from signing in again unless it is reactivated.",
            "Printable attendance reports for any module, optional course and date range, plus assessment reports for one assessment or all assessments in a module.",
            "A complete record of any individual student — attendance per module, marks per assessment — filtered to whatever range is needed and exported as a PDF or copied as text.",
          ],
        },
        { type: "subheading", text: "Who can do what" },
        {
          type: "bullets",
          items: [
            "Administrators own the records: courses, modules, students, and the lecturer accounts. They do not take registers.",
            "Lecturers own the teaching: registers, marks, their own reports and their own thresholds. They see only the students on courses that run their modules, and cannot edit a student record.",
            "We hold one operations account for support: it can open any account's screen in a workspace labelled read-only, switch account status on or off, and read the activity log.",
          ],
        },
        { type: "subheading", text: "For the institution" },
        {
          type: "bullets",
          items: [
            "Evidence for regulator and audit requirements, produced on demand rather than reconstructed.",
            "A searchable activity trail for recorded system actions, attributed to a person and timestamped, with the selected entries replayed in the order they happened.",
            "Early sight of students below the attendance threshold, while there is still time to act.",
            "The college name and logo on every report it issues, with each lecturer setting their own attendance threshold and pass mark across the modules they teach.",
          ],
        },
      ],
    },

    // ---------------------------------------------------------------- 4
    {
      title: "4. What it costs us to run",
      pageBreak: true,
      blocks: [
        {
          type: "paragraph",
          text: "These are our costs, shown so the pricing in section 5 is transparent rather than arbitrary. They fall into two groups: costs we carry whether we have one college or twenty, and costs that grow with each college added.",
        },
        { type: "subheading", text: "4.1 Platform costs — shared across all customers, per year" },
        {
          type: "table",
          columns: [
            { header: "Item", width: 200 },
            { header: "What it covers", width: 190 },
            { header: "KES / year", width: 85, align: "right" },
          ],
          rows: [
            ["Application hosting", "Running the web application itself", "36,000"],
            ["Managed database", "Postgres with automated failover", "30,000"],
            ["Backups & retention", "Daily backups held off-site", "9,000"],
            ["Domain & certificates", "Address and encryption in transit", "2,500"],
            ["Transactional email", "Invite links and system notices", "12,000"],
            ["Monitoring & error tracking", "Knowing about faults before users report them", "18,000"],
            ["Annual security review", "Independent check for vulnerabilities", "60,000"],
            ["Data protection registration", "ODPC data controller registration", "4,000"],
            ["Professional indemnity insurance", "Cover if our software causes a loss", "35,000"],
            ["Accounting & legal", "Company filings, contract review", "40,000"],
            ["Total platform cost", "", "246,500"],
          ],
          totalRow: true,
        },
        { type: "subheading", text: "4.2 Per-college costs — added for each institution, per year" },
        {
          type: "table",
          columns: [
            { header: "Item", width: 200 },
            { header: "What it covers", width: 190 },
            { header: "KES / year", width: 85, align: "right" },
          ],
          rows: [
            ["Incremental compute & storage", "Their share of database and traffic growth", "9,000"],
            ["Email & SMS delivery", "Messages sent on their behalf", "6,000"],
            ["Support", "Around two hours a month of real help", "36,000"],
            ["Account management", "Reviews, reporting, relationship", "12,000"],
            ["Total per college", "", "63,000"],
          ],
          totalRow: true,
        },
        { type: "subheading", text: "4.3 One-time cost per college" },
        {
          type: "table",
          columns: [
            { header: "Item", width: 200 },
            { header: "What it covers", width: 190 },
            { header: "KES", width: 85, align: "right" },
          ],
          rows: [
            ["Implementation", "Setting up courses, modules, thresholds, branding", "15,000"],
            ["Data migration", "Loading the existing student roll", "18,000"],
            ["Training", "Two sessions: administrators, then lecturers", "12,000"],
            ["Total one-time", "", "45,000"],
          ],
          totalRow: true,
        },
        {
          type: "callout",
          tone: "warning",
          title: "One cost is deliberately missing above: our own time",
          text: "Development, maintenance and the hours spent answering the phone are not listed as a line item, because they are not an expense we pay out — they are what the margin has to fund. If a subscription only covers the invoices above, the work is being done for free. Price the time in, or the business quietly runs at a loss.",
        },
      ],
    },

    // ---------------------------------------------------------------- 5
    {
      // No page break: this follows straight on from the cost tables, and forcing
      // one strands the closing callout of section 4 alone on a page.
      title: "5. Proposed pricing",
      blocks: [
        {
          type: "paragraph",
          text: "We recommend a tiered annual subscription banded by student numbers, plus a one-time implementation fee. Banding by student count is simple to budget for, scales with the college's ability to pay, and does not penalise the college for adding lecturers.",
        },
        {
          type: "table",
          columns: [
            { header: "Tier", width: 95 },
            { header: "Students", width: 90 },
            { header: "Annual subscription", width: 110, align: "right" },
            { header: "Setup (one-time)", width: 95, align: "right" },
            { header: "USD / yr", width: 60, align: "right" },
          ],
          rows: [
            ["Starter", "Up to 300", "KES 60,000", "KES 30,000", "~460"],
            ["Standard", "301 – 1,000", "KES 150,000", "KES 45,000", "~1,150"],
            ["Institution", "1,001 – 3,000", "KES 320,000", "KES 75,000", "~2,460"],
            ["Multi-campus", "3,000+", "By assessment", "By assessment", "—"],
          ],
        },
        {
          type: "paragraph",
          text: "Every tier includes hosting, backups, security updates, all feature releases during the term, unlimited lecturer and administrator accounts, and support during working hours. There is no charge per lecturer and no charge per report.",
        },
        { type: "subheading", text: "5.1 What the margin looks like" },
        {
          type: "table",
          columns: [
            { header: "At the Standard tier", width: 300 },
            { header: "KES / year", width: 110, align: "right" },
          ],
          rows: [
            ["Subscription revenue", "150,000"],
            ["Less per-college costs (section 4.2)", "(63,000)"],
            ["Contribution per college", "87,000"],
            ["Colleges needed to cover platform costs", "3"],
          ],
          totalRow: true,
        },
        {
          type: "paragraph",
          text: "Three colleges on the Standard tier cover every fixed cost of running the platform. The fourth onwards funds development time and profit. That is the number to steer the business by.",
        },
        { type: "subheading", text: "5.2 Legitimate additional charges" },
        {
          type: "paragraph",
          text: "These are chargeable because each one is real, optional work that not every college will want:",
        },
        {
          type: "table",
          columns: [
            { header: "Service", width: 190 },
            { header: "Basis", width: 175 },
            { header: "Indicative", width: 110, align: "right" },
          ],
          rows: [
            ["Extra training sessions", "Beyond the two included", "KES 8,000 / session"],
            ["Historical data entry", "Typing up past paper registers", "KES 1,200 / hour"],
            ["Bulk SMS to students", "Passed through with a small margin", "At cost + 15%"],
            ["College-specific features", "Built for one college only", "KES 3,000 / hour"],
            ["Integration with other systems", "Finance, exams or student portals", "Scoped per case"],
            ["Additional campus", "Separate branding and reporting", "40% of tier price"],
            ["Priority support tier", "Faster response commitments", "+25% of subscription"],
            ["On-premise deployment", "Running on the college's own servers", "Quoted separately"],
          ],
        },
      ],
    },

    // ---------------------------------------------------------------- 6
    {
      title: "6. What should not be charged for",
      pageBreak: true,
      blocks: [
        {
          type: "paragraph",
          text: "You asked to be told if anything you listed should not be monetised. Four of the items commonly proposed as revenue lines are, in our view, mistakes — not because charging for them is unfair, but because doing so damages the sale and, in one case, is legally risky.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Do not bill separately for fixing your own defects",
          text: "\"Maintenance\" sounds reasonable until a college realises it is paying to have a fault repaired that you introduced. It also creates a perverse incentive: the vendor earns more when the software is worse. Fold defect fixes into the subscription and describe them as included — it costs the same and reads far better in procurement.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Do not bill separately for security patches",
          text: "The same logic, with sharper edges. A college that declines a security add-on and is later breached will hold you responsible regardless of what the contract says. Security is a baseline obligation, not a product tier. Price it into every plan and say so in the proposal — it becomes a selling point rather than a line item.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Do not bill separately for uptime or \"keeping the system running\"",
          text: "This is what the subscription is. Listing it as an extra invites the obvious question: what exactly does the subscription buy? Keep one price that covers availability, and commit to a specific uptime figure in the agreement instead.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Do not charge for backups, data export, or getting their data back",
          text: "Charging a college to retrieve its own student records reads as holding data hostage, will be flagged in any competent procurement review, and sits badly against data protection principles that give data subjects a right of access. Make free export a written guarantee — it removes the single biggest objection to trusting a small vendor.",
        },
        {
          type: "paragraph",
          text: "Also keep free: password resets and routine account administration, adding a lecturer mid-term, and the reports the college needs for regulatory compliance. Each is cheap to provide and expensive in goodwill to charge for.",
        },
      ],
    },

    // ---------------------------------------------------------------- 7
    {
      title: "7. What is missing and should be added",
      pageBreak: true,
      blocks: [
        {
          type: "paragraph",
          text: "These were not in the original brief but a college's procurement process will ask about most of them. Having answers ready is often what decides a sale in favour of a small vendor.",
        },
        { type: "subheading", text: "7.1 Data protection compliance" },
        {
          type: "paragraph",
          text: "The system holds personal data about students. Under the Kenya Data Protection Act 2019 that carries obligations: registering with the Office of the Data Protection Commissioner, signing a data processing agreement with each college, being clear about who controls the data, and being able to respond when a student asks what is held about them. This is a cost (section 4.1) but it is also a differentiator — most informal alternatives cannot answer these questions at all.",
        },
        { type: "subheading", text: "7.2 A written service level agreement" },
        {
          type: "table",
          columns: [
            { header: "Commitment", width: 200 },
            { header: "Proposed level", width: 275 },
          ],
          rows: [
            ["Availability", "99.5% monthly, excluding announced maintenance"],
            ["Critical fault response", "Within 4 working hours"],
            ["Non-critical response", "Within 2 working days"],
            ["Support hours", "Monday to Friday, 8am – 5pm"],
            ["Backup frequency", "Daily, retained 30 days"],
            ["Recovery point objective", "At most 24 hours of data at risk"],
            ["Recovery time objective", "Service restored within 8 hours"],
            ["Planned maintenance", "Announced 5 days ahead, outside teaching hours"],
          ],
        },
        { type: "subheading", text: "7.3 Business continuity — the question every solo vendor is asked" },
        {
          type: "callout",
          tone: "note",
          title: "\"What happens to us if something happens to you?\"",
          text: "A college committing its records to a one-person supplier will ask this, and a weak answer loses the deal. Three things fix it: source code held in escrow and released to the college if the business ceases trading, a documented export of all their data available at any time, and a written commitment that the college's data is theirs. Together they cost very little and remove the objection entirely.",
        },
        { type: "subheading", text: "7.4 Commercial terms worth setting now" },
        {
          type: "bullets",
          items: [
            "Pilot term: one semester at a reduced rate, with a clean exit. It converts a large decision into a small one and is the fastest route to a first customer.",
            "Billing aligned to the academic calendar: colleges have money when fees come in. Invoicing in the first month of a term is far more likely to be paid on time.",
            "Multi-year agreements: a 10% discount for two years and 15% for three, in exchange for a commitment. Renewal is where small software businesses fail.",
            "Annual price adjustment: a stated inflation-linked increase, capped, so raising the price later is not a renegotiation.",
            "Liability cap: limit total liability to the fees paid in the preceding twelve months. Standard, and it makes the insurance affordable.",
            "Referrals: colleges talk to each other constantly. A discount for a successful introduction is the cheapest acquisition channel available.",
            "Roadmap governance: state plainly who decides what gets built. Without this, every college assumes their request is next.",
          ],
        },
        { type: "subheading", text: "7.5 Practical realities to plan for" },
        {
          type: "bullets",
          items: [
            "Connectivity: attendance is marked in classrooms and workshops where the network may be weak. Confirm coverage during the pilot; it is the most common reason a rollout stalls.",
            "Devices: the metrics dashboard shows the phone-versus-computer split. If lecturers are mostly on phones, that is where the effort belongs.",
            "The first term is the hardest: adoption succeeds or fails on whether lecturers use it in week one. Budget support time accordingly.",
          ],
        },
      ],
    },

    // ---------------------------------------------------------------- 8
    {
      title: "8. Rollout plan",
      blocks: [
        {
          type: "table",
          columns: [
            { header: "Stage", width: 110 },
            { header: "What happens", width: 250 },
            { header: "Timing", width: 115 },
          ],
          rows: [
            ["Agreement", "Contract, data processing agreement, invoice raised", "Week 0"],
            ["Setup", "Institution details, courses, modules, students", "Week 1"],
            ["Data migration", "Student roll loaded and verified with the registrar", "Week 1 – 2"],
            ["Administrator training", "One session, then admins add lecturers", "Week 2"],
            ["Lecturer onboarding", "Invite links issued; lecturers set their own passwords", "Week 2 – 3"],
            ["Lecturer training", "One session per group, hands-on with real classes", "Week 3"],
            ["Live use", "Attendance and assessments recorded in the system", "Week 4"],
            ["Review", "Usage reviewed together; gaps addressed", "End of term 1"],
          ],
        },
        {
          type: "paragraph",
          text: "We recommend starting with one department rather than the whole college. A department that succeeds becomes the internal advocate for everyone else, and problems surface while they are still small.",
        },
      ],
    },

    // ---------------------------------------------------------------- 9
    {
      title: "9. Why this rather than the alternatives",
      blocks: [
        {
          type: "table",
          columns: [
            { header: "Option", width: 110 },
            { header: "Strength", width: 175 },
            { header: "Weakness", width: 190 },
          ],
          rows: [
            [
              "Paper registers",
              "No cost, no training, always works",
              "Lost records, no totals, no evidence, no early warning",
            ],
            [
              "Spreadsheets",
              "Free, familiar, flexible",
              "Fragmented per lecturer, no audit trail, versions diverge, leaves with the staff member",
            ],
            [
              "Full ERP / MIS",
              "Covers finance and admissions too",
              "Costs many times more, months to deploy, needs dedicated IT staff",
            ],
            [
              "LecBook",
              "Focused on the records lecturers actually keep; live in weeks; priced for a college budget",
              "Does not handle finance or admissions; small supplier (see 7.3)",
            ],
          ],
        },
        {
          type: "paragraph",
          text: "We have listed our own weaknesses because they will come up anyway, and because a proposal that only lists strengths is not believed.",
        },
      ],
    },

    // ---------------------------------------------------------------- 10
    {
      title: "10. What we are asking for",
      blocks: [
        {
          type: "numbered",
          items: [
            "A meeting with the principal, the registrar and whoever owns IT, to walk through the system with the college's own courses on screen.",
            "Agreement to a one-semester pilot with a single department, at the reduced pilot rate.",
            "A named contact inside the college who owns the rollout — this matters more than any technical decision.",
          ],
        },
        {
          type: "callout",
          tone: "positive",
          title: "The offer in one line",
          text: "One semester, one department, at the pilot rate. If the college is not convinced by the end of it, we export every record in full and part on good terms.",
        },
        { type: "spacer" },
        {
          type: "paragraph",
          text: "This document is a draft prepared for discussion. Every figure is an assumption to be tested against real hosting invoices, real support hours and the first real conversations with a college — and revised as those arrive.",
        },
      ],
    },
  ],
};
