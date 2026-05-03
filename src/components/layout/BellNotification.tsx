"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { BellIcon } from "@/components/ui/Icons";

export function BellNotification() {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const [pendientes, setPendientes] = useState(0);

  async function fetchCount() {
    const { count } = await (supabase
      .from("tareas" as never)
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente")) as unknown as { count: number | null };
    setPendientes(count ?? 0);
  }

  useEffect(() => {
    fetchCount();

    const channel = supabase
      .channel("tareas-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "tareas" }, fetchCount)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPending = pendientes > 0;

  return (
    <button
      onClick={() => router.push("/tareas")}
      title={hasPending ? `${pendientes} tarea${pendientes > 1 ? "s" : ""} pendiente${pendientes > 1 ? "s" : ""}` : "Tareas"}
      className="relative flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-gray-800"
    >
      <BellIcon
        className="h-5 w-5 transition-colors"
        style={{ color: hasPending ? "#EF4444" : "#9CA3AF" }}
      />
      {hasPending && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {pendientes > 99 ? "99+" : pendientes}
        </span>
      )}
    </button>
  );
}
