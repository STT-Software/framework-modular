import { observer } from "mobx-react-lite";
import { businessSetupStore } from "../stores/businessSetup.store";
import { CATEGORY_CARDS } from "./categories";
import { MiniMark } from "./MiniMark";
import { ModuleIcon } from "./ModuleIcon";

/** Paso 3: la categoría que registró el superadministrador, para confirmarla o ajustarla. "Otra" pide su descripción. */
export const CategoryPanel = observer(() => {
  const store = businessSetupStore;
  return (
    <section className="no-panel" aria-label="Tipo de negocio">
      <div className="no-category-intro">
        <span className="no-source-badge">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 4 4L19 6" />
          </svg>
          Desde superadministración
        </span>
        <p>Partimos de la categoría que ya registraste. Confírmala o ajústala para mantener la información de tu negocio al día.</p>
      </div>
      <fieldset className="no-category-fieldset">
        <legend className="no-sr-only">Categoría del negocio</legend>
        <div className="no-category-grid">
          {CATEGORY_CARDS.map((category) => (
            <label key={category.id} className="no-category-card">
              <input
                type="radio"
                name="no-category"
                value={category.id}
                aria-label={category.name}
                checked={store.categoryDraft === category.id}
                onChange={() => store.chooseCategory(category.id)}
              />
              <ModuleIcon color={category.color} icon={category.icon} />
              <strong>{category.name}</strong>
              <p>{category.description}</p>
              <span className="no-category-check" aria-hidden="true">
                ✓
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {store.categoryDraft === "other" && (
        <div className="no-card no-other-category">
          <div className="no-field">
            <label htmlFor="no-category-custom">
              ¿Cuál es el tipo de negocio? <span>*</span>
            </label>
            <input
              id="no-category-custom"
              value={store.categoryOther}
              maxLength={60}
              placeholder="Ej. Centro de experiencias"
              aria-describedby="no-category-error"
              aria-invalid={store.categoryError ? true : undefined}
              onChange={(event) => store.setCategoryOther(event.target.value)}
            />
          </div>
        </div>
      )}
      <p id="no-category-error" className="no-error" role="status" hidden={!store.categoryError}>
        {store.categoryError}
      </p>
      <div className="no-category-context">
        <MiniMark />
        <p>Esta categoría identifica a tu negocio. Las reglas específicas de cada módulo se configurarán en la siguiente etapa.</p>
      </div>
    </section>
  );
});
