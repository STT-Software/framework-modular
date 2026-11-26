import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { PageMeta } from "@/shell/meta";
import { OrdersStore } from "../stores/OrdersStore";
import { ConversationsStore } from "../stores/ConversationsStore";

const GlobalPayLogo: React.FC<{ className?: string }> = ({
  className = "h-10",
}) => (
  <div className={`flex items-center gap-3 select-none ${className}`}>
    <svg
      className="h-10 w-10 flex-shrink-0"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M50 50 C50 30 65 15 75 25 C85 35 70 50 50 50 Z" fill="#0284c7" opacity="0.95" />
      <path d="M50 50 C70 50 85 65 75 75 C65 85 50 70 50 50 Z" fill="#0ea5e9" opacity="0.95" />
      <path d="M50 50 C50 70 35 85 25 75 C15 65 30 50 50 50 Z" fill="#f59e0b" opacity="0.95" />
      <path d="M50 50 C30 50 15 35 25 25 C35 15 50 30 50 50 Z" fill="#1e3a8a" opacity="0.95" />
      <path d="M50 50 C55 35 75 35 70 48 C65 60 55 52 50 50 Z" fill="#ef4444" opacity="0.9" />
      <path d="M50 50 C65 55 65 75 52 70 C40 65 48 55 50 50 Z" fill="#ea580c" opacity="0.9" />
      <path d="M50 50 C45 65 25 65 30 52 C35 40 45 48 50 50 Z" fill="#a855f7" opacity="0.9" />
      <path d="M50 50 C35 45 35 25 48 30 C60 35 52 45 50 50 Z" fill="#14b8a6" opacity="0.9" />
      <circle cx="50" cy="50" r="6" fill="#ffffff" />
    </svg>
    <div className="flex flex-col leading-none">
      <div className="flex items-baseline text-2xl font-black tracking-tight">
        <span className="text-[#152e59]">Global</span>
        <span className="text-[#ea7a24]">Pay</span>
      </div>
      <div className="text-[11px] font-semibold text-gray-500 tracking-wide mt-0.5 flex items-center gap-1">
        <span>de</span>
        <span className="text-[#152e59] font-bold">Redeban</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] inline-block" />
      </div>
    </div>
  </div>
);

