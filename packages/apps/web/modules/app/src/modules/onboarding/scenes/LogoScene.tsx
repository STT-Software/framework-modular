import { useRef } from "react";
import { OnboardingLogo } from "../components/OnboardingLogo";
import { TAGLINE_PATH_COUNT } from "../components/logoPaths";
import { useSceneMotion } from "../hooks/useSceneMotion";

/** Escena 0: el logotipo se arma trazo a trazo. */
export function LogoScene() {
  const ref = useRef<HTMLElement>(null);

  useSceneMotion(
    ref,
    (root, motion) => {
      const paths = [...root.querySelectorAll(".ob-hero-logo path")];
      // Marca y palabra: suben con un leve desenfoque, una tras otra.
      paths.slice(TAGLINE_PATH_COUNT).forEach((path, i) =>
        motion(
          path,
          [
            { opacity: 0, transform: "translateY(15px) scale(.88)", filter: "blur(3px)" },
            { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" },
          ],
          { delay: 100 + i * 90 },
        ),
      );
      // El lema aparece al final.
      paths.slice(0, TAGLINE_PATH_COUNT).forEach((path) =>
        motion(path, [{ opacity: 0 }, { opacity: 1 }], { delay: 600, duration: 500 }),
      );
      motion(
        root.querySelector(".ob-logo-aura"),
        [
          { opacity: 0, transform: "translate(-50%,-50%) scale(.6)" },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
        ],
        { duration: 1100 },
      );
      motion(
        root.querySelector(".ob-logo-caption"),
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { delay: 800, duration: 500 },
      );
    },
    { delay: 0, step: 0, distance: 0 },
  );

  return (
    <section
      ref={ref}
      className="ob-scene ob-scene-logo"
      aria-label="Necto, tu próxima conexión empieza aquí"
    >
      <div className="ob-logo-aura" aria-hidden="true" />
      <div className="ob-hero-logo">
        <OnboardingLogo width={161} height={23} />
      </div>
      <p className="ob-logo-caption">Todo empieza con una conexión.</p>
    </section>
  );
}
