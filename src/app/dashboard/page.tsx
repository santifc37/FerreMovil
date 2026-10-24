"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EscanerCodigo from "@/components/EscanerCodigo";
import FormularioProducto from "@/components/FormularioProducto";
import Navegacion from "@/components/Navegacion";
import {
  api,
  type Categoria,
  ErrorApi,
  esAborto,
  leerNumero,
  mensajeDeError,
  nuevaClave,
  type Unidad,
} from "@/lib/api";
import { cantidad as formatoCantidad, moneda } from "@/lib/formato";

type Producto = {
  producto_id: string;
  nombre: string;
  codigo: string;
  codigo_barras: string | null;
  precio_venta: number;
  stock_actual: number;
  unidad_base_id: string;
};

type ItemCarrito = Producto & {
  cantidad: number;
};

type EstadoEscaner = { tipo: "ok" | "error"; texto: string } | null;

function redondear(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

export default function DashboardPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [estadoEscaner, setEstadoEscaner] = useState<EstadoEscaner>(null);

  // Código escaneado que no existe, y datos para crear el producto al vuelo.
  const [codigoDesconocido, setCodigoDesconocido] = useState<string | null>(
    null
  );
  const [creando, setCreando] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<{
    categorias: Categoria[];
    unidades: Unidad[];
  } | null>(null);

  const cargarProductos = useCallback(
    async (signal?: AbortSignal): Promise<Producto[] | null> => {
      try {
        const datos = await api<{ productos?: Producto[] }>(
          "/inventario/stock?activo=true",
          { signal }
        );

        const lista = (datos.productos ?? []).map((p) => ({
          ...p,
          precio_venta: Number(p.precio_venta),
          stock_actual: Number(p.stock_actual),
        }));

        setProductos(lista);
        setError("");

        return lista;
      } catch (err) {
        if (!esAborto(err)) {
          setError(mensajeDeError(err, "Error al cargar el inventario."));
        }

        return null;
      } finally {
        if (!signal?.aborted) {
          setCargando(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    // Carga inicial: el estado solo cambia cuando responde la API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarProductos(controller.signal);

    return () => {
      controller.abort();
    };
  }, [cargarProductos]);

  const resultados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) {
      return productos;
    }

    return productos.filter((producto) => {
      const nombre = (producto.nombre ?? "").toLowerCase();
      const codigo = (producto.codigo ?? "").toLowerCase();
      const barras = (producto.codigo_barras ?? "").toLowerCase();

      return (
        nombre.includes(termino) ||
        codigo.includes(termino) ||
        barras.includes(termino)
      );
    });
  }, [productos, busqueda]);

  const totalUnidades = redondear(
    carrito.reduce((total, item) => total + item.cantidad, 0)
  );

  const totalVenta = carrito.reduce(
    (total, item) => total + item.precio_venta * item.cantidad,
    0
  );

  const agregarProducto = useCallback((producto: Producto) => {
    setMensaje("");
    setError("");

    setCarrito((actual) => {
      const item = actual.find((i) => i.producto_id === producto.producto_id);

      if (item) {
        return actual.map((i) =>
          i.producto_id === producto.producto_id
            ? { ...i, cantidad: redondear(i.cantidad + 1) }
            : i
        );
      }

      return [...actual, { ...producto, cantidad: 1 }];
    });

    setBusqueda("");
  }, []);

  function cambiarCantidad(productoId: string, cambio: number) {
    setCarrito((actual) =>
      actual
        .map((item) =>
          item.producto_id === productoId
            ? { ...item, cantidad: redondear(item.cantidad + cambio) }
            : item
        )
        .filter((item) => item.cantidad > 0)
    );
  }

  function fijarCantidad(productoId: string, texto: string) {
    const valor = leerNumero(texto);

    if (valor === null || valor <= 0) {
      return false;
    }

    setCarrito((actual) =>
      actual.map((item) =>
        item.producto_id === productoId
          ? { ...item, cantidad: redondear(valor) }
          : item
      )
    );

    return true;
  }

  function quitarProducto(productoId: string) {
    setCarrito((actual) =>
      actual.filter((item) => item.producto_id !== productoId)
    );
  }

  function alEscanear(codigoLeido: string) {
    const codigo = codigoLeido.trim();
    const minuscula = codigo.toLowerCase();

    const encontrado = productos.find(
      (producto) =>
        producto.codigo_barras === codigo ||
        (producto.codigo ?? "").toLowerCase() === minuscula
    );

    if (!encontrado) {
      setCodigoDesconocido(codigo);
      setEstadoEscaner({
        tipo: "error",
        texto: `No hay ningún producto con el código ${codigo}.`,
      });
      return;
    }

    setCodigoDesconocido(null);
    agregarProducto(encontrado);
    setEstadoEscaner({
      tipo: "ok",
      texto: `Agregado: ${encontrado.nombre}`,
    });
  }

  async function abrirCreador(codigo: string) {
    setEscaneando(false);
    setMensaje("");
    setError("");

    try {
      let datosCatalogo = catalogo;

      if (!datosCatalogo) {
        const [categorias, unidades] = await Promise.all([
          api<Categoria[]>("/categorias"),
          api<{ datos: Unidad[] }>("/unidades"),
        ]);

        datosCatalogo = {
          categorias: categorias.filter((c) => c.activo),
          unidades: unidades.datos ?? [],
        };
        setCatalogo(datosCatalogo);
      }

      setCreando(codigo);
    } catch (err) {
      setError(
        mensajeDeError(err, "No se pudieron cargar las categorías y unidades.")
      );
    }
  }

  async function alCrearProducto(resultado: { id: string; aviso: string }) {
    setCreando(null);
    setCodigoDesconocido(null);

    const lista = await cargarProductos();
    const nuevo = lista?.find((p) => p.producto_id === resultado.id);

    if (nuevo) {
      agregarProducto(nuevo);
      setMensaje(`${resultado.aviso} Ya está en la venta.`);
    } else {
      setMensaje(resultado.aviso);
    }
  }

  async function enviarVenta(confirmarStockNegativo: boolean) {
    await api("/ventas", {
      metodo: "POST",
      // Una clave nueva por intento: el primer intento falló y no creó venta.
      claveIdempotencia: nuevaClave(),
      cuerpo: {
        confirmar_stock_negativo: confirmarStockNegativo,
        items: carrito.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          unidad_id: item.unidad_base_id,
          precio_unitario: item.precio_venta,
        })),
      },
    });
  }

  async function registrarVenta() {
    if (carrito.length === 0 || registrando) {
      return;
    }

    setRegistrando(true);
    setMensaje("");
    setError("");

    try {
      try {
        await enviarVenta(false);
      } catch (err) {
        const sinStock =
          err instanceof ErrorApi && err.message.includes("STOCK_INSUFICIENTE");

        if (!sinStock) {
          throw err;
        }

        const continuar = window.confirm(
          "Algunos productos superan el stock registrado. Si ya los vendiste, puedes registrar la venta de todas formas; el stock de esos productos quedará en negativo hasta que registres una entrada.\n\n¿Registrar la venta?"
        );

        if (!continuar) {
          setError("La venta no se registró.");
          return;
        }

        await enviarVenta(true);
      }

      setCarrito([]);
      setBusqueda("");
      setMensaje("Venta registrada correctamente.");

      await cargarProductos();
    } catch (err) {
      setError(mensajeDeError(err, "Error al registrar la venta."));
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <main className="ventas-page">
      <Navegacion />

      <header className="ventas-header">
        <div>
          <h1>Registrar venta</h1>
          <p className="ventas-subtitulo">
            Busca o escanea los productos y agrégalos a la venta.
          </p>
        </div>
      </header>

      <section className="buscador-seccion">
        <label htmlFor="buscar-producto">Buscar producto</label>

        <div className="buscador-campo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>

          <input
            id="buscar-producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, código o código de barras"
            autoComplete="off"
          />

          {busqueda && (
            <button
              type="button"
              className="limpiar-busqueda"
              onClick={() => setBusqueda("")}
              aria-label="Borrar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          className="escanear-boton"
          onClick={() => {
            setEstadoEscaner(null);
            setEscaneando(true);
          }}
          disabled={cargando || productos.length === 0}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
          </svg>
          Escanear código
        </button>

        {cargando && <p>Cargando inventario...</p>}

        {error && (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setCargando(true);
                void cargarProductos();
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && !error && (
          <div className="resultados-productos">
            {resultados.map((producto) => (
              <button
                type="button"
                className="resultado-producto"
                key={producto.producto_id}
                onClick={() => agregarProducto(producto)}
              >
                <span className="resultado-info">
                  <strong>{producto.nombre}</strong>
                  <small>
                    Código: {producto.codigo} · Stock:{" "}
                    {formatoCantidad.format(producto.stock_actual)}
                  </small>
                </span>

                <span className="resultado-precio">
                  {moneda.format(producto.precio_venta)}
                </span>

                <span className="agregar-signo">+</span>
              </button>
            ))}

            {resultados.length === 0 && (
              <div className="sin-resultados">
                <p>
                  {busqueda.trim()
                    ? "No se encontró el producto."
                    : "No hay productos registrados."}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="carrito-seccion">
        <div className="carrito-titulo">
          <div>
            <h2>Productos de la venta</h2>
            <p>Revisa las cantidades antes de continuar.</p>
          </div>

          <span className="contador-items">
            {formatoCantidad.format(totalUnidades)} uds.
          </span>
        </div>

        {carrito.length === 0 ? (
          <div className="carrito-vacio">
            <strong>Tu venta está vacía</strong>
            <p>Busca o escanea un producto para comenzar.</p>
          </div>
        ) : (
          <div className="lista-carrito">
            {carrito.map((item) => (
              <article className="carrito-item" key={item.producto_id}>
                <div className="carrito-item-info">
                  <strong>{item.nombre}</strong>
                  <small>{moneda.format(item.precio_venta)} / unidad</small>
                  <span className="carrito-subtotal">
                    {moneda.format(item.precio_venta * item.cantidad)}
                  </span>
                  {item.cantidad > item.stock_actual && (
                    <small className="carrito-alerta-stock">
                      Stock registrado:{" "}
                      {formatoCantidad.format(Math.max(item.stock_actual, 0))}
                    </small>
                  )}
                  <button
                    type="button"
                    className="carrito-quitar"
                    onClick={() => quitarProducto(item.producto_id)}
                  >
                    Quitar
                  </button>
                </div>

                <div className="cantidad-control">
                  <button
                    type="button"
                    aria-label={`Restar una unidad de ${item.nombre}`}
                    onClick={() => cambiarCantidad(item.producto_id, -1)}
                  >
                    −
                  </button>

                  <input
                    key={item.cantidad}
                    className="cantidad-input"
                    defaultValue={item.cantidad}
                    inputMode="decimal"
                    aria-label={`Cantidad de ${item.nombre}`}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={(e) => {
                      if (!fijarCantidad(item.producto_id, e.target.value)) {
                        e.target.value = String(item.cantidad);
                      }
                    }}
                  />

                  <button
                    type="button"
                    aria-label={`Agregar una unidad de ${item.nombre}`}
                    onClick={() => cambiarCantidad(item.producto_id, 1)}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="resumen-venta">
        <div className="resumen-linea">
          <span>Productos diferentes</span>
          <span>{carrito.length}</span>
        </div>

        <div className="resumen-linea">
          <span>Unidades totales</span>
          <span>{formatoCantidad.format(totalUnidades)}</span>
        </div>

        <div className="resumen-total">
          <span>Total de la venta</span>
          <strong>{moneda.format(totalVenta)}</strong>
        </div>

        <button
          type="button"
          className="registrar-boton"
          disabled={carrito.length === 0 || registrando}
          onClick={() => void registrarVenta()}
        >
          {registrando ? "Registrando..." : "Registrar venta"}
        </button>

        {mensaje && (
          <p className="mensaje-venta" role="status">
            {mensaje}
          </p>
        )}

        {error && (
          <p className="mensaje-venta" role="alert">
            {error}
          </p>
        )}
      </section>

      {escaneando && (
        <EscanerCodigo
          titulo="Escanear productos"
          continuo
          estado={estadoEscaner}
          accion={
            codigoDesconocido
              ? {
                  texto: "Crear producto con este código",
                  alHacerClick: () => void abrirCreador(codigoDesconocido),
                }
              : null
          }
          onDetectar={alEscanear}
          onCerrar={() => setEscaneando(false)}
        />
      )}

      {creando !== null && catalogo && (
        <FormularioProducto
          producto={null}
          codigoInicial={creando}
          categorias={catalogo.categorias}
          unidades={catalogo.unidades}
          existentes={productos.map((p) => ({
            id: p.producto_id,
            nombre: p.nombre,
            codigo: p.codigo,
            codigo_barras: p.codigo_barras,
          }))}
          onCategoriaCreada={(nueva) =>
            setCatalogo((actual) =>
              actual
                ? {
                    ...actual,
                    categorias: [...actual.categorias, nueva].sort((a, b) =>
                      a.nombre.localeCompare(b.nombre)
                    ),
                  }
                : actual
            )
          }
          onGuardado={(resultado) => void alCrearProducto(resultado)}
          onCerrar={() => setCreando(null)}
        />
      )}
    </main>
  );
}
