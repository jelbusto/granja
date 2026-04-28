import { WrenchIcon } from "@/components/ui/Icons";

export function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="rounded-full bg-gray-100 p-6 mb-6">
        <WrenchIcon className="h-12 w-12 text-gray-400" />
      </div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-3">{title}</h1>
      <p className="text-base text-gray-500">Esta sección estará disponible próximamente.</p>
    </div>
  );
}
