import { Button } from "@/elements/ui/button";
import { Card } from "@/elements/ui/card";
import { FilePicker } from "../components/FilePicker";
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    PlusIcon,
    CloseLineIcon, GridIcon,
    ListIcon, DocsIcon, TrashBinIcon,
    PencilIcon
} from '@/icons';
import { PageMeta } from '@/shell/meta';
import {
    BoltIcon,
    BookOpenIcon,
    CloudArrowUpIcon,
    HeartIcon,
    HomeIcon,
    PuzzlePieceIcon,
    ShoppingBagIcon,
    SparklesIcon,
    Squares2X2Icon,
    TrophyIcon,
    TruckIcon,
    WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image?: string;

  extraImages?: string[];
  available: boolean;
}

const PRODUCT_CATEGORIES: { label: string; icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
  { label: 'Salud, belleza y cuidado personal', icon: SparklesIcon },
  { label: 'Hogar, Muebles, Cocina', icon: HomeIcon },
  { label: 'Tecnología y electrodomésticos', icon: BoltIcon },
  { label: 'Moda, Ropa y Accesorios', icon: ShoppingBagIcon },
  { label: 'Bebés, Juguetes y Juegos', icon: PuzzlePieceIcon },
  { label: 'Animales y Mascotas', icon: HeartIcon },
  { label: 'Deportes y Fitness', icon: TrophyIcon },
  { label: 'Vehículos', icon: TruckIcon },
  { label: 'Librería y papelería', icon: BookOpenIcon },
  { label: 'Herramientas', icon: WrenchScrewdriverIcon },
  { label: 'Otros', icon: Squares2X2Icon },
];

