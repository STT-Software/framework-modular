import QRCode from "qrcode";
import {
  formatCOP,
  PAYMENT_METHOD_LABELS,
  type Order,
} from "./order";

const FALLBACK_CHECKOUT_ORIGIN = "https://necto.app";

/**
 * Generates a deterministic checkout URL matching CheckoutGlobalPayPage's
 * query contract (?ref=&total=&cliente=&org=).
 */
export function buildPaymentLink(
  order: Order,
  origin?: string,
  businessId?: string,
): string {
  const baseOrigin =
    origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : FALLBACK_CHECKOUT_ORIGIN);
  const cleanOrigin = baseOrigin.replace(/\/+$/, "");
  const ref = encodeURIComponent(order.code);
  const total = Math.max(0, Math.round(order.total));
  const cliente = encodeURIComponent(order.customerName);
  const orgSuffix = businessId ? `&org=${encodeURIComponent(businessId)}` : "";

  return `${cleanOrigin}/checkout?ref=${ref}&total=${total}&cliente=${cliente}${orgSuffix}`;
}

/**
 * Formats a friendly WhatsApp payment request message with itemized lines,
 * shipping, extra charges, total, payment method, and checkout link.
 */
export function buildPaymentMessage(
  order: Order,
  businessName: string,
  origin?: string,
  businessId?: string,
): string {
  const firstName = order.customerName.trim().split(/\s+/)[0] || "cliente";
  const storeName = businessName.trim() || "nuestro negocio";
  const lines: string[] = [
    `Hola ${firstName}, aquí tienes el resumen de cobro de tu pedido *${order.code}* en *${storeName}*:`,
    "",
  ];

  for (const item of order.items) {
    const variantSuffix = item.variant ? ` (${item.variant})` : "";
    const lineTotal = item.quantity * item.unitPrice;
    lines.push(
      `• ${item.quantity} × ${item.name}${variantSuffix}: ${formatCOP(lineTotal)}`,
    );
  }

  for (const extra of order.extraCharges) {
    lines.push(`• ${extra.label}: ${formatCOP(extra.amount)}`);
  }

  if (order.shippingFee > 0) {
    lines.push(`• Envío: ${formatCOP(order.shippingFee)}`);
  }

  lines.push("");
  lines.push(`*Total a pagar: ${formatCOP(order.total)}*`);
  lines.push(`Medio de pago: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`);
  lines.push(
    `Estado del pago: ${order.paid ? "Pagado" : "Pendiente de pago"}`,
  );

  if (!order.paid) {
    lines.push("");
    lines.push(
      `Enlace de pago seguro: ${buildPaymentLink(order, origin, businessId)}`,
    );
    lines.push("Una vez realices el pago, envíanos el comprobante por este chat.");
  }

  return lines.join("\n");
}

/**
 * Generates a real, scannable PNG QR code data URL asynchronously using `qrcode`.
 */
export async function generateQrDataUrl(
  payload: string,
  options?: { width?: number; dark?: string; light?: string },
): Promise<string> {
  const content = payload.trim() || FALLBACK_CHECKOUT_ORIGIN;
  return QRCode.toDataURL(content, {
    width: options?.width ?? 220,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: options?.dark ?? "#190088",
      light: options?.light ?? "#FFFFFF",
    },
  });
}

/**
 * Renders a real, ISO-18004 scannable QR code SVG data URL synchronously
 * via `QRCode.create`.
 */
export function generateQrSvgDataUrl(
  payload: string,
  options?: { dark?: string; light?: string },
): string {
  const content = payload.trim() || FALLBACK_CHECKOUT_ORIGIN;
  const qr = QRCode.create(content, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const quiet = 2;
  const total = size + quiet * 2;
  const dark = options?.dark ?? "#111827";
  const light = options?.light ?? "#FFFFFF";

  const rects: string[] = [];
  for (let r = 0; r < size; r += 1) {
    let runStart = -1;
    for (let c = 0; c <= size; c += 1) {
      const isDark = c < size && Boolean(qr.modules.get(r, c));
      if (isDark && runStart === -1) {
        runStart = c;
      } else if (!isDark && runStart !== -1) {
        rects.push(
          `<rect x="${runStart + quiet}" y="${r + quiet}" width="${c - runStart}" height="1"/>`,
        );
        runStart = -1;
      }
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<g fill="${dark}">${rects.join("")}</g>` +
    `</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
