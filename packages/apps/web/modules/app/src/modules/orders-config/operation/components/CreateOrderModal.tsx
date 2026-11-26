import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  ArrowDownTrayIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  QrCodeIcon,
  TrashIcon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/elements/ui/button";
import type { ModalityType } from "../../types";
import { assignSmartPhoto, type CatalogProduct } from "../domain/catalogDomain";
import {
  COLOMBIA_DEPARTMENTS,
  formatCOP,
  MODALITY_LABELS,
  PAYMENT_METHOD_LABELS,
  type Order,
  type OrderModality,
  type OrderPaymentMethod,
} from "../domain/order";
import {
  buildPaymentLink,
  buildPaymentMessage,
  generateQrSvgDataUrl,
} from "../domain/orderBilling";
import type { OrdersStore } from "../stores/OrdersStore";
import { CarrierLogo } from "./CarrierLogo";
import { Modal } from "./Dialog";
import { ScheduleOrderModal } from "./ScheduleOrderModal";

export interface CreateOrderModalProps {
  open: boolean;
  businessName: string;
  businessId?: string;
  operatorName: string;
  ordersStore: OrdersStore;
  catalogProducts: CatalogProduct[];
  modalities: ReadonlyArray<ModalityType | OrderModality>;
  initialCustomerName?: string;
  initialCustomerPhone?: string;
  initialAddressStreet?: string;
  initialChatId?: string;
  onSendReceiptToChat?: (order: Order, message: string) => void;
  onClose: () => void;
  onOpenCatalog: () => void;
  onGoToDetail: (order: Order) => void;
}

function stripCountryPrefix(phone?: string): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("+57")) {
    return trimmed.slice(3).trim();
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) {
    return digits.slice(2);
  }
  return trimmed;
}

interface CartDraftItem {
  id: string;
  productId?: string;
  name: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  image?: string;
}

interface ExtraChargeDraft {
  id: string;
  label: string;
  amount: number;
}

function normalizeModalities(
  raw: ReadonlyArray<ModalityType | OrderModality>,
): OrderModality[] {
  const mapped = raw
    .map((m): OrderModality => (m === "on_site" ? "onsite" : m))
    .filter((m, idx, arr) => arr.indexOf(m) === idx);
  return mapped.length > 0 ? mapped : ["delivery", "pickup", "onsite"];
}

function isOwnDeliveryCarrier(carrierName: string): boolean {
  const norm = carrierName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return norm === "envio propio";
}

const ONSITE_QUICK_TABLES = ["Mesa 1", "Mesa 2", "Mesa 3", "Barra", "Terraza"];

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-gray-300 bg-white px-3 text-xs text-ink-body outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

