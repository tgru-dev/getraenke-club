"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PinChangeDialog } from "@/components/PinChangeDialog";

export function AdminSidebarFooter({ name }: { name: string }) {
  const router = useRouter();
  const [showPin, setShowPin] = useState(false);

  return (
    <div className="mt-auto flex flex-col gap-2 pt-4">
      <p className="text-xs text-neutral-500">{name}</p>
      <button
        onClick={() => setShowPin(true)}
        className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700"
      >
        PIN ändern
      </button>
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/login");
        }}
        className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-700"
      >
        Abmelden
      </button>
      {showPin && <PinChangeDialog onClose={() => setShowPin(false)} />}
    </div>
  );
}
