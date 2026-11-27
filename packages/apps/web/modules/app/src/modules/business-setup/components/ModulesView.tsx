import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/elements/ui/button";
import { WorkspaceAnnouncementBanner } from "@/components/configuration/WorkspaceAnnouncementBanner";
import { useElementVisibility } from "@/hooks";
import { moduleInfo } from "@/modules/businesses";
import { businessSetupStore } from "../stores/businessSetup.store";
import type { SetupStep } from "../types";
import { ModuleCardDecor } from "./ModuleCardDecor";
import { OperationsHeroArt, SetupHeroArt, TeamScheduleHeroArt } from "./SetupHeroArt";

const RESUME_LABELS: Record<SetupStep, string> = {
  data: "Continuar con los datos",
  schedule: "Continuar con horarios",
  category: "Continuar con el tipo de negocio",
  review: "Continuar con la revisión",
};

const HERO_SLIDE_INTERVAL_MS = 5600;
const isConfigurableModule = (moduleId: string): boolean => moduleId === "turnos" || moduleId === "pedidos";

type HeroSlideId = "workspace" | "operations" | "team";

interface ModulesViewProps {
  dashboardReady: boolean;
  onStart: () => void;
  onOpenStep: (step: SetupStep) => void;
  onConfigure: (moduleId: string) => void;
  onOpenOperation: (moduleId?: string) => void;
}

/**
 * Business Setup Home — NECTO Flat Editorial Workspace.
 * Rotating warm-cream hero banners (business storefront, connected operations, team & schedules)
 * with smart auto-pause + manual controls, clean module cards with organic corner geometry,
 * and collapsible NECTO announcements below.
 */
