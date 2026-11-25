import { TruckIcon } from "@heroicons/react/24/outline";

import type { Carrier } from "../domain/carrierDirectory";

const SIZES = {
  sm: { box: "h-7 w-16", icon: "size-4" },
  md: { box: "h-9 w-[96px]", icon: "size-5" },
  lg: { box: "h-11 w-[120px]", icon: "size-6" },
} as const;

export interface CarrierLogoProps {
  carrier: Carrier | undefined;

  name?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export const CarrierLogo = ({
  carrier,
  name,
  size = "md",
  className = "",
}: CarrierLogoProps) => {
  const m = SIZES[size];
  const background = !carrier?.logo
    ? "bg-[#ECECEC] dark:bg-white/[0.08]"
    : carrier.logoBackground === "dark"
      ? "bg-[#212121] ring-1 ring-black/10 dark:ring-white/15"
      : "bg-white ring-1 ring-[#ECECEC] dark:ring-white/10";

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md px-1.5 ${m.box} ${background} ${className}`}

      title={carrier?.name ?? name}
    >
      {carrier?.logo ? (
        <img
          src={carrier.logo}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain"
        />
      ) : (
        <TruckIcon className={`${m.icon} text-gray-400 dark:text-white/40`} aria-hidden="true" />
      )}
    </span>
  );
};

export default CarrierLogo;
