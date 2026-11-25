import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    CloudArrowUpIcon,
    FolderIcon,
    MagnifyingGlassIcon,
    PhotoIcon,
    PlusIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

interface MediaLibrary {
  folders: string[];

  files: Record<string, string[]>;
}

const readDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image read failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

export interface FilePickerProps {
  open: boolean;

  singleSelect?: boolean;
  onClose: () => void;
  onSelect: (images: string[]) => void;
}

export const FilePicker: React.FC<FilePickerProps> = ({
  open,
  singleSelect = false,
  onClose,
  onSelect,
}) => {
  const [library] = useState<MediaLibrary>(() => ({ folders: [], files: Object.create(null) }));
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const [activeFolder, setActiveFolder] = useState<string | null>(
    library.folders[0] ?? null,
  );
  const [search, setSearch] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [fileError, setFileError] = useState("");
  const [selection, setSelection] = useState<string[]>([]);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setActiveFolder(library.folders[0] ?? null);
      setSelection([]);
      setFileError("");
      setSearch('');
      setCreatingFolder(false);
      setFolderName('');
    }
  }, [open]);

  useEffect(() => {
    if (creatingFolder) folderInputRef.current?.focus();
  }, [creatingFolder]);

  const visibleFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.folders.filter((c) => !q || c.toLowerCase().includes(q));
  }, [search, library.folders.length, open]);

  const folderImages = activeFolder ? library.files[activeFolder] ?? [] : [];

  const createFolder = () => {
    const name = folderName.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    if (!library.folders.includes(name)) {
      library.folders.push(name);
      library.files[name] = [];
    }
    setActiveFolder(name);
    setFolderName('');
    setCreatingFolder(false);
    refresh();
  };

  const loadImages = async (files: File[]) => {
    if (!activeFolder) return;
    setFileError("");
    if (files.some(file => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
      setFileError("Elige imágenes de hasta 10 MB cada una.");
      return;
    }
    let urls: string[];
    try {
      urls = await Promise.all(files.map(readDataUrl));
    } catch {
      setFileError("No se pudo leer la imagen. Vuelve a seleccionarla.");
      return;
    }
    library.files[activeFolder] = [
      ...(library.files[activeFolder] ?? []),
      ...urls,
    ];
    refresh();
  };

  const toggleSelection = (url: string) => {
    setSelection((prev) => {
      if (singleSelect) return prev[0] === url ? [] : [url];
      return prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url];
    });
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[600px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">

        {fileError && <p className="p-3 text-sm text-red-600" role="alert">{fileError}</p>}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-[#212121] dark:bg-gray-800 dark:text-white">
              <PhotoIcon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <h2 className="text-[16px] font-bold text-[#212121] dark:text-white">
              Administrador de archivos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-5 sm:grid-cols-[260px_1fr]">

          <div className="flex min-h-0 flex-col">
            <button
              type="button"
              onClick={() => {
                setCreatingFolder(true);
                setFolderName('');
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#212121] text-[13px] font-bold text-white transition-colors hover:bg-black dark:bg-white dark:text-[#212121] dark:hover:bg-gray-200"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Nueva Carpeta
            </button>

            {creatingFolder && (
              <input
                ref={folderInputRef}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createFolder();
                  if (e.key === 'Escape') setCreatingFolder(false);
                }}
                onBlur={createFolder}
                placeholder="Nombre de la carpeta"
                aria-label="Nombre de la carpeta"
                className="mt-2 h-9 w-full rounded-lg border border-[#FF3F1A] px-3 text-[13px] outline-none focus:ring-1 focus:ring-[#FF3F1A]/30 dark:bg-gray-900 dark:text-white"
              />
            )}

            <div className="relative mt-2">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                aria-label="Buscar carpeta"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-gray-400 focus:border-[#FF3F1A] dark:border-gray-800 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between border-b border-gray-200 bg-[#ECECEC]/60 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-white/[0.04] dark:text-gray-400">
                <span>Nombre</span>
                <span>({visibleFolders.length})</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {visibleFolders.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[12px] font-normal text-gray-400">
                    No hay carpetas todavía. Crea una con «Nueva Carpeta».
                  </p>
                ) : (
                  visibleFolders.map((folder) => {
                    const enabled = folder === activeFolder;
                    return (
                      <button
                        key={folder}
                        type="button"
                        onClick={() => {
                          setActiveFolder(folder);
                          setSelection([]);
                        }}
                        className={
                          enabled
                            ? 'flex w-full items-center gap-2 border-l-2 border-[#FF3F1A] bg-[#FF3F1A]/5 px-3 py-2 text-left text-[13px] font-bold text-[#212121] dark:text-white'
                            : 'flex w-full items-center gap-2 border-l-2 border-transparent px-3 py-2 text-left text-[13px] font-normal text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5'
                        }
                      >
                        <FolderIcon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                        <span className="truncate">{folder}</span>
                        <span className="ml-auto text-[11px] text-gray-400">
                          {(library.files[folder] ?? []).length}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3.5 sm:flex-row sm:items-center dark:border-gray-700">
              <div className="flex items-center gap-3">
                <CloudArrowUpIcon className="h-6 w-6 shrink-0 text-gray-400" aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-bold text-[#212121] dark:text-white">
                    Selecciona las imágenes para subir a tu catálogo
                  </p>
                  <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-gray-400">
                    El archivo seleccionado debe tener como máximo 10 MB de tamaño.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={!singleSelect}
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length) void loadImages(files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!activeFolder}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#212121] px-3.5 text-[12px] font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#212121] dark:hover:bg-gray-200"
              >
                <PlusIcon className="h-4 w-4" aria-hidden="true" />
                Cargar Imagen
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              {!activeFolder ? (
                <p className="py-10 text-center text-[12px] text-gray-400">
                  Crea una carpeta para empezar a cargar imágenes.
                </p>
              ) : folderImages.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-gray-400">
                  Esta carpeta está vacía.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {folderImages.map((url, i) => {
                    const chosen = selection.includes(url);
                    return (
                      <button
                        key={`${i}-${url.slice(-10)}`}
                        type="button"
                        onClick={() => toggleSelection(url)}
                        aria-pressed={chosen}
                        className={
                          chosen
                            ? 'relative aspect-square overflow-hidden rounded-lg ring-2 ring-[#FF3F1A] ring-offset-1'
                            : 'relative aspect-square overflow-hidden rounded-lg ring-1 ring-gray-200 transition-shadow hover:ring-gray-300 dark:ring-gray-700'
                        }
                      >
                        <img src={url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg bg-gray-100 px-4 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSelect(selection)}
            disabled={selection.length === 0}
            className="h-9 rounded-lg bg-[#212121] px-4 text-[13px] font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#212121] dark:hover:bg-gray-200"
          >
            Seleccionar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FilePicker;
