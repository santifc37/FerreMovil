"use client";

import { FormEvent, useState } from "react";
import EscanerCodigo from "@/components/EscanerCodigo";
import {
  api,
  type Categoria,
  leerNumero,
  mensajeDeError,
  type ProductoCatalogo,
  type Unidad,
} from "@/lib/api";
import { cantidad as formatoCantidad } from "@/lib/formato";

/** Lo mínimo que necesitamos de un producto ya existente para detectar duplicados. */
export type ProductoExistente = {
  id: string;
  nombre: string;
  codigo: string;
  codigo_barras: string | null;
};

type Props = {
  /** null = producto nuevo. */
  producto: ProductoCatalogo | null;
  /** Código escaneado que llena el código interno y el de barras. */
  codigoInicial?: string;
  categorias: Categoria[];
  unidades: Unidad[];
  existentes: ProductoExistente[];
  onCategoriaCreada: (categoria: Categoria) => void;
  onGuardado: (resultado: { id: string; aviso: string }) => void;
  onCerrar: () => void;
};

type Datos = {
  codigo: string;
  codigo_barras: string;
  nombre: string;
  descripcion: string;
  categoria_id: string;
  unidad_base_id: string;
  precio_compra: string;
  precio_venta: string;
  stock_minimo: string;
  cantidad_inicial: string;
};

function datosDesde(producto: ProductoCatalogo): Datos {
  return {
    codigo: producto.codigo,
    codigo_barras: producto.codigo_barras ?? "",
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? "",
    categoria_id: producto.categoria_id,
    unidad_base_id: producto.unidad_base_id,
    precio_compra: String(producto.precio_compra),
    precio_venta: String(producto.precio_venta),
    stock_minimo: String(producto.stock_minimo),
    cantidad_inicial: "",
  };
}

function datosNuevos(unidades: Unidad[], codigoInicial?: string): Datos {
  const codigo = codigoInicial?.trim() ?? "";

  return {
    codigo,
    codigo_barras: codigo,
    nombre: "",
    descripcion: "",
    categoria_id: "",
    // Si hay una sola unidad, o una "und", la dejamos elegida.
    unidad_base_id:
      unidades.find((u) => u.codigo.toLowerCase() === "und")?.id ??
      (unidades.length === 1 ? unidades[0].id : ""),
    precio_compra: "",
    precio_venta: "",
    stock_minimo: "0",
    cantidad_inicial: "",
  };
}

