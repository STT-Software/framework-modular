import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { observer } from "mobx-react-lite";
import {
  ArrowRightIcon,
  BuildingStorefrontIcon,
  CheckIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  TicketIcon,
  TrashIcon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { PageMeta } from "@/shell/meta";
import type { OrdersProfileId } from "../../types";
import { assignSmartPhoto, type CatalogProduct } from "../domain/catalogDomain";
import { generateQrSvgDataUrl } from "../domain/orderBilling";
import {
  createCatalogProductsForProfile,
  getProfilePreset,
  isValidOrdersProfileId,
  readActiveBusinessProfile,
} from "../domain/profilePresets";
import { CatalogStore } from "../stores/CatalogStore";
import { OrdersStore } from "../stores/OrdersStore";
import { ConversationsStore } from "../stores/ConversationsStore";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  subtext?: string;
  price: number;
  image: string;
  variants?: string[];
  badge?: string;
  availableCount: number;
  soldCount: number;
}

const VARIANT_KEY_SEPARATOR = "::";

function makeCartKey(productId: string, variant?: string): string {
  return variant ? `${productId}${VARIANT_KEY_SEPARATOR}${variant}` : productId;
}

function parseCartKey(key: string): { productId: string; variant?: string } {
  const idx = key.indexOf(VARIANT_KEY_SEPARATOR);
  if (idx === -1) return { productId: key };
  return {
    productId: key.slice(0, idx),
    variant: key.slice(idx + VARIANT_KEY_SEPARATOR.length) || undefined,
  };
}

function mapCatalogProductToMenuItem(
  item: CatalogProduct,
  index: number,
): MenuItem {
  return {
    id: item.id || `prod-${index}`,
    name: item.name || "Producto",
    category: item.category || "General",
    description: item.description || "",
    subtext: item.description ? item.description.slice(0, 36) : undefined,
    price: Number(item.price) || 0,
    image: item.image || assignSmartPhoto(item.name, item.category),
    variants: item.variants && item.variants.length > 0 ? [...item.variants] : undefined,
    availableCount: 12 + ((index * 3) % 14),
    soldCount: 4 + ((index * 5) % 15),
  };
}

function formatCOP(value: number): string {
  return `$ ${Math.round(value).toLocaleString("es-CO")}`;
}

