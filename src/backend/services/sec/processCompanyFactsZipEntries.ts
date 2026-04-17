import yauzl from "yauzl";
import type { CompanyFactsZipEntryMeta } from "@/backend/services/sec/scanCompanyFactsZipEntries";
import type { CompanyFactsDocument } from "@/backend/schemas/sec/companyFacts";

export type ProcessCompanyFactsZipEntriesHandlers = {
  onDocument: (
    entry: CompanyFactsZipEntryMeta,
    doc: CompanyFactsDocument
  ) => Promise<void>;
  onError?: (entry: CompanyFactsZipEntryMeta, error: unknown) => Promise<void> | void;
};

export async function processCompanyFactsZipEntries(
  zipFilePath: string,
  entriesToRead: CompanyFactsZipEntryMeta[],
  handlers: ProcessCompanyFactsZipEntriesHandlers
): Promise<void> {
  const targetByCik = new Map(entriesToRead.map((entry) => [entry.cik, entry] as const));

  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true }, (openError, zipfile) => {
      if (openError || !zipfile) {
        reject(openError ?? new Error(`Failed to open zip: ${zipFilePath}`));
        return;
      }

      zipfile.readEntry();

      zipfile.on("entry", (entry) => {
        const cik = extractCikFromEntryName(entry.fileName);

        if (!cik) {
          zipfile.readEntry();
          return;
        }

        const target = targetByCik.get(cik);

        if (!target) {
          zipfile.readEntry();
          return;
        }

        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            Promise.resolve(
              handlers.onError?.(
                target,
                streamError ?? new Error(`Failed to open stream for cik ${cik}`)
              )
            )
              .finally(() => {
                zipfile.readEntry();
              });
            return;
          }

          const chunks: Buffer[] = [];

          stream.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          stream.on("end", () => {
            void (async () => {
              try {
                const raw = Buffer.concat(chunks).toString("utf8");
                const doc = JSON.parse(raw) as CompanyFactsDocument;
                await handlers.onDocument(target, doc);
              } catch (error) {
                await handlers.onError?.(target, error);
              } finally {
                zipfile.readEntry();
              }
            })();
          });

          stream.on("error", (error) => {
            void Promise.resolve(handlers.onError?.(target, error)).finally(() => {
              zipfile.readEntry();
            });
          });
        });
      });

      zipfile.on("end", () => {
        zipfile.close();
        resolve();
      });

      zipfile.on("error", reject);
    });
  });
}

function extractCikFromEntryName(entryName: string): string | null {
  const match = entryName.match(/^CIK(\d+)\.json$/);
  return match ? match[1] : null;
}