export const ModulesView = observer(
  ({ dashboardReady, onStart, onOpenStep, onConfigure, onOpenOperation }: ModulesViewProps) => {
    const { state, saving } = businessSetupStore;
    const heading = useRef<HTMLHeadingElement>(null);
    const newsRegionId = useId();
    const { ref: heroRef, isVisible: heroVisible } = useElementVisibility<HTMLElement>();

    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [instantFocus, setInstantFocus] = useState(false);
    const [newsOpen, setNewsOpen] = useState(false);

    const [slideIndex, setSlideIndex] = useState(0);
    const [slideDir, setSlideDir] = useState<"next" | "prev">("next");
    const [heroPaused, setHeroPaused] = useState(false);

    useEffect(() => {
      heading.current?.focus({ preventScroll: true });
    }, [state?.business.id]);

    const handleHighlight = useCallback((moduleId: string | null, viaKeyboard = false) => {
      setInstantFocus(viaKeyboard);
      setActiveModuleId(moduleId);
    }, []);

    const orderedModules = useMemo(() => {
      if (!state) return [];
      const configurable = state.modules.filter((m) => isConfigurableModule(m.id));
      const assigned = state.modules.filter((m) => !isConfigurableModule(m.id));
      return [...configurable, ...assigned];
    }, [state]);

    // Auto-rotate hero banners; pause on hover, active module interaction, hidden tab, offscreen, or reduced motion
    useEffect(() => {
      if (heroPaused || !heroVisible || activeModuleId !== null) return;
      if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      const id = window.setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        setSlideDir("next");
        setSlideIndex((prev) => (prev + 1) % 3);
      }, HERO_SLIDE_INTERVAL_MS);

      return () => window.clearInterval(id);
    }, [heroPaused, heroVisible, activeModuleId]);

    if (!state) return null;

    const { profile, progress } = state;
    const started = progress.visitedSteps.length > 0 || (progress.currentStep !== null && progress.currentStep !== "data");

    const primaryLabel = progress.baseReady
      ? "Revisar configuración base"
      : started
        ? RESUME_LABELS[progress.currentStep ?? "data"]
        : "Continuar con los datos";

    const subtitleText = progress.baseReady
      ? "Tu configuración base está lista. Administra o ajusta los módulos de tu espacio."
      : started
        ? "Tu avance está guardado. Retoma la configuración desde el último paso."
        : "Prepara los datos, horarios y tipo de negocio para dejar lista tu operación.";

    const configurableModules = orderedModules.filter((m) => isConfigurableModule(m.id));
    const readyConfigurableCount = configurableModules.filter((m) => m.settings.status === "ready").length;
    const totalCount = orderedModules.length;

    const allReady =
      progress.baseReady || (configurableModules.length > 0 && readyConfigurableCount === configurableModules.length);

    const readyPedidos = orderedModules.find((m) => m.id === "pedidos" && m.settings.status === "ready");
    const firstPending = configurableModules.find((m) => m.settings.status !== "ready");

    const opsCtaLabel = dashboardReady
      ? "Ir al dashboard general"
      : readyPedidos
        ? "Abrir operación de Pedidos"
        : firstPending
          ? `Configurar ${firstPending.name}`
          : primaryLabel;

    const handleOpsCta = () => {
      if (dashboardReady) {
        onOpenOperation();
        return;
      }
      if (readyPedidos) {
        onOpenOperation("pedidos");
        return;
      }
      if (firstPending) {
        onConfigure(firstPending.id);
        return;
      }
      onStart();
    };

    const slides: ReadonlyArray<{
      id: HeroSlideId;
      eyebrow: string;
      title: string;
      subtitle: string;
      ctaLabel: string;
      onCta: () => void;
      showDashboardSecondary?: boolean;
      dotLabel: string;
    }> = [
      {
        id: "workspace",
        eyebrow: "ESPACIO DE TRABAJO",
        title: profile.name,
        subtitle: subtitleText,
        ctaLabel: primaryLabel,
        onCta: onStart,
        showDashboardSecondary: dashboardReady,
        dotLabel: `Espacio de ${profile.name}`,
      },
      {
        id: "operations",
        eyebrow: "OPERACIÓN CONECTADA",
        title: "Tus módulos, en un solo pulso.",
        subtitle:
          "Supervisa filas, pedidos y estados desde un mismo espacio con todo conectado en tiempo real.",
        ctaLabel: opsCtaLabel,
        onCta: handleOpsCta,
        dotLabel: "Operación conectada",
      },
      {
        id: "team",
        eyebrow: "HORARIOS Y EQUIPO",
        title: "Un solo acceso para tu equipo.",
        subtitle:
          "Define el horario base una vez y da entrada a tus operadores con código único por correo.",
        ctaLabel: "Revisar horarios",
        onCta: () => onOpenStep("schedule"),
        dotLabel: "Horarios y equipo",
      },
    ];

    const currentSlide = slides[slideIndex] ?? slides[0];

    const goToSlide = (targetIndex: number) => {
      const normalized = (targetIndex + slides.length) % slides.length;
      if (normalized === slideIndex) return;
      setSlideDir(normalized > slideIndex ? "next" : "prev");
      setSlideIndex(normalized);
    };

    return (
      <section
        className="setup-home"
        data-instant-focus={instantFocus || undefined}
        aria-label={`Espacio de trabajo de ${profile.name}`}
      >
        {/* ROTATING HERO BANNER */}
        <header
          ref={heroRef}
          className="sh-hero"
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
        >
          <div className="sh-hero-copy">
            <div key={currentSlide.id} className="sh-hero-slide-copy" data-dir={slideDir}>
              <span className="sh-hero-eyebrow">{currentSlide.eyebrow}</span>
              {currentSlide.id === "workspace" ? (
                <h1 id="setup-home-name" ref={heading} tabIndex={-1} className="sh-hero-title">
                  {currentSlide.title}
                </h1>
              ) : (
                <>
                  <h1 id="setup-home-name" ref={heading} tabIndex={-1} className="no-sr-only">
                    {profile.name}
                  </h1>
                  <h2 className="sh-hero-title">{currentSlide.title}</h2>
                </>
              )}
              <p className="sh-hero-subtitle">{currentSlide.subtitle}</p>

              <div className="sh-hero-actions">
                <Button className="sh-hero-cta" disabled={saving} onClick={currentSlide.onCta}>
                  <span>{currentSlide.ctaLabel}</span>
                  <span className="sh-arrow" aria-hidden="true">→</span>
                </Button>

                {currentSlide.showDashboardSecondary && (
                  <Button
                    variant="outline"
                    className="sh-hero-secondary"
                    disabled={saving}
                    onClick={() => onOpenOperation()}
                  >
                    <span>Ir al dashboard general</span>
                    <span className="sh-arrow" aria-hidden="true">→</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="sh-hero-dots" role="tablist" aria-label="Banners del espacio de trabajo">
              {slides.map((slide, idx) => {
                const isActive = idx === slideIndex;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Banner ${idx + 1}: ${slide.dotLabel}`}
                    className="sh-hero-dot"
                    data-active={isActive || undefined}
                    onClick={() => goToSlide(idx)}
                  />
                );
              })}
            </div>
          </div>

          <div className="sh-hero-visual">
            <div key={currentSlide.id} className="sh-hero-slide-art" data-dir={slideDir}>
              {currentSlide.id === "workspace" && (
                <SetupHeroArt
                  businessName={profile.name}
                  verified={allReady}
                  modules={orderedModules.map((mod) => ({
                    id: mod.id,
                    name: mod.name,
                    ready: mod.settings.status === "ready",
                  }))}
                  activeModuleId={activeModuleId}
                  saving={saving}
                  onHighlight={handleHighlight}
                  onSelectModule={onConfigure}
                />
              )}
              {currentSlide.id === "operations" && <OperationsHeroArt />}
              {currentSlide.id === "team" && <TeamScheduleHeroArt />}
            </div>
          </div>
        </header>

        {/* MODULES SECTION */}
        <section className="sh-modules" aria-labelledby="sh-modules-heading">
          <h2 id="sh-modules-heading" className="sh-section-title">
            Tus módulos
          </h2>

          {totalCount > 0 ? (
            <ul className="sh-card-grid" data-single={totalCount === 1 || undefined}>
              {orderedModules.map((mod, idx) => {
                const configurable = isConfigurableModule(mod.id);
                const ready = mod.settings.status === "ready";
                const info = moduleInfo(mod.id);
                const isActive = activeModuleId === mod.id;
                const actionLabel = configurable
                  ? ready
                    ? "Ver configuración"
                    : "Configurar"
                  : "Ver datos del negocio";
                const showOperationLink = mod.id === "pedidos" && ready;

                return (
                  <li
                    key={mod.id}
                    className="sh-card"
                    data-active={isActive || undefined}
                    onMouseEnter={() => handleHighlight(mod.id, false)}
                    onMouseLeave={() => handleHighlight(null, false)}
                    onFocus={() => handleHighlight(mod.id, true)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        handleHighlight(null, true);
                      }
                    }}
                  >
                    <ModuleCardDecor variant={idx % 2 === 0 ? "a" : "b"} />

                    <div className="sh-card-top">
                      <div className="sh-card-main">
                        <span className="sh-card-icon" aria-hidden="true">
                          {info ? (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              dangerouslySetInnerHTML={{ __html: info.icon }}
                            />
                          ) : null}
                        </span>

                        <div className="sh-card-copy">
                          <h3 className="sh-card-title">{mod.name}</h3>
                          <p className="sh-card-desc">{mod.description}</p>
                        </div>
                      </div>

                      <span
                        className="sh-card-status"
                        data-kind={ready ? "ready" : configurable ? "pending" : "assigned"}
                      >
                        {ready ? (
                          <span className="sh-status-badge-check" aria-hidden="true">
                            <svg viewBox="0 0 16 16" fill="none">
                              <path
                                d="M4.2 8.2 6.8 10.8 11.8 5.4"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span className="sh-status-dot" aria-hidden="true" />
                        )}
                        <span>{ready ? "Configurado" : configurable ? "Por configurar" : "Asignado"}</span>
                      </span>
                    </div>

                    <div className="sh-card-actions">
                      <button
                        type="button"
                        className="sh-card-link"
                        disabled={saving}
                        onClick={() => onConfigure(mod.id)}
                      >
                        <span>{actionLabel}</span>
                        <span className="no-sr-only"> de {mod.name}</span>
                        <span className="sh-arrow" aria-hidden="true">→</span>
                      </button>

                      {showOperationLink && (
                        <button
                          type="button"
                          className="sh-card-op-link"
                          disabled={saving}
                          onClick={() => onOpenOperation("pedidos")}
                        >
                          <span>Abrir operación</span>
                          <span className="sh-arrow" aria-hidden="true">→</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="sh-empty">
              <h3 className="sh-empty-title">Aún no hay módulos asignados</h3>
              <p className="sh-empty-copy">
                Puedes preparar los datos de tu negocio. Tu superadministrador podrá habilitar sus
                funcionalidades desde su espacio.
              </p>
            </div>
          )}
        </section>

        {/* COLLAPSIBLE NECTO ANNOUNCEMENTS */}
        <section className="sh-news" aria-label="Novedades de NECTO">
          <button
            type="button"
            className="sh-news-trigger"
            aria-expanded={newsOpen}
            aria-controls={newsRegionId}
            data-open={newsOpen || undefined}
            onClick={() => setNewsOpen((prev) => !prev)}
          >
            <svg className="sh-news-caret" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4 2.2 8.8 6 4 9.8V2.2Z" fill="currentColor" />
            </svg>
            <span>Novedades de NECTO</span>
          </button>

          <div
            id={newsRegionId}
            className="sh-news-drawer"
            data-open={newsOpen || undefined}
            aria-hidden={!newsOpen}
          >
            <div className="sh-news-drawer-inner">
              {newsOpen ? <WorkspaceAnnouncementBanner /> : null}
            </div>
          </div>
        </section>
      </section>
    );
  },
);
