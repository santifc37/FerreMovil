"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EscanerCodigo from "@/components/EscanerCodigo";
import FormularioProducto from "@/components/FormularioProducto";
import Navegacion from "@/components/Navegacion";
import {
  api,
  type Categoria,
  esAborto,
  mensajeDeError,
  type ProductoCatalogo,
  type Unidad,
} from "@/lib/api";
import { cantidad as formatoCantidad, moneda } from "@/lib/formato";

type FilaStock = {
  producto_id: string;
  stock_actual: number;
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [stock, setStock] = useState<Record<string, number> | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // null = formulario cerrado; "nuevo" = crear; un producto = editar.
  const [editando, setEditando] = useState<ProductoCatalogo | "nuevo" | null>(
    null
  );
  const [codigoNuevo, setCodigoNuevo] = useState<string | undefined>();

  const [escaneando, setEscaneando] = useState(false);
  // Código escaneado que no corresponde a ningún producto.
  const [codigoDesconocido, setCodigoDesconocido] = useState<string | null>(
    null
  );

  const cargar = useCallback(async (signal?: AbortSignal) => {
    try {
      const [listaProductos, listaCategorias, listaUnidades, listaStock] =
        await Promise.all([
          api<ProductoCatalogo[]>("/productos?activo=true", { signal }),
          api<Categoria[]>("/categorias", { signal }),
          api<{ datos: Unidad[] }>("/unidades", { signal }),
          // Si el stock falla, igual mostramos el catálogo.
          api<{ productos: FilaStock[] }>("/inventario/stock?activo=true", {
            signal,
          }).catch((err: unknown) => {
            if (esAborto(err)) {
              throw err;
            }

            return null;
          }),
        ]);

      setProductos(
        listaProductos.map((p) => ({
          ...p,
          precio_compra: Number(p.precio_compra),
          precio_venta: Number(p.precio_venta),
          stock_minimo: Number(p.stock_minimo),
        }))
      );
      setCategorias(listaCategorias.filter((c) => c.activo));
      setUnidades(listaUnidades.datos ?? []);
      setStock(
        listaStock
          ? Object.fromEntries(
              listaStock.productos.map((fila) => [
                fila.producto_id,
                Number(fila.stock_actual),
              ])
            )
          : null
      );
      setError("");
    } catch (err) {
      if (esAborto(err)) {
        return;
      }

      setError(mensajeDeError(err, "No se pudo cargar el catálogo."));
    } finally {
      if (!signal?.aborted) {
        setCargando(false);
      }
    }
  }, []);

  useEffect(() => {
    const controlador = new AbortController();

    // Carga inicial: el estado solo cambia cuando responde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar(controlador.signal);

    return () => controlador.abort();
  }, [cargar]);

  const nombreCategoriaDe = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
    [categorias]
  );

  const resultados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) {
      return productos;
    }

    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(termino) ||
        p.codigo.toLowerCase().includes(termino) ||
        (p.codigo_barras ?? "").toLowerCase().includes(termino)
    );
  }, [productos, busqueda]);

  function abrirNuevo(codigo?: string) {
    setAviso("");
    setCodigoDesconocido(null);
    setCodigoNuevo(codigo);
    setEditando("nuevo");
  }

  function abrirEdicion(producto: ProductoCatalogo) {
    setAviso("");
    setCodigoNuevo(undefined);
    setEditando(producto);
  }

  function alEscanear(codigoLeido: string) {
    const codigo = codigoLeido.trim();
    const minuscula = codigo.toLowerCase();

    const existe = productos.some(
      (p) =>
        p.codigo_barras === codigo || p.codigo.toLowerCase() === minuscula
    );

    setBusqueda(codigo);
    setCodigoDesconocido(existe ? null : codigo);
    setEscaneando(false);
  }

  async function alGuardar(resultado: { id: string; aviso: string }) {
    setAviso(resultado.aviso);
    setEditando(null);
    await cargar();
  }

  async function desactivar(producto: ProductoCatalogo) {
    const confirmado = window.confirm(
      `¿Desactivar "${producto.nombre}"? Dejará de aparecer para vender, pero su historial se conserva.`
    );

    if (!confirmado) {
      return;
    }

    setAviso("");
    setError("");

    try {
      await api(`/productos/${producto.id}/desactivar`, { metodo: "PATCH" });
      setAviso(`Se desactivó "${producto.nombre}".`);
      await cargar();
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo desactivar el producto."));
    }
  }

  return (
    <main className="fm-page">
      <Navegacion />

      <header className="fm-encabezado">
        <div>
          <h1>Productos</h1>
          <p>Registra y consulta lo que vendes en la ferretería.</p>
        </div>

        <button type="button" className="fm-btn" onClick={() => abrirNuevo()}>
          + Nuevo producto
        </button>
      </header>

      <section className="fm-tarjeta">
        <label htmlFor="buscar-catalogo" className="fm-etiqueta">
          Buscar producto
        </label>

        <div className="fm-buscador">
          <input
            id="buscar-catalogo"
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value);
              setCodigoDesconocido(null);
            }}
            placeholder="Nombre, código o código de barras"
            autoComplete="off"
          />

          {busqueda && (
            <button
              type="button"
              className="fm-btn fm-btn-claro fm-btn-icono"
              onClick={() => {
                setBusqueda("");
                setCodigoDesconocido(null);
              }}
              aria-label="Borrar búsqueda"
            >
              ×
            </button>
          )}

          <button
            type="button"
            className="fm-btn fm-btn-claro"
            onClick={() => setEscaneando(true)}
          >
            Escanear
          </button>
        </div>
      </section>

      {codigoDesconocido && (
        <div className="fm-aviso fm-aviso-accion" role="status">
          <p>
            No hay ningún producto con el código <strong>{codigoDesconocido}</strong>.
          </p>
          <div className="fm-aviso-botones">
            <button
              type="button"
              className="fm-btn"
              onClick={() => abrirNuevo(codigoDesconocido)}
            >
              Crear producto con este código
            </button>
            <button
              type="button"
              className="fm-btn fm-btn-claro"
              onClick={() => setCodigoDesconocido(null)}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <p className="fm-aviso fm-aviso-ok" role="status">
          {aviso}
        </p>
      )}

      {error && (
        <div className="fm-aviso fm-aviso-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="fm-btn fm-btn-claro"
            onClick={() => {
              setCargando(true);
              void cargar();
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="fm-vacio">Cargando productos…</p>
      ) : (
        !error && (
          <section className="fm-lista" aria-label="Lista de productos">
            {resultados.length === 0 && !codigoDesconocido && (
              <p className="fm-vacio">
                {busqueda.trim()
                  ? "No se encontró ningún producto con esa búsqueda."
                  : "Aún no hay productos. Toca “Nuevo producto” para registrar el primero."}
              </p>
            )}

            {resultados.map((producto) => {
              const existencias = stock ? (stock[producto.id] ?? 0) : null;
              const agotado = existencias !== null && existencias <= 0;
              const bajo =
                existencias !== null &&
                !agotado &&
                existencias <= producto.stock_minimo;

              return (
                <article className="fm-producto" key={producto.id}>
                  <div className="fm-producto-info">
                    <strong>{producto.nombre}</strong>
                    <small>
                      Código: {producto.codigo}
                      {producto.codigo_barras
                        ? ` · Barras: ${producto.codigo_barras}`
                        : ""}
                    </small>
                    <small>
                      {nombreCategoriaDe[producto.categoria_id] ??
                        "Sin categoría"}
                    </small>
                  </div>

                  <div className="fm-producto-datos">
                    <span className="fm-precio">
                      {moneda.format(producto.precio_venta)}
                    </span>

                    {existencias !== null && (
                      <span
                        className={`fm-etiqueta-stock ${
                          agotado
                            ? "fm-stock-agotado"
                            : bajo
                              ? "fm-stock-bajo"
                              : ""
                        }`}
                      >
                        {agotado
                          ? "Agotado"
                          : `${formatoCantidad.format(existencias)} en stock${bajo ? " · bajo" : ""}`}
                      </span>
                    )}
                  </div>

                  <div className="fm-producto-acciones">
                    <button
                      type="button"
                      className="fm-btn fm-btn-claro"
                      onClick={() => abrirEdicion(producto)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="fm-btn fm-btn-peligro"
                      onClick={() => void desactivar(producto)}
                    >
                      Desactivar
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )
      )}

      {editando !== null && (
        <FormularioProducto
          producto={editando === "nuevo" ? null : editando}
          codigoInicial={codigoNuevo}
          categorias={categorias}
          unidades={unidades}
          existentes={productos}
          onCategoriaCreada={(nueva) =>
            setCategorias((actuales) =>
              [...actuales, nueva].sort((a, b) =>
                a.nombre.localeCompare(b.nombre)
              )
            )
          }
          onGuardado={(resultado) => void alGuardar(resultado)}
          onCerrar={() => setEditando(null)}
        />
      )}

      {escaneando && (
        <EscanerCodigo
          titulo="Buscar escaneando"
          onDetectar={alEscanear}
          onCerrar={() => setEscaneando(false)}
        />
      )}
    </main>
  );
}
