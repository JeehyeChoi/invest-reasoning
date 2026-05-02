"use client";

import dynamic from "next/dynamic";

const DataPipelineRefreshPanel = dynamic(
  () =>
    import("@/features/data-pipeline/components/DataPipelineRefreshPanel").then(
      (mod) => mod.DataPipelineRefreshPanel,
    ),
  { ssr: false },
);

export function StartupDataPipelineClient() {
  return <DataPipelineRefreshPanel />;
}
