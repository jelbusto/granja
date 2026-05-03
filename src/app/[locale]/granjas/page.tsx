import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getGranjas } from "@/lib/supabase/granjas";
import { PencilIcon, PlusIcon } from "@/components/ui/Icons";
import { DeleteGranjaButton } from "@/components/granjas/DeleteGranjaButton";
import GranjasMapa from "@/components/granjas/GranjasMapa";

interface PageProps {
  params: { locale: string };
  searchParams: { page?: string; vista?: string };
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations({ locale: params.locale, namespace: "granjas" });
  return { title: t("title") };
}

export default async function GranjasPage({ params, searchParams }: PageProps) {
  const { locale } = params;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const vista = searchParams.vista === "mapa" ? "mapa" : "tabla";

  const t = await getTranslations({ locale, namespace: "granjas" });
  const tc = await getTranslations({ locale, namespace: "common" });

  const { data: granjas, count, pageSize, error } = await getGranjas(page);
  const totalPages = Math.ceil(count / pageSize);

  const paisLabels: Record<string, string> = {
    ES: t("paises.ES"),
    PT: t("paises.PT"),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <Link
            href="/granjas/new"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            {t("new_granja")}
          </Link>
        </div>

        {/* Toggle Tabla / Mapa */}
        <div className="mb-5 flex rounded-lg overflow-hidden w-fit" style={{ border: "1px solid #e5e5e5" }}>
          <Link
            href="/granjas"
            className="px-4 py-1.5 text-sm font-medium transition-colors"
            style={
              vista === "tabla"
                ? { backgroundColor: "var(--accent)", color: "white" }
                : { backgroundColor: "white", color: "#555" }
            }
          >
            Tabla
          </Link>
          <Link
            href="/granjas?vista=mapa"
            className="px-4 py-1.5 text-sm font-medium transition-colors"
            style={
              vista === "mapa"
                ? { backgroundColor: "var(--accent)", color: "white" }
                : { backgroundColor: "white", color: "#555" }
            }
          >
            Mapa
          </Link>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {tc("error")}: {error.message}
          </div>
        )}

        {vista === "mapa" ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-4">
            <GranjasMapa />
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">
                      {t("id")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">
                      {t("nombre")}
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-semibold text-gray-600">
                      {t("pais")}
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">
                      {tc("active")}
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">
                      {tc("actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {granjas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-gray-400"
                      >
                        {t("no_granjas")}
                      </td>
                    </tr>
                  ) : (
                    granjas.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-gray-700">
                          {g.codigo}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {g.nombre}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-gray-600">
                          {g.pais ? (paisLabels[g.pais] ?? g.pais) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              g.activo
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {g.activo ? tc("active") : tc("inactive")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/granjas/${g.id}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                              {tc("edit")}
                            </Link>
                            <DeleteGranjaButton id={g.id} locale={locale} />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>
                  {tc("page")} {page} {tc("of")} {totalPages}
                </span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={`/granjas?page=${page - 1}`}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
                    >
                      ← {tc("previous")}
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link
                      href={`/granjas?page=${page + 1}`}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
                    >
                      {tc("next")} →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