export default function FormularioProducto({
  producto,
  codigoInicial,
  categorias,
  unidades,
  existentes,
  onCategoriaCreada,
  onGuardado,
  onCerrar,
}: Props) {
  const esNuevo = producto === null;

  const [datos, setDatos] = useState<Datos>(() =>
    producto ? datosDesde(producto) : datosNuevos(unidades, codigoInicial)
  );
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);

  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

  function cambiar(campo: keyof Datos, valor: string) {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
    setError("");
  }

  function cerrar() {
    if (!guardando) {
      onCerrar();
    }
  }

  function alEscanear(codigo: string) {
    setDatos((actuales) => ({
      ...actuales,
      codigo_barras: codigo,
      // En muchas ferreterías el código interno es el mismo de barras.
      codigo: actuales.codigo.trim() ? actuales.codigo : codigo,
    }));
    setError("");
    setEscaneando(false);
  }

  async function crearCategoria() {
    const nombre = nombreCategoria.trim();

    if (!nombre || guardandoCategoria) {
      return;
    }

    setGuardandoCategoria(true);
    setError("");

    try {
      const nueva = await api<Categoria>("/categorias", {
        metodo: "POST",
        cuerpo: { nombre },
      });

      onCategoriaCreada(nueva);
      setDatos((actuales) => ({ ...actuales, categoria_id: nueva.id }));
      setCreandoCategoria(false);
      setNombreCategoria("");
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo crear la categoría."));
    } finally {
      setGuardandoCategoria(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (guardando) {
      return;
    }

    const codigo = datos.codigo.trim();
    const codigoBarras = datos.codigo_barras.trim();
    const nombre = datos.nombre.trim();
    const precioCompra = leerNumero(datos.precio_compra);
    const precioVenta = leerNumero(datos.precio_venta);
    const stockMinimo = leerNumero(datos.stock_minimo || "0");
    const inicial = datos.cantidad_inicial.trim()
      ? leerNumero(datos.cantidad_inicial)
      : 0;

    if (!nombre || !codigo) {
      setError("Escribe el nombre y el código del producto.");
      return;
    }

    if (!datos.categoria_id || !datos.unidad_base_id) {
      setError("Elige la categoría y la unidad del producto.");
      return;
    }

    if (
      precioCompra === null ||
      precioVenta === null ||
      precioCompra < 0 ||
      precioVenta < 0
    ) {
      setError(
        "Escribe precios válidos (el precio de compra puede ser 0 si no lo sabes)."
      );
      return;
    }

    if (stockMinimo === null || stockMinimo < 0) {
      setError("El stock mínimo debe ser un número positivo o 0.");
      return;
    }

    if (inicial === null || inicial < 0) {
      setError("La cantidad inicial debe ser un número positivo.");
      return;
    }

    const repetido = existentes.find(
      (p) =>
        p.id !== producto?.id &&
        (p.codigo.toLowerCase() === codigo.toLowerCase() ||
          (codigoBarras !== "" && p.codigo_barras === codigoBarras))
    );

    if (repetido) {
      setError(
        `Ya existe "${repetido.nombre}" con ese código o código de barras.`
      );
      return;
    }

    setGuardando(true);
    setError("");

    const cuerpo = {
      codigo,
      codigo_barras: codigoBarras || null,
      nombre,
      descripcion: datos.descripcion.trim() || null,
      categoria_id: datos.categoria_id,
      unidad_base_id: datos.unidad_base_id,
      precio_compra: precioCompra,
      precio_venta: precioVenta,
      stock_minimo: stockMinimo,
    };

    try {
      if (producto) {
        await api(`/productos/${producto.id}`, { metodo: "PATCH", cuerpo });
        onGuardado({ id: producto.id, aviso: `Se actualizó "${nombre}".` });
        return;
      }

      const creado = await api<ProductoCatalogo>("/productos", {
        metodo: "POST",
        cuerpo,
      });

      let aviso = `Se registró "${nombre}".`;

      if (inicial > 0) {
        try {
          await api("/inventario/entradas", {
            metodo: "POST",
            cuerpo: {
              motivo: "Inventario inicial",
              items: [
                {
                  producto_id: creado.id,
                  unidad_id: datos.unidad_base_id,
                  cantidad: inicial,
                },
              ],
            },
          });
          aviso = `Se registró "${nombre}" con ${formatoCantidad.format(inicial)} en inventario.`;
        } catch (err) {
          aviso = `Se registró "${nombre}", pero no se pudo guardar la cantidad inicial: ${mensajeDeError(err, "error desconocido")}`;
        }
      }

      onGuardado({ id: creado.id, aviso });
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo guardar el producto."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fm-modal-fondo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) {
          cerrar();
        }
      }}
    >
      <section
        className="fm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-formulario"
      >
        <header className="fm-modal-cabecera">
          <h2 id="titulo-formulario">
            {esNuevo ? "Nuevo producto" : "Editar producto"}
          </h2>
          <button
            type="button"
            className="fm-cerrar"
            onClick={cerrar}
            aria-label="Cerrar formulario"
          >
            ×
          </button>
        </header>

        <form className="fm-formulario" onSubmit={(e) => void guardar(e)}>
          <label className="fm-campo">
            Nombre del producto *
            <input
              value={datos.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              placeholder="Ej. Cemento gris 50 kg"
              maxLength={150}
              autoFocus
              required
            />
          </label>

          <div className="fm-fila">
            <label className="fm-campo">
              Código interno *
              <input
                value={datos.codigo}
                onChange={(e) => cambiar("codigo", e.target.value)}
                placeholder="Ej. CEM-050"
                maxLength={60}
                required
              />
            </label>

            <div className="fm-campo">
              <label htmlFor="campo-barras">Código de barras</label>
              <div className="fm-buscador">
                <input
                  id="campo-barras"
                  value={datos.codigo_barras}
                  onChange={(e) => cambiar("codigo_barras", e.target.value)}
                  placeholder="Opcional"
                  inputMode="numeric"
                  maxLength={60}
                />
                <button
                  type="button"
                  className="fm-btn fm-btn-claro"
                  onClick={() => setEscaneando(true)}
                >
                  Escanear
                </button>
              </div>
            </div>
          </div>

          <div className="fm-fila">
            <div className="fm-campo">
              <label htmlFor="campo-categoria">Categoría *</label>
              <select
                id="campo-categoria"
                value={datos.categoria_id}
                onChange={(e) => cambiar("categoria_id", e.target.value)}
                required
              >
                <option value="">Elige una categoría</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>

              {creandoCategoria ? (
                <div className="fm-buscador fm-categoria-nueva">
                  <input
                    value={nombreCategoria}
                    onChange={(e) => setNombreCategoria(e.target.value)}
                    placeholder="Nombre de la categoría"
                    maxLength={80}
                    aria-label="Nombre de la nueva categoría"
                  />
                  <button
                    type="button"
                    className="fm-btn"
                    disabled={!nombreCategoria.trim() || guardandoCategoria}
                    onClick={() => void crearCategoria()}
                  >
                    {guardandoCategoria ? "…" : "Crear"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="fm-enlace"
                  onClick={() => setCreandoCategoria(true)}
                >
                  + Crear categoría nueva
                </button>
              )}
            </div>

            <div className="fm-campo">
              <label htmlFor="campo-unidad">Unidad de venta *</label>
              <select
                id="campo-unidad"
                value={datos.unidad_base_id}
                onChange={(e) => cambiar("unidad_base_id", e.target.value)}
                disabled={!esNuevo}
                required
              >
                <option value="">Elige una unidad</option>
                {unidades.map((unidad) => (
                  <option key={unidad.id} value={unidad.id}>
                    {unidad.nombre}
                  </option>
                ))}
              </select>
              {!esNuevo && (
                <small className="fm-nota">
                  La unidad no se puede cambiar después de crear el producto.
                </small>
              )}
            </div>
          </div>

          <div className="fm-fila">
            <label className="fm-campo">
              Precio de compra *
              <input
                value={datos.precio_compra}
                onChange={(e) => cambiar("precio_compra", e.target.value)}
                placeholder="0"
                inputMode="decimal"
                required
              />
            </label>

            <label className="fm-campo">
              Precio de venta *
              <input
                value={datos.precio_venta}
                onChange={(e) => cambiar("precio_venta", e.target.value)}
                placeholder="0"
                inputMode="decimal"
                required
              />
            </label>
          </div>

          <div className="fm-fila">
            <label className="fm-campo">
              Stock mínimo
              <input
                value={datos.stock_minimo}
                onChange={(e) => cambiar("stock_minimo", e.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
            </label>

            {esNuevo && (
              <label className="fm-campo">
                Cantidad que tienes ahora
                <input
                  value={datos.cantidad_inicial}
                  onChange={(e) => cambiar("cantidad_inicial", e.target.value)}
                  placeholder="Opcional"
                  inputMode="decimal"
                />
              </label>
            )}
          </div>

          <label className="fm-campo">
            Descripción
            <input
              value={datos.descripcion}
              onChange={(e) => cambiar("descripcion", e.target.value)}
              placeholder="Opcional"
              maxLength={300}
            />
          </label>

          {error && (
            <p className="fm-aviso fm-aviso-error" role="alert">
              {error}
            </p>
          )}

          <div className="fm-modal-pie">
            <button
              type="button"
              className="fm-btn fm-btn-claro"
              onClick={cerrar}
              disabled={guardando}
            >
              Cancelar
            </button>
            <button type="submit" className="fm-btn" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar producto"}
            </button>
          </div>
        </form>
      </section>

      {escaneando && (
        <EscanerCodigo
          titulo="Escanear código de barras"
          onDetectar={alEscanear}
          onCerrar={() => setEscaneando(false)}
        />
      )}
    </div>
  );
}
