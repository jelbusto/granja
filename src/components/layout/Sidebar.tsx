"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/lib/i18n/routing";
import type { SVGProps } from "react";
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
} from "@/components/ui/Icons";

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element;

type SimpleItem = {
  kind: "link";
  href: string;
  label: string;
  icon: IconComponent;
};

type GroupItem = {
  kind: "group";
  key: string;
  label: string;
  icon: IconComponent;
  children: SimpleItem[];
};

type NavEntry = SimpleItem | GroupItem;

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
  const t = useTranslations("nav");

  const NAV: NavEntry[] = [
    { kind: "link", href: "/dashboard", label: t("vision_general"), icon: HomeIcon },
    { kind: "link", href: "/produccion", label: t("datos_produccion"), icon: ChartBarIcon },
    { kind: "link", href: "/economico", label: t("datos_economicos"), icon: BanknotesIcon },
    { kind: "link", href: "/carga-datos", label: t("carga_datos"), icon: ArrowUpTrayIcon },
    {
      kind: "group",
      key: "mantenimientos",
      label: t("mantenimientos"),
      icon: WrenchIcon,
      children: [
        { kind: "link", href: "/granjas", label: t("granjas"), icon: BuildingOfficeIcon },
      ],
    },
    { kind: "link", href: "/configuracion", label: t("configuracion"), icon: CogIcon },
  ];

  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>({
    mantenimientos: pathname.startsWith("/granjas"),
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function toggleGroup(key: string) {
    setGroupOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function renderItem(item: NavEntry, onClose: () => void): JSX.Element {
    if (item.kind === "group") {
      const open = groupOpen[item.key] ?? false;
      const anyActive = item.children.some((c) => isActive(c.href));
      return (
        <li key={item.key}>
          <button
            onClick={() => toggleGroup(item.key)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              anyActive
                ? "text-white bg-gray-700"
                : "text-gray-300 hover:text-white hover:bg-gray-800"
            }`}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronDownIcon
              className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
          {open && (
            <ul className="mt-0.5 ml-3 pl-3 border-l border-gray-700 space-y-0.5">
              {item.children.map((child) => renderItem(child, onClose))}
            </ul>
          )}
        </li>
      );
    }

    const active = isActive(item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            active
              ? "bg-accent text-white"
              : "text-gray-300 hover:text-white hover:bg-gray-800"
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

  return (
    <>
      {/* Desktop sidebar — in normal document flow */}
      <aside className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 bg-gray-900 min-h-screen border-r border-gray-700">
        <div className="px-4 py-5 border-b border-gray-700"><SidebarLogo /></div>
        <nav className="flex-1 overflow-y-auto">
          <NavList onClose={() => {}} />
        </nav>
      </aside>

      {/* Mobile fixed top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center h-14 bg-gray-900 px-4 border-b border-gray-700">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-gray-300 hover:text-white p-1 rounded"
          aria-label="Abrir menú"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <div className="ml-3"><SidebarLogo /></div>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 flex flex-col transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-700">
          <SidebarLogo />
          <button
            onClick={() => setMobileOpen(false)}
            className="text-gray-400 hover:text-white p-1 rounded"
            aria-label="Cerrar menú"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <NavList onClose={() => setMobileOpen(false)} />
        </nav>
      </aside>
    </>
  );
}