export const PublicCatalogPage: React.FC = observer(() => {
  const { businessId } = useParams<{ businessId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const resolvedBusinessId = businessId || searchParams.get("org") || "";
  const paramProfile = searchParams.get("perfil");
  const urlProfile = isValidOrdersProfileId(paramProfile) ? paramProfile : undefined;

  const [activeProfile, setActiveProfile] = useState<OrdersProfileId>(() => {
    if (urlProfile) return urlProfile;
    if (resolvedBusinessId) return readActiveBusinessProfile(resolvedBusinessId);
    return "general";
  });

  const [catalogStore] = useState(() =>
    resolvedBusinessId ? new CatalogStore(resolvedBusinessId, activeProfile) : null,
  );
  const [storageSyncVersion, setStorageSyncVersion] = useState(0);

  useEffect(() => {
    if (!urlProfile || urlProfile === activeProfile) return;
    setActiveProfile(urlProfile);
    catalogStore?.reload(urlProfile);
  }, [urlProfile, activeProfile, catalogStore]);

  useEffect(() => {
    if (typeof window === "undefined" || !resolvedBusinessId) return;
    const profileKey = `necto.pedidos.profile.${resolvedBusinessId}`;
    const catalogKey = `necto.pedidos.catalog.${resolvedBusinessId}`;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== profileKey && event.key !== catalogKey && event.key !== null) {
        return;
      }
      const nextProfile = readActiveBusinessProfile(resolvedBusinessId);
      setActiveProfile((prev) => {
        if (prev !== nextProfile) {
          setCart({});
          setSelectedVariants({});
        }
        return nextProfile;
      });
      catalogStore?.reload(nextProfile);
      setStorageSyncVersion((v) => v + 1);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [resolvedBusinessId, catalogStore]);

  const effectiveProfile = catalogStore?.profile ?? activeProfile;
  const preset = useMemo(() => getProfilePreset(effectiveProfile), [effectiveProfile]);

  const businessName =
    searchParams.get("negocio") ||
    searchParams.get("nombre") ||
    "Menú & Catálogo";
  const businessTagline =
    searchParams.get("eslogan") || preset.storefront.tagline;
  const coverUrl = searchParams.get("portada") || "";
  const logoUrl = searchParams.get("logo") || "";
  const customerName = searchParams.get("cliente") || "Cliente Necto";
  const customerPhone = searchParams.get("telefono") || "+57 300 000 0000";
  const branchName = searchParams.get("sede") || "Sede Principal";
  const address = searchParams.get("direccion") || "Medellín, Colombia";
  const chatId = searchParams.get("chatId") || "";
  const paramModality = searchParams.get("modalidad");

  const products: MenuItem[] = useMemo(() => {
    void storageSyncVersion;
    const storeProducts = catalogStore?.products ?? [];
    const available = storeProducts.filter((item) => item.available !== false);
    if (available.length > 0) {
      return available.map(mapCatalogProductToMenuItem);
    }
    return createCatalogProductsForProfile(effectiveProfile)
      .filter((item) => item.available !== false)
      .map(mapCatalogProductToMenuItem);
  }, [catalogStore?.products, effectiveProfile, storageSyncVersion]);

  const [modality, setModality] = useState<"domicilio" | "retiro">(
    paramModality === "retiro" ? "retiro" : "domicilio",
  );
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [search, setSearch] = useState<string>("");
  const [sortPriceAsc, setSortPriceAsc] = useState<boolean | null>(null);
  const [filterMenuOpen, setFilterMenuOpen] = useState<boolean>(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Record<string, number>>({});
  const [promoActive, setPromoActive] = useState<boolean>(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [savingOrder, setSavingOrder] = useState<boolean>(false);
  const [botNotified, setBotNotified] = useState<boolean>(false);
  const [createdOrderRef, setCreatedOrderRef] = useState<string>("");
  const [syncedCartSignature, setSyncedCartSignature] = useState<string>("");

  const cartSignature = useMemo(
    () => JSON.stringify({ cart, modality, promoActive }),
    [cart, modality, promoActive],
  );

  useEffect(() => {
    if (syncedCartSignature && cartSignature !== syncedCartSignature) {
      setCreatedOrderRef("");
      setSyncedCartSignature("");
      setBotNotified(false);
    }
  }, [cartSignature, syncedCartSignature]);

  useEffect(() => {
    if (!filterMenuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node)
      ) {
        setFilterMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterMenuOpen]);

  const addItem = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeItem = (id: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if ((next[id] || 0) <= 1) {
        delete next[id];
      } else {
        next[id] -= 1;
      }
      return next;
    });
  };

  const deleteItemCompletely = (id: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const product of products) {
      const cat = (product.category || "").trim();
      if (cat && !seen.includes(cat)) seen.push(cat);
    }
    return ["Todos", ...seen];
  }, [products]);

  useEffect(() => {
    if (activeCategory !== "Todos" && !categories.includes(activeCategory)) {
      setActiveCategory("Todos");
    }
  }, [activeCategory, categories]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = products.filter((prod) => {
      const matchCat =
        activeCategory === "Todos" ||
        prod.category.toLowerCase() === activeCategory.toLowerCase();
      const matchSearch =
        query === "" ||
        prod.name.toLowerCase().includes(query) ||
        prod.description.toLowerCase().includes(query) ||
        prod.category.toLowerCase().includes(query) ||
        (prod.variants?.some((v) => v.toLowerCase().includes(query)) ?? false);
      return matchCat && matchSearch;
    });
    if (sortPriceAsc === true) {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortPriceAsc === false) {
      return [...list].sort((a, b) => b.price - a.price);
    }
    return list;
  }, [products, activeCategory, search, sortPriceAsc]);

  const totalUnits = Object.values(cart).reduce((acc, qty) => acc + qty, 0);
  const subtotal = Object.entries(cart).reduce((acc, [cartKey, qty]) => {
    const { productId } = parseCartKey(cartKey);
    const prod = products.find((p) => p.id === productId);
    return acc + (prod ? prod.price * qty : 0);
  }, 0);

  const discount = promoActive && totalUnits > 0 ? Math.round(subtotal * 0.1) : 0;
  const shippingFee = totalUnits > 0 && modality === "domicilio" ? 5000 : 0;
  const total = Math.max(0, subtotal - discount + shippingFee);

  const fallbackOrderRef = useMemo(
    () => `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
    [],
  );
  const orderRef = createdOrderRef || fallbackOrderRef;

  const checkoutUrl = useMemo(() => {
    const params = new URLSearchParams({
      ref: orderRef,
      total: String(total),
      cliente: customerName,
      chatId,
      modalidad: modality,
      ...(resolvedBusinessId ? { org: resolvedBusinessId } : {}),
      negocio: businessName,
    });
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://necto.app";
    return `${origin}/checkout?${params.toString()}`;
  }, [orderRef, total, customerName, chatId, modality, resolvedBusinessId, businessName]);

  const qrDataUrl = useMemo(
    () => (paymentModalOpen ? generateQrSvgDataUrl(checkoutUrl) : ""),
    [paymentModalOpen, checkoutUrl],
  );

  const syncSelectionToBusiness = () => {
    if (totalUnits === 0) return;
    setSavingOrder(true);
    try {
      const items = Object.entries(cart).map(([cartKey, qty]) => {
        const { productId, variant } = parseCartKey(cartKey);
        const prod = products.find((p) => p.id === productId);
        return {
          id: `item-${cartKey}`,
          productId,
          name: prod?.name || "Producto",
          ...(variant ? { variant } : {}),
          quantity: qty,
          unitPrice: prod?.price || 0,
          image: prod?.image,
        };
      });

      if (resolvedBusinessId) {
        const ordersStore = new OrdersStore(resolvedBusinessId, effectiveProfile);
        const created = ordersStore.createOrder(
          {
            customerName,
            customerPhone,
            modality: modality === "domicilio" ? "delivery" : "pickup",
            items,
            extraCharges:
              discount > 0
                ? [{ id: "promo-10", label: "Descuento Especial (10%)", amount: -discount }]
                : [],
            shippingFee,
            paymentMethod: "card",
            paid: false,
            channel: "whatsapp",
            address:
              modality === "domicilio"
                ? { street: address, city: "Medellín", department: "Antioquia" }
                : undefined,
            notes: `Pedido iniciado desde Catálogo Público (${businessName}).`,
          },
          "Catálogo público",
        );
        setCreatedOrderRef(created.code);

        const conversationsStore = new ConversationsStore(
          resolvedBusinessId,
          ordersStore.orders,
        );
        const summaryLines = items
          .map(
            (item) =>
              `• ${item.quantity} × *${item.name}*${item.variant ? ` (${item.variant})` : ""} — ${formatCOP(item.unitPrice * item.quantity)}`,
          )
          .join("\n");
        const message =
          `*Resumen de tu pedido ${created.code}*\n${summaryLines}\nTotal a pagar: *${formatCOP(total)} COP* (${modality === "domicilio" ? `${preset.storefront.deliveryLabel}: ${address}` : `${preset.storefront.pickupLabel}: ${branchName}`}).`;
        conversationsStore.sendOrderReceiptToChat(
          chatId || customerPhone,
          created,
          message,
          "catalog-bot",
          "Catálogo público",
        );
      } else {
        setCreatedOrderRef(fallbackOrderRef);
      }

      setSyncedCartSignature(cartSignature);
      setBotNotified(true);
    } finally {
      setSavingOrder(false);
    }
  };

  const handleProceedToPayment = () => {
    if (totalUnits === 0) return;
    setPaymentModalOpen(true);
    if (createdOrderRef && syncedCartSignature === cartSignature) {
      return;
    }
    syncSelectionToBusiness();
  };

  const goToOnlineCheckout = () => {
    const params = new URLSearchParams({
      ref: orderRef,
      total: String(total),
      cliente: customerName,
      chatId,
      modalidad: modality,
      ...(resolvedBusinessId ? { org: resolvedBusinessId } : {}),
      negocio: businessName,
    });
    navigate(`/checkout?${params.toString()}`);
  };

  return (
    <>
      <PageMeta
        title={`Necto · ${businessName}`}
        description="Selecciona tus platos y productos favoritos"
      />

      <div
        style={{ fontFamily: "'DM Sans', sans-serif" }}
        className="min-h-screen bg-[#ECECEC]/30 text-[#212121] p-4 sm:p-6 lg:p-8 antialiased selection:bg-[#190088] selection:text-white"
      >
        <div className="max-w-[1500px] mx-auto space-y-6">
          {/* ── BANNER Y FOTO DE MARCA DEL NEGOCIO (DISEÑO NECTO / KASIRIN) ── */}
          <div className="relative overflow-hidden rounded-3xl border border-[#ECECEC] bg-white shadow-sm">
            {/* Banner superior de portada */}
            <div className="h-44 sm:h-52 w-full relative overflow-hidden bg-gradient-to-r from-[#190088] via-[#212121] to-[#190088]">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Portada del negocio"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#97D6DF]/20 via-transparent to-transparent" />
                  <div className="flex items-center gap-2 text-white/40">
                    <BuildingStorefrontIcon className="w-8 h-8" />
                    <span className="text-[14px] font-normal tracking-wide">
                      {businessName}
                    </span>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
            </div>

            {/* Fila de identidad del negocio: Logo, Nombre, Eslogan, Buscador y Filtro */}
            <div className="p-5 sm:p-6 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
              <div className="flex items-end gap-4">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-1.5 shadow-md border border-[#ECECEC] shrink-0 overflow-hidden">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={businessName}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#FF3F1A] to-[#190088] flex items-center justify-center text-white text-[28px] font-bold">
                      {(businessName || "N")[0].toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="space-y-1 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-[24px] sm:text-[36px] font-bold text-[#190088] tracking-tight leading-none">
                      {businessName}
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-[#97D6DF]/30 text-[#190088] border border-[#97D6DF]/50">
                      Abierto
                    </span>
                  </div>

                  <p className="text-[14px] font-light text-[#212121]/70 max-w-xl line-clamp-1">
                    {businessTagline}
                  </p>
                </div>
              </div>

              {/* Buscador y filtro */}
              <div className="flex items-center gap-3 shrink-0 relative">
                <div className="relative w-full sm:w-64">
                  <MagnifyingGlassIcon className="w-4 h-4 text-[#212121]/50 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={preset.storefront.searchPlaceholder}
                    className="w-full h-11 pl-11 pr-8 bg-[#ECECEC]/30 text-[#212121] text-[14px] font-normal placeholder-[#212121]/40 rounded-full border border-[#ECECEC] focus:border-[#97D6DF] focus:outline-none transition-colors"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#212121]/50 hover:text-[#FF3F1A] cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div ref={filterMenuRef} className="relative">
                  <button
                    type="button"
                    aria-expanded={filterMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setFilterMenuOpen((prev) => !prev)}
                    className={`h-11 px-4 border rounded-full text-[14px] font-normal flex items-center gap-2 shadow-2xs transition-colors shrink-0 cursor-pointer ${
                      sortPriceAsc !== null
                        ? "bg-[#190088] border-[#190088] text-white font-semibold"
                        : "bg-white border-[#ECECEC] text-[#212121] hover:bg-[#EFE6D3]/40"
                    }`}
                  >
                    <FunnelIcon className="w-4 h-4" />
                    <span>Filtrar</span>
                  </button>

                  {filterMenuOpen && (
                    <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-[#ECECEC] shadow-xl p-1.5 z-30">
                      <button
                        type="button"
                        onClick={() => {
                          setSortPriceAsc(null);
                          setFilterMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs cursor-pointer ${
                          sortPriceAsc === null
                            ? "bg-[#190088]/10 text-[#190088] font-bold"
                            : "text-[#212121] hover:bg-[#ECECEC]/40"
                        }`}
                      >
                        Orden recomendado
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortPriceAsc(true);
                          setFilterMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs cursor-pointer ${
                          sortPriceAsc === true
                            ? "bg-[#190088]/10 text-[#190088] font-bold"
                            : "text-[#212121] hover:bg-[#ECECEC]/40"
                        }`}
                      >
                        Precio: menor a mayor
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortPriceAsc(false);
                          setFilterMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs cursor-pointer ${
                          sortPriceAsc === false
                            ? "bg-[#190088]/10 text-[#190088] font-bold"
                            : "text-[#212121] hover:bg-[#ECECEC]/40"
                        }`}
                      >
                        Precio: mayor a menor
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── BARRA DE CATEGORÍAS HORIZONTAL CON ESTILO DE PÍLDORAS ── */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-[14px] transition-all shrink-0 cursor-pointer ${
                    active
                      ? "bg-[#190088] text-white font-bold shadow-xs"
                      : "bg-white text-[#212121] font-normal border border-[#ECECEC] hover:bg-[#EFE6D3]/50"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* ── CUERPO PRINCIPAL CON 2 COLUMNAS SIMÉTRICAS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* ── COLUMNA IZQUIERDA: GRID DE PRODUCTOS ── */}
            <div className="lg:col-span-7 xl:col-span-8">
              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-[#ECECEC] shadow-2xs space-y-3">
                  <p className="text-[16px] font-normal text-[#212121]/70">
                    No hay productos disponibles en esta categoría.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setActiveCategory("Todos");
                      setSortPriceAsc(null);
                    }}
                    className="text-[14px] font-bold text-[#FF3F1A] hover:underline cursor-pointer"
                  >
                    Ver todos los productos
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProducts.map((prod) => {
                    const activeVariant = prod.variants?.length
                      ? (selectedVariants[prod.id] ?? prod.variants[0])
                      : undefined;
                    const cartKey = makeCartKey(prod.id, activeVariant);
                    const qty = cart[cartKey] || 0;

                    return (
                      <div
                        key={prod.id}
                        className="bg-white rounded-2xl p-4 border border-[#ECECEC] shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                      >
                        {/* Fila superior: Foto a la izquierda, título y descripción a la derecha */}
                        <div className="flex items-start gap-3.5">
                          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-[#ECECEC]/30">
                            <img
                              src={prod.image}
                              alt={prod.name}
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                if (img.dataset.fallbackApplied === "1") return;
                                img.dataset.fallbackApplied = "1";
                                img.src = assignSmartPhoto(prod.name, prod.category);
                              }}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="text-[16px] font-bold text-[#212121] leading-tight line-clamp-2">
                              {prod.name}
                            </h3>
                            <p className="text-[12px] font-light text-[#212121]/70 line-clamp-2 mt-1 leading-snug">
                              {prod.description ||
                                prod.subtext ||
                                "Seleccionado especialmente para tu pedido."}
                            </p>

                            {/* Píldoras de stock y vendidos */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-normal bg-[#ECECEC]/70 text-[#212121]/80">
                                {prod.availableCount} disponibles
                              </span>
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-normal bg-[#ECECEC]/70 text-[#212121]/80">
                                {prod.soldCount} vendidos
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Selector interactivo de tallas / variantes */}
                        {prod.variants && prod.variants.length > 0 && (
                          <div
                            className="mt-3 flex flex-wrap items-center gap-1.5"
                            role="group"
                            aria-label={`Opciones de ${prod.name}`}
                          >
                            {prod.variants.map((variant) => {
                              const isSelected = activeVariant === variant;
                              const variantQty = cart[makeCartKey(prod.id, variant)] || 0;
                              return (
                                <button
                                  key={variant}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() =>
                                    setSelectedVariants((prev) => ({
                                      ...prev,
                                      [prod.id]: variant,
                                    }))
                                  }
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? "border-[#190088] bg-[#190088] text-white shadow-2xs"
                                      : "border-[#ECECEC] bg-[#ECECEC]/40 text-[#212121] hover:border-[#190088]/40"
                                  }`}
                                >
                                  <span>{variant}</span>
                                  {variantQty > 0 && (
                                    <span
                                      className={`rounded-full px-1 text-[10px] ${
                                        isSelected
                                          ? "bg-white/25 text-white"
                                          : "bg-[#190088]/10 text-[#190088]"
                                      }`}
                                    >
                                      {variantQty}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Fila inferior: Precio a la izquierda, selector + / - a la derecha */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#ECECEC]/60">
                          <span className="text-[18px] font-bold text-[#212121]">
                            {formatCOP(prod.price)}
                          </span>

                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => removeItem(cartKey)}
                              disabled={qty === 0}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                qty > 0
                                  ? "bg-[#ECECEC] hover:bg-[#ECECEC]/80 text-[#212121] active:scale-95"
                                  : "bg-[#ECECEC]/40 text-[#212121]/30 cursor-not-allowed"
                              }`}
                              title="Disminuir"
                              aria-label={`Disminuir ${prod.name}${activeVariant ? ` (${activeVariant})` : ""}`}
                            >
                              <MinusIcon className="w-4 h-4 stroke-[2.5]" />
                            </button>

                            <span className="text-[14px] font-bold text-[#212121] min-w-[16px] text-center">
                              {qty}
                            </span>

                            <button
                              type="button"
                              onClick={() => addItem(cartKey)}
                              className="w-8 h-8 rounded-full bg-[#10B981] hover:bg-[#059669] text-white flex items-center justify-center shadow-xs active:scale-95 transition-all cursor-pointer"
                              title="Aumentar"
                              aria-label={`Agregar ${prod.name}${activeVariant ? ` (${activeVariant})` : ""}`}
                            >
                              <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── COLUMNA DERECHA: TARJETA DE TU PEDIDO ALINEADA SIMÉTRICAMENTE ── */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="bg-white rounded-3xl p-6 border border-[#ECECEC] shadow-sm flex flex-col space-y-5 lg:sticky lg:top-8">
                {/* Cabecera del carrito */}
                <div className="flex items-center justify-between">
                  <h2 className="text-[24px] font-bold text-[#190088] tracking-tight">
                    Tu Pedido
                  </h2>

                  {totalUnits > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart({})}
                      className="text-[12px] font-bold text-[#FF3F1A] hover:underline cursor-pointer"
                    >
                      Vaciar todo
                    </button>
                  )}
                </div>

                {/* Lista de productos en la comanda */}
                {totalUnits === 0 ? (
                  <div className="py-12 text-center space-y-3 bg-[#EFE6D3]/20 rounded-2xl border border-dashed border-[#ECECEC]">
                    <ShoppingBagIcon className="w-10 h-10 text-[#212121]/30 mx-auto" />
                    <p className="text-[14px] font-normal text-[#212121]/70 px-4">
                      {preset.storefront.emptyCartCopy}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                    {Object.entries(cart).map(([cartKey, qty]) => {
                      const { productId, variant } = parseCartKey(cartKey);
                      const prod = products.find((p) => p.id === productId);
                      if (!prod) return null;
                      return (
                        <div
                          key={cartKey}
                          className="bg-[#EFE6D3]/30 border border-[#ECECEC] rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-5 h-5 rounded-md bg-[#212121] text-white flex items-center justify-center shrink-0">
                              <CheckIcon className="w-3.5 h-3.5 stroke-[3]" />
                            </div>

                            <img
                              src={prod.image}
                              alt={prod.name}
                              onError={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                if (img.dataset.fallbackApplied === "1") return;
                                img.dataset.fallbackApplied = "1";
                                img.src = assignSmartPhoto(prod.name, prod.category);
                              }}
                              className="w-14 h-14 rounded-full object-cover shrink-0 shadow-2xs"
                            />

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h4 className="text-[14px] font-bold text-[#190088] truncate">
                                  {prod.name}
                                </h4>
                                {variant && (
                                  <span className="shrink-0 rounded-md bg-[#190088]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#190088]">
                                    {variant}
                                  </span>
                                )}
                              </div>
                              <p className="text-[12px] font-light text-[#212121]/70 truncate">
                                {prod.subtext || prod.category}
                              </p>
                              <p className="text-[14px] font-bold text-[#212121] mt-0.5">
                                Total {formatCOP(prod.price * qty)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => deleteItemCompletely(cartKey)}
                              className="text-[#212121]/40 hover:text-[#FF3F1A] transition-colors cursor-pointer"
                              title="Eliminar producto"
                              aria-label={`Eliminar ${prod.name}${variant ? ` (${variant})` : ""}`}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => removeItem(cartKey)}
                                className="w-6 h-6 rounded-full bg-[#ECECEC] hover:bg-[#ECECEC]/80 text-[#212121] flex items-center justify-center text-[12px] font-bold cursor-pointer transition-colors active:scale-95"
                                title="Disminuir"
                              >
                                −
                              </button>
                              <span className="text-[13px] font-bold text-[#212121] min-w-[14px] text-center">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => addItem(cartKey)}
                                className="w-6 h-6 rounded-full bg-[#10B981] hover:bg-[#059669] text-white flex items-center justify-center text-[12px] font-bold cursor-pointer transition-colors active:scale-95 shadow-xs"
                                title="Aumentar"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Banner de cupón / promoción */}
                <div className="bg-[#EFE6D3] rounded-2xl p-3 border border-[#ECECEC] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TicketIcon className="w-4 h-4 text-[#190088]" />
                    <span className="text-[12px] font-bold text-[#190088]">
                      Descuento Especial (10%)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPromoActive(!promoActive)}
                    className="px-3 py-1 bg-white text-[#FF3F1A] rounded-full text-[12px] font-bold border border-[#ECECEC] hover:bg-[#FF3F1A] hover:text-white transition-colors cursor-pointer"
                  >
                    {promoActive ? "Quitar" : "Aplicar"}
                  </button>
                </div>

                {/* Selector de modalidad */}
                <div className="bg-white rounded-2xl p-3 border border-[#ECECEC] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <TruckIcon className="w-4 h-4 text-[#FF3F1A] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[12px] font-bold text-[#190088] block truncate">
                        {modality === "domicilio"
                          ? preset.storefront.deliveryLabel
                          : preset.storefront.pickupLabel}
                      </span>
                      <span className="text-[12px] font-light text-[#212121]/70 block truncate">
                        {modality === "domicilio" ? address : branchName}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setModality(modality === "domicilio" ? "retiro" : "domicilio")
                    }
                    className="text-[12px] font-bold text-[#FF3F1A] hover:underline cursor-pointer shrink-0"
                  >
                    Cambiar
                  </button>
                </div>

                {/* Desglose financiero */}
                <div className="space-y-2 border-t border-[#ECECEC] pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-normal text-[#212121]">
                      Subtotal productos
                    </span>
                    <span className="text-[14px] font-bold text-[#212121]">
                      {formatCOP(subtotal)}
                    </span>
                  </div>

                  {discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-normal text-[#212121]">
                        Descuento
                      </span>
                      <span className="text-[14px] font-bold text-[#FF3F1A]">
                        -{formatCOP(discount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-normal text-[#212121]">
                      Costo de envío
                    </span>
                    <span className="text-[14px] font-bold text-[#212121]">
                      {shippingFee === 0 ? "Gratis" : formatCOP(shippingFee)}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-2 border-t border-[#ECECEC]">
                    <span className="text-[16px] font-bold text-[#212121]">
                      Total a pagar
                    </span>
                    <span className="text-[36px] font-bold text-[#190088] leading-none">
                      {formatCOP(total)}
                    </span>
                  </div>
                </div>

                {/* Botón principal CTA */}
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={totalUnits === 0}
                  className="w-full py-4 rounded-full bg-[#FF3F1A] hover:bg-[#FF3F1A]/90 active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[16px] font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{preset.storefront.ctaLabel}</span>
                  <ArrowRightIcon className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── MODAL DE PROCEDER AL PAGO (EN LÍNEA / QR / BOT) ── */}
        {paymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#ECECEC] overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-[#190088] text-white px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBagIcon className="w-5 h-5 text-[#97D6DF]" />
                  <span className="text-[16px] font-bold text-white">
                    Confirmar Pedido {orderRef}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="text-white/80 hover:text-white text-[16px] font-bold cursor-pointer"
                  aria-label="Cerrar confirmación"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-[24px] font-bold text-[#190088]">
                    {formatCOP(total)} COP
                  </h3>
                  <p className="text-[14px] font-normal text-[#212121]/70">
                    Cliente: <b>{customerName}</b> •{" "}
                    {modality === "domicilio"
                      ? preset.storefront.deliveryLabel
                      : preset.storefront.pickupLabel}
                  </p>
                </div>

                <div className="bg-[#EFE6D3]/40 rounded-2xl p-4 border border-[#ECECEC] space-y-2 text-[14px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-normal text-[#212121]">
                      Destino:
                    </span>
                    <span className="text-[14px] font-bold text-[#212121]">
                      {modality === "domicilio" ? address : branchName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-normal text-[#212121]">
                      Total artículos:
                    </span>
                    <span className="text-[14px] font-bold text-[#212121]">
                      {totalUnits} unidades
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#ECECEC] pt-2">
                    <span className="text-[14px] font-normal text-[#212121]">
                      Estado sincronización:
                    </span>
                    <span className="text-[12px] font-bold text-[#190088]">
                      {savingOrder
                        ? "Sincronizando..."
                        : botNotified
                          ? "Registrado y enviado al chat"
                          : "Listo"}
                    </span>
                  </div>
                </div>

                {qrDataUrl && (
                  <div className="text-center space-y-2 py-2">
                    <div className="inline-block p-3 bg-white border border-[#ECECEC] rounded-2xl shadow-2xs">
                      <img
                        src={qrDataUrl}
                        alt="Código QR de Pago"
                        className="w-40 h-40 mx-auto"
                      />
                    </div>
                    <p className="text-[12px] font-light text-[#212121]/70">
                      Escanea para pagar en caja o abrir el checkout directo
                    </p>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={goToOnlineCheckout}
                    className="w-full py-4 rounded-full bg-[#FF3F1A] hover:bg-[#FF3F1A]/90 text-white text-[16px] font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Pagar con Tarjeta / PSE en Línea</span>
                    <ArrowRightIcon className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(false)}
                    className="w-full py-3 text-[14px] font-normal text-[#212121]/70 hover:text-[#212121] text-center cursor-pointer"
                  >
                    Continuar comprando
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
});

export default PublicCatalogPage;
