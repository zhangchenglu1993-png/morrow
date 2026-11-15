"use client";

import { useEffect } from "react";
import { mutationFetch } from "@/lib/client";

export function MarkSeen({ endpoint }: { endpoint: string }) {
  useEffect(() => {
    void mutationFetch(endpoint, { method: "POST" }).catch(() => {
      // 已读记录失败不影响阅读，下次进入会重新标记。
    });
  }, [endpoint]);
  return null;
}