export const CreateOrderModal = observer(
  ({
    open,
    businessName,
    businessId,
    operatorName,
    ordersStore,
    catalogProducts,
    modalities,
    initialCustomerName,
    initialCustomerPhone,
    initialAddressStreet,
    initialChatId,
    onSendReceiptToChat,
    onClose,
    onOpenCatalog,
    onGoToDetail,
  }: CreateOrderModalProps) => {
    const enabledModalities = useMemo(() => normalizeModalities(modalities), [modalities]);
    const enabledCarriers = ordersStore.enabledCarriers;
    const defaultCarrierName =
      ordersStore.favoriteCarrier?.name ?? enabledCarriers[0]?.name ?? "Envío propio";

    // Customer & CRM
    const [phoneDigits, setPhoneDigits] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [saveAddressCrm, setSaveAddressCrm] = useState(true);

    // Modality & Fulfillment (start empty as required)
    const [modality, setModality] = useState<OrderModality>(enabledModalities[0]);
    const [street, setStreet] = useState("");
    const [neighborhood, setNeighborhood] = useState("");
    const [reference, setReference] = useState("");
    const [department, setDepartment] = useState("");
    const [city, setCity] = useState("");
    const [addressNotes, setAddressNotes] = useState("");
    const [carrier, setCarrier] = useState(defaultCarrierName);
    const [courierName, setCourierName] = useState("");
    const [shippingFee, setShippingFee] = useState("0");
    const [table, setTable] = useState("");

    // Catalog & Cart
    const [catalogQuery, setCatalogQuery] = useState("");
    const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);
    const catalogDropdownRef = useRef<HTMLDivElement>(null);
    const [cart, setCart] = useState<CartDraftItem[]>([]);
    const [showCustomItem, setShowCustomItem] = useState(false);
    const [customName, setCustomName] = useState("");
    const [customVariant, setCustomVariant] = useState("");
    const [customQty, setCustomQty] = useState("1");
    const [customPrice, setCustomPrice] = useState("");

    // Extra charges
    const [extraCharges, setExtraCharges] = useState<ExtraChargeDraft[]>([]);
    const [extraLabel, setExtraLabel] = useState("");
    const [extraAmount, setExtraAmount] = useState("");

    // Payment & options
    const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>("transfer");
    const [paid, setPaid] = useState(false);
    const [paidWith, setPaidWith] = useState("");
    const [confirmOnCreate, setConfirmOnCreate] = useState(false);
    const [urgent, setUrgent] = useState(false);
    const [scheduledFor, setScheduledFor] = useState<string | null>(null);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [notes, setNotes] = useState("");

    // Validation & Post-creation receipt state
    const [error, setError] = useState<string | null>(null);
    const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
    const [copyNotice, setCopyNotice] = useState<string | null>(null);
    const [receiptSentToChat, setReceiptSentToChat] = useState(false);

    const resetForm = (applyInitials = false) => {
      setPhoneDigits(applyInitials ? stripCountryPrefix(initialCustomerPhone) : "");
      setCustomerName(applyInitials ? (initialCustomerName?.trim() ?? "") : "");
      setSaveAddressCrm(true);
      setModality(enabledModalities[0]);
      setStreet(applyInitials ? (initialAddressStreet?.trim() ?? "") : "");
      setNeighborhood("");
      setReference("");
      setDepartment("");
      setCity("");
      setAddressNotes("");
      setCarrier(defaultCarrierName);
      setCourierName("");
      setShippingFee("0");
      setTable("");
      setCatalogQuery("");
      setCatalogDropdownOpen(false);
      setCart([]);
      setShowCustomItem(false);
      setCustomName("");
      setCustomVariant("");
      setCustomQty("1");
      setCustomPrice("");
      setExtraCharges([]);
      setExtraLabel("");
      setExtraAmount("");
      setPaymentMethod("transfer");
      setPaid(false);
      setPaidWith("");
      setConfirmOnCreate(false);
      setUrgent(false);
      setScheduledFor(null);
      setScheduleModalOpen(false);
      setNotes("");
      setError(null);
      setCreatedOrder(null);
      setCopyNotice(null);
      setReceiptSentToChat(false);
    };

    useEffect(() => {
      if (open) {
        resetForm(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialCustomerName, initialCustomerPhone, initialAddressStreet, initialChatId]);

    useEffect(() => {
      if (!catalogDropdownOpen) return;
      const handleOutside = (event: MouseEvent) => {
        if (
          catalogDropdownRef.current &&
          !catalogDropdownRef.current.contains(event.target as Node)
        ) {
          setCatalogDropdownOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }, [catalogDropdownOpen]);

    const fullPhone = phoneDigits.trim() ? `+57 ${phoneDigits.trim()}` : "";
    const savedMatches = useMemo(
      () =>
        phoneDigits.replace(/\D/g, "").length >= 7
          ? ordersStore.getCustomerAddresses(fullPhone)
          : [],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [fullPhone, phoneDigits, ordersStore.savedAddresses.length],
    );

    const availableProducts = useMemo(() => {
      const q = catalogQuery.trim().toLowerCase();
      return catalogProducts.filter((p) => {
        if (!p.available) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      });
    }, [catalogProducts, catalogQuery]);

    const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const extrasTotal = extraCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const parsedShipping =
      modality === "delivery" ? Math.max(0, Math.round(Number(shippingFee) || 0)) : 0;
    const total = subtotal + extrasTotal + parsedShipping;

    const supportsCashCalculator =
      paymentMethod === "cash" || paymentMethod === "cod";
    const hasPaidWithInput = supportsCashCalculator && paidWith.trim().length > 0;
    const parsedPaidWith = Math.max(0, Math.round(Number(paidWith) || 0));
    const changeDue = hasPaidWithInput ? parsedPaidWith - total : null;
    const isPaidWithInsufficient =
      hasPaidWithInput && total > 0 && parsedPaidWith < total;

    if (!open) return null;

    const addCatalogProduct = (product: CatalogProduct) => {
      setError(null);
      setCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) => item.productId === product.id && !item.variant,
        );
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = {
            ...next[existingIdx],
            quantity: next[existingIdx].quantity + 1,
          };
          return next;
        }
        return [
          ...prev,
          {
            id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: product.id,
            name: product.name,
            variant: "",
            quantity: 1,
            unitPrice: product.price,
            image: product.image || assignSmartPhoto(product.name, product.category),
          },
        ];
      });
    };

    const addCustomItem = () => {
      const cleanName = customName.trim();
      const price = Math.max(0, Math.round(Number(customPrice) || 0));
      const qty = Math.max(1, Math.round(Number(customQty) || 1));
      if (!cleanName) {
        setError("Escribe el nombre del producto personalizado.");
        return;
      }
      setCart((prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanName,
          variant: customVariant.trim(),
          quantity: qty,
          unitPrice: price,
          image: assignSmartPhoto(cleanName, ""),
        },
      ]);
      setCustomName("");
      setCustomVariant("");
      setCustomQty("1");
      setCustomPrice("");
      setShowCustomItem(false);
      setError(null);
    };

    const addExtraCharge = () => {
      const cleanLabel = extraLabel.trim();
      const amount = Math.round(Number(extraAmount) || 0);
      if (!cleanLabel || amount <= 0) return;
      setExtraCharges((prev) => [
        ...prev,
        {
          id: `extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: cleanLabel,
          amount,
        },
      ]);
      setExtraLabel("");
      setExtraAmount("");
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!customerName.trim()) {
        setError("Ingresa el nombre del cliente.");
        return;
      }
      if (phoneDigits.replace(/\D/g, "").length < 7) {
        setError("Ingresa un número de teléfono válido (mínimo 7 dígitos).");
        return;
      }
      if (cart.length === 0) {
        setError("Agrega al menos un producto al pedido.");
        return;
      }
      if (modality === "delivery" && !street.trim()) {
        setError("Ingresa la dirección de entrega para pedidos a domicilio.");
        return;
      }
      if (isPaidWithInsufficient) {
        setError(
          `El monto con el que paga el cliente (${formatCOP(parsedPaidWith)}) es menor al total del pedido (${formatCOP(total)}).`,
        );
        return;
      }
      if (scheduledFor) {
        const scheduledMs = new Date(scheduledFor).getTime();
        if (Number.isNaN(scheduledMs) || scheduledMs <= Date.now()) {
          setError(
            "La fecha y hora programada ya expiró. Elige una nueva fecha futura.",
          );
          return;
        }
      }

      const ownCarrier = isOwnDeliveryCarrier(carrier);

      const created = ordersStore.createOrder(
        {
          customerName: customerName.trim(),
          customerPhone: fullPhone,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            variant: item.variant.trim() || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            image: item.image,
          })),
          extraCharges: extraCharges.map((c) => ({ label: c.label, amount: c.amount })),
          shippingFee: parsedShipping,
          modality,
          table: modality === "onsite" ? table.trim() || undefined : undefined,
          address:
            modality === "delivery"
              ? {
                  street: street.trim(),
                  neighborhood: neighborhood.trim() || undefined,
                  reference: reference.trim() || undefined,
                  department: department || undefined,
                  city: city.trim() || undefined,
                  notes: addressNotes.trim() || undefined,
                }
              : undefined,
          carrier: modality === "delivery" ? carrier : undefined,
          courierName:
            modality === "delivery" && ownCarrier && courierName.trim()
              ? courierName.trim()
              : undefined,
          paymentMethod,
          paid,
          paidWith:
            supportsCashCalculator && parsedPaidWith > 0 ? parsedPaidWith : undefined,
          channel: "operator",
          confirmOnCreate,
          saveAddressToCrm: saveAddressCrm,
          scheduledFor,
          urgent,
          notes: notes.trim() || undefined,
        },
        operatorName,
      );

      setCreatedOrder(created);
      setError(null);
    };

    const copyText = async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopyNotice(label);
        window.setTimeout(() => setCopyNotice(null), 2600);
      } catch {
        setCopyNotice("No se pudo copiar automáticamente.");
        window.setTimeout(() => setCopyNotice(null), 2600);
      }
    };

    const handleDownloadQr = (order: Order, qrDataUrl: string) => {
      try {
        const link = document.createElement("a");
        link.href = qrDataUrl;
        link.download = `qr-${order.code.replace(/[^a-zA-Z0-9_-]/g, "")}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setCopyNotice("Código QR descargado");
        window.setTimeout(() => setCopyNotice(null), 2400);
      } catch {
        setCopyNotice("No se pudo descargar el QR.");
        window.setTimeout(() => setCopyNotice(null), 2400);
      }
    };

    const receiptPaymentLink = createdOrder
      ? buildPaymentLink(createdOrder, undefined, businessId)
      : "";
    const receiptPaymentMessage = createdOrder
      ? buildPaymentMessage(createdOrder, businessName, undefined, businessId)
      : "";
    const receiptQrUrl = createdOrder
      ? generateQrSvgDataUrl(receiptPaymentLink, { dark: "#190088", light: "#FFFFFF" })
      : "";

    const totalCartUnits = cart.reduce((s, i) => s + i.quantity, 0);

    return (
      <>
        <Modal
          isOpen
          onClose={onClose}
          label={createdOrder ? `Comprobante ${createdOrder.code}` : "Nuevo pedido"}
          className="w-[min(96vw,68rem)] overflow-hidden p-0"
        >
          {createdOrder ? (
            /* Post-creation Editorial 2-Column NECTO Comprobante */
            <div className="flex max-h-[90dvh] flex-col">
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1.15fr_1fr]">
                {/* Left Column: Editorial NECTO Header + 4 Detail Rows + Real Scannable QR & Actions */}
                <div className="flex flex-col justify-between p-6 sm:p-7">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#190088] text-sm font-black tracking-tight text-white shadow-theme-xs">
                          N
                        </span>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            {businessName}
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {createdOrder.scheduledFor ? "Programado" : "Registrado"} ·{" "}
                            {createdOrder.code}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer md:hidden dark:hover:bg-gray-800 dark:hover:text-white"
                      >
                        <XMarkIcon className="size-4" />
                      </button>
                    </div>

                    <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#190088] dark:text-white">
                      ¡Pedido registrado!
                    </h1>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Comprobante listo para compartir con {createdOrder.customerName}.
                    </p>

                    {/* 4 Clean Detail Rows */}
                    <dl className="mt-5 divide-y divide-gray-100 rounded-2xl border border-gray-200/80 bg-white px-4 text-xs dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-gray-500 dark:text-gray-400">Cliente</dt>
                        <dd className="text-right font-semibold text-ink-body dark:text-white">
                          {createdOrder.customerName}
                          <span className="block text-[11px] font-normal text-gray-500">
                            {createdOrder.customerPhone}
                          </span>
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-gray-500 dark:text-gray-400">Modalidad</dt>
                        <dd className="text-right font-semibold text-ink-body dark:text-white">
                          {MODALITY_LABELS[createdOrder.modality]}
                          <span className="block max-w-[240px] truncate text-[11px] font-normal text-gray-500">
                            {createdOrder.modality === "delivery"
                              ? [
                                  createdOrder.address?.street,
                                  createdOrder.address?.city,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "Domicilio"
                              : createdOrder.modality === "onsite"
                                ? createdOrder.table || "Consumo en sitio"
                                : "Retiro en tienda"}
                          </span>
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-gray-500 dark:text-gray-400">Pago</dt>
                        <dd className="text-right font-semibold text-ink-body dark:text-white">
                          {PAYMENT_METHOD_LABELS[createdOrder.paymentMethod]}
                          <span
                            className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              createdOrder.paid
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                            }`}
                          >
                            {createdOrder.paid ? "Pagado" : "Pendiente"}
                          </span>
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-gray-500 dark:text-gray-400">
                          {createdOrder.scheduledFor ? "Programación" : "Logística"}
                        </dt>
                        <dd className="text-right font-semibold text-ink-body dark:text-white">
                          {createdOrder.scheduledFor
                            ? new Date(createdOrder.scheduledFor).toLocaleString(
                                "es-CO",
                                {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : createdOrder.modality === "delivery"
                              ? [createdOrder.carrier, createdOrder.courierName]
                                  .filter(Boolean)
                                  .join(" · ") || "Por asignar"
                              : new Date(createdOrder.createdAt).toLocaleString(
                                  "es-CO",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                        </dd>
                      </div>
                    </dl>

                    {/* QR + Share Actions */}
                    <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 sm:flex-row sm:items-center dark:border-gray-800 dark:bg-gray-950/50">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-theme-xs">
                          <img
                            src={receiptQrUrl}
                            alt={`Código QR de pago para ${createdOrder.code}`}
                            className="size-28"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadQr(createdOrder, receiptQrUrl)}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#190088] hover:underline cursor-pointer dark:text-brand-400"
                        >
                          <ArrowDownTrayIcon className="size-3.5" />
                          Descargar QR
                        </button>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-ink-body dark:text-white">
                          <QrCodeIcon className="size-4 text-[#FF3F1A]" />
                          Cobro y comprobante
                        </div>

                        {(copyNotice || receiptSentToChat) && (
                          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            <CheckIcon className="size-3.5" />
                            {copyNotice ?? "Comprobante enviado al chat"}
                          </div>
                        )}

                        {onSendReceiptToChat && (
                          <button
                            type="button"
                            onClick={() => {
                              onSendReceiptToChat(createdOrder, receiptPaymentMessage);
                              setReceiptSentToChat(true);
                              setCopyNotice("Comprobante enviado al chat");
                              window.setTimeout(() => setCopyNotice(null), 3200);
                            }}
                            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-emerald-700 cursor-pointer"
                          >
                            <ChatBubbleLeftRightIcon className="size-4 shrink-0" />
                            <span>
                              {receiptSentToChat
                                ? "Comprobante enviado al chat"
                                : "Enviar comprobante al chat"}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            void copyText(receiptPaymentLink, "Enlace de pago copiado")
                          }
                          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#FF3F1A] px-3 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-[#e53614] cursor-pointer"
                        >
                          <ClipboardDocumentIcon className="size-4" />
                          Copiar enlace de pago
                        </button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          startIcon={<ClipboardDocumentIcon className="size-4" />}
                          onClick={() =>
                            void copyText(
                              receiptPaymentMessage,
                              "Mensaje de cobro copiado",
                            )
                          }
                        >
                          Copiar mensaje de cobro
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Editorial #F7F7F5 Itemized Summary with Thumbnails */}
                <div className="flex flex-col justify-between border-t border-gray-200/80 bg-[#F7F7F5] p-6 sm:p-7 md:border-l md:border-t-0 dark:border-gray-800 dark:bg-gray-800/50">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Resumen del comprobante
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-bold text-[#190088] dark:text-white">
                          {createdOrder.code}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="hidden size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/80 hover:text-gray-700 cursor-pointer md:flex dark:hover:bg-gray-800 dark:hover:text-white"
                      >
                        <XMarkIcon className="size-4" />
                      </button>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {createdOrder.items.map((item) => {
                        const thumb = item.image || assignSmartPhoto(item.name, "");
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white p-2.5 dark:border-gray-700/80 dark:bg-gray-900"
                          >
                            <img
                              src={thumb}
                              alt={item.name}
                              className="size-11 shrink-0 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold text-ink-body dark:text-white">
                                {item.name}
                              </div>
                              <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                {item.quantity} × {formatCOP(item.unitPrice)}
                                {item.variant ? ` · ${item.variant}` : ""}
                              </div>
                            </div>
                            <span className="shrink-0 text-xs font-bold tabular-nums text-ink-body dark:text-white">
                              {formatCOP(item.quantity * item.unitPrice)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 space-y-1.5 border-t border-gray-200 pt-3.5 text-xs dark:border-gray-700">
                      <div className="flex justify-between text-gray-600 dark:text-gray-300">
                        <span>Subtotal</span>
                        <span className="tabular-nums">
                          {formatCOP(createdOrder.subtotal)}
                        </span>
                      </div>
                      {createdOrder.extraCharges.map((extra) => (
                        <div
                          key={extra.id}
                          className="flex justify-between text-gray-600 dark:text-gray-300"
                        >
                          <span>{extra.label}</span>
                          <span className="tabular-nums">
                            {formatCOP(extra.amount)}
                          </span>
                        </div>
                      ))}
                      {createdOrder.shippingFee > 0 && (
                        <div className="flex justify-between text-gray-600 dark:text-gray-300">
                          <span>Envío ({createdOrder.carrier ?? "Domicilio"})</span>
                          <span className="tabular-nums">
                            {formatCOP(createdOrder.shippingFee)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-300/80 pt-2.5 text-base font-extrabold text-[#190088] dark:border-gray-700 dark:text-white">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {formatCOP(createdOrder.total)}
                        </span>
                      </div>
                      {createdOrder.paidWith && createdOrder.paidWith >= createdOrder.total && (
                        <div className="flex justify-between pt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                          <span>Paga con {formatCOP(createdOrder.paidWith)}</span>
                          <span className="font-bold tabular-nums">
                            Cambio: {formatCOP(createdOrder.paidWith - createdOrder.total)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {createdOrder.scheduledFor && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      <CalendarDaysIcon className="size-4 shrink-0" />
                      Se activará automáticamente al llegar la fecha programada.
                    </div>
                  )}
                </div>
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-6 py-3.5 dark:border-gray-800">
                <Button variant="outline" size="sm" onClick={() => resetForm(false)}>
                  Crear otro pedido
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const target = createdOrder;
                      onClose();
                      onGoToDetail(target);
                    }}
                  >
                    Ir al detalle
                  </Button>
                  <Button variant="primary" size="sm" onClick={onClose}>
                    Cerrar
                  </Button>
                </div>
              </footer>
            </div>
          ) : (
            /* Editorial 2-Column Creation Form */
            <form onSubmit={handleSubmit} className="flex max-h-[90dvh] flex-col">
              {/* Top Editorial Header with Necto N emblem + Business Name + H1 #190088 + Modality Pills */}
              <header className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#190088] text-base font-black tracking-tight text-white shadow-theme-xs">
                      N
                    </span>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        {businessName}
                      </div>
                      <h1 className="text-xl font-extrabold tracking-tight text-[#190088] dark:text-white">
                        Nuevo pedido
                      </h1>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Modality Pills */}
                    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
                      {enabledModalities.map((mod) => {
                        const Icon =
                          mod === "delivery"
                            ? TruckIcon
                            : mod === "pickup"
                              ? BuildingStorefrontIcon
                              : MapPinIcon;
                        const active = modality === mod;
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => setModality(mod)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                              active
                                ? "bg-[#190088] text-white shadow-theme-xs dark:bg-brand-500"
                                : "text-gray-600 hover:bg-white hover:text-ink-body dark:text-gray-300 dark:hover:bg-gray-800"
                            }`}
                          >
                            <Icon className="size-3.5 shrink-0" />
                            <span>{MODALITY_LABELS[mod]}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Cerrar"
                      className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer dark:hover:bg-gray-800 dark:hover:text-white"
                    >
                      <XMarkIcon className="size-4" />
                    </button>
                  </div>
                </div>
              </header>

              {/* 2-Column Editorial Split */}
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1.15fr_1fr]">
                {/* LEFT COLUMN: Customer + Delivery/Onsite + Payment + Options */}
                <div className="space-y-5 p-6">
                  {/* 1. Customer & CRM */}
                  <section className="space-y-3">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      1. Datos del cliente
                    </h2>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="create-order-phone"
                          className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200"
                        >
                          Teléfono WhatsApp *
                        </label>
                        <div className="mt-1 flex h-10 items-center overflow-hidden rounded-xl border border-gray-300 bg-white focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900">
                          <span className="flex h-full items-center border-r border-gray-200 bg-gray-50 px-2.5 text-xs font-bold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            +57
                          </span>
                          <input
                            id="create-order-phone"
                            type="tel"
                            value={phoneDigits}
                            onChange={(e) => {
                              setPhoneDigits(e.target.value);
                              if (error) setError(null);
                            }}
                            placeholder="300 123 4567"
                            className="h-full w-full min-w-0 bg-transparent px-2.5 text-xs text-ink-body outline-none placeholder:text-gray-400 dark:text-gray-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="create-order-customer"
                          className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200"
                        >
                          Nombre completo *
                        </label>
                        <input
                          id="create-order-customer"
                          type="text"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (error) setError(null);
                          }}
                          placeholder="Ej. Laura Gómez"
                          className={`mt-1 ${INPUT_CLASS}`}
                        />
                      </div>
                    </div>

                    {/* CRM saved addresses */}
                    {savedMatches.length > 0 && (
                      <div className="rounded-xl border border-brand-200/80 bg-brand-25/70 p-3 dark:border-brand-500/30 dark:bg-brand-500/10">
                        <div className="text-[11px] font-bold text-brand-700 dark:text-brand-300">
                          Direcciones guardadas en CRM ({savedMatches.length})
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {savedMatches.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => {
                                if (!customerName.trim()) setCustomerName(entry.customerName);
                                setStreet(entry.address.street);
                                setNeighborhood(entry.address.neighborhood ?? "");
                                setReference(entry.address.reference ?? "");
                                setDepartment(entry.address.department ?? "");
                                setCity(entry.address.city ?? "");
                                setAddressNotes(entry.address.notes ?? "");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-body transition-colors hover:border-brand-400 hover:bg-brand-50 cursor-pointer dark:border-brand-500/30 dark:bg-gray-900 dark:text-gray-100"
                            >
                              <MapPinIcon className="size-3 text-brand-500" />
                              <span>
                                {entry.address.street}
                                {entry.address.city ? `, ${entry.address.city}` : ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* 2. Modality-specific fields */}
                  {modality === "delivery" && (
                    <section className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        2. Entrega a domicilio
                      </h2>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                            Dirección principal *
                          </label>
                          <input
                            type="text"
                            value={street}
                            onChange={(e) => {
                              setStreet(e.target.value);
                              if (error) setError(null);
                            }}
                            placeholder="Ej. Calle 85 # 14-28, Apto 402"
                            className={`mt-1 ${INPUT_CLASS}`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                            Barrio
                          </label>
                          <input
                            type="text"
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            placeholder="Ej. Chapinero, Laureles…"
                            className={`mt-1 ${INPUT_CLASS}`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                            Punto de referencia
                          </label>
                          <input
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="Ej. Edificio azul, portería 24h"
                            className={`mt-1 ${INPUT_CLASS}`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                            Departamento
                          </label>
                          <select
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className={`mt-1 ${INPUT_CLASS} cursor-pointer`}
                          >
                            <option value="">Seleccionar departamento…</option>
                            {COLOMBIA_DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                            Ciudad / Municipio
                          </label>
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Ej. Bogotá, Medellín, Cali…"
                            className={`mt-1 ${INPUT_CLASS}`}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                            Indicaciones de dirección
                          </label>
                          <input
                            type="text"
                            value={addressNotes}
                            onChange={(e) => setAddressNotes(e.target.value)}
                            placeholder="Ej. Timbrar 2 veces o dejar en recepción"
                            className={`mt-1 ${INPUT_CLASS}`}
                          />
                        </div>
                      </div>

                      {/* Carrier selector */}
                      <div>
                        <span className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                          Transportadora
                        </span>
                        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {enabledCarriers.map((c) => {
                            const active = carrier === c.name;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setCarrier(c.name)}
                                className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-colors cursor-pointer ${
                                  active
                                    ? "border-brand-500 bg-brand-25 ring-1 ring-brand-500/20 dark:bg-brand-500/10"
                                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900"
                                }`}
                              >
                                <CarrierLogo carrier={c} size="sm" />
                                <span className="truncate text-[11px] font-semibold text-ink-body dark:text-gray-100">
                                  {c.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mensajero input when Envío propio is chosen */}
                      {isOwnDeliveryCarrier(carrier) && (
                        <div>
                          <label
                            htmlFor="create-order-courier"
                            className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200"
                          >
                            Mensajero asignado (Envío propio)
                          </label>
                          <input
                            id="create-order-courier"
                            type="text"
                            value={courierName}
                            onChange={(e) => setCourierName(e.target.value)}
                            placeholder="Ej. Javier Moto 04, Carlos Domínguez…"
                            className={`mt-1 ${INPUT_CLASS}`}
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="w-44">
                          <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                            Valor flete / envío (COP)
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={shippingFee}
                            onChange={(e) => setShippingFee(e.target.value)}
                            className={`mt-1 ${INPUT_CLASS}`}
                          />
                        </div>

                        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={saveAddressCrm}
                            onChange={(e) => setSaveAddressCrm(e.target.checked)}
                            className="size-4 rounded accent-brand-500"
                          />
                          Guardar dirección en CRM del cliente
                        </label>
                      </div>
                    </section>
                  )}

                  {modality === "onsite" && (
                    <section className="space-y-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        2. Atención en sitio
                      </h2>
                      <div className="flex flex-wrap gap-1.5">
                        {ONSITE_QUICK_TABLES.map((quick) => {
                          const active = table === quick;
                          return (
                            <button
                              key={quick}
                              type="button"
                              onClick={() => setTable(quick)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                                active
                                  ? "border-[#190088] bg-[#190088] text-white dark:border-brand-500 dark:bg-brand-500"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                              }`}
                            >
                              {quick}
                            </button>
                          );
                        })}
                      </div>
                      <div>
                        <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                          Mesa o zona de atención
                        </label>
                        <input
                          type="text"
                          value={table}
                          onChange={(e) => setTable(e.target.value)}
                          placeholder="Ej. Mesa 4, Barra principal, Terraza…"
                          className={`mt-1 ${INPUT_CLASS}`}
                        />
                      </div>
                    </section>
                  )}

                  {modality === "pickup" && (
                    <section className="border-t border-gray-100 pt-4 dark:border-gray-800">
                      <div className="flex items-center gap-2.5 rounded-xl border border-violet-200/70 bg-violet-50/50 px-3.5 py-2.5 text-xs text-violet-900 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-200">
                        <BuildingStorefrontIcon className="size-4 shrink-0 text-violet-600 dark:text-violet-300" />
                        <span>
                          El cliente recogerá su pedido en tienda (sin cobro de domicilio).
                        </span>
                      </div>
                    </section>
                  )}

                  {/* 3. Payment Method, Transfer Callout & Cash/COD Calculator */}
                  <section className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      3. Pago y programación
                    </h2>

                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {(["transfer", "cash", "card", "cod"] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(method);
                            if (error) setError(null);
                          }}
                          className={`rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                            paymentMethod === method
                              ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                          }`}
                        >
                          {PAYMENT_METHOD_LABELS[method]}
                        </button>
                      ))}
                    </div>

                    {/* Bank account / transfer instructions callout */}
                    {paymentMethod === "transfer" && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-3 text-xs dark:border-indigo-500/30 dark:bg-indigo-500/10">
                        <BuildingLibraryIcon className="mt-0.5 size-4 shrink-0 text-[#190088] dark:text-indigo-300" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[#190088] dark:text-indigo-200">
                            Instrucciones de transferencia · {businessName}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                            Comparte el enlace o QR del comprobante al crear el pedido (Nequi / Daviplata / Bancolombia). Recuerda validar el comprobante de transferencia antes de despachar.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Cash / Contra entrega tender calculator */}
                    {supportsCashCalculator && (
                      <div
                        className={`rounded-xl border p-3 ${
                          isPaidWithInsufficient
                            ? "border-error-300 bg-error-50/70 dark:border-error-500/40 dark:bg-error-500/10"
                            : "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                          <BanknotesIcon className="size-3.5" />
                          Calculadora de cambio ({PAYMENT_METHOD_LABELS[paymentMethod]})
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor="create-order-paid-with"
                              className="block text-[10.5px] font-semibold text-gray-600 dark:text-gray-300"
                            >
                              Paga con (COP)
                            </label>
                            <input
                              id="create-order-paid-with"
                              type="number"
                              min={0}
                              step={1000}
                              value={paidWith}
                              onChange={(e) => {
                                setPaidWith(e.target.value);
                                if (error) setError(null);
                              }}
                              placeholder="Ej. 100000"
                              className={`mt-1 h-8 w-full rounded-lg border bg-white px-2 text-xs text-ink-body outline-none dark:bg-gray-900 dark:text-gray-100 ${
                                isPaidWithInsufficient
                                  ? "border-error-400 focus:border-error-500"
                                  : "border-gray-300 dark:border-gray-700"
                              }`}
                            />
                          </div>
                          <div>
                            <span className="block text-[10.5px] font-semibold text-gray-600 dark:text-gray-300">
                              Vueltas / Cambio
                            </span>
                            <div
                              className={`mt-1 flex h-8 items-center rounded-lg px-2 text-xs font-bold tabular-nums ${
                                changeDue !== null && changeDue < 0
                                  ? "bg-error-100/80 text-error-700 dark:bg-error-500/20 dark:text-error-300"
                                  : "bg-white text-emerald-700 dark:bg-gray-900 dark:text-emerald-300"
                              }`}
                            >
                              {changeDue === null
                                ? "—"
                                : changeDue < 0
                                  ? `Falta ${formatCOP(Math.abs(changeDue))}`
                                  : formatCOP(changeDue)}
                            </div>
                          </div>
                        </div>
                        {isPaidWithInsufficient && (
                          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-error-600 dark:text-error-400">
                            <ExclamationTriangleIcon className="size-3.5 shrink-0" />
                            El monto recibido debe ser igual o mayor al total del pedido ({formatCOP(total)}).
                          </p>
                        )}
                      </div>
                    )}

                    {/* Workflow toggles */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-gray-200/80 px-3 py-2 text-xs dark:border-gray-800">
                        <span className="font-semibold text-ink-body dark:text-gray-200">
                          Pagado
                        </span>
                        <input
                          type="checkbox"
                          checked={paid}
                          onChange={(e) => setPaid(e.target.checked)}
                          className="size-4 accent-brand-500"
                        />
                      </label>

                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-gray-200/80 px-3 py-2 text-xs dark:border-gray-800">
                        <span className="font-semibold text-ink-body dark:text-gray-200">
                          Confirmar ya
                        </span>
                        <input
                          type="checkbox"
                          checked={confirmOnCreate}
                          disabled={Boolean(scheduledFor)}
                          onChange={(e) => setConfirmOnCreate(e.target.checked)}
                          className="size-4 accent-brand-500"
                        />
                      </label>

                      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-gray-200/80 px-3 py-2 text-xs dark:border-gray-800">
                        <span className="font-semibold text-ink-body dark:text-gray-200">
                          Urgente (SLA)
                        </span>
                        <input
                          type="checkbox"
                          checked={urgent}
                          onChange={(e) => setUrgent(e.target.checked)}
                          className="size-4 accent-brand-500"
                        />
                      </label>
                    </div>

                    {/* Schedule control */}
                    <div>
                      {scheduledFor ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs dark:border-violet-500/30 dark:bg-violet-500/10">
                          <div className="flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300">
                            <CalendarDaysIcon className="size-4 shrink-0" />
                            <span>
                              Programado:{" "}
                              {new Date(scheduledFor).toLocaleString("es-CO", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setScheduleModalOpen(true)}
                              className="text-[11px] font-bold text-violet-700 underline cursor-pointer dark:text-violet-300"
                            >
                              Cambiar
                            </button>
                            <button
                              type="button"
                              onClick={() => setScheduledFor(null)}
                              aria-label="Quitar programación"
                              className="text-gray-400 hover:text-error-500 cursor-pointer"
                            >
                              <XMarkIcon className="size-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setScheduleModalOpen(true)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-700 cursor-pointer dark:border-gray-700 dark:text-gray-300 dark:hover:border-violet-500"
                        >
                          <CalendarDaysIcon className="size-4" />
                          Programar entrega para otra fecha
                        </button>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-[11.5px] font-bold text-ink-body dark:text-gray-200">
                        Notas del pedido
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Instrucciones especiales de preparación o entrega…"
                        className="mt-1 w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-ink-body outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </section>
                </div>

                {/* RIGHT COLUMN (#F7F7F5): Live Summary + Searchable Catalog Dropdown + Itemized Cart + Extras + CTA */}
                <div className="flex flex-col justify-between gap-4 border-t border-gray-200/80 bg-[#F7F7F5] p-6 lg:border-l lg:border-t-0 dark:border-gray-800 dark:bg-gray-800/50">
                  <div className="space-y-4">
                    {/* Live Summary Header */}
                    <div className="flex items-center justify-between rounded-2xl border border-gray-200/80 bg-white px-4 py-3 shadow-theme-xs dark:border-gray-700/80 dark:bg-gray-900">
                      <div>
                        <div className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400">
                          Resumen en vivo
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                          {totalCartUnits}{" "}
                          {totalCartUnits === 1 ? "producto" : "productos"} ·{" "}
                          {MODALITY_LABELS[modality]}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold tabular-nums text-[#190088] dark:text-white">
                          {formatCOP(total)}
                        </div>
                        <div className="text-[10.5px] text-gray-400">
                          {PAYMENT_METHOD_LABELS[paymentMethod]}
                        </div>
                      </div>
                    </div>

                    {/* Searchable Catalog Dropdown & Selector */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Productos del catálogo
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowCustomItem((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-brand-50 cursor-pointer dark:border-brand-500/30 dark:bg-gray-900 dark:text-brand-300"
                        >
                          <PlusIcon className="size-3.5" />
                          {showCustomItem ? "Cerrar ítem libre" : "Ítem libre"}
                        </button>
                      </div>

                      {showCustomItem && (
                        <div className="grid grid-cols-1 gap-2 rounded-xl border border-brand-200/80 bg-white p-3 sm:grid-cols-12 dark:border-brand-500/30 dark:bg-gray-900">
                          <input
                            type="text"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="Nombre del producto *"
                            className={`sm:col-span-6 ${INPUT_CLASS}`}
                          />
                          <input
                            type="text"
                            value={customVariant}
                            onChange={(e) => setCustomVariant(e.target.value)}
                            placeholder="Variante"
                            className={`sm:col-span-6 ${INPUT_CLASS}`}
                          />
                          <input
                            type="number"
                            min={1}
                            value={customQty}
                            onChange={(e) => setCustomQty(e.target.value)}
                            placeholder="Cant."
                            className={`sm:col-span-4 ${INPUT_CLASS}`}
                          />
                          <input
                            type="number"
                            min={0}
                            value={customPrice}
                            onChange={(e) => setCustomPrice(e.target.value)}
                            placeholder="Precio COP"
                            className={`sm:col-span-8 ${INPUT_CLASS}`}
                          />
                          <div className="flex justify-end sm:col-span-12">
                            <Button
                              size="sm"
                              variant="primary"
                              type="button"
                              onClick={addCustomItem}
                            >
                              Agregar al pedido
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Searchable dropdown trigger */}
                      <div ref={catalogDropdownRef} className="relative">
                        <div className="relative">
                          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={catalogQuery}
                            onFocus={() => setCatalogDropdownOpen(true)}
                            onChange={(e) => {
                              setCatalogQuery(e.target.value);
                              setCatalogDropdownOpen(true);
                            }}
                            placeholder="Buscar y agregar producto del catálogo…"
                            className={`${INPUT_CLASS} pl-9 pr-8`}
                          />
                          {catalogQuery && (
                            <button
                              type="button"
                              onClick={() => setCatalogQuery("")}
                              aria-label="Limpiar búsqueda de catálogo"
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                              <XMarkIcon className="size-3.5" />
                            </button>
                          )}
                        </div>

                        {catalogDropdownOpen && (
                          <div className="absolute left-0 right-0 top-11 z-30 max-h-60 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg custom-scrollbar dark:border-gray-700 dark:bg-gray-900">
                            {availableProducts.length === 0 ? (
                              <div className="py-5 text-center text-xs text-gray-500 dark:text-gray-400">
                                <p>
                                  {catalogProducts.length === 0
                                    ? "Tu catálogo no tiene productos disponibles aún."
                                    : "Sin coincidencias en el catálogo."}
                                </p>
                                {catalogProducts.length === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onOpenCatalog();
                                    }}
                                    className="mt-1.5 font-bold text-brand-600 underline cursor-pointer dark:text-brand-400"
                                  >
                                    Ir al catálogo
                                  </button>
                                )}
                              </div>
                            ) : (
                              availableProducts.map((product) => {
                                const thumb =
                                  product.image ||
                                  assignSmartPhoto(product.name, product.category);
                                return (
                                  <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => {
                                      addCatalogProduct(product);
                                      setCatalogDropdownOpen(false);
                                    }}
                                    className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-gray-50 cursor-pointer dark:hover:bg-gray-800"
                                  >
                                    <img
                                      src={thumb}
                                      alt={product.name}
                                      className="size-9 shrink-0 rounded-lg object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-xs font-bold text-ink-body dark:text-white">
                                        {product.name}
                                      </div>
                                      <div className="truncate text-[10.5px] text-gray-400">
                                        {product.category}
                                      </div>
                                    </div>
                                    <span className="shrink-0 text-xs font-bold tabular-nums text-[#190088] dark:text-brand-400">
                                      {formatCOP(product.price)}
                                    </span>
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                                      <PlusIcon className="size-3.5" />
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Itemized Cart Table with Thumbnails */}
                    <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5 dark:border-gray-700/80 dark:bg-gray-900">
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          Detalle del pedido ({totalCartUnits})
                        </span>
                        {cart.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setCart([])}
                            className="text-[11px] font-semibold text-gray-400 hover:text-error-500 cursor-pointer"
                          >
                            Vaciar
                          </button>
                        )}
                      </div>

                      {cart.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400 dark:border-gray-800">
                          Usa el buscador superior para agregar productos o crea un ítem libre.
                        </p>
                      ) : (
                        <div className="max-h-52 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                          {cart.map((item) => {
                            const thumb = item.image || assignSmartPhoto(item.name, "");
                            return (
                              <div
                                key={item.id}
                                className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-950/50"
                              >
                                <img
                                  src={thumb}
                                  alt={item.name}
                                  className="size-10 shrink-0 rounded-lg object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="truncate text-xs font-bold text-ink-body dark:text-white">
                                      {item.name}
                                    </div>
                                    <button
                                      type="button"
                                      aria-label={`Eliminar ${item.name}`}
                                      onClick={() =>
                                        setCart((prev) =>
                                          prev.filter((row) => row.id !== item.id),
                                        )
                                      }
                                      className="text-gray-400 hover:text-error-600 cursor-pointer"
                                    >
                                      <TrashIcon className="size-3.5" />
                                    </button>
                                  </div>

                                  <input
                                    type="text"
                                    value={item.variant}
                                    onChange={(e) =>
                                      setCart((prev) =>
                                        prev.map((row) =>
                                          row.id === item.id
                                            ? { ...row, variant: e.target.value }
                                            : row,
                                        ),
                                      )
                                    }
                                    placeholder="Variante o nota (opcional)"
                                    className="mt-1 h-7 w-full rounded-lg border border-gray-200 bg-white px-2 text-[11px] text-gray-700 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                  />

                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCart((prev) =>
                                            prev.map((row) =>
                                              row.id === item.id
                                                ? {
                                                    ...row,
                                                    quantity: Math.max(
                                                      1,
                                                      row.quantity - 1,
                                                    ),
                                                  }
                                                : row,
                                            ),
                                          )
                                        }
                                        className="flex size-6 items-center justify-center text-gray-600 hover:bg-gray-50 cursor-pointer dark:text-gray-300"
                                      >
                                        <MinusIcon className="size-3" />
                                      </button>
                                      <span className="w-6 text-center text-xs font-bold tabular-nums">
                                        {item.quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setCart((prev) =>
                                            prev.map((row) =>
                                              row.id === item.id
                                                ? { ...row, quantity: row.quantity + 1 }
                                                : row,
                                            ),
                                          )
                                        }
                                        className="flex size-6 items-center justify-center text-gray-600 hover:bg-gray-50 cursor-pointer dark:text-gray-300"
                                      >
                                        <PlusIcon className="size-3" />
                                      </button>
                                    </div>

                                    <span className="text-xs font-bold tabular-nums text-ink-body dark:text-white">
                                      {formatCOP(item.quantity * item.unitPrice)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Extra charges */}
                      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                        <span className="block text-[11px] font-bold text-gray-600 dark:text-gray-300">
                          Cargos adicionales (empaque, seguro, etc.)
                        </span>
                        <div className="mt-1.5 flex gap-1.5">
                          <input
                            type="text"
                            value={extraLabel}
                            onChange={(e) => setExtraLabel(e.target.value)}
                            placeholder="Concepto"
                            className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                          <input
                            type="number"
                            min={0}
                            value={extraAmount}
                            onChange={(e) => setExtraAmount(e.target.value)}
                            placeholder="Valor"
                            className="h-8 w-24 rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                          <button
                            type="button"
                            onClick={addExtraCharge}
                            aria-label="Agregar cargo adicional"
                            className="flex h-8 items-center justify-center rounded-lg bg-gray-100 px-2.5 text-xs font-bold text-gray-700 hover:bg-gray-200 cursor-pointer dark:bg-gray-800 dark:text-gray-200"
                          >
                            <PlusIcon className="size-3.5" />
                          </button>
                        </div>

                        {extraCharges.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {extraCharges.map((charge) => (
                              <div
                                key={charge.id}
                                className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1 text-xs dark:bg-gray-800/70"
                              >
                                <span className="truncate text-gray-600 dark:text-gray-300">
                                  {charge.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold tabular-nums">
                                    {formatCOP(charge.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExtraCharges((prev) =>
                                        prev.filter((c) => c.id !== charge.id),
                                      )
                                    }
                                    className="text-gray-400 hover:text-error-500 cursor-pointer"
                                  >
                                    <XMarkIcon className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Totals breakdown */}
                      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
                        <div className="flex justify-between text-gray-500 dark:text-gray-400">
                          <span>Subtotal</span>
                          <span className="tabular-nums">{formatCOP(subtotal)}</span>
                        </div>
                        {extrasTotal > 0 && (
                          <div className="flex justify-between text-gray-500 dark:text-gray-400">
                            <span>Cargos adicionales</span>
                            <span className="tabular-nums">
                              {formatCOP(extrasTotal)}
                            </span>
                          </div>
                        )}
                        {modality === "delivery" && (
                          <div className="flex justify-between text-gray-500 dark:text-gray-400">
                            <span>Envío</span>
                            <span className="tabular-nums">
                              {formatCOP(parsedShipping)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-gray-100 pt-2 text-sm font-extrabold text-[#190088] dark:border-gray-800 dark:text-white">
                          <span>Total a pagar</span>
                          <span className="tabular-nums">{formatCOP(total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit CTA inside Right Column */}
                  <div className="space-y-2.5 pt-2">
                    {error && (
                      <p className="flex items-center gap-1.5 rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-xs font-medium text-error-600 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400">
                        <ExclamationTriangleIcon className="size-4 shrink-0" />
                        <span>{error}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="md"
                        type="button"
                        onClick={onClose}
                        className="shrink-0"
                      >
                        Cancelar
                      </Button>
                      <button
                        type="submit"
                        disabled={isPaidWithInsufficient}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF3F1A] px-4 text-xs font-bold text-white shadow-theme-xs transition-colors hover:bg-[#e53614] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        <span>
                          {scheduledFor ? "Programar pedido" : "Registrar pedido"}
                        </span>
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] tabular-nums">
                          {formatCOP(total)}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </Modal>

        <ScheduleOrderModal
          open={scheduleModalOpen}
          initialIso={scheduledFor}
          scheduledOrders={ordersStore.scheduledOrders}
          onClose={() => setScheduleModalOpen(false)}
          onConfirm={(iso) => {
            setScheduledFor(iso);
            setConfirmOnCreate(false);
            setScheduleModalOpen(false);
          }}
        />
      </>
    );
  },
);

export default CreateOrderModal;
