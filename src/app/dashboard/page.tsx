
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function DashboardPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargarProductos = useCallback(async (signal?: AbortSignal) => {
    setError("");

    try {
      const respuesta = await fetch("/api/inventario/stock?activo=true", {
        credentials: "include",
        cache: "no-store",
        signal,
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          datos.error || "No se pudo cargar el inventario."
        );
      }

      setProductos(datos.productos ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar el inventario."
      );
    } finally {
      if (!signal?.aborted) {
        setCargando(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

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
      const barras = producto.codigo_barras ?? "";

      return (
        nombre.includes(termino) ||
        codigo.includes(termino) ||
        barras.includes(termino)
      );
    });
  }, [productos, busqueda]);

  const totalUnidades = carrito.reduce(
    (total, item) => total + item.cantidad,
    0
  );

  const totalVenta = carrito.reduce(
    (total, item) => total + item.precio_venta * item.cantidad,
    0
  );

  function agregarProducto(producto: Producto) {
    setMensaje("");
    setError("");

    const existente = carrito.find(
      (item) => item.producto_id === producto.producto_id
    );

    if (producto.stock_actual <= 0) {
      setMensaje("Este producto no tiene existencias.");
      return;
    }

    if (existente && existente.cantidad >= producto.stock_actual) {
      setMensaje("No hay suficientes existencias.");
      return;
    }

    setCarrito((actual) => {
      const item = actual.find(
        (i) => i.producto_id === producto.producto_id
      );

      if (item) {
        return actual.map((i) =>
          i.producto_id === producto.producto_id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        );
      }

      return [...actual, { ...producto, cantidad: 1 }];
    });

    setBusqueda("");
  }

  function cambiarCantidad(productoId: string, cambio: number) {
    setCarrito((actual) =>
      actual
        .map((item) =>
          item.producto_id === productoId
            ? {
                ...item,
                cantidad: Math.min(
                  item.stock_actual,
                  item.cantidad + cambio
                ),
              }
            : item
        )
        .filter((item) => item.cantidad > 0)
    );
  }

  async function registrarVenta() {
    if (carrito.length === 0 || registrando) {
      return;
    }

    setRegistrando(true);
    setMensaje("");
    setError("");

    try {
      const respuesta = await fetch("/api/ventas", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          items: carrito.map((item) => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            unidad_id: item.unidad_base_id,
            precio_unitario: item.precio_venta,
          })),
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          datos.error || "No se pudo registrar la venta."
        );
      }

      setCarrito([]);
      setBusqueda("");
      setMensaje("Venta registrada correctamente.");

      await cargarProductos();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al registrar la venta."
      );
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <main className="ventas-page">
      <header className="ventas-header">
        <div>
          <p className="ventas-marca">FERREMOVIL</p>
          <h1>Registrar venta</h1>
          <p className="ventas-subtitulo">
            Busca los productos y agrégalos a la venta.
          </p>
        </div>
      </header>

      <section className="buscador-seccion">
        <label htmlFor="buscar-producto">Buscar producto</label>

        <div className="buscador-campo">
          <input
            id="buscar-producto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, código o código de barras"
            autoComplete="off"
          />
        </div>

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
                    {producto.stock_actual}
                  </small>
                </span>

                <span className="resultado-precio">
                  {moneda.format(producto.precio_venta)}
                </span>

                <span>+</span>
              </button>
            ))}

            {resultados.length === 0 && (
              <p>
                {busqueda.trim()
                  ? "No se encontró el producto."
                  : "No hay productos registrados."}
              </p>
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

          <span className="contador-items">{totalUnidades} uds.</span>
        </div>

        {carrito.length === 0 ? (
          <div className="carrito-vacio">
            <strong>Tu venta está vacía</strong>
            <p>Busca un producto para comenzar.</p>
          </div>
        ) : (
          <div className="lista-carrito">
            {carrito.map((item) => (
              <article
                className="carrito-item"
                key={item.producto_id}
              >
                <div className="carrito-item-info">
                  <strong>{item.nombre}</strong>
                  <small>
                    {moneda.format(item.precio_venta)} / unidad
                  </small>
                  <span className="carrito-subtotal">
                    {moneda.format(
                      item.precio_venta * item.cantidad
                    )}
                  </span>
                </div>

                <div className="cantidad-control">
                  <button
                    type="button"
                    aria-label={`Restar una unidad de ${item.nombre}`}
                    onClick={() =>
                      cambiarCantidad(item.producto_id, -1)
                    }
                  >
                    −
                  </button>

                  <span>{item.cantidad}</span>

                  <button
                    type="button"
                    aria-label={`Agregar una unidad de ${item.nombre}`}
                    disabled={item.cantidad >= item.stock_actual}
                    onClick={() =>
                      cambiarCantidad(item.producto_id, 1)
                    }
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
          <span>{totalUnidades}</span>
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
    </main>
  );
}
