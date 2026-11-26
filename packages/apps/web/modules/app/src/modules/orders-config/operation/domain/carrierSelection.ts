import { CARRIERS, type Carrier } from "./carrierDirectory";

export interface CarrierPreferences {
  enabledIds: string[];
  favoriteId: string | null;
}

const VALID_CARRIER_IDS = new Set(CARRIERS.map((carrier) => carrier.id));

export const DEFAULT_CARRIER_PREFERENCES: CarrierPreferences = {
  enabledIds: CARRIERS.map((carrier) => carrier.id),
  favoriteId: "coordinadora",
};

function storageKey(businessId: string): string {
  return `necto.pedidos.carriers.${businessId || "default"}`;
}

function normalizePreferences(
  raw: Partial<CarrierPreferences> | null | undefined,
): CarrierPreferences {
  const hasExplicitEnabled = Array.isArray(raw?.enabledIds);
  const enabledIds = hasExplicitEnabled
    ? Array.from(
        new Set(
          raw.enabledIds!.filter(
            (id): id is string =>
              typeof id === "string" && VALID_CARRIER_IDS.has(id),
          ),
        ),
      )
    : [...DEFAULT_CARRIER_PREFERENCES.enabledIds];

  let favoriteId: string | null;
  if (raw?.favoriteId === null) {
    favoriteId = null;
  } else if (
    typeof raw?.favoriteId === "string" &&
    VALID_CARRIER_IDS.has(raw.favoriteId) &&
    enabledIds.includes(raw.favoriteId)
  ) {
    favoriteId = raw.favoriteId;
  } else if (raw?.favoriteId === undefined) {
    favoriteId =
      DEFAULT_CARRIER_PREFERENCES.favoriteId &&
      enabledIds.includes(DEFAULT_CARRIER_PREFERENCES.favoriteId)
        ? DEFAULT_CARRIER_PREFERENCES.favoriteId
        : null;
  } else {
    favoriteId = null;
  }

  return {
    enabledIds,
    favoriteId,
  };
}

export function loadCarrierPreferences(businessId: string): CarrierPreferences {
  if (typeof window === "undefined") {
    return {
      enabledIds: [...DEFAULT_CARRIER_PREFERENCES.enabledIds],
      favoriteId: DEFAULT_CARRIER_PREFERENCES.favoriteId,
    };
  }

  try {
    const serialized = window.localStorage.getItem(storageKey(businessId));
    if (!serialized) {
      return {
        enabledIds: [...DEFAULT_CARRIER_PREFERENCES.enabledIds],
        favoriteId: DEFAULT_CARRIER_PREFERENCES.favoriteId,
      };
    }
    const parsed = JSON.parse(serialized) as Partial<CarrierPreferences>;
    return normalizePreferences(parsed);
  } catch {
    return {
      enabledIds: [...DEFAULT_CARRIER_PREFERENCES.enabledIds],
      favoriteId: DEFAULT_CARRIER_PREFERENCES.favoriteId,
    };
  }
}

export function saveCarrierPreferences(
  businessId: string,
  prefs: CarrierPreferences,
): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizePreferences(prefs);
    window.localStorage.setItem(storageKey(businessId), JSON.stringify(normalized));
  } catch {
    // Ignore storage quota or private-mode restrictions.
  }
}

export function getEnabledCarriers(prefs: CarrierPreferences): Carrier[] {
  const enabledSet = new Set(prefs.enabledIds);
  const filtered = CARRIERS.filter((carrier) => enabledSet.has(carrier.id));
  return filtered.length > 0 ? filtered : [...CARRIERS];
}

export function getFavoriteCarrier(prefs: CarrierPreferences): Carrier | null {
  if (!prefs.favoriteId) return null;
  if (!prefs.enabledIds.includes(prefs.favoriteId)) return null;
  return CARRIERS.find((carrier) => carrier.id === prefs.favoriteId) ?? null;
}

export function getDefaultCarrier(prefs: CarrierPreferences): Carrier {
  const favorite = getFavoriteCarrier(prefs);
  if (favorite) return favorite;
  const enabled = getEnabledCarriers(prefs);
  return enabled[0] ?? CARRIERS[0];
}

export function toggleCarrierEnabled(
  prefs: CarrierPreferences,
  carrierId: string,
): { ok: true; value: CarrierPreferences } | { ok: false; error: string } {
  if (!VALID_CARRIER_IDS.has(carrierId)) {
    return { ok: false, error: "La transportadora seleccionada no es válida." };
  }

  const current = normalizePreferences(prefs);
  const isEnabled = current.enabledIds.includes(carrierId);

  if (isEnabled) {
    const enabledIds = current.enabledIds.filter((id) => id !== carrierId);
    const favoriteId =
      current.favoriteId === carrierId ? null : current.favoriteId;
    return { ok: true, value: { enabledIds, favoriteId } };
  }

  const enabledIds = CARRIERS.map((carrier) => carrier.id).filter(
    (id) => id === carrierId || current.enabledIds.includes(id),
  );
  return {
    ok: true,
    value: {
      enabledIds,
      favoriteId: current.favoriteId,
    },
  };
}

export function setFavoriteCarrier(
  prefs: CarrierPreferences,
  carrierId: string | null,
): CarrierPreferences {
  const current = normalizePreferences(prefs);
  if (carrierId === null) {
    return {
      enabledIds: current.enabledIds,
      favoriteId: null,
    };
  }
  if (!VALID_CARRIER_IDS.has(carrierId)) return current;

  const enabledIds = current.enabledIds.includes(carrierId)
    ? current.enabledIds
    : CARRIERS.map((carrier) => carrier.id).filter(
        (id) => id === carrierId || current.enabledIds.includes(id),
      );

  return {
    enabledIds,
    favoriteId: carrierId,
  };
}
