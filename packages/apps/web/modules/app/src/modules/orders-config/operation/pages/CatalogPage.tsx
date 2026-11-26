import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { observer } from "mobx-react-lite";
import {
  ArrowUpTrayIcon,
  BoltIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CloudArrowUpIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  FireIcon,
  GiftIcon,
  HeartIcon,
  HomeIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Squares2X2Icon,
  TruckIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/elements/ui/button";
import { Card } from "@/elements/ui/card";
import {
  CloseLineIcon,
  DocsIcon,
  GridIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  TrashBinIcon,
} from "@/icons";
import { PageMeta } from "@/shell/meta";
import type { OrdersProfileId } from "../../types";
import { FilePicker } from "../components/FilePicker";
import { CatalogImportModal } from "../components/CatalogImportModal";
import {
  CATALOG_CATEGORY_META,
  assignSmartPhoto,
  type CatalogProduct,
  type Product,
} from "../domain/catalogDomain";
import { getProfilePreset } from "../domain/profilePresets";
import type { CatalogAlertBanner, CatalogStore } from "../stores/CatalogStore";

export type { CatalogProduct, Product };

export interface CatalogPageProps {
  store: CatalogStore;
  businessId?: string;
  businessName: string;
  businessLogo?: string;
  businessCover?: string;
  profile?: OrdersProfileId;
}

const CATEGORY_ICON_BY_KEY: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  heart: HeartIcon,
  home: HomeIcon,
  bolt: BoltIcon,
  "shopping-bag": ShoppingBagIcon,
  gift: GiftIcon,
  sparkles: SparklesIcon,
  fire: FireIcon,
  truck: TruckIcon,
  book: BookOpenIcon,
  wrench: WrenchScrewdriverIcon,
  squares: Squares2X2Icon,
};

function applySmartPhotoFallback(
  event: React.SyntheticEvent<HTMLImageElement>,
  name: string,
  category: string,
): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = assignSmartPhoto(name, category);
}

