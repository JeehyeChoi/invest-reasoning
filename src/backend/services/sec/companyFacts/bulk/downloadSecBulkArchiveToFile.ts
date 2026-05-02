import fs from "fs";
import path from "path";
import { ENV } from "@/backend/config/env";
import {
  downloadSecBulkArchive,
  type SecBulkDataset,
} from "@/backend/clients/secBulk";

export async function downloadSecBulkArchiveToFile(
  dataset: SecBulkDataset
): Promise<string> {
  const outDir = ENV.SEC_DATA_DIR;
  fs.mkdirSync(outDir, { recursive: true });

  const fileName = `sec-${dataset}.zip`;
  const filePath = path.join(outDir, fileName);

  console.log(`[SEC BULK] Downloading ${dataset}...`);

  const arrayBuffer = await downloadSecBulkArchive(dataset);
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(filePath, buffer);

  console.log(`[SEC BULK] Saved to ${filePath}`);

  return filePath;
}
