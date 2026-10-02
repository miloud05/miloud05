"use client";

import { useState } from "react";
import { FilePen, Plus, Trash, Wallet } from "lucide-react";
import { CrudPage } from "@/components/crud/CrudPage";
import { StatusBadge } from "@/components/StatusBadge";
import { Button, Input, Modal, ProgressBar, Select, Table, Td, Th } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { useLookup } from "@/lib/client/lookup";
import { ENUMS, type Subcontract } from "@/lib/schemas";
import { round2, todayIso } from "@/lib/calc/money";

function paidOf(s: Subcontract) {
  return round2(s.payments.reduce((a, p) => a + p.amount, 0));
}

function PaymentsDialog({ contract, onClose }: { contract: Subcontract; onClose: () => void }) {
  const { t, money, date, enumLabel, can, toast, errorMessage } = useApp();
  const { update } = useCollection("subcontracts");
  const [payments, setPayments] = useState(contract.payments);
  const [busy, setBusy] = useState(false);
  const writable = can("subcontracts", "write");

  async function save() {
    setBusy(true);
    try {
      await update(contract.id, { payments });
      toast(t("common.saved"));
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const paid = round2(payments.reduce((a, p) => a + (Number(p.amount) || 0), 0));
  return (
    <Modal
      open
      onClose={onClose}
      title={`${t("subcontracts.payments")} — ${contract.object}`}
      size="lg"
      footer={
        writable ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button loading={busy} onClick={save}>
              {t("common.save")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs text-muted">{t("fields.amount")}</p>
          <p className="num font-semibold">{money(contract.amount)}</p>
        </div>
        <div className="rounded-xl bg-success-soft p-3">
          <p className="text-xs text-muted">{t("fields.paid")}</p>
          <p className="num font-semibold text-success">{money(paid)}</p>
        </div>
        <div className="rounded-xl bg-warning-soft p-3">
          <p className="text-xs text-muted">{t("fields.remaining")}</p>
          <p className="num font-semibold text-warning">{money(contract.amount - paid)}</p>
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>{t("fields.date")}</Th>
            <Th align="end">{t("fields.amount")}</Th>
            <Th>{t("fields.paymentMode")}</Th>
            <Th>{t("fields.reference")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={i}>
              <Td>
                {writable ? (
                  <Input type="date" value={p.date} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                ) : (
                  date(p.date)
                )}
              </Td>
              <Td align="end">
                {writable ? (
                  <Input type="number" dir="ltr" value={p.amount} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
                ) : (
                  <span className="num">{money(p.amount)}</span>
                )}
              </Td>
              <Td>
                {writable ? (
                  <Select value={p.mode} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, mode: e.target.value } : x)))}>
                    {ENUMS.paymentMode.map((m) => (
                      <option key={m} value={m}>
                        {enumLabel("paymentMode", m)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  enumLabel("paymentMode", p.mode)
                )}
              </Td>
              <Td>
                {writable ? (
                  <Input value={p.reference} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))} />
                ) : (
                  p.reference
                )}
              </Td>
              <Td align="end">
                {writable && (
                  <button onClick={() => setPayments(payments.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted hover:text-danger" aria-label={t("common.removeLine")}>
                    <Trash className="size-4" />
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {writable && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          icon={<Plus className="size-4" />}
          onClick={() => setPayments([...payments, { date: todayIso(), amount: 0, mode: "transfer", reference: "" }])}
        >
          {t("common.addLine")}
        </Button>
      )}
    </Modal>
  );
}

export default function SubcontractsPage() {
  const { money, date, t } = useApp();
  const subs = useLookup("subcontractors");
  const projects = useLookup("projects");
  const [selected, setSelected] = useState<Subcontract | null>(null);

  return (
    <>
      <CrudPage
        collection="subcontracts"
        title="subcontracts.title"
        subtitle="subcontracts.subtitle"
        newLabel="subcontracts.new"
        emptyIcon={<FilePen className="size-6" />}
        defaults={() => ({ status: "active", startDate: todayIso(), payments: [] })}
        searchText={(r) => `${r.object} ${subs.label(r.subcontractorId)} ${projects.label(r.projectId)}`}
        filters={[
          { name: "status", label: "fields.status", enumKey: "subcontractStatus" },
          { name: "projectId", label: "fields.project", options: projects.data.map((p) => ({ value: p.id, label: p.name })) },
        ]}
        columns={[
          { key: "object", label: "fields.object", render: (r) => <span className="font-medium">{r.object}</span> },
          { key: "subcontractorId", label: "fields.subcontractor", render: (r) => subs.label(r.subcontractorId), sortValue: (r) => subs.label(r.subcontractorId) },
          { key: "projectId", label: "fields.project", render: (r) => projects.get(r.projectId)?.code ?? "—" },
          { key: "amount", label: "fields.amount", align: "end", render: (r) => <span className="num">{money(r.amount)}</span> },
          {
            key: "paid",
            label: "fields.paid",
            sortValue: (r) => paidOf(r),
            render: (r) => (
              <div className="min-w-32">
                <p className="num text-xs">{money(paidOf(r))}</p>
                <ProgressBar value={r.amount ? (paidOf(r) / r.amount) * 100 : 0} tone="success" className="mt-1" />
              </div>
            ),
          },
          { key: "endDate", label: "fields.endDate", render: (r) => date(r.endDate) },
          { key: "status", label: "fields.status", render: (r) => <StatusBadge enumKey="subcontractStatus" value={r.status} /> },
        ]}
        rowActions={(r) => (
          <button onClick={() => setSelected(r)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title={t("subcontracts.payments")}>
            <Wallet className="size-4" />
          </button>
        )}
        fields={[
          { name: "object", label: "fields.object", required: true, full: true },
          { name: "subcontractorId", label: "fields.subcontractor", type: "ref", ref: "subcontractors", required: true },
          { name: "projectId", label: "fields.project", type: "ref", ref: "projects", required: true },
          { name: "amount", label: "fields.amount", type: "number" },
          { name: "status", label: "fields.status", type: "select", enumKey: "subcontractStatus" },
          { name: "startDate", label: "fields.startDate", type: "date" },
          { name: "endDate", label: "fields.endDate", type: "date" },
          { name: "notes", label: "fields.notes", type: "textarea" },
        ]}
      />
      {selected && <PaymentsDialog contract={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
