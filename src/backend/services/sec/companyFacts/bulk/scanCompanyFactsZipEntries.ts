import yauzl from "yauzl";

export type CompanyFactsZipEntryMeta = {
  cik: string;
  size: number;
};

export type CompanyFactsCompanyStateLike = {
  cik: string;
  last_file_size: number | null;
};

export type ScanCompanyFactsZipEntriesResult = {
  entriesToRead: CompanyFactsZipEntryMeta[];
  totalCount: number;
  newCount: number;
  sameSizeSkipCount: number;
  changedSizeCount: number;
  filteredOutCount: number;
};

export async function scanCompanyFactsZipEntries(
  zipFilePath: string,
  companyStateMap: Map<string, CompanyFactsCompanyStateLike>,
  allowedCiks?: Set<string>,
  options: {
    forceReadAll?: boolean;
  } = {},
): Promise<ScanCompanyFactsZipEntriesResult> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) {
        reject(error ?? new Error(`Failed to open zip: ${zipFilePath}`));
        return;
      }

      const entriesToRead: CompanyFactsZipEntryMeta[] = [];

      let totalCount = 0;
      let newCount = 0;
      let sameSizeSkipCount = 0;
      let changedSizeCount = 0;
      let filteredOutCount = 0;

      zipfile.readEntry();

      zipfile.on("entry", (entry) => {
        const cik = extractCikFromEntryName(entry.fileName);

        if (!cik) {
          zipfile.readEntry();
          return;
        }

        // 1) universe 필터: 허용 대상이 아니면 즉시 skip
        if (allowedCiks && !allowedCiks.has(cik)) {
          filteredOutCount += 1;
          zipfile.readEntry();
          return;
        }

        // totalCount는 "허용된 universe 안에서 검사 대상이 된 회사 수"
        totalCount += 1;

        const size = entry.uncompressedSize;
        const prev = companyStateMap.get(cik);
        const prevFileSize =
          prev?.last_file_size == null ? null : Number(prev.last_file_size);

        if (!prev) {
          newCount += 1;
          entriesToRead.push({ cik, size });
          zipfile.readEntry();
          return;
        }

        if (prevFileSize === size && !options.forceReadAll) {
          sameSizeSkipCount += 1;
          zipfile.readEntry();
          return;
        }

        if (prevFileSize !== size) {
          changedSizeCount += 1;
        }
        entriesToRead.push({ cik, size });
        zipfile.readEntry();
      });

      zipfile.on("end", () => {
        resolve({
          entriesToRead: entriesToRead.sort((a, b) => a.cik.localeCompare(b.cik)),
          totalCount,
          newCount,
          sameSizeSkipCount,
          changedSizeCount,
          filteredOutCount,
        });
      });

      zipfile.on("error", reject);
    });
  });
}

export function buildCompanyFactsEntryName(cik: string): string {
  return `CIK${String(cik).padStart(10, "0")}.json`;
}

function extractCikFromEntryName(entryName: string): string | null {
  const match = entryName.match(/^CIK(\d+)\.json$/);
  return match ? match[1].padStart(10, "0") : null;
}
