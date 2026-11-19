import type { CSSProperties } from "react";
import type { QueueColor } from "../types";
import { Icon } from "./Icon";
import { colorHex, ICONS } from "./icons";

export const colorStyle = (color: QueueColor) => ({ "--nt-queue-color": colorHex(color) }) as CSSProperties;

export const QueueSymbol = ({ color }: { color: QueueColor }) => (
  <span className="nt-queue-symbol" style={colorStyle(color)}>
    <Icon paths={ICONS.queue} />
  </span>
);

/** El nombre de una fila con su color, como las etiquetas de los operadores. */
export const QueuePill = ({ name, color }: { name: string; color: QueueColor }) => (
  <span className="nt-queue-pill" style={colorStyle(color)}>
    <i />
    {name}
  </span>
);
