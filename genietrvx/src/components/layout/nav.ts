import {
  ArrowLeftRight,
  Banknote,
  Building,
  CalendarCheck,
  ChartGantt,
  FileChartColumn,
  FilePen,
  FileText,
  Handshake,
  HardHat,
  LayoutDashboard,
  NotebookPen,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Sparkles,
  Store,
  Truck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Resource } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  resource?: Resource;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { items: [{ href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard }] },
  {
    label: "nav.sites",
    items: [
      { href: "/projects", label: "nav.projects", icon: HardHat, resource: "projects" },
      { href: "/planning", label: "nav.planning", icon: ChartGantt, resource: "tasks" },
      { href: "/daily-reports", label: "nav.dailyReports", icon: NotebookPen, resource: "dailyReports" },
    ],
  },
  {
    label: "nav.finance",
    items: [
      { href: "/markets", label: "nav.markets", icon: ScrollText, resource: "markets" },
      { href: "/quotes", label: "nav.quotes", icon: FileText, resource: "quotes" },
      { href: "/invoices", label: "nav.invoices", icon: Receipt, resource: "invoices" },
      { href: "/expenses", label: "nav.expenses", icon: Wallet, resource: "expenses" },
      { href: "/estimation", label: "nav.estimation", icon: Sparkles, resource: "estimation" },
    ],
  },
  {
    label: "nav.labor",
    items: [
      { href: "/employees", label: "nav.employees", icon: Users, resource: "employees" },
      { href: "/attendance", label: "nav.attendance", icon: CalendarCheck, resource: "attendance" },
      { href: "/payroll", label: "nav.payroll", icon: Banknote, resource: "payslips" },
    ],
  },
  {
    label: "nav.logistics",
    items: [
      { href: "/materials", label: "nav.materials", icon: Package, resource: "materials" },
      { href: "/stock", label: "nav.stockMovements", icon: ArrowLeftRight, resource: "stockMovements" },
      { href: "/equipment", label: "nav.equipment", icon: Truck, resource: "equipment" },
    ],
  },
  {
    label: "nav.partners",
    items: [
      { href: "/clients", label: "nav.clients", icon: Building, resource: "clients" },
      { href: "/suppliers", label: "nav.suppliers", icon: Store, resource: "suppliers" },
      { href: "/subcontractors", label: "nav.subcontractors", icon: Handshake, resource: "subcontractors" },
      { href: "/subcontracts", label: "nav.subcontracts", icon: FilePen, resource: "subcontracts" },
    ],
  },
  { items: [{ href: "/reports", label: "nav.reports", icon: FileChartColumn, resource: "reports" }] },
  {
    label: "nav.admin",
    items: [
      { href: "/users", label: "nav.users", icon: UserCog, resource: "users" },
      { href: "/settings", label: "nav.settings", icon: Settings, resource: "settings" },
    ],
  },
];
