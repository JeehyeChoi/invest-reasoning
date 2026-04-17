"use client";

import { useEffect } from "react";

export function StartupJobsTrigger() {
  useEffect(() => {
    void fetch("/api/internal/sec-bulk", {
      method: "POST",
    }).catch(() => {
      // 조용히 실패 무시 (로그 정도만 필요하면 추가)
    });
  }, []);

  return null;
}
