"use client";

import { InvoiceDoc, InvoicesJournal, QuoteDoc } from "./commercial";
import { MarketsSummary, OdsDoc, SituationDoc } from "./market";
import { AttendanceSheet, EmployeesList, PayrollLedger, PayslipDoc } from "./hr";
import { DailyReportDoc, EquipmentList, ExpensesReport, MovementDoc, ProjectReport, StockReport } from "./site";
import { NotFound } from "./states";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export function PrintDocument({ doc, id, projectId }: { doc: string; id: string; projectId: string }) {
  switch (doc) {
    case "quote":
      return <QuoteDoc id={id} />;
    case "invoice":
      return <InvoiceDoc id={id} />;
    case "invoices":
      return <InvoicesJournal />;
    case "client":
      return <InvoicesJournal clientId={id} />;
    case "situation":
      return <SituationDoc id={id} />;
    case "attachment":
      return <SituationDoc id={id} attachment />;
    case "ods":
      return <OdsDoc id={id} />;
    case "markets":
      return <MarketsSummary />;
    case "payslip":
      return <PayslipDoc id={id} />;
    case "payroll":
      return PERIOD.test(id) ? <PayrollLedger period={id} projectId={projectId} /> : <NotFound />;
    case "attendance":
      return PERIOD.test(id) ? <AttendanceSheet period={id} projectId={projectId} /> : <NotFound />;
    case "employees":
      return <EmployeesList />;
    case "project":
      return <ProjectReport id={id} />;
    case "stock":
      return <StockReport />;
    case "equipment":
      return <EquipmentList />;
    case "expenses":
      return id === "all" || PERIOD.test(id) ? <ExpensesReport period={id} projectId={projectId} /> : <NotFound />;
    case "daily-report":
      return <DailyReportDoc id={id} />;
    case "movement":
      return <MovementDoc id={id} />;
    default:
      return <NotFound />;
  }
}
