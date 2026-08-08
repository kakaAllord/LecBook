import { writeFileSync } from "fs";
import { resolve } from "path";
import { generateProposalPdf } from "../src/lib/services/proposal.service";

/**
 * Renders the business proposal to a PDF in the repository root.
 *
 * Edit the wording and figures in `src/lib/content/proposal.ts`, then run
 * `npm run docs:proposal` to produce the updated document.
 */
async function main() {
  const { pdf, filename } = await generateProposalPdf();
  const target = resolve(process.cwd(), filename);
  writeFileSync(target, pdf);
  console.log(`Wrote ${filename} (${(pdf.length / 1024).toFixed(1)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
