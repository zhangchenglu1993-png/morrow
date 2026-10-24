"use client";

import { useRouter } from "next/navigation";
import { mutationFetch } from "@/lib/client";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="text-button"
      type="button"
      onClick={async () => {
        await mutationFetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      退出
    </button>
  );
}
