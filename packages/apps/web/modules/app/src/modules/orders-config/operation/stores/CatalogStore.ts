import { makeAutoObservable, runInAction } from "mobx";
import type { OrdersProfileId } from "../../types";
import {
  assignSmartPhoto,
  parseCatalogBulkText,
  type CatalogFileEntry,
  type CatalogProduct,
} from "../domain/catalogDomain";
import {
  createCatalogProductsForProfile,
  getProfilePreset,
  isValidOrdersProfileId,
  readActiveBusinessProfile,
  writeActiveBusinessProfile,
} from "../domain/profilePresets";

export interface CatalogAlertBanner {
  tone: "success" | "error";
  message: string;
}

interface PersistedCatalogState {
  profile?: OrdersProfileId;
  products: CatalogProduct[];
  publishedSnapshot: string;
  fileLibrary: CatalogFileEntry[];
  folders: string[];
}

const DEFAULT_FOLDERS = ["General", "Productos", "Promociones"];

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readPersistedCatalog(key: string): PersistedCatalogState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedCatalogState>;
    if (!Array.isArray(parsed.products)) return null;
    return {
      profile: isValidOrdersProfileId(parsed.profile) ? parsed.profile : undefined,
      products: parsed.products,
      publishedSnapshot:
        typeof parsed.publishedSnapshot === "string"
          ? parsed.publishedSnapshot
          : JSON.stringify(parsed.products),
      fileLibrary: Array.isArray(parsed.fileLibrary) ? parsed.fileLibrary : [],
      folders:
        Array.isArray(parsed.folders) && parsed.folders.length > 0
          ? parsed.folders
          : [...DEFAULT_FOLDERS],
    };
  } catch {
    return null;
  }
}

function writePersistedCatalog(key: string, state: PersistedCatalogState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Ignore storage quota or restricted-mode errors.
  }
}

export class CatalogStore {
  profile: OrdersProfileId = "general";
  products: CatalogProduct[] = [];
  publishedSnapshot = "[]";
  fileLibrary: CatalogFileEntry[] = [];
  folders: string[] = [...DEFAULT_FOLDERS];

  saving = false;
  publishedSuccess = false;
  alertBanner: CatalogAlertBanner | null = null;

  private readonly businessId: string;

  constructor(businessId: string, profile?: OrdersProfileId) {
    this.businessId = businessId || "default";
    makeAutoObservable<CatalogStore, "businessId">(this, {
      businessId: false,
    });
    this.load(profile);
  }

  private get storageKey(): string {
    return `necto.pedidos.catalog.${this.businessId}`;
  }

  private load(initialProfile?: OrdersProfileId): void {
    const targetProfile =
      initialProfile ?? readActiveBusinessProfile(this.businessId);
    this.profile = targetProfile;

    const stored = readPersistedCatalog(this.storageKey);
    if (stored) {
      const storedProfile = stored.profile ?? "general";
      if (storedProfile !== targetProfile) {
        const seeded = createCatalogProductsForProfile(targetProfile);
        this.products = seeded;
        this.publishedSnapshot = JSON.stringify(seeded);
        this.fileLibrary = stored.fileLibrary;
        this.folders = stored.folders;
        this.persist();
        return;
      }

      this.products = stored.products;
      this.publishedSnapshot = stored.publishedSnapshot;
      this.fileLibrary = stored.fileLibrary;
      this.folders = stored.folders;
      if (!stored.profile) {
        this.persist();
      }
      return;
    }

    const demo = createCatalogProductsForProfile(targetProfile);
    this.products = demo;
    this.publishedSnapshot = JSON.stringify(demo);
    this.fileLibrary = [];
    this.folders = [...DEFAULT_FOLDERS];
    this.persist();
  }

  private persist(): void {
    writePersistedCatalog(this.storageKey, {
      profile: this.profile,
      products: this.products,
      publishedSnapshot: this.publishedSnapshot,
      fileLibrary: this.fileLibrary,
      folders: this.folders,
    });
  }

  reload(profile?: OrdersProfileId): void {
    this.load(profile);
  }

  applyProfile(nextProfile: OrdersProfileId): void {
    const preset = getProfilePreset(nextProfile);
    const seeded = createCatalogProductsForProfile(preset.id);
    this.profile = preset.id;
    writeActiveBusinessProfile(this.businessId, preset.id);
    this.products = seeded;
    this.publishedSnapshot = JSON.stringify(seeded);
    this.publishedSuccess = false;
    this.alertBanner = {
      tone: "success",
      message: `Catálogo actualizado al perfil «${preset.name}» con ${seeded.length} productos de ejemplo.`,
    };
    this.persist();
  }

  get hasPendingChanges(): boolean {
    return JSON.stringify(this.products) !== this.publishedSnapshot;
  }

  addProduct(
    input: Omit<CatalogProduct, "id" | "createdAt">,
  ): CatalogProduct {
    const cleanName = input.name.trim();
    const cleanCategory = input.category.trim() || "Otros";
    const cleanVariants = input.variants
      ?.map((v) => v.trim())
      .filter(Boolean);
    const product: CatalogProduct = {
      id: makeId("prod"),
      name: cleanName,
      description: input.description.trim(),
      price: Math.max(0, Math.round(input.price)),
      category: cleanCategory,
      image: input.image || assignSmartPhoto(cleanName, cleanCategory),
      gallery: input.gallery ? [...input.gallery] : undefined,
      variants: cleanVariants && cleanVariants.length > 0 ? cleanVariants : undefined,
      available: input.available,
      createdAt: new Date().toISOString(),
    };

    this.products.unshift(product);
    this.publishedSuccess = false;
    this.persist();
    return product;
  }

