"use client";

import { useState } from "react";
import { Trash } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { FormFields } from "@/components/crud/FormFields";
import { useFormErrors } from "@/components/crud/useFormErrors";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { addDays, todayIso } from "@/lib/calc/money";
import type { Task } from "@/lib/schemas";

export function TaskDialog({
  task,
  projectId,
  onClose,
  showProject = false,
}: {
  task: Task | null;
  projectId?: string;
  onClose: () => void;
  showProject?: boolean;
}) {
  const { t, toast, can } = useApp();
  const { create, update, remove } = useCollection("tasks");
  const [values, setValues] = useState<Record<string, unknown>>(
    task
      ? { ...task }
      : { projectId: projectId ?? "", startDate: todayIso(), endDate: addDays(todayIso(), 14), progress: 0, order: 0 },
  );
  const [busy, setBusy] = useState(false);
  const { errors, handle } = useFormErrors();
  const writable = can("tasks", "write");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (task) await update(task.id, values);
      else await create(values);
      toast(t("common.saved"));
      onClose();
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!task) return;
    setBusy(true);
    try {
      await remove(task.id);
      toast(t("common.deleted"));
      onClose();
    } catch (err) {
      handle(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? task.name : t("projects.addTask")}
      footer={
        writable ? (
          <>
            {task && (
              <Button variant="ghost" className="me-auto text-danger" icon={<Trash className="size-4" />} onClick={destroy} disabled={busy}>
                {t("common.delete")}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="task-form" loading={busy}>
              {t("common.save")}
            </Button>
          </>
        ) : undefined
      }
    >
      <form id="task-form" onSubmit={submit} noValidate>
        <FormFields
          values={values}
          errors={errors}
          onChange={(name, v) => setValues((prev) => ({ ...prev, [name]: v }))}
          fields={[
            ...(showProject ? [{ name: "projectId", label: "fields.project", type: "ref" as const, ref: "projects" as const, required: true, full: true }] : []),
            { name: "name", label: "fields.taskName", required: true, full: true },
            { name: "startDate", label: "fields.startDate", type: "date", required: true },
            { name: "endDate", label: "fields.endDate", type: "date", required: true },
            { name: "progress", label: "fields.progress", type: "number", min: 0, max: 100 },
            { name: "responsible", label: "fields.responsible" },
            {
              name: "dependsOn",
              label: "fields.dependsOn",
              type: "ref",
              ref: "tasks",
              refFilter: (d, v) => d.projectId === v.projectId && d.id !== task?.id,
              refLabel: (d) => String(d.name),
            },
            { name: "order", label: "#", type: "number", step: "1" },
          ]}
        />
      </form>
    </Modal>
  );
}