function formatCheckoutCOP(value: number): string {
  const formatted = Number(value).toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$ ${formatted}`;
}

export const CheckoutGlobalPayPage: React.FC = () => {
  const { ref } = useParams<{ ref?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const businessId = searchParams.get("org") || "";
  const businessName = searchParams.get("negocio") || "Necto Pedidos";

  const [firstName, setFirstName] = useState(searchParams.get("nombre") || "");
  const [lastName, setLastName] = useState(searchParams.get("apellido") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [reference, setReference] = useState(
    ref || searchParams.get("ref") || "WEB-0001",
  );
  const [description, setDescription] = useState(
    searchParams.get("descripcion") || `${businessName} - Orden`,
  );
  const [currency] = useState("COP");
  const [total, setTotal] = useState<number>(
    Number(searchParams.get("total")) || 56900,
  );
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [termsError, setTermsError] = useState<string | null>(null);

  const [paymentModal, setPaymentModal] = useState<"card" | "pse" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [txId, setTxId] = useState("");
  const [usedMethod, setUsedMethod] = useState<"card" | "pse">("card");

  const [cardNumber, setCardNumber] = useState("4532 •••• •••• 8920");
  const [cardExpiry, setCardExpiry] = useState("11/28");
  const [cardCvv, setCardCvv] = useState("892");
  const [cardInstallments, setCardInstallments] = useState("1");

  const [pseBank, setPseBank] = useState("Bancolombia");
  const [psePersonType, setPsePersonType] = useState("natural");
  const [pseDocument, setPseDocument] = useState("1020304050");

  const initializedKeyRef = useRef<string>("");

  useEffect(() => {
    const initKey = `${businessId}|${ref ?? ""}|${businessName}`;
    if (initializedKeyRef.current === initKey) return;
    initializedKeyRef.current = initKey;

    const paramNombre = searchParams.get("nombre") || "";
    const paramApellido = searchParams.get("apellido") || "";
    const paramCustomer = searchParams.get("cliente");

    if (paramCustomer && (!paramNombre || !paramApellido)) {
      const parts = paramCustomer.trim().split(/\s+/);
      if (parts.length >= 2) {
        if (!paramNombre) setFirstName(parts[0]);
        if (!paramApellido) setLastName(parts.slice(1).join(" "));
      } else if (parts.length === 1) {
        if (!paramNombre) setFirstName(parts[0]);
        if (!paramApellido) setLastName("Cliente");
      }
    } else if (!paramNombre && !paramApellido) {
      setFirstName("Cliente");
      setLastName("Necto");
    }

    const initialRef = ref || searchParams.get("ref") || "WEB-0001";
    if (businessId && initialRef) {
      const ordersStore = new OrdersStore(businessId);
      const found = ordersStore.byCode(initialRef) ?? ordersStore.byId(initialRef);
      if (found) {
        setTotal(found.total);
        setReference(found.code);
        if (!searchParams.get("descripcion")) {
          setDescription(`${businessName} - Orden #${found.code}`);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, ref, businessName]);

  const processPayment = () => {
    if (!acceptTerms) {
      setTermsError(
        "Debes aceptar la Política de tratamiento de datos personales para continuar.",
      );
      return;
    }
    setTermsError(null);
    setProcessing(true);
    setUsedMethod(paymentModal || "card");

    setTimeout(() => {
      const txCode = "RED-" + Math.floor(100000 + Math.random() * 900000);
      setTxId(txCode);
      setProcessing(false);
      setPaymentModal(null);
      setApproved(true);

      if (businessId && reference) {
        const ordersStore = new OrdersStore(businessId);
        const found = ordersStore.byCode(reference) ?? ordersStore.byId(reference);
        if (found) {
          if (!found.paid) {
            ordersStore.togglePaid(found.id, "GlobalPay Redeban");
          }
          if (found.stage === "new") {
            ordersStore.moveOrder(found.id, "confirmed", "GlobalPay Redeban");
          }
          const updated = ordersStore.byId(found.id) ?? found;
          const convStore = new ConversationsStore(businessId, ordersStore.orders);
          convStore.notifyOrderEvent(updated, "paid", businessName);
        }
      }
    }, 1200);
  };

  return (
    <>
      <PageMeta
        title={`GlobalPay Redeban · Orden #${reference}`}
        description="Pasarela de pago segura GlobalPay de Redeban"
      />
      <div className="min-h-screen bg-[#f4f5f8] flex flex-col font-sans text-gray-800 antialiased selection:bg-[#ea7a24] selection:text-white">
        <header className="w-full bg-white border-b border-gray-200/80 px-6 sm:px-14 py-4 flex items-center justify-between shadow-xs">
          <GlobalPayLogo />
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">
              Transacción segura cifrada a 256 bits
            </span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-4xl bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-10">
            {approved ? (
              <div className="py-8 text-center max-w-md mx-auto space-y-6">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircleIcon className="w-10 h-10" />
                </div>
                <div>
                  <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                    Transacción Aprobada
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900">
                    ¡Pago Exitoso!
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Tu orden ha sido confirmada y recibida por el comercio.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 text-left text-sm space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Comercio:</span>
                    <span className="font-semibold text-gray-800">
                      {businessName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Referencia:</span>
                    <span className="font-mono font-semibold text-gray-800">
                      #{reference}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">N° Transacción Redeban:</span>
                    <span className="font-mono text-gray-700">{txId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Método de pago:</span>
                    <span className="font-medium text-gray-800 uppercase">
                      {usedMethod === "pse"
                        ? "PSE (Débito en cuenta)"
                        : "Tarjeta de Crédito / Débito"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                    <span className="text-gray-900">Monto pagado:</span>
                    <span className="text-[#ea7a24] text-base">
                      {formatCheckoutCOP(total)} COP
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setApproved(false)}
                    className="px-5 py-2.5 rounded text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    Ver resumen de compra
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        businessId
                          ? `/catalogo-clientes/${businessId}?negocio=${encodeURIComponent(businessName)}`
                          : "/catalogo-clientes",
                      )
                    }
                    className="px-6 py-2.5 rounded text-xs font-semibold text-white bg-[#ea7a24] hover:bg-[#d96a17] transition-colors shadow-sm cursor-pointer"
                  >
                    Volver al catálogo
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                <div className="md:col-span-7 space-y-4">
                  <h1 className="text-xl font-medium text-[#ea7a24] tracking-tight">
                    Detalles de tu compra
                  </h1>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full h-9 px-3 text-sm bg-white border border-gray-300 rounded focus:border-[#ea7a24] focus:ring-1 focus:ring-[#ea7a24] outline-none transition-all"
                        placeholder="Nombre"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Apellido
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full h-9 px-3 text-sm bg-white border border-gray-300 rounded focus:border-[#ea7a24] focus:ring-1 focus:ring-[#ea7a24] outline-none transition-all"
                        placeholder="Apellido"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Correo electrónico
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-9 px-3 text-sm bg-white border border-gray-300 rounded focus:border-[#ea7a24] focus:ring-1 focus:ring-[#ea7a24] outline-none transition-all"
                        placeholder="ejemplo@correo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Número de referencia
                      </label>
                      <input
                        type="text"
                        value={reference}
                        readOnly
                        className="w-full h-9 px-3 text-sm bg-[#e9edf2] text-gray-700 font-mono border border-gray-300 rounded outline-none cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2 sm:gap-3">
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full h-9 px-3 text-sm bg-white border border-gray-300 rounded focus:border-[#ea7a24] focus:ring-1 focus:ring-[#ea7a24] outline-none transition-all truncate"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Moneda
                      </label>
                      <input
                        type="text"
                        value={currency}
                        readOnly
                        className="w-full h-9 px-3 text-sm bg-[#e9edf2] text-gray-700 font-bold text-center border border-gray-300 rounded outline-none cursor-not-allowed"
                      />
                    </div>
                    <div className="col-span-8 sm:col-span-5">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Valor de la compra
                      </label>
                      <input
                        type="text"
                        value={formatCheckoutCOP(total)}
                        readOnly
                        className="w-full h-9 px-3 text-sm bg-[#e9edf2] text-gray-800 font-semibold border border-gray-300 rounded outline-none cursor-not-allowed text-right sm:text-left"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <input
                        id="habeasData"
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => {
                          setAcceptTerms(e.target.checked);
                          if (e.target.checked) setTermsError(null);
                        }}
                        className="w-4 h-4 text-[#ea7a24] rounded border-gray-300 focus:ring-[#ea7a24] cursor-pointer"
                      />
                      <label
                        htmlFor="habeasData"
                        className="text-xs text-gray-600 select-none cursor-pointer"
                      >
                        Acepto{" "}
                        <span className="text-[#0284c7] hover:underline">
                          Política de tratamiento de datos personales
                        </span>
                      </label>
                    </div>
                    {termsError && (
                      <p className="text-xs font-medium text-red-600">
                        {termsError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="md:col-span-5 flex flex-col items-center justify-center text-center pt-2 sm:pt-4 md:border-l md:border-gray-100 md:pl-8">
                  <div className="mb-6">
                    <span className="text-3xl sm:text-4xl font-bold text-[#ea7a24] tracking-tight">
                      {formatCheckoutCOP(total)}{" "}
                      <span className="text-xl sm:text-2xl font-semibold">
                        COP
                      </span>
                    </span>
                  </div>

                  <h3 className="text-lg font-medium text-[#ea7a24] mb-4">
                    Métodos de pago
                  </h3>

                  <div className="w-full max-w-xs space-y-3">
                    <button
                      type="button"
                      onClick={() => setPaymentModal("card")}
                      className="w-full py-3 px-4 bg-[#ea933e] hover:bg-[#df832a] active:bg-[#c96f18] text-white text-xs font-bold uppercase tracking-wider rounded transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CreditCardIcon className="w-4 h-4" />
                      PAGAR CON TARJETA
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentModal("pse")}
                      className="w-full py-3 px-4 bg-[#ea933e] hover:bg-[#df832a] active:bg-[#c96f18] text-white text-xs font-bold uppercase tracking-wider rounded transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <BuildingOffice2Icon className="w-4 h-4" />
                      PAGAR CON PSE
                    </button>
                  </div>

                  <div className="mt-6 flex items-center gap-1.5 text-[11px] text-gray-400">
                    <LockClosedIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>Procesado por Redeban Multicolor S.A.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {paymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
              <div className="bg-[#ea7a24] text-white px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  {paymentModal === "card" ? (
                    <CreditCardIcon className="w-4 h-4" />
                  ) : (
                    <BuildingOffice2Icon className="w-4 h-4" />
                  )}
                  <span>
                    {paymentModal === "card"
                      ? "Pagar con Tarjeta de Crédito / Débito"
                      : "Pagar con PSE (Débito Bancario)"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  className="text-white/80 hover:text-white text-lg leading-none cursor-pointer"
                  aria-label="Cerrar modal de pago"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                {paymentModal === "card" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Número de tarjeta
                      </label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4532 0000 0000 0000"
                        className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-[#ea7a24] outline-none font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Vence (MM/AA)
                        </label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="12/28"
                          className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-[#ea7a24] outline-none text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          CVV
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          placeholder="123"
                          className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-[#ea7a24] outline-none text-center"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Cuotas
                      </label>
                      <select
                        value={cardInstallments}
                        onChange={(e) => setCardInstallments(e.target.value)}
                        className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-[#ea7a24] outline-none bg-white"
                      >
                        <option value="1">1 cuota (Sin interés)</option>
                        <option value="2">2 cuotas</option>
                        <option value="3">3 cuotas</option>
                        <option value="6">6 cuotas</option>
                        <option value="12">12 cuotas</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Selecciona tu Banco
                      </label>
                      <select
                        value={pseBank}
                        onChange={(e) => setPseBank(e.target.value)}
                        className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-[#ea7a24] outline-none bg-white font-medium"
                      >
                        <option value="Bancolombia">Bancolombia</option>
                        <option value="Davivienda">Davivienda</option>
                        <option value="Nequi">Nequi</option>
                        <option value="Daviplata">Daviplata</option>
                        <option value="Banco de Bogotá">Banco de Bogotá</option>
                        <option value="BBVA Colombia">BBVA Colombia</option>
                        <option value="Scotiabank Colpatria">
                          Scotiabank Colpatria
                        </option>
                        <option value="Banco de Occidente">
                          Banco de Occidente
                        </option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Tipo de Persona
                        </label>
                        <select
                          value={psePersonType}
                          onChange={(e) => setPsePersonType(e.target.value)}
                          className="w-full h-9 px-2 text-sm border border-gray-300 rounded focus:border-[#ea7a24] outline-none bg-white"
                        >
                          <option value="natural">Natural</option>
                          <option value="juridica">Jurídica</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Cédula / NIT
                        </label>
                        <input
                          type="text"
                          value={pseDocument}
                          onChange={(e) => setPseDocument(e.target.value)}
                          placeholder="N° de identificación"
                          className="w-full h-9 px-3 text-sm border border-gray-300 rounded focus:border-[#ea7a24] outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">
                      Serás redirigido de forma segura a la pasarela de tu entidad
                      bancaria registrada en PSE.
                    </p>
                  </div>
                )}

                {termsError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-2"
                  >
                    <div className="flex items-start gap-2 font-medium">
                      <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                      <span>{termsError}</span>
                    </div>
                    <label className="flex items-center gap-2 text-[11.5px] text-gray-700 cursor-pointer select-none pl-6">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => {
                          setAcceptTerms(e.target.checked);
                          if (e.target.checked) setTermsError(null);
                        }}
                        className="w-3.5 h-3.5 text-[#ea7a24] rounded border-gray-300 focus:ring-[#ea7a24] cursor-pointer"
                      />
                      <span>Acepto la Política de tratamiento de datos personales</span>
                    </label>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={processPayment}
                    className="w-full py-2.5 px-4 bg-[#ea7a24] hover:bg-[#d96a17] active:bg-[#c2590b] text-white text-sm font-semibold rounded transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        <span>Procesando pago con Redeban...</span>
                      </>
                    ) : (
                      <span>
                        Confirmar Pago de {formatCheckoutCOP(total)} COP
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="w-full bg-[#ea7a24] text-white py-2.5 px-4 text-center text-[11px] sm:text-xs font-normal tracking-wide shadow-inner">
          © 2018 2026 Copyright: GlobalPay Redeban®. Todos los derechos reservados.
        </footer>
      </div>
    </>
  );
};

export default CheckoutGlobalPayPage;