  updateProduct(
    id: string,
    patch: Partial<Omit<CatalogProduct, "id" | "createdAt">>,
  ): CatalogProduct | undefined {
    const target = this.products.find((product) => product.id === id);
    if (!target) return undefined;

    if (patch.name !== undefined) target.name = patch.name.trim();
    if (patch.description !== undefined) {
      target.description = patch.description.trim();
    }
    if (patch.price !== undefined) {
      target.price = Math.max(0, Math.round(patch.price));
    }
    if (patch.category !== undefined) {
      target.category = patch.category.trim() || "Otros";
    }
    if (patch.image !== undefined) {
      target.image = patch.image || assignSmartPhoto(target.name, target.category);
    }
    if (patch.gallery !== undefined) {
      target.gallery = [...patch.gallery];
    }
    if (patch.variants !== undefined) {
      const cleanVariants = patch.variants.map((v) => v.trim()).filter(Boolean);
      target.variants = cleanVariants.length > 0 ? cleanVariants : undefined;
    }
    if (patch.available !== undefined) {
      target.available = patch.available;
    }

    this.publishedSuccess = false;
    this.persist();
    return target;
  }

  deleteProduct(id: string): void {
    const next = this.products.filter((product) => product.id !== id);
    if (next.length === this.products.length) return;
    this.products = next;
    this.publishedSuccess = false;
    this.persist();
  }

  toggleAvailable(id: string): void {
    const target = this.products.find((product) => product.id === id);
    if (!target) return;
    target.available = !target.available;
    this.publishedSuccess = false;
    this.persist();
  }

  bulkImport(
    rawText: string,
  ): { ok: true; count: number } | { ok: false; error: string } {
    const parsed = parseCatalogBulkText(rawText);
    if (parsed.length === 0) {
      const error =
        "No encontramos productos válidos para importar. Revisa el formato del texto o archivo.";
      this.alertBanner = { tone: "error", message: error };
      return { ok: false, error };
    }

    const nowIso = new Date().toISOString();
    const created: CatalogProduct[] = parsed.map((item) => ({
      ...item,
      id: makeId("prod"),
      createdAt: nowIso,
    }));

    this.products = [...created, ...this.products];
    this.publishedSuccess = false;
    this.alertBanner = {
      tone: "success",
      message: `Se importaron ${created.length} ${created.length === 1 ? "producto" : "productos"} al catálogo.`,
    };
    this.persist();
    return { ok: true, count: created.length };
  }

  loadDemoProducts(): number {
    const existingNames = new Set(
      this.products.map((product) => product.name.trim().toLowerCase()),
    );
    const demo = createCatalogProductsForProfile(this.profile).filter(
      (product) => !existingNames.has(product.name.trim().toLowerCase()),
    );

    if (demo.length === 0) {
      this.alertBanner = {
        tone: "success",
        message: "Los productos de ejemplo ya están cargados en tu catálogo.",
      };
      return 0;
    }

    this.products = [...demo, ...this.products];
    this.publishedSuccess = false;
    this.alertBanner = {
      tone: "success",
      message: `Se agregaron ${demo.length} productos de ejemplo al catálogo.`,
    };
    this.persist();
    return demo.length;
  }

  async saveAndPublish(): Promise<boolean> {
    if (this.saving) return false;
    this.saving = true;
    this.publishedSuccess = false;

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 300);
    });

    runInAction(() => {
      this.publishedSnapshot = JSON.stringify(this.products);
      this.saving = false;
      this.publishedSuccess = true;
      this.alertBanner = {
        tone: "success",
        message: "Catálogo guardado y publicado correctamente para tus canales de venta.",
      };
      this.persist();
    });

    return true;
  }

  addFile(entry: Omit<CatalogFileEntry, "id" | "addedAt">): CatalogFileEntry {
    const folder = entry.folder.trim() || "General";
    if (!this.folders.includes(folder)) {
      this.folders.push(folder);
    }

    const file: CatalogFileEntry = {
      id: makeId("file"),
      name: entry.name.trim() || "imagen.png",
      dataUrl: entry.dataUrl,
      folder,
      sizeBytes: Math.max(0, Math.round(entry.sizeBytes)),
      addedAt: new Date().toISOString(),
    };

    this.fileLibrary.unshift(file);
    this.persist();
    return file;
  }

  addFolder(name: string): { ok: boolean; error?: string } {
    const clean = name.trim();
    if (!clean) {
      return { ok: false, error: "Escribe un nombre para la carpeta." };
    }
    if (
      this.folders.some(
        (folder) => folder.trim().toLowerCase() === clean.toLowerCase(),
      )
    ) {
      return { ok: false, error: "Ya existe una carpeta con ese nombre." };
    }
    this.folders.push(clean);
    this.persist();
    return { ok: true };
  }

  dismissBanner(): void {
    this.alertBanner = null;
  }

  resetDemo(): void {
    const demo = createCatalogProductsForProfile(this.profile);
    this.products = demo;
    this.publishedSnapshot = JSON.stringify(demo);
    this.fileLibrary = [];
    this.folders = [...DEFAULT_FOLDERS];
    this.saving = false;
    this.publishedSuccess = false;
    this.alertBanner = null;
    this.persist();
  }
}
