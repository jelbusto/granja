"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, Link, useRouter } from "@/lib/i18n/routing";
import type { SVGProps } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  HomeIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  BanknotesIcon,
  ArrowUpTrayIcon,
  WrenchIcon,
  CogIcon,
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
  DocumentIcon,
  UserIcon,
  UsersIcon,
  LogoutIcon,
  IdentificationIcon,
  CreditCardIcon,
  ClockIcon,
  CalendarIcon,
  TagIcon,
} from "@/components/ui/Icons";

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element;

type SimpleItem = {
  kind: "link";
  href: string;
  ruta: string;
  label: string;
  icon: IconComponent;
};

type GroupItem = {
  kind: "group";
  key: string;
  ruta: string;
  label: string;
  icon: IconComponent;
  children: SimpleItem[];
};

type NavEntry = SimpleItem | GroupItem;

type Permiso = { puede_ver: boolean; puede_editar: boolean };

function SidebarLogo() {
  return (
    <div className="bg-white rounded-lg px-3 py-2 flex items-center justify-center">
      <Image
        src="/logo.png"
        alt="Dairy Professionals"
        width={168}
        height={56}
        className="object-contain h-12 w-auto"
        priority
      />
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const [permisos, setPermisos] = useState<Record<string, Permiso> | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfil } = await (supabase
        .from("usuarios_perfil" as never)
        .select("nombre, apellidos, id_tipo_usuario, idioma")
        .eq("id", user.id)
        .single()) as { data: { nombre: string; apellidos: string | null; id_tipo_usuario: string | null; idioma: string | null } | null; error: unknown };

      // Apply saved locale (cross-device sync)
      if (perfil?.idioma && perfil.idioma !== locale) {
        router.replace(pathname, { locale: perfil.idioma });
        return;
      }

      setUserName(
        perfil
          ? [perfil.nombre, perfil.apellidos].filter(Boolean).join(" ")
          : (user.email ?? "")
      );

      if (!perfil?.id_tipo_usuario) {
        setPermisos({});
        return;
      }

      const { data: perms } = await (supabase
        .from("permisos_menu" as never)
        .select("ruta, puede_ver, puede_editar")
        .eq("id_tipo_usuario", perfil.id_tipo_usuario)) as {
        data: { ruta: string; puede_ver: boolean; puede_editar: boolean }[] | null;
        error: unknown;
      };

      const map: Record<string, Permiso> = {};
      for (const p of perms ?? []) map[p.ruta] = { puede_ver: p.puede_ver, puede_editar: p.puede_editar };
      setPermisos(map);
    }
    load();
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  // While permisos are loading, show all (avoids flash of empty sidebar)
  function canSee(ruta: string): boolean {
    if (permisos === null) return true;
    return permisos[ruta]?.puede_ver ?? false;
  }

  const NAV: NavEntry[] = [
    { kind: "link", href: "/dashboard",     ruta: "dashboard",      label: t("vision_general"),    icon: HomeIcon },
    { kind: "link", href: "/produccion",    ruta: "produccion",     label: t("datos_produccion"),  icon: ChartBarIcon },
    { kind: "link", href: "/economico",     ruta: "economico",      label: t("datos_economicos"),  icon: BanknotesIcon },
    { kind: "link", href: "/carga-datos",   ruta: "carga_datos",    label: t("carga_datos"),       icon: ArrowUpTrayIcon },
    { kind: "link", href: "/documentacion", ruta: "documentacion",  label: t("documentacion"),     icon: DocumentIcon },
    { kind: "link", href: "/actividades",   ruta: "actividades",    label: t("actividades"),       icon: CalendarIcon },
    {
      kind: "group",
      key: "empleados",
      ruta: "empleados",
      label: t("empleados"),
      icon: IdentificationIcon,
      children: [
        { kind: "link", href: "/empleados/gastos-viaje", ruta: "empleados/gastos_viaje", label: t("gastos_viaje"), icon: CreditCardIcon },
        { kind: "link", href: "/empleados/fichajes",     ruta: "empleados/fichajes",     label: t("fichajes"),     icon: ClockIcon },
      ],
    },
    {
      kind: "group",
      key: "mantenimientos",
      ruta: "mantenimientos",
      label: t("mantenimientos"),
      icon: WrenchIcon,
      children: [
        { kind: "link", href: "/granjas",                          ruta: "mantenimientos/granjas",          label: t("granjas"),          icon: BuildingOfficeIcon },
        { kind: "link", href: "/mantenimientos/tipos-usuario",     ruta: "mantenimientos/tipos_usuario",    label: t("tipos_usuario"),    icon: UsersIcon },
        { kind: "link", href: "/mantenimientos/usuarios",          ruta: "mantenimientos/usuarios",         label: t("usuarios"),         icon: UserIcon },
        { kind: "link", href: "/mantenimientos/tipos-actividad",   ruta: "mantenimientos/tipos_actividad",  label: t("tipos_actividad"),  icon: TagIcon },
      ],
    },
    { kind: "link", href: "/configuracion", ruta: "configuracion",  label: t("configuracion"),     icon: CogIcon },
  ];

  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({
    mantenimientos: pathname.startsWith("/granjas") || pathname.startsWith("/mantenimientos"),
    empleados:      pathname.startsWith("/empleados"),
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function toggleGroup(key: string) {
    setGroupOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderItem(item: NavEntry, onClose: () => void): JSX.Element | null {
    if (item.kind === "group") {
      if (!canSee(item.ruta)) return null;
      const visibleChildren = item.children.filter((c) => canSee(c.ruta));
      if (visibleChildren.length === 0) return null;
      const open = groupOpen[item.key] ?? false;
      const anyActive = visibleChildren.some((c) => isActive(c.href));
      return (
        <li key={item.key}>
          <button
            onClick={() => toggleGroup(item.key)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              anyActive ? "text-white bg-gray-700" : "text-gray-300 hover:text-white hover:bg-gray-800"
            }`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <ul className="mt-0.5 ml-3 pl-3 border-l border-gray-700 space-y-0.5">
              {visibleChildren.map((child) => renderItem(child, onClose))}
            </ul>
          )}
        </li>
      );
    }

    if (!canSee(item.ruta)) return null;
    const active = isActive(item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            active ? "bg-accent text-white" : "text-gray-300 hover:text-white hover:bg-gray-800"
          }`}
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          {item.label}
        </Link>
      </li>
    );
  }

  function NavList({ onClose }: { onClose: () => void }) {
    return (
      <ul className="py-4 px-2 space-y-0.5">
        {NAV.map((item) => renderItem(item, onClose))}
      </ul>
    );
  }

  function UserFooter() {
    if (!userName) return null;
    return (
      <div className="px-3 py-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-2 px-1">
          <div className="h-7 w-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
            <UserIcon className="h-4 w-4 text-gray-300" />
          </div>
          <span className="text-sm text-gray-300 truncate">{userName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogoutIcon className="h-4 w-4 flex-shrink-0" />
          {t("cerrar_sesion")}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 bg-gray-900 min-h-screen border-r border-gray-700">
        <div className="px-4 py-5 border-b border-gray-700"><SidebarLogo /></div>
        <nav className="flex-1 overflow-y-auto">
          <NavList onClose={() => {}} />
        </nav>
        <UserFooter />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center h-14 bg-gray-900 px-4 border-b border-gray-700">
        <button onClick={() => setMobileOpen(true)} className="text-gray-300 hover:text-white p-1 rounded" aria-label="Abrir menú">
          <Bars3Icon className="h-6 w-6" />
        </button>
        <div className="ml-3"><SidebarLogo /></div>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 flex flex-col transform transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-700">
          <SidebarLogo />
          <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white p-1 rounded" aria-label="Cerrar menú">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <NavList onClose={() => setMobileOpen(false)} />
        </nav>
        <UserFooter />
      </aside>
    </>
  );
}
