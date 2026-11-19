import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { BusinessWizard, businessErrorMessage, businessesApi, BusinessesError, type Business } from "@/modules/businesses";
import { PageMeta } from "@/shell/meta";
import { WorkspaceLayout } from "../components/WorkspaceLayout";
import { WORKSPACE_PATH } from "../paths";

type Loaded =
  | { state: "loading" }
  | { state: "error"; id: string; message: string; missing: boolean }
  | { state: "ready"; business?: Business };

/** The page to create a business, or to edit one when the address carries its id. */
export default function BusinessSetupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded>(id ? { state: "loading" } : { state: "ready" });

  useEffect(() => {
    if (!id) {
      setLoaded((current) => (current.state === "ready" && !current.business ? current : { state: "ready" }));
      return;
    }
    let cancelled = false;
    setLoaded({ state: "loading" });
    businessesApi
      .get(id)
      .then((business) => !cancelled && setLoaded({ state: "ready", business }))
      .catch(
        (failure: unknown) =>
          !cancelled &&
          setLoaded({
            state: "error",
            id,
            message: businessErrorMessage(failure),
            missing: failure instanceof BusinessesError && failure.kind === "not-found",
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const goBack = () => navigate(WORKSPACE_PATH);
  const isError = Boolean(id) && loaded.state === "error" && loaded.id === id;
  const isLoading = Boolean(id) && !isError && (loaded.state !== "ready" || loaded.business?.id !== id);
  const wizardBusiness = id && loaded.state === "ready" && loaded.business?.id === id ? loaded.business : undefined;

  return (
    <WorkspaceLayout section={id ? "Editar negocio" : "Crear negocio"}>
      <PageMeta title={id ? "Necto · Editar negocio" : "Necto · Crear negocio"} />
      {isLoading && (
        <p className="bs-loading" role="status">
          Cargando el negocio…
        </p>
      )}
      {isError && loaded.state === "error" && (
        <div className="bs-state" role="alert">
          <p>{loaded.message}</p>
          <button type="button" onClick={goBack}>
            Volver a mis negocios
          </button>
        </div>
      )}
      {!isLoading && !isError && (
        // The key makes a different business start a fresh form instead of reusing the previous one's state.
        <BusinessWizard key={wizardBusiness?.id ?? "new"} business={wizardBusiness} onCancel={goBack} onSaved={goBack} />
      )}
    </WorkspaceLayout>
  );
}
