"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import EscanerCodigo from "@/components/EscanerCodigo";
import Navegacion from "@/components/Navegacion";
import {
  api,
  type Categoria,
  ErrorApi,
  esAborto,
  leerNumero,
  mensajeDeError,
  type ProductoCatalogo,
  type Unidad,
} from "@/lib/api";
import { cantidad as formatoCantidad, moneda } from "@/lib/formato";

type FilaStock = {
  producto_id: string;
  stock_actual: number;
};

type Formulario = {
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

const formularioVacio: Formulario = {
  codigo: "",
  codigo_barras: "",
  nombre: "",
  descripcion: "",
  categoria_id: "",
  unidad_base_id: "",
  precio_compra: "",
  precio_venta: "",
  stock_minimo: "0",
  cantidad_inicial: "",
};

function formularioDesde(producto: ProductoCatalogo): Formulario {
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
  const [datos, setDatos] = useState<Formulario>(formularioVacio);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [escaner, setEscaner] = useState<"buscar" | "barras" | null>(null);

  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nombreCategoria, setNombreCategoria] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);

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

  function abrirNuevo() {
    setAviso("");
    setErrorFormulario("");
    setCreandoCategoria(false);
    setNombreCategoria("");
    setDatos({
      ...formularioVacio,
      // Si solo hay una unidad (o una "unidad" estándar), la dejamos elegida.
      unidad_base_id:
        unidades.find((u) => u.codigo.toLowerCase() === "und")?.id ??
        (unidades.length === 1 ? unidades[0].id : ""),
    });
    setEditando("nuevo");
  }

  function abrirEdicion(producto: ProductoCatalogo) {
    setAviso("");
    setErrorFormulario("");
    setCreandoCategoria(false);
    setNombreCategoria("");
    setDatos(formularioDesde(producto));
    setEditando(producto);
  }

  function cerrarFormulario() {
    if (guardando) {
      return;
    }

    setEditando(null);
    setEscaner(null);
  }

  function cambiar(campo: keyof Formulario, valor: string) {
    setDatos((actuales) => ({ ...actuales, [campo]: valor }));
    setErrorFormulario("");
  }

  function alEscanear(codigo: string) {
    if (escaner === "buscar") {
      setBusqueda(codigo);
    } else if (escaner === "barras") {
      setDatos((actuales) => ({
        ...actuales,
        codigo_barras: codigo,
        // En muchas ferreterías el código interno es el mismo de barras.
        codigo: actuales.codigo.trim() ? actuales.codigo : codigo,
      }));
      setErrorFormulario("");
    }

    setEscaner(null);
  }

  async function crearCategoria() {
    const nombre = nombreCategoria.trim();

    if (!nombre || guardandoCategoria) {
      return;
    }

    setGuardandoCategoria(true);
    setErrorFormulario("");

    try {
      const nueva = await api<Categoria>("/categorias", {
        metodo: "POST",
        cuerpo: { nombre },
      });

      setCategorias((actuales) =>
        [...actuales, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      setDatos((actuales) => ({ ...actuales, categoria_id: nueva.id }));
      setCreandoCategoria(false);
      setNombreCategoria("");
    } catch (err) {
      setErrorFormulario(
        mensajeDeError(err, "No se pudo crear la categoría.")
      );
    } finally {
      setGuardandoCategoria(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (guardando || editando === null) {
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
      setErrorFormulario("Escribe el nombre y el código del producto.");
      return;
    }

    if (!datos.categoria_id || !datos.unidad_base_id) {
      setErrorFormulario("Elige la categoría y la unidad del producto.");
      return;
    }

    if (
      precioCompra === null ||
      precioVenta === null ||
      precioCompra < 0 ||
      precioVenta < 0
    ) {
      setErrorFormulario(
        "Escribe precios válidos (el precio de compra puede ser 0 si no lo sabes)."
      );
      return;
    }

    if (stockMinimo === null || stockMinimo < 0) {
      setErrorFormulario("El stock mínimo debe ser un número positivo o 0.");
      return;
    }

    if (inicial === null || inicial < 0) {
      setErrorFormulario("La cantidad inicial debe ser un número positivo.");
      return;
    }

    const idEditado = editando === "nuevo" ? null : editando.id;

    const repetido = productos.find(
      (p) =>
        p.id !== idEditado &&
        (p.codigo.toLowerCase() === codigo.toLowerCase() ||
          (codigoBarras !== "" && p.codigo_barras === codigoBarras))
    );

    if (repetido) {
      setErrorFormulario(
        `Ya existe "${repetido.nombre}" con ese código o código de barras.`
      );
      return;
    }

    setGuardando(true);
    setErrorFormulario("");

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
      if (idEditado) {
        await api(`/productos/${idEditado}`, { metodo: "PATCH", cuerpo });
        setAviso(`Se actualizó "${nombre}".`);
      } else {
        const creado = await api<ProductoCatalogo>("/productos", {
          metodo: "POST",
          cuerpo,
        });

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
            setAviso(
              `Se registró "${nombre}" con ${formatoCantidad.format(inicial)} en inventario.`
            );
          } catch (err) {
            setAviso(
              `Se registró "${nombre}", pero no se pudo guardar la cantidad inicial: ${mensajeDeError(err, "error desconocido")}`
            );
          }
        } else {
          setAviso(`Se registró "${nombre}".`);
        }
      }

      setEditando(null);
      setEscaner(null);
      await cargar();
    } catch (err) {
      setErrorFormulario(
        err instanceof ErrorApi
          ? err.message
          : "No se pudo guardar el producto."
      );
    } finally {
      setGuardando(false);
    }
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

  const titulo = editando === "nuevo" ? "Nuevo producto" : "Editar producto";

  return (
    <main className="fm-page">
      <Navegacion />

      <header className="fm-encabezado">
        <div>
          <h1>Productos</h1>
          <p>Registra y consulta lo que vendes en la ferretería.</p>
        </div>

        <button type="button" className="fm-btn" onClick={abrirNuevo}>
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
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Nombre, código o código de barras"
            autoComplete="off"
          />

          {busqueda && (
            <button
              type="button"
              className="fm-btn fm-btn-claro fm-btn-icono"
              onClick={() => setBusqueda("")}
              aria-label="Borrar búsqueda"
            >
              ×
            </button>
          )}

          <button
            type="button"
            className="fm-btn fm-btn-claro"
            onClick={() => setEscaner("buscar")}
          >
            Escanear
          </button>
        </div>
      </section>

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
            {resultados.length === 0 && (
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
        <div
          className="fm-modal-fondo"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) {
              cerrarFormulario();
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
              <h2 id="titulo-formulario">{titulo}</h2>
              <button
                type="button"
                className="fm-cerrar"
                onClick={cerrarFormulario}
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
                      onClick={() => setEscaner("barras")}
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
                    disabled={editando !== "nuevo"}
                    required
                  >
                    <option value="">Elige una unidad</option>
                    {unidades.map((unidad) => (
                      <option key={unidad.id} value={unidad.id}>
                        {unidad.nombre}
                      </option>
                    ))}
                  </select>
                  {editando !== "nuevo" && (
                    <small className="fm-nota">
                      La unidad no se puede cambiar después de crear el
                      producto.
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

                {editando === "nuevo" && (
                  <label className="fm-campo">
                    Cantidad que tienes ahora
                    <input
                      value={datos.cantidad_inicial}
                      onChange={(e) =>
                        cambiar("cantidad_inicial", e.target.value)
                      }
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

              {errorFormulario && (
                <p className="fm-aviso fm-aviso-error" role="alert">
                  {errorFormulario}
                </p>
              )}

              <div className="fm-modal-pie">
                <button
                  type="button"
                  className="fm-btn fm-btn-claro"
                  onClick={cerrarFormulario}
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
        </div>
      )}

      {escaner && (
        <EscanerCodigo
          titulo={
            escaner === "barras"
              ? "Escanear código de barras"
              : "Buscar escaneando"
          }
          onDetectar={alEscanear}
          onCerrar={() => setEscaner(null)}
        />
      )}
    </main>
  );
}
