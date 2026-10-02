"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Inbox, Pencil, Plus, Printer, Search, Trash } from "lucide-react";
import { Button, Card, EmptyState, Input, Modal, PageHeader, Select, Skeleton, Table, Td, Th } from "@/components/ui";
import { useApp } from "@/components/providers/AppProvider";
import { useCollection } from "@/lib/client/api";
import { ENUMS, type CollectionName, type Doc, type EnumKey } from "@/lib/schemas";
import { FormFields, type FormField } from "./FormFields";
import { useFormErrors } from "./useFormErrors";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "start" | "end" | "center";
  className?: string;
}

export interface FilterDef<T> {
  name: string;
  label: string;
  enumKey?: EnumKey;
  options?: Array<{ value: string; label: string }>;
  match?: (row: T, value: string) => boolean;
}

export interface CrudPageProps<C extends CollectionName> {
  collection: C;
  title: string;
  subtitle?: string;
  newLabel?: string;
  columns: Column<Doc<C>>[];
  fields: FormField[];
  defaults?: () => Record<string, unknown>;
  searchText?: (row: Doc<C>) => string;
  filters?: FilterDef<Doc<C>>[];
  rowHref?: (row: Doc<C>) => string;
  rowActions?: (row: Doc<C>) => ReactNode;
  headerActions?: ReactNode;
  summary?: (rows: Doc<C>[]) => ReactNode;
  footer?: (rows: Doc<C>[]) => ReactNode;
  afterCreate?: (doc: Doc<C>) => void;
  toForm?: (row: Doc<C>) => Record<string, unknown>;
  modalSize?: "sm" | "md" | "lg" | "xl";
  pageSize?: number;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  emptyIcon?: ReactNode;
  canEdit?: (row: Doc<C>) => boolean;
}

