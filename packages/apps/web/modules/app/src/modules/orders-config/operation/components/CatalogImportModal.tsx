import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/elements/ui/button";
import {
  CATALOG_CATEGORIES,
  assignSmartPhoto,
  generateCatalogCsvTemplate,
  parseCatalogBulkText,
  type CatalogProduct,
} from "../domain/catalogDomain";

export interface CatalogImportModalProps {
  open: boolean;
  onImport: (items: Array<Omit<CatalogProduct, "id" | "createdAt">>) => void;
  onLoadDemo: () => void;
  onCreateSingle?: () => void;
  onClose: () => void;
}

interface ParsedRow {
  rowId: string;
  selected: boolean;
  data: Omit<CatalogProduct, "id" | "createdAt">;
}

const ACCEPTED_EXTENSIONS = [
  ".csv",
  ".txt",
  ".xlsx",
  ".xls",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file, "UTF-8");
  });
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function downloadCsvTemplate(): void {
  if (typeof document === "undefined") return;
  const content = generateCatalogCsvTemplate();
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "plantilla_catalogo_necto.csv";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const GUIDE_STEPS = [
  {
    step: "1. Prepara tu lista",
    detail: "Reúne nombre, precio en COP, categoría y descripción de tus productos.",
  },
  {
    step: "2. Sube o pega los datos",
    detail: "Arrastra un archivo CSV o TXT, o pega tu menú línea por línea.",
  },
  {
    step: "3. Revisa la vista previa",
    detail: "Edita precios, ajusta categorías y elige qué productos deseas importar.",
  },
  {
    step: "4. Publica tu catálogo",
    detail: "Confirma la importación y guarda los cambios para tus canales de venta.",
  },
];

export const CatalogImportModal = ({
  open,
  onImport,
  onLoadDemo,
  onCreateSingle,
  onClose,
}: CatalogImportModalProps) => {
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [rawText, setRawText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "info" | "error" | "success";
    message: string;
  } | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setActiveTab("file");
      setRawText("");
      setDragging(false);
      setUploadedFileName(null);
      setFeedback(null);
      setRows([]);
    }
  }, [open]);

  if (!open) return null;

  const populateRows = (
    parsed: Array<Omit<CatalogProduct, "id" | "createdAt">>,
    sourceLabel: string,
  ) => {
    if (parsed.length === 0) {
      setFeedback({
        tone: "error",
        message:
          "No encontramos productos válidos para importar. Verifica que cada línea tenga al menos un nombre y precio.",
      });
      return;
    }

    setRows(
      parsed.map((item, idx) => ({
        rowId: `import-${Date.now()}-${idx}`,
        selected: true,
        data: {
          ...item,
          image: item.image || assignSmartPhoto(item.name, item.category),
        },
      })),
    );
    setFeedback({
      tone: "success",
      message: `Se detectaron ${parsed.length} ${
        parsed.length === 1 ? "producto" : "productos"
      } desde ${sourceLabel}. Revísalos antes de importar.`,
    });
  };

  const handleAnalyzeText = () => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setFeedback({
        tone: "error",
        message: "Escribe o pega al menos una línea de productos antes de analizar.",
      });
      return;
    }
    const parsed = parseCatalogBulkText(trimmed);
    populateRows(parsed, "el texto ingresado");
  };

  const handleFilePicked = async (file: File) => {
    const ext = getExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFeedback({
        tone: "error",
        message:
          "Formato no compatible. Usa archivos CSV, TXT, Excel (.xlsx/.xls), PDF o imágenes (PNG/JPG).",
      });
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setFeedback({
        tone: "error",
        message: "El archivo supera el límite máximo de 10 MB.",
      });
      return;
    }

    setUploadedFileName(file.name);

    const isPlainText =
      ext === ".csv" ||
      ext === ".txt" ||
      file.type.startsWith("text/") ||
      file.type === "application/csv";

    if (isPlainText) {
      try {
        const text = await readFileAsText(file);
        const parsed = parseCatalogBulkText(text);
        populateRows(parsed, `«${file.name}»`);
      } catch {
        setFeedback({
          tone: "error",
          message: "No pudimos leer el archivo seleccionado. Intenta subirlo nuevamente.",
        });
      }
      return;
    }

    // Binary files (.pdf, .xlsx, .xls, .png, .jpg, .jpeg) cannot be parsed in local mode — never invent fake products from filenames
    setRows([]);
    setFeedback({
      tone: "info",
      message: `Recibimos «${file.name}», pero en modo local solo procesamos automáticamente archivos .csv y .txt. No se crearon productos de relleno: descarga la plantilla CSV, pega tu listado en «Escribir o pegar texto» o carga el catálogo de ejemplo.`,
    });
  };

  const selectedRows = rows.filter((row) => row.selected && row.data.name.trim().length > 0);
  const allSelected = rows.length > 0 && rows.every((row) => row.selected);

  const toggleAll = () => {
    const next = !allSelected;
    setRows((prev) => prev.map((row) => ({ ...row, selected: next })));
  };

  const toggleRow = (rowId: string) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, selected: !row.selected } : row)),
    );
  };

  const updateRowData = (
    rowId: string,
    patch: Partial<Omit<CatalogProduct, "id" | "createdAt">>,
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const nextData = { ...row.data, ...patch };
        if (patch.category !== undefined || patch.name !== undefined) {
          nextData.image = assignSmartPhoto(nextData.name, nextData.category);
        }
        return { ...row, data: nextData };
      }),
    );
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const handleConfirmImport = () => {
    if (selectedRows.length === 0) return;
    onImport(selectedRows.map((row) => row.data));
    onClose();
  };

  const handleLoadDemoClick = () => {
    onLoadDemo();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 sm:p-5 font-sans">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar productos al catálogo"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
              <ArrowUpTrayIcon className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-ink-title dark:text-white">
                Importar productos masivamente
              </h2>
              <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                Carga un archivo CSV/TXT o pega tu lista de productos para agregarlos al catálogo en
                segundos.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onCreateSingle && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateSingle();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-theme-xs font-bold text-ink-title transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                <PlusIcon className="size-3.5 text-brand-500" aria-hidden="true" />
                Crear producto individual
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <XMarkIcon className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            {/* Left Column: Tabs + Input + Preview */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="inline-flex w-fit items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("file")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-theme-xs font-bold transition-colors cursor-pointer ${
                    activeTab === "file"
                      ? "bg-white text-ink-title shadow-xs dark:bg-gray-900 dark:text-white"
                      : "text-gray-500 hover:text-ink-body dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  <ArrowUpTrayIcon className="size-4" aria-hidden="true" />
                  Subir archivo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("text")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-theme-xs font-bold transition-colors cursor-pointer ${
                    activeTab === "text"
                      ? "bg-white text-ink-title shadow-xs dark:bg-gray-900 dark:text-white"
                      : "text-gray-500 hover:text-ink-body dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  <DocumentTextIcon className="size-4" aria-hidden="true" />
                  Escribir o pegar texto
                </button>
              </div>

              {activeTab === "file" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleFilePicked(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors cursor-pointer ${
                    dragging
                      ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/10"
                      : "border-gray-300 bg-gray-50/60 hover:border-brand-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950/40 dark:hover:border-brand-500/60"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFilePicked(file);
                      e.target.value = "";
                    }}
                  />
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-brand-500 shadow-xs dark:bg-gray-800">
                    <ArrowUpTrayIcon className="size-6" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-theme-sm font-bold text-ink-title dark:text-white">
                    Arrastra tu archivo aquí o haz clic para seleccionarlo
                  </p>
                  <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                    Formatos soportados: CSV, TXT, Excel (.xlsx, .xls), PDF, PNG y JPG · Máximo 10
                    MB
                  </p>
                  {uploadedFileName && (
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-[11px] font-bold text-ink-title dark:bg-accent-300/15 dark:text-accent-300">
                      <DocumentTextIcon className="size-3.5" aria-hidden="true" />
                      Archivo cargado: {uploadedFileName}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                  <label
                    htmlFor="catalog-bulk-textarea"
                    className="text-theme-xs font-bold text-ink-body dark:text-gray-200"
                  >
                    Pega o escribe tus productos (uno por línea o en formato CSV)
                  </label>
                  <textarea
                    id="catalog-bulk-textarea"
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={
                      "Audífonos Inalámbricos ANC Pro - $185.000 - Tecnología y electrodomésticos - Bluetooth 5.3 y batería de 36 horas\nSérum Facial Vitamina C 30ml - $68.000 - Salud, belleza y cuidado personal - Fórmula antioxidante\nCafetera Prensa Francesa 1L - $92.000 - Hogar, Muebles, Cocina - Vidrio borosilicato"
                    }
                    className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-theme-xs leading-relaxed text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Acepta separadores por coma, punto y coma, tabulación o guion (« - »).
                    </span>
                    <Button variant="primary" size="sm" onClick={handleAnalyzeText}>
                      Analizar productos
                    </Button>
                  </div>
                </div>
              )}

              {feedback && (
                <div
                  role="alert"
                  className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-theme-xs ${
                    feedback.tone === "error"
                      ? "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                      : feedback.tone === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
                  }`}
                >
                  {feedback.tone === "error" ? (
                    <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : feedback.tone === "success" ? (
                    <CheckCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <InformationCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  <div className="flex-1 space-y-2">
                    <p className="leading-snug">{feedback.message}</p>
                    {feedback.tone === "info" && activeTab === "file" && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={downloadCsvTemplate}
                          className="text-[11.5px] font-bold underline underline-offset-2 cursor-pointer"
                        >
                          Descargar plantilla CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("text")}
                          className="text-[11.5px] font-bold underline underline-offset-2 cursor-pointer"
                        >
                          Ir a «Escribir o pegar texto»
                        </button>
                        <button
                          type="button"
                          onClick={handleLoadDemoClick}
                          className="text-[11.5px] font-bold underline underline-offset-2 cursor-pointer"
                        >
                          Cargar catálogo de ejemplo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {rows.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 dark:border-gray-800 dark:bg-white/[0.02]">
                    <label className="inline-flex items-center gap-2 text-theme-xs font-bold text-ink-title cursor-pointer dark:text-white">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="size-4 rounded border-gray-300 accent-brand-500 cursor-pointer"
                      />
                      Vista previa ({selectedRows.length} de {rows.length} seleccionados)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setRows([]);
                        setFeedback(null);
                      }}
                      className="text-[11px] font-bold text-gray-500 hover:text-error-600 cursor-pointer dark:text-gray-400"
                    >
                      Limpiar vista previa
                    </button>
                  </div>

                  <div className="max-h-72 overflow-x-auto overflow-y-auto">
                    <table className="w-full min-w-[540px] border-collapse text-left text-theme-xs">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/40 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:bg-white/[0.01]">
                          <th className="w-10 px-3 py-2.5 text-center">Inc.</th>
                          <th className="px-3 py-2.5">Producto</th>
                          <th className="px-3 py-2.5">Categoría</th>
                          <th className="px-3 py-2.5">Precio (COP)</th>
                          <th className="w-10 px-3 py-2.5 text-right" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {rows.map((row) => (
                          <tr
                            key={row.rowId}
                            className={row.selected ? "" : "opacity-50"}
                          >
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={() => toggleRow(row.rowId)}
                                aria-label={`Incluir ${row.data.name}`}
                                className="size-4 rounded border-gray-300 accent-brand-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={
                                    row.data.image ||
                                    assignSmartPhoto(row.data.name, row.data.category)
                                  }
                                  alt={row.data.name}
                                  className="size-10 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-ink-body dark:text-white">
                                    {row.data.name}
                                  </p>
                                  <p className="truncate text-[11px] text-gray-400 max-w-[200px]">
                                    {row.data.description || "Sin descripción"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                value={row.data.category}
                                onChange={(e) =>
                                  updateRowData(row.rowId, { category: e.target.value })
                                }
                                aria-label={`Categoría de ${row.data.name}`}
                                className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-[11.5px] font-medium text-ink-body outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                              >
                                {CATALOG_CATEGORIES.map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="relative w-28">
                                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">
                                  $
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={row.data.price}
                                  onChange={(e) =>
                                    updateRowData(row.rowId, {
                                      price: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    })
                                  }
                                  aria-label={`Precio de ${row.data.name}`}
                                  className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-6 pr-2 text-[11.5px] font-bold tabular-nums text-ink-body outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => removeRow(row.rowId)}
                                aria-label={`Quitar ${row.data.name}`}
                                title="Quitar de la lista"
                                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-error-50 hover:text-error-600 cursor-pointer dark:hover:bg-error-500/10"
                              >
                                <TrashIcon className="size-4" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Guide + Rules + Template + Demo */}
            <aside className="flex flex-col gap-4">
              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
                <h3 className="text-theme-xs font-bold uppercase tracking-wider text-ink-title dark:text-white">
                  ¿Cómo funciona?
                </h3>
                <ol className="mt-3 space-y-2.5">
                  {GUIDE_STEPS.map((item) => (
                    <li key={item.step} className="rounded-xl bg-white p-3 shadow-2xs dark:bg-gray-900">
                      <p className="text-theme-xs font-bold text-ink-body dark:text-white">
                        {item.step}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                        {item.detail}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="text-theme-xs font-bold text-ink-title dark:text-white">
                  Reglas de formato
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-gray-600 dark:text-gray-300">
                  <li>
                    Columnas CSV sugeridas:{" "}
                    <span className="font-mono text-[11px]">
                      Nombre, Precio, Categoria, Descripcion, Disponible
                    </span>
                    .
                  </li>
                  <li>
                    Precios en pesos colombianos sin decimales (ej.{" "}
                    <span className="font-mono">28000</span> o{" "}
                    <span className="font-mono">$28.000</span>).
                  </li>
                  <li>
                    Si un producto no tiene imagen, asignamos una portada visual automática según su
                    categoría.
                  </li>
                </ul>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-theme-xs font-bold text-ink-title transition-colors hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                  >
                    <ArrowDownTrayIcon className="size-4" aria-hidden="true" />
                    Descargar plantilla CSV
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadDemoClick}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 text-theme-xs font-bold text-brand-600 transition-colors hover:bg-brand-100 cursor-pointer dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
                  >
                    <SparklesIcon className="size-4" aria-hidden="true" />
                    Cargar catálogo de ejemplo (6 productos)
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
            {selectedRows.length > 0
              ? `${selectedRows.length} ${
                  selectedRows.length === 1 ? "producto listo" : "productos listos"
                } para agregar a tu catálogo.`
              : "Analiza un archivo o texto para previsualizar tus productos."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedRows.length === 0}
              onClick={handleConfirmImport}
            >
              {selectedRows.length === 1
                ? "Importar 1 producto"
                : `Importar ${selectedRows.length} productos`}
            </Button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

export default CatalogImportModal;