const ImageUpload: React.FC<{
  images: string[];
  productName: string;
  productCategory: string;
  onOpen: () => void;
  onRemove: (index: number) => void;
}> = ({ images, productName, productCategory, onOpen, onRemove }) => (
  <div className="rounded-xl border border-dashed border-gray-300 px-6 py-6 text-center dark:border-gray-700">
    {images.length > 0 ? (
      <div className="flex flex-wrap justify-center gap-2">
        {images.map((url, i) => (
          <div
            key={`${i}-${url.slice(-12)}`}
            className="group relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
          >
            <img
              src={url}
              alt={`Imagen ${i + 1}`}
              onError={(e) => applySmartPhotoFallback(e, productName || "Producto", productCategory || "Otros")}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Quitar imagen ${i + 1}`}
              className="absolute right-1 top-1 rounded-md bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
            >
              <CloseLineIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <>
        <CloudArrowUpIcon className="mx-auto h-6 w-6 text-gray-400" aria-hidden="true" />
        <p className="mt-1.5 text-[12px] font-normal text-gray-600 dark:text-gray-300">
          Selecciona la imagen para subir a tu catálogo
        </p>
        <p className="mt-0.5 text-[11px] font-normal text-gray-400">
          Selecciona uno o más archivos. Tamaño máximo: 10 MB.
        </p>
      </>
    )}

    <button
      type="button"
      onClick={onOpen}
      className="mt-3 rounded-md bg-[#212121] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-black cursor-pointer dark:bg-white dark:text-[#212121] dark:hover:bg-gray-200"
    >
      Seleccionar archivos
    </button>
  </div>
);

const CatalogSkeleton: React.FC = () => (
  <div
    aria-label="Cargando productos del catálogo"
    className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
  >
    {Array.from({ length: 8 }).map((_, index) => (
      <div
        key={index}
        className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="h-36 animate-pulse bg-gray-200 sm:h-40 dark:bg-gray-800" />
        <div className="space-y-2 p-3">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
          <div className="flex items-center justify-between pt-1.5">
            <div className="h-3 w-12 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
            <div className="size-4 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

interface ProductDraft {
  id?: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image?: string;
  gallery: string[];
  variantsInput: string;
  available: boolean;
}

export const CatalogPage = observer(({
  store,
  businessId,
  businessName,
  businessLogo,
  businessCover,
  profile,
}: CatalogPageProps) => {
  const [hydrating, setHydrating] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todas");

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [localBanner, setLocalBanner] = useState<CatalogAlertBanner | null>(null);

  const [editedProduct, setEditedProduct] = useState<ProductDraft | null>(null);
  const [imageTarget, setImageTarget] = useState<"primary" | "additional" | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);

  const activeProfile = profile ?? store.profile;
  const profilePreset = useMemo(() => getProfilePreset(activeProfile), [activeProfile]);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrating(false), 180);
    return () => window.clearTimeout(timer);
  }, []);

  const catalogItems = store.products;
  const activeBanner = store.alertBanner ?? localBanner;

  const dismissBanner = () => {
    store.dismissBanner();
    setLocalBanner(null);
  };

  const toggleAvailability = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    store.toggleAvailable(id);
  };

  const deleteProduct = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    store.deleteProduct(id);
    if (editedProduct?.id === id) {
      setEditedProduct(null);
    }
  };

  const openNewProduct = () => {
    setAddMenuOpen(false);
    setEditedProduct({
      name: "",
      category: activeCategory !== "Todas" ? activeCategory : "Otros",
      description: "",
      price: 0,
      gallery: [],
      variantsInput: "",
      available: true,
    });
    setIsNewProduct(true);
  };

  const openImportModal = () => {
    setAddMenuOpen(false);
    setImportModalOpen(true);
  };

  const editProduct = (product: CatalogProduct) => {
    setEditedProduct({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      price: product.price,
      image: product.image,
      gallery: [...(product.gallery ?? [])],
      variantsInput: (product.variants ?? []).join(", "),
      available: product.available,
    });
    setIsNewProduct(false);
  };

  const addImages = (urls: string[], additional: boolean) => {
    if (urls.length === 0) return;
    setEditedProduct((prev) => {
      if (!prev) return prev;
      if (!additional) return { ...prev, image: urls[0] };
      return {
        ...prev,
        gallery: [...prev.gallery, ...urls].slice(0, 6),
      };
    });
  };

  const saveProduct = () => {
    if (!editedProduct || !editedProduct.name.trim()) return;
    const parsedVariants = editedProduct.variantsInput
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (isNewProduct || !editedProduct.id) {
      store.addProduct({
        name: editedProduct.name,
        category: editedProduct.category || "Otros",
        description: editedProduct.description,
        price: editedProduct.price,
        image: editedProduct.image,
        gallery: editedProduct.gallery.length > 0 ? editedProduct.gallery : undefined,
        variants: parsedVariants.length > 0 ? parsedVariants : undefined,
        available: editedProduct.available,
      });
    } else {
      store.updateProduct(editedProduct.id, {
        name: editedProduct.name,
        category: editedProduct.category || "Otros",
        description: editedProduct.description,
        price: editedProduct.price,
        image: editedProduct.image ?? "",
        gallery: editedProduct.gallery,
        variants: parsedVariants,
        available: editedProduct.available,
      });
    }

    setEditedProduct(null);
  };

  const handleBulkImportItems = (
    items: Array<Omit<CatalogProduct, "id" | "createdAt">>,
  ) => {
    if (items.length === 0) return;
    for (let idx = items.length - 1; idx >= 0; idx -= 1) {
      store.addProduct(items[idx]);
    }
    store.dismissBanner();
    setLocalBanner({
      tone: "success",
      message: `Se importaron ${items.length} ${
        items.length === 1 ? "producto" : "productos"
      } al catálogo. Recuerda pulsar «Guardar y Publicar» para reflejar los cambios.`,
    });
  };

  const handleLoadDemo = () => {
    setLocalBanner(null);
    store.loadDemoProducts();
  };

  const handleSaveAndPublish = () => {
    setLocalBanner(null);
    void store.saveAndPublish();
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalogItems.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return ["Todas", ...Array.from(set)];
  }, [catalogItems]);

  useEffect(() => {
    if (activeCategory !== "Todas" && !categories.includes(activeCategory)) {
      setActiveCategory("Todas");
    }
  }, [activeCategory, categories]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalogItems.filter((p) => {
      const matchesCategory = activeCategory === "Todas" || p.category === activeCategory;
      const matchesSearch =
        query === "" ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [catalogItems, activeCategory, search]);

  const formatPrice = (num: number) => `$ ${num.toLocaleString("es-CO")}`;

  const publicCatalogHref = useMemo(() => {
    const params = new URLSearchParams({
      negocio: businessName,
      perfil: activeProfile,
    });
    if (businessLogo?.trim()) params.set("logo", businessLogo.trim());
    if (businessCover?.trim()) params.set("portada", businessCover.trim());
    const base = businessId
      ? `/catalogo-clientes/${encodeURIComponent(businessId)}`
      : "/catalogo-clientes";
    return `${base}?${params.toString()}`;
  }, [businessId, businessName, businessLogo, businessCover, activeProfile]);

  return (
    <>
      <PageMeta
        title="Catálogo"
        description="Productos y precios que ven tus clientes"
      />
      <div className="min-h-screen w-full space-y-4 bg-gray-50/50 px-4 py-5 font-sans sm:px-6 lg:px-8 dark:bg-gray-950">
        <div className="space-y-3.5 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#97D6DF]/20 text-[#190088] dark:bg-[#97D6DF]/15 dark:text-[#97D6DF]">
                <DocsIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-[#190088] sm:text-xl dark:text-white">
                    Catálogo
                  </h1>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    · {catalogItems.length}{" "}
                    {catalogItems.length === 1 ? "producto" : "productos"}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[#97D6DF]/60 bg-[#97D6DF]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#190088] dark:border-[#97D6DF]/30 dark:bg-[#97D6DF]/10 dark:text-[#97D6DF]">
                    Perfil: {profilePreset.name}
                  </span>
                </div>
                <p className="hidden text-xs text-gray-500 sm:block dark:text-gray-400">
                  Administra los productos, los precios y la disponibilidad de tu catálogo.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={publicCatalogHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <EyeIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                <span>Ver catálogo</span>
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAddMenuOpen((prev) => !prev)}
                  aria-expanded={addMenuOpen}
                  aria-haspopup="menu"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-gray-800 cursor-pointer dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <PlusIcon className="size-4" aria-hidden="true" />
                  <span>Agregar productos</span>
                  <ChevronDownIcon className="size-3.5 opacity-80" aria-hidden="true" />
                </button>

                {addMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setAddMenuOpen(false)}
                    />
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg animate-entrada-menu dark:border-gray-800 dark:bg-gray-900"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={openNewProduct}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-bold text-ink-body transition-colors hover:bg-gray-50 cursor-pointer dark:text-gray-100 dark:hover:bg-gray-800"
                      >
                        <PlusIcon className="size-4 text-brand-500" aria-hidden="true" />
                        <div>
                          <p>Nuevo producto</p>
                          <p className="text-[10.5px] font-normal text-gray-400">
                            Crea un artículo paso a paso
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={openImportModal}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-bold text-ink-body transition-colors hover:bg-gray-50 cursor-pointer dark:text-gray-100 dark:hover:bg-gray-800"
                      >
                        <ArrowUpTrayIcon
                          className="size-4 text-[#190088] dark:text-[#97D6DF]"
                          aria-hidden="true"
                        />
                        <div>
                          <p>Importar productos</p>
                          <p className="text-[10.5px] font-normal text-gray-400">
                            CSV, texto masivo o plantilla
                          </p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                disabled={store.saving}
                onClick={handleSaveAndPublish}
                className={`relative inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition-all cursor-pointer disabled:cursor-wait disabled:opacity-80 ${
                  store.publishedSuccess && !store.hasPendingChanges
                    ? "border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                    : store.hasPendingChanges
                      ? "border border-[#190088] bg-[#190088] text-white shadow-sm hover:bg-[#14006e]"
                      : "border border-gray-200 bg-white text-gray-700 shadow-2xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {store.hasPendingChanges && !store.saving && (
                  <span className="relative flex size-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-white" />
                  </span>
                )}
                {store.saving ? (
                  <>
                    <svg
                      className="size-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Guardando…
                  </>
                ) : store.publishedSuccess && !store.hasPendingChanges ? (
                  <>
                    <CheckCircleIcon className="size-4" aria-hidden="true" />
                    ¡Guardado y Publicado!
                  </>
                ) : (
                  "Guardar y Publicar"
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-gray-100 pt-2 md:flex-row md:items-center dark:border-gray-800">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="relative w-full max-w-xs shrink-0">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por producto, categoría..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-1.5 pl-3.5 pr-8 text-xs text-gray-900 focus:border-[#190088] focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:focus:border-[#97D6DF]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <CloseLineIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {categories.length > 1 && (
                <div className="scrollbar-none flex flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                        activeCategory === cat
                          ? "bg-[#190088] text-white shadow-2xs dark:bg-white dark:text-gray-900"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="inline-flex h-9 shrink-0 items-center self-end rounded-2xl border border-black/[0.04] bg-[#EEEEEE] p-1 sm:h-10 md:self-auto dark:border-white/[0.06] dark:bg-white/[0.08]">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Vista en cuadrícula"
                className={`flex h-full items-center gap-1.5 rounded-xl px-3 text-xs transition-all duration-200 cursor-pointer sm:px-3.5 ${
                  viewMode === "grid"
                    ? "bg-white font-bold text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-[#1C1C1F] dark:text-white"
                    : "font-medium text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <GridIcon className="size-3.5 sm:size-4" />
                <span>Cuadrícula</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="Vista en tabla / lista"
                className={`flex h-full items-center gap-1.5 rounded-xl px-3 text-xs transition-all duration-200 cursor-pointer sm:px-3.5 ${
                  viewMode === "list"
                    ? "bg-white font-bold text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-[#1C1C1F] dark:text-white"
                    : "font-medium text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <ListIcon className="size-3.5 sm:size-4" />
                <span>Lista</span>
              </button>
            </div>
          </div>
        </div>

        {activeBanner && (
          <div
            role="status"
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-medium shadow-2xs ${
              activeBanner.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {activeBanner.tone === "success" ? (
                <CheckCircleIcon className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <ExclamationTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span>{activeBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Cerrar notificación"
              className="rounded-lg p-1 opacity-75 transition-opacity hover:opacity-100 cursor-pointer"
            >
              <XMarkIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {hydrating ? (
          <CatalogSkeleton />
        ) : filteredProducts.length === 0 ? (
          <Card className="py-12 text-center">
            <DocsIcon className="mx-auto mb-3 size-8 text-gray-400" />
            <h2 className="text-base font-bold text-ink-title dark:text-white">
              No hay productos para mostrar
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-gray-500 dark:text-gray-400">
              {catalogItems.length > 0
                ? "Prueba con otra categoría o término de búsqueda."
                : "Crea tu primer producto manualmente, importa tu listado desde archivo o carga un catálogo de ejemplo."}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              {catalogItems.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("Todas");
                  }}
                >
                  Limpiar filtros
                </Button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={openNewProduct}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-gray-800 cursor-pointer dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                  >
                    <PlusIcon className="size-4" aria-hidden="true" />
                    Crear producto
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    startIcon={<ArrowUpTrayIcon className="size-4" aria-hidden="true" />}
                    onClick={openImportModal}
                  >
                    Importar archivo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    startIcon={<SparklesIcon className="size-4" aria-hidden="true" />}
                    onClick={handleLoadDemo}
                  >
                    Cargar ejemplo
                  </Button>
                </>
              )}
            </div>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {filteredProducts.map((item, i) => (
              <div
                key={item.id}
                data-flip={item.id}
                onClick={() => editProduct(item)}
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                className={`animate-entrada-lista group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 ${
                  item.available
                    ? "border-gray-200/80 dark:border-gray-800"
                    : "border-gray-200/60 opacity-60 dark:border-gray-800/60"
                }`}
              >
                <div className="relative h-36 w-full overflow-hidden bg-gray-900 sm:h-40 dark:bg-gray-800">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      onError={(e) => applySmartPhotoFallback(e, item.name, item.category)}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <img
                      src={assignSmartPhoto(item.name, item.category)}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

                  <span className="absolute left-2 top-2 max-w-[55%] truncate rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-gray-800 shadow-2xs backdrop-blur-xs dark:bg-gray-900/95 dark:text-gray-200">
                    {item.category}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => toggleAvailability(item.id, e)}
                    title={item.available ? "Pausar producto" : "Habilitar producto"}
                    className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold shadow-2xs transition-all cursor-pointer ${
                      item.available
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    {item.available ? "Disponible" : "Agotado"}
                  </button>

                  <div className="absolute bottom-2 left-2">
                    <span className="text-sm font-bold tabular-nums text-white drop-shadow-md sm:text-base">
                      {formatPrice(item.price)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between space-y-1.5 p-3">
                  <div>
                    <h4 className="line-clamp-1 text-xs font-bold text-[#190088] transition-colors group-hover:text-[#FF3F1A] sm:text-[13px] dark:text-white">
                      {item.name}
                    </h4>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {item.description || "Sin descripción"}
                    </p>
                    {item.variants && item.variants.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {item.variants.map((variant) => (
                          <span
                            key={variant}
                            className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {variant}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 dark:border-gray-800/80">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 transition-colors hover:text-[#190088] dark:text-gray-400 dark:hover:text-white">
                      <PencilIcon className="h-3 w-3" />
                      Editar
                    </span>

                    <button
                      type="button"
                      onClick={(e) => deleteProduct(item.id, e)}
                      title="Eliminar producto"
                      aria-label={`Eliminar ${item.name}`}
                      className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer dark:hover:bg-red-500/10"
                    >
                      <TrashBinIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs dark:border-gray-800 dark:bg-gray-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Precio ($COP)</th>
                    <th className="px-4 py-3 text-center">Disponibilidad</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {filteredProducts.map((item, i) => (
                    <tr
                      key={item.id}
                      data-flip={item.id}
                      onClick={() => editProduct(item)}
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                      className="animate-entrada-lista group cursor-pointer transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-gray-200/60 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                onError={(e) => applySmartPhotoFallback(e, item.name, item.category)}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <img
                                src={assignSmartPhoto(item.name, item.category)}
                                alt={item.name}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-bold text-[#190088] dark:text-white">
                              {item.name}
                            </h4>
                            <p className="max-w-xs truncate text-xs text-gray-500 md:max-w-md dark:text-gray-400">
                              {item.description || "Sin descripción"}
                            </p>
                            {item.variants && item.variants.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {item.variants.map((variant) => (
                                  <span
                                    key={variant}
                                    className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  >
                                    {variant}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-block rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {item.category}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                          {formatPrice(item.price)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => toggleAvailability(item.id, e)}
                          className={`rounded-full px-3 py-1 text-xs font-bold shadow-2xs transition-all cursor-pointer ${
                            item.available
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {item.available ? "Disponible" : "Agotado"}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => editProduct(item)}
                            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#190088] cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
                            title="Editar producto"
                            aria-label={`Editar ${item.name}`}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => deleteProduct(item.id, e)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer dark:hover:bg-red-500/10"
                            title="Eliminar producto"
                            aria-label={`Eliminar ${item.name}`}
                          >
                            <TrashBinIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editedProduct &&
          createPortal(
            <div className="fixed inset-0 z-[60] overflow-y-auto bg-white font-sans dark:bg-gray-950">
              <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-6 sm:px-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-bold text-[#212121] dark:text-white">
                      {isNewProduct ? "Nuevo producto" : "Editar producto"}
                    </h2>
                    <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                      Completa los datos del producto. Aparecerá en tu catálogo apenas lo guardes.
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditedProduct(null)}
                      className="h-9 rounded-lg px-3 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveProduct}
                      disabled={!editedProduct.name.trim()}
                      className="h-9 rounded-lg bg-[#212121] px-4 text-[13px] font-bold text-white transition-colors hover:bg-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#212121] dark:hover:bg-gray-200"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                <div className="mt-7">
                  <label
                    htmlFor="prod-nombre"
                    className="block text-[13px] font-bold text-[#212121] dark:text-white"
                  >
                    Nombre del producto
                  </label>
                  <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                    Con este nombre verás el producto en el catálogo. Es el nombre visible para tus
                    clientes.
                  </p>
                  <input
                    id="prod-nombre"
                    type="text"
                    value={editedProduct.name}
                    onChange={(e) =>
                      setEditedProduct({ ...editedProduct, name: e.target.value })
                    }
                    placeholder="Escribe aquí el nombre de tu producto"
                    className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-normal text-[#212121] outline-none transition-colors placeholder:text-gray-400 focus:border-[#FF3F1A] focus:ring-1 focus:ring-[#FF3F1A]/30 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="prod-descripcion"
                    className="block text-[13px] font-bold text-[#212121] dark:text-white"
                  >
                    Descripción
                  </label>
                  <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                    Escribe aquí la descripción de tu producto
                  </p>
                  <div className="relative mt-2">
                    <textarea
                      id="prod-descripcion"
                      rows={5}
                      maxLength={2000}
                      value={editedProduct.description}
                      onChange={(e) =>
                        setEditedProduct({ ...editedProduct, description: e.target.value })
                      }
                      placeholder="Describe el producto, sus materiales o sus especificaciones"
                      className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 pb-7 text-[13px] font-normal text-[#212121] outline-none transition-colors placeholder:text-gray-400 focus:border-[#FF3F1A] focus:ring-1 focus:ring-[#FF3F1A]/30 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                    />
                    <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-gray-400">
                      {editedProduct.description.length} / 2000
                    </span>
                  </div>
                </div>

                <div className="mt-5">
                  <span className="block text-[13px] font-bold text-[#212121] dark:text-white">
                    Categorías
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editedProduct.category &&
                      !CATALOG_CATEGORY_META.some(
                        (cat) => cat.label === editedProduct.category,
                      ) && (
                        <button
                          type="button"
                          aria-pressed={true}
                          onClick={() =>
                            setEditedProduct({
                              ...editedProduct,
                              category: "Otros",
                            })
                          }
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#FF3F1A] bg-[#FF3F1A]/10 px-3 text-[12px] font-bold text-[#FF3F1A] transition-colors cursor-pointer"
                        >
                          <Squares2X2Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {editedProduct.category}
                        </button>
                      )}
                    {CATALOG_CATEGORY_META.map((cat) => {
                      const Icon = CATEGORY_ICON_BY_KEY[cat.iconKey] ?? Squares2X2Icon;
                      const enabled = editedProduct.category === cat.label;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-pressed={enabled}
                          onClick={() =>
                            setEditedProduct({
                              ...editedProduct,
                              category: enabled ? "Otros" : cat.label,
                            })
                          }
                          className={
                            enabled
                              ? "inline-flex h-8 items-center gap-1.5 rounded-full border border-[#FF3F1A] bg-[#FF3F1A]/10 px-3 text-[12px] font-bold text-[#FF3F1A] transition-colors cursor-pointer"
                              : "inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-[12px] font-normal text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 cursor-pointer dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5"
                          }
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <span className="block text-[13px] font-bold text-[#212121] dark:text-white">
                      Imagen principal
                    </span>
                    <div className="mt-2">
                      <ImageUpload
                        images={editedProduct.image ? [editedProduct.image] : []}
                        productName={editedProduct.name}
                        productCategory={editedProduct.category}
                        onOpen={() => setImageTarget("primary")}
                        onRemove={() =>
                          setEditedProduct({ ...editedProduct, image: undefined })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[13px] font-bold text-[#212121] dark:text-white">
                      Imágenes adicionales
                    </span>
                    <div className="mt-2">
                      <ImageUpload
                        images={editedProduct.gallery}
                        productName={editedProduct.name}
                        productCategory={editedProduct.category}
                        onOpen={() => setImageTarget("additional")}
                        onRemove={(index) =>
                          setEditedProduct({
                            ...editedProduct,
                            gallery: editedProduct.gallery.filter((_, i) => i !== index),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="prod-precio"
                      className="block text-[13px] font-bold text-[#212121] dark:text-white"
                    >
                      Precio
                    </label>
                    <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                      Lo que paga el cliente, en pesos colombianos.
                    </p>
                    <div className="relative mt-2">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-normal text-gray-400">
                        $
                      </span>
                      <input
                        id="prod-precio"
                        type="number"
                        min={0}
                        value={editedProduct.price}
                        onChange={(e) =>
                          setEditedProduct({
                            ...editedProduct,
                            price: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-7 pr-3 text-[13px] font-bold tabular-nums text-[#212121] outline-none transition-colors focus:border-[#FF3F1A] focus:ring-1 focus:ring-[#FF3F1A]/30 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[13px] font-bold text-[#212121] dark:text-white">
                      Disponibilidad
                    </span>
                    <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                      Si se agota, apágalo para que tus clientes no lo pidan.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setEditedProduct({
                          ...editedProduct,
                          available: !editedProduct.available,
                        })
                      }
                      aria-pressed={editedProduct.available}
                      className={
                        editedProduct.available
                          ? "mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-[#97D6DF] bg-[#97D6DF]/20 px-3 text-[13px] font-bold text-[#190088] cursor-pointer dark:text-[#97D6DF]"
                          : "mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-[13px] font-bold text-gray-500 cursor-pointer dark:border-gray-800 dark:text-gray-400"
                      }
                    >
                      <span
                        className={
                          editedProduct.available
                            ? "h-1.5 w-1.5 rounded-full bg-[#190088] dark:bg-[#97D6DF]"
                            : "h-1.5 w-1.5 rounded-full bg-gray-400"
                        }
                        aria-hidden="true"
                      />
                      {editedProduct.available ? "Disponible" : "Agotado"}
                    </button>
                  </div>
                </div>

                {(profilePreset.storefront.supportsVariants ||
                  editedProduct.variantsInput.trim().length > 0) && (
                  <div className="mt-5">
                    <label
                      htmlFor="prod-variantes"
                      className="block text-[13px] font-bold text-[#212121] dark:text-white"
                    >
                      Tallas o variantes
                    </label>
                    <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                      Opcional. Separa cada opción por coma (ej. S, M, L, XL o 37, 38, 39, 40).
                    </p>
                    <input
                      id="prod-variantes"
                      type="text"
                      value={editedProduct.variantsInput}
                      onChange={(e) =>
                        setEditedProduct({
                          ...editedProduct,
                          variantsInput: e.target.value,
                        })
                      }
                      placeholder="S, M, L, XL"
                      className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-normal text-[#212121] outline-none transition-colors placeholder:text-gray-400 focus:border-[#FF3F1A] focus:ring-1 focus:ring-[#FF3F1A]/30 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>

      <FilePicker
        open={imageTarget !== null}
        singleSelect={imageTarget === "primary"}
        files={store.fileLibrary}
        folders={store.folders}
        onAddFile={(file) => {
          store.addFile(file);
        }}
        onAddFolder={(folder) => {
          store.addFolder(folder);
        }}
        onClose={() => setImageTarget(null)}
        onSelect={(images) => {
          addImages(images, imageTarget === "additional");
          setImageTarget(null);
        }}
      />

      <CatalogImportModal
        open={importModalOpen}
        onImport={handleBulkImportItems}
        onLoadDemo={handleLoadDemo}
        onCreateSingle={openNewProduct}
        onClose={() => setImportModalOpen(false)}
      />
    </>
  );
});

export default CatalogPage;
