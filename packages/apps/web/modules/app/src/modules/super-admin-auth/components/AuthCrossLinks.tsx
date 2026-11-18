import { Link } from "react-router";

const BUSINESS_ACCESS_PATH = "/business/access";

interface AuthCrossLinksProps {
  prompt: string;
  actionLabel: string;
  to: string;
  className?: string;
}

/** Shared navigation footer below super-admin auth forms: sibling auth route + business access door. */
export function AuthCrossLinks({ prompt, actionLabel, to, className = "mt-7" }: AuthCrossLinksProps) {
  return (
    <>
      <p className={`${className} text-[14px] font-normal text-[#212121] dark:text-[#ECECEC]`}>
        {prompt}
        <Link to={to} className="ml-1 font-bold text-[#190088] hover:underline dark:text-[#97D6DF]">
          {actionLabel}
        </Link>
      </p>
      {/* Otra puerta, otra persona: quien administra un negocio entra con su correo y un código, no con usuario y contraseña. */}
      <p className="mt-3 text-[14px] font-normal text-[#212121] dark:text-[#ECECEC]">
        ¿Administras un negocio?
        <Link
          to={BUSINESS_ACCESS_PATH}
          className="ml-1 font-bold text-[#190088] hover:underline dark:text-[#97D6DF]"
        >
          Entra a tu negocio <span aria-hidden="true">↗</span>
        </Link>
      </p>
    </>
  );
}
