"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { deleteGranjaAction } from "@/lib/actions/granjas";
import { TrashIcon } from "@/components/ui/Icons";

export function DeleteGranjaButton({ id, locale }: { id: string; locale: string }) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(tc("confirm_delete"))) return;
    setLoading(true);
    await deleteGranjaAction(id, locale);
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <TrashIcon className="h-3.5 w-3.5" />
      {tc("delete")}
    </button>
  );
}