export function CrudPage<C extends CollectionName>(props: CrudPageProps<C>) {
  const {
    collection,
    columns,
    fields,
    defaults,
    searchText,
    filters = [],
    rowHref,
    rowActions,
    headerActions,
    summary,
    footer,
    afterCreate,
    toForm,
    pageSize = 20,
  } = props;
  const { t, can, toast } = useApp();
  const router = useRouter();
  const { data, ready, error, reload, create, update, remove } = useCollection(collection);
  const writable = can(collection, "write");

  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(props.defaultSort ?? null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Doc<C> | null>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Doc<C> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { errors, handle, clear } = useFormErrors();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data.filter((row) => {
      for (const f of filters) {
        const v = filterValues[f.name];
        if (!v) continue;
        if (f.match ? !f.match(row, v) : String((row as unknown as Record<string, unknown>)[f.name]) !== v) return false;
      }
      if (!q) return true;
      const text = searchText
        ? searchText(row)
        : Object.values(row as unknown as Record<string, unknown>)
            .filter((v) => typeof v === "string" || typeof v === "number")
            .join(" ");
      return text.toLowerCase().includes(q);
    });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const get = (r: Doc<C>) => (col?.sortValue ? col.sortValue(r) : ((r as unknown as Record<string, unknown>)[sort.key] as string | number) ?? "");
      list = [...list].sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true });
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [data, query, filterValues, filters, searchText, sort, columns]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);

  function openCreate() {
    clear();
    setEditing(null);
    setValues(defaults ? defaults() : {});
    setOpen(true);
  }

  function openEdit(row: Doc<C>) {
    clear();
    setEditing(row);
    setValues(toForm ? toForm(row) : { ...(row as unknown as Record<string, unknown>) });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, values);
        toast(t("common.saved"));
      } else {
        const doc = await create(values);
        toast(t("common.created"));
        afterCreate?.(doc);
      }
      setOpen(false);
    } catch (err) {
      handle(err);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await remove(toDelete.id);
      toast(t("common.deleted"));
      setToDelete(null);
    } catch (err) {
      handle(err);
    } finally {
      setDeleting(false);
    }
  }

  function toggleSort(key: string) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div>
      <PageHeader
        title={t(props.title)}
        subtitle={props.subtitle ? t(props.subtitle) : undefined}
        actions={
          <>
            {headerActions}
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()} className="hidden sm:inline-flex">
              {t("common.print")}
            </Button>
            <a
              href={`/api/export/${collection}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">{t("common.export")}</span>
            </a>
            {writable && (
              <Button icon={<Plus className="size-4" />} onClick={openCreate}>
                {t(props.newLabel ?? "common.add")}
              </Button>
            )}
          </>
        }
      />

      {summary && ready && <div className="mb-6">{summary(rows)}</div>}

      <Card padded={false}>
        <div className="no-print flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t("common.search")}
              className="ps-9"
              aria-label={t("common.search")}
            />
          </div>
          {filters.map((f) => (
            <Select
              key={f.name}
              value={filterValues[f.name] ?? ""}
              onChange={(e) => {
                setFilterValues((prev) => ({ ...prev, [f.name]: e.target.value }));
                setPage(1);
              }}
              className="sm:w-52"
              aria-label={t(f.label)}
            >
              <option value="">
                {t(f.label)} : {t("common.all")}
              </option>
              {(f.options ?? (f.enumKey ? ENUMS[f.enumKey].map((v) => ({ value: v, label: t(`enums.${f.enumKey}.${v}`) })) : [])).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))}
        </div>

        {error ? (
          <EmptyState
            title={t(error.status === 403 ? "common.noAccess" : "common.error")}
            action={
              <Button variant="secondary" onClick={() => reload()}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : !ready ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={props.emptyIcon ?? <Inbox className="size-6" />}
            title={t("common.empty")}
            hint={writable && data.length === 0 ? t("common.emptyHint") : undefined}
            action={
              writable && data.length === 0 ? (
                <Button icon={<Plus className="size-4" />} onClick={openCreate}>
                  {t(props.newLabel ?? "common.add")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <Th key={c.key} align={c.align}>
                      <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-text">
                        {t(c.label)}
                        {sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    </Th>
                  ))}
                  <Th align="end" className="no-print">
                    <span className="sr-only">{t("common.actions")}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className={rowHref ? "cursor-pointer transition-colors hover:bg-surface-2" : "transition-colors hover:bg-surface-2/60"}
                    onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                  >
                    {columns.map((c) => (
                      <Td key={c.key} align={c.align} className={c.className}>
                        {c.render ? c.render(row) : String((row as unknown as Record<string, unknown>)[c.key] ?? "—")}
                      </Td>
                    ))}
                    <Td align="end" className="no-print">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {rowActions?.(row)}
                        {writable && (!props.canEdit || props.canEdit(row)) && (
                          <>
                            <button
                              onClick={() => openEdit(row)}
                              className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text"
                              title={t("common.edit")}
                              aria-label={t("common.edit")}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => setToDelete(row)}
                              className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"
                              title={t("common.delete")}
                              aria-label={t("common.delete")}
                            >
                              <Trash className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
              {footer && <tfoot>{footer(rows)}</tfoot>}
            </Table>
            <div className="no-print flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted">
              <span>{t("common.results", { count: rows.length })}</span>
              {pages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label={t("common.previous")}>
                    <ChevronLeft className="size-4 rtl:rotate-180" />
                  </Button>
                  <span>{t("common.page", { page: current, pages })}</span>
                  <Button variant="secondary" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)} aria-label={t("common.next")}>
                    <ChevronRight className="size-4 rtl:rotate-180" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t("common.edit") : t(props.newLabel ?? "common.add")}
        size={props.modalSize ?? "md"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form={`form-${collection}`} loading={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <form id={`form-${collection}`} onSubmit={submit} noValidate>
          <FormFields fields={fields} values={values} onChange={(name, v) => setValues((prev) => ({ ...prev, [name]: v }))} errors={errors} />
        </form>
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={t("common.delete")}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm">{t("common.confirmDelete")}</p>
      </Modal>
    </div>
  );
}
