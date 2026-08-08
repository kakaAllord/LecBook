/**
 * Block vocabulary for the business proposal.
 *
 * The proposal is kept as structured data rather than a hand-laid-out document
 * so its wording can be edited without touching pagination, and so the same
 * source can be re-rendered as the numbers change.
 */
export type ProposalBlock =
  | { type: "paragraph"; text: string }
  | { type: "lead"; text: string }
  | { type: "subheading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }
  | {
      type: "table";
      columns: { header: string; width: number; align?: "left" | "right" | "center" }[];
      rows: string[][];
      /** Renders the final row in bold — for totals. */
      totalRow?: boolean;
      caption?: string;
    }
  | { type: "callout"; tone: "note" | "warning" | "positive"; title: string; text: string }
  | { type: "kpis"; items: { value: string; label: string }[] }
  | { type: "spacer" };

export type ProposalSection = {
  /** Numbered heading, e.g. "3. Pricing". */
  title: string;
  /** Start this section on a fresh page. */
  pageBreak?: boolean;
  blocks: ProposalBlock[];
};

export type Proposal = {
  title: string;
  subtitle: string;
  preparedFor: string;
  preparedBy: string;
  version: string;
  currencyNote: string;
  sections: ProposalSection[];
};