const ImageUpload: React.FC<{
  images: string[];
  onOpen: () => void;
  onRemove: (index: number) => void;
}> = ({ images, onOpen, onRemove }) => {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 px-6 py-6 text-center dark:border-gray-700">
      {images.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {images.map((url, i) => (
            <div
              key={`${i}-${url.slice(-12)}`}
              className="group relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
            >
              <img src={url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Quitar imagen ${i + 1}`}
                className="absolute right-1 top-1 rounded-md bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <CloseLineIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          <CloudArrowUpIcon className="mx-auto h-6 w-6 text-gray-400" aria-hidden="true" />
          <p className="mt-1.5 text-[12px] font-normal text-gray-600 dark:text-gray-300">
            Selecciona la imagen para subir a tu catálogo
          </p>
          <p className="mt-0.5 text-[11px] font-normal text-gray-400">
            Selecciona uno o más archivos. Tamaño máximo: 10 MB.
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 rounded-md bg-[#212121] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-black dark:bg-white dark:text-[#212121] dark:hover:bg-gray-200"
      >
        Seleccionar archivos
      </button>
    </div>
  );
};

export function CatalogPage({ products, onChange }: { products: Product[]; onChange: (products: Product[]) => void }) {
  const catalogItems = products;
  const updateProducts = onChange;
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('Todas');

  const [editedProduct, setEditedProduct] = useState<Product | null>(null);

  const [imageTarget, setImageTarget] = useState<'primary' | 'additional' | null>(null);
  const [isNewProduct, setIsNewProduct] = useState<boolean>(false);

  const toggleAvailability = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = catalogItems.map((item) =>
      item.id === id ? { ...item, available: !item.available } : item
    );
    updateProducts(updated);
  };

  const deleteProduct = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = catalogItems.filter((p) => p.id !== id);
    updateProducts(updated);
    if (editedProduct?.id === id) {
      setEditedProduct(null);
    }
  };

  const newProduct = () => {
    const newItem: Product = {
      id: crypto.randomUUID(),
      name: '',
      category: activeCategory !== 'Todas' ? activeCategory : 'General',
      description: '',
      price: 0,

      extraImages: [],
      available: true,
    };
    setEditedProduct(newItem);
    setIsNewProduct(true);
  };

  const addImages = (urls: string[], additional: boolean) => {
    if (urls.length === 0) return;
    setEditedProduct((prev) => {
      if (!prev) return prev;
      if (!additional) return { ...prev, image: urls[0] };
      return {
        ...prev,
        extraImages: [...(prev.extraImages ?? []), ...urls].slice(0, 6),
      };
    });
  };

  const editProduct = (prod: Product) => {
    setEditedProduct({ ...prod });
    setIsNewProduct(false);
  };

  const saveProduct = () => {
    if (!editedProduct || !editedProduct.name.trim()) return;

    let updated: Product[];
    if (isNewProduct) {
      updated = [editedProduct, ...catalogItems];
    } else {
      updated = catalogItems.map((p) =>
        p.id === editedProduct.id ? editedProduct : p
      );
    }
    updateProducts(updated);
    setEditedProduct(null);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalogItems.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return ['Todas', ...Array.from(set)];
  }, [catalogItems]);

  const filteredProducts = useMemo(() => {
    return catalogItems.filter((p) => {
      const matchesCategory = activeCategory === 'Todas' || p.category === activeCategory;
      const matchesSearch =
        search.trim() === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [catalogItems, activeCategory, search]);

  const formatPrice = (num: number) => {
    return `$ ${num.toLocaleString('es-CO')}`;
  };

  return (
    <>
      <PageMeta
        title="Catálogo"
        description="Productos y precios que ven tus clientes"
      />
      <div className="w-full min-h-screen bg-gray-50/50 dark:bg-gray-950 px-4 sm:px-6 lg:px-8 py-5 space-y-4 font-sans">

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 p-4 shadow-2xs space-y-3.5">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#97D6DF]/20 dark:bg-[#97D6DF]/15 flex items-center justify-center text-[#190088] dark:text-[#97D6DF] shrink-0">
                <DocsIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-[#190088] dark:text-white tracking-tight">
                    Catálogo
                  </h1>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    · {catalogItems.length} {catalogItems.length === 1 ? 'producto' : 'catalogItems'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                  Administra los productos, los precios y la disponibilidad de tu catálogo.
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">

              <Button onClick={newProduct} startIcon={<PlusIcon className="size-4" />}>Nuevo producto</Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">

              <div className="relative w-full max-w-xs shrink-0">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por producto, categoría..."
                  className="w-full pl-3.5 pr-8 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#190088] dark:focus:border-[#97D6DF]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <CloseLineIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {categories.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        activeCategory === cat
                          ? 'bg-[#190088] text-white shadow-2xs dark:bg-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="inline-flex h-9 sm:h-10 items-center rounded-2xl bg-[#EEEEEE] p-1 dark:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Vista en cuadrícula"
                className={`flex h-full items-center gap-1.5 rounded-xl px-3 sm:px-3.5 text-xs transition-all duration-200 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white font-bold text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-[#1C1C1F] dark:text-white'
                    : 'font-medium text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <GridIcon className="size-3.5 sm:size-4" />
                <span>Cuadrícula</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Vista en tabla / lista"
                className={`flex h-full items-center gap-1.5 rounded-xl px-3 sm:px-3.5 text-xs transition-all duration-200 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white font-bold text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-[#1C1C1F] dark:text-white'
                    : 'font-medium text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <ListIcon className="size-3.5 sm:size-4" />
                <span>Lista</span>
              </button>
            </div>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <Card className="text-center">
            <DocsIcon className="mx-auto mb-3 size-8 text-gray-400"/>
            <h2 className="font-semibold">No hay productos para mostrar</h2>
            <p className="mt-1 text-sm text-gray-500">{catalogItems.length ? "Prueba otra categoría o búsqueda." : "Agrega tu primer producto para comenzar."}</p>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
            {filteredProducts.map((item, i) => (
              <div
                key={item.id}
                data-flip={item.id}
                onClick={() => editProduct(item)}
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                className={`animate-entrada-lista group bg-white dark:bg-gray-900 rounded-2xl border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer overflow-hidden flex flex-col justify-between ${
                  item.available
                    ? 'border-gray-200/80 dark:border-gray-800'
                    : 'border-gray-200/60 dark:border-gray-800/60 opacity-60'
                }`}
              >

                <div className="relative h-36 sm:h-40 w-full bg-gray-900 dark:bg-gray-800 overflow-hidden">
                  {item.image ? (<img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />) : <ShoppingBagIcon aria-hidden="true" className="h-full w-full bg-gray-50 p-[15%] text-gray-300 dark:bg-gray-800 dark:text-gray-500" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />

                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/95 dark:bg-gray-900/95 text-gray-800 dark:text-gray-200 backdrop-blur-xs shadow-2xs truncate max-w-[55%]">
                    {item.category}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => toggleAvailability(item.id, e)}
                    title={item.available ? 'Pausar producto' : 'Habilitar producto'}
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-2xs transition-all ${
                      item.available
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-700 text-gray-200'
                    }`}
                  >
                    {item.available ? 'Disponible' : 'Agotado'}
                  </button>

                  <div className="absolute bottom-2 left-2">
                    <span className="text-sm sm:text-base font-bold text-white drop-shadow-md tabular-nums">
                      {formatPrice(item.price)}
                    </span>
                  </div>
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between space-y-1.5">
                  <div>
                    <h4 className="font-bold text-xs sm:text-[13px] text-[#190088] dark:text-white line-clamp-1 group-hover:text-[#FF3F1A] transition-colors">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                      {item.description || 'Sin descripción'}
                    </p>
                  </div>

                  <div className="pt-1.5 flex items-center justify-between border-t border-gray-100 dark:border-gray-800/80">
                    <span className="text-[11px] font-semibold text-gray-500 hover:text-[#190088] dark:text-gray-400 dark:hover:text-white flex items-center gap-1 transition-colors">
                      <PencilIcon className="w-3 h-3" />
                      Editar
                    </span>

                    <button
                      type="button"
                      onClick={(e) => deleteProduct(item.id, e)}
                      title="Eliminar producto"
                      className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <TrashBinIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Vista en Lista / Tabla Operativa ── */
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-800/50 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Precio ($COP)</th>
                    <th className="py-3 px-4 text-center">Disponibilidad</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {filteredProducts.map((item, i) => (
                    <tr
                      key={item.id}
                      data-flip={item.id}
                      onClick={() => editProduct(item)}
                      style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                      className="animate-entrada-lista hover:bg-gray-50/80 dark:hover:bg-gray-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 border border-gray-200/60 dark:border-gray-700">
                            {item.image ? (<img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />) : <ShoppingBagIcon aria-hidden="true" className="h-full w-full bg-gray-50 p-[15%] text-gray-300 dark:bg-gray-800 dark:text-gray-500" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-[#190088] dark:text-white truncate">
                              {item.name}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs md:max-w-md">
                              {item.description || 'Sin descripción'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block text-xs px-2.5 py-0.5 rounded-md font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-sm text-gray-900 dark:text-white tabular-nums">
                          {formatPrice(item.price)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => toggleAvailability(item.id, e)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-2xs ${
                            item.available
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                              : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {item.available ? 'Disponible' : 'Agotado'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => editProduct(item)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#190088] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            title="Editar producto"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => deleteProduct(item.id, e)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            title="Eliminar producto"
                          >
                            <TrashBinIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {editedProduct &&
        createPortal(
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-white dark:bg-gray-950">
            <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-6 sm:px-10">

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-bold text-[#212121] dark:text-white">
                  {isNewProduct ? 'Nuevo producto' : 'Editar producto'}
                </h2>
                <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                  Completa los datos del producto. Aparecerá en tu catálogo apenas lo guardes.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditedProduct(null)}
                  className="h-9 rounded-lg px-3 text-[13px] font-bold text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveProduct}
                  disabled={!editedProduct.name.trim()}
                  className="h-9 rounded-lg bg-[#212121] px-4 text-[13px] font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#212121] dark:hover:bg-gray-200"
                >
                  Guardar
                </button>
              </div>
            </div>

            <div className="mt-7">
              <label
                htmlFor="prod-nombre"
                className="block text-[13px] font-bold text-[#212121] dark:text-white"
              >
                Nombre del producto
              </label>
              <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                Con este nombre verás el producto en el catálogo. Es el nombre visible para tus
                clientes.
              </p>
              <input
                id="prod-nombre"
                type="text"
                value={editedProduct.name}
                onChange={(e) =>
                  setEditedProduct({ ...editedProduct, name: e.target.value })
                }
                placeholder="Escribe aquí el nombre de tu producto"
                className="mt-2 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-normal text-[#212121] outline-none transition-colors placeholder:text-gray-400 focus:border-[#FF3F1A] focus:ring-1 focus:ring-[#FF3F1A]/30 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
              />
            </div>

            <div className="mt-5">
              <label
                htmlFor="prod-descripcion"
                className="block text-[13px] font-bold text-[#212121] dark:text-white"
              >
                Descripción
              </label>
              <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                Escribe aquí la descripción de tu producto
              </p>
              <div className="relative mt-2">
                <textarea
                  id="prod-descripcion"
                  rows={5}
                  maxLength={2000}
                  value={editedProduct.description}
                  onChange={(e) =>
                    setEditedProduct({ ...editedProduct, description: e.target.value })
                  }
                  placeholder="Describe el producto, sus materiales o sus especificaciones"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 pb-7 text-[13px] font-normal text-[#212121] outline-none transition-colors placeholder:text-gray-400 focus:border-[#FF3F1A] focus:ring-1 focus:ring-[#FF3F1A]/30 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                />
                <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-gray-400">
                  {editedProduct.description.length} / 2000
                </span>
              </div>
            </div>

            <div className="mt-5">
              <span className="block text-[13px] font-bold text-[#212121] dark:text-white">
                Categorías
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRODUCT_CATEGORIES.map(({ label, icon: Icon }) => {
                  const enabled = editedProduct.category === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={enabled}
                      onClick={() =>
                        setEditedProduct({
                          ...editedProduct,
                          category: enabled ? '' : label,
                        })
                      }
                      className={
                        enabled
                          ? 'inline-flex h-8 items-center gap-1.5 rounded-full border border-[#FF3F1A] bg-[#FF3F1A]/10 px-3 text-[12px] font-bold text-[#FF3F1A] transition-colors'
                          : 'inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-[12px] font-normal text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5'
                      }
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <span className="block text-[13px] font-bold text-[#212121] dark:text-white">
                  Imagen principal
                </span>
                <div className="mt-2">
                  <ImageUpload
                    images={editedProduct.image ? [editedProduct.image] : []}
                    onOpen={() => setImageTarget('primary')}
                    onRemove={() => setEditedProduct({ ...editedProduct, image: undefined })}
                  />
                </div>
              </div>

              <div>
                <span className="block text-[13px] font-bold text-[#212121] dark:text-white">
                  Imágenes adicionales
                </span>
                <div className="mt-2">
                  <ImageUpload
                    images={editedProduct.extraImages ?? []}
                    onOpen={() => setImageTarget('additional')}
                    onRemove={(index) =>
                      setEditedProduct({
                        ...editedProduct,
                        extraImages: (editedProduct.extraImages ?? []).filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="prod-precio"
                  className="block text-[13px] font-bold text-[#212121] dark:text-white"
                >
                  Precio
                </label>
                <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                  Lo que paga el cliente, en pesos colombianos.
                </p>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-normal text-gray-400">
                    $
                  </span>
                  <input
                    id="prod-precio"
                    type="number"
                    min={0}
                    value={editedProduct.price}
                    onChange={(e) =>
                      setEditedProduct({
                        ...editedProduct,
                        price: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-7 pr-3 text-[13px] font-bold tabular-nums text-[#212121] outline-none transition-colors focus:border-[#FF3F1A] focus:ring-1 focus:ring-[#FF3F1A]/30 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <span className="block text-[13px] font-bold text-[#212121] dark:text-white">
                  Disponibilidad
                </span>
                <p className="mt-0.5 text-[12px] font-normal text-gray-500 dark:text-gray-400">
                  Si se agota, apágalo para que tus clientes no lo pidan.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setEditedProduct({
                      ...editedProduct,
                      available: !editedProduct.available,
                    })
                  }
                  aria-pressed={editedProduct.available}
                  className={
                    editedProduct.available
                      ? 'mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-[#97D6DF] bg-[#97D6DF]/20 px-3 text-[13px] font-bold text-[#190088] dark:text-[#97D6DF]'
                      : 'mt-2 inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-[13px] font-bold text-gray-500 dark:border-gray-800 dark:text-gray-400'
                  }
                >
                  <span
                    className={
                      editedProduct.available
                        ? 'h-1.5 w-1.5 rounded-full bg-[#190088] dark:bg-[#97D6DF]'
                        : 'h-1.5 w-1.5 rounded-full bg-gray-400'
                    }
                    aria-hidden="true"
                  />
                  {editedProduct.available ? 'Disponible' : 'Agotado'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
      </div>

      <FilePicker open={imageTarget !== null} singleSelect={imageTarget === "primary"}
        onClose={() => setImageTarget(null)} onSelect={(images) => {
          addImages(images, imageTarget === "additional");
          setImageTarget(null);
        }} />
    </>
  );
}
