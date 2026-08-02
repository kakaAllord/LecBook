import fs from "fs";
import path from "path";
import { generateGettingStartedGuide } from "@/lib/services/guide.service";

const OUTPUT_PATH = path.join(process.cwd(), "public", "getting-started-guide.pdf");

async function main() {
  const institutionName = process.argv[2] || "Your Institution Name";

  const pdf = await generateGettingStartedGuide(institutionName);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, pdf);
  console.log(`Getting started guide written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
