"use client";

import { useMemo, useState } from "react";

type Producto = {
  id: number;
  nombre: string;
  codigo: string;
  precio: number;
  stock: number;
};

type ItemCarrito = Producto & {
  cantidad: number;
};

const productosIniciales: Producto[] = [
  { id: 1, nombre: "Martillo de uña", codigo: "77010001", precio: 25000, stock: 12 },
  { id: 2, nombre: "Destornillador estrella", codigo: "77010002", precio: 8500, stock: 20 },
  { id: 3, nombre: "Cinta aislante", codigo: "77010003", precio: 4500, stock: 35 },
  { id: 4, nombre: "Tornillo 2 pulgadas", codigo: "77010004", precio: 300, stock: 150 },
];

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export default function DashboardPage() {
  const [productos] = useState(productosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [mensaje, setMensaje] = useState("");

  const resultados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return [];

    return productos.filter(
      (producto) =>
        producto.nombre.toLowerCase().includes(termino) ||
        producto.codigo.toLowerCase().includes(termino)
    );
  }, [busqueda, productos]);

  const totalUnidades = carrito.reduce((total, item) => total + item.cantidad, 0);
  const totalVenta = carrito.reduce(
    (total, item) => total + item.precio * item.cantidad,
    0
  );

  function agregarProducto(producto: Producto) {
    setMensaje("");

    setCarrito((actual) => {
      const existente = actual.find((item) => item.id === producto.id);

      if (existente) {
        if (existente.cantidad >= producto.stock) {
          setMensaje("No puedes superar las existencias disponibles.");
          return actual;
        }

        return actual.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }

      if (producto.stock <= 0) {
        setMensaje("Este producto no tiene existencias.");
        return actual;
      }

      return [...actual, { ...producto, cantidad: 1 }];
    });

    setBusqueda("");
  }

  function cambiarCantidad(id: number, cambio: number) {
    setMensaje("");

    setCarrito((actual) =>
      actual
        .map((item) => {
          if (item.id !== id) return item;

          return {
            ...item,
            cantidad: Math.min(item.stock, item.cantidad + cambio),
          };
        })
        .filter((item) => item.cantidad > 0)
    );
  }

  function registrarVenta() {
    setMensaje(
      "Interfaz de prueba: todavía no se ha registrado ninguna venta."
    );
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
        <div className="ventas-icono" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="20" r="1.2" fill="currentColor" />
            <circle cx="18" cy="20" r="1.2" fill="currentColor" />
          </svg>
        </div>
      </header>

      <section className="buscador-seccion">
        <label htmlFor="buscar-producto">Buscar producto</label>
        <div className="buscador-campo">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            id="buscar-producto"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Nombre o código de barras"
            autoComplete="off"
          />
          {busqueda && (
            <button
              className="limpiar-busqueda"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar búsqueda"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          className="escanear-boton"
          onClick={() =>
            setMensaje("El escáner con cámara se implementará en el siguiente paso.")
          }
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 8V5h4M16 5h4v3M20 16v3h-4M8 19H4v-3M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Escanear código
        </button>

        {busqueda && (
          <div className="resultados-productos">
            {resultados.length > 0 ? (
              resultados.map((producto) => (
                <button
                  type="button"
                  className="resultado-producto"
                  key={producto.id}
                  onClick={() => agregarProducto(producto)}
                >
                  <span className="producto-mini-icono" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <path d="m4 7 8 4 8-4M12 11v10" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <span className="resultado-info">
                    <strong>{producto.nombre}</strong>
                    <small>Código: {producto.codigo} · Stock: {producto.stock}</small>
                  </span>
                  <span className="resultado-precio">{moneda.format(producto.precio)}</span>
                  <span className="agregar-signo">+</span>
                </button>
              ))
            ) : (
              <div className="sin-resultados">
                <p>No se encontró el producto.</p>
                <button
                  type="button"
                  onClick={() =>
                    setMensaje("La creación de productos se implementará en el siguiente paso.")
                  }
                >
                  + Crear producto
                </button>
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
          <span className="contador-items">{totalUnidades} uds.</span>
        </div>

        {carrito.length === 0 ? (
          <div className="carrito-vacio">
            <div className="carrito-vacio-icono">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="20" r="1.2" fill="currentColor" />
                <circle cx="18" cy="20" r="1.2" fill="currentColor" />
              </svg>
            </div>
            <strong>Tu venta está vacía</strong>
            <p>Busca un producto arriba para comenzar.</p>
          </div>
        ) : (
          <div className="lista-carrito">
            {carrito.map((item) => (
              <article className="carrito-item" key={item.id}>
                <div className="producto-mini-icono" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="m4 7 8 4 8-4M12 11v10" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </div>
                <div className="carrito-item-info">
                  <strong>{item.nombre}</strong>
                  <small>{moneda.format(item.precio)} / unidad</small>
                  <span className="carrito-subtotal">
                    {moneda.format(item.precio * item.cantidad)}
                  </span>
                </div>
                <div className="cantidad-control">
                  <button
                    type="button"
                    onClick={() => cambiarCantidad(item.id, -1)}
                    aria-label={`Disminuir ${item.nombre}`}
                  >
                    −
                  </button>
                  <span>{item.cantidad}</span>
                  <button
                    type="button"
                    disabled={item.cantidad >= item.stock}
                    onClick={() => cambiarCantidad(item.id, 1)}
                    aria-label={`Aumentar ${item.nombre}`}
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
          disabled={carrito.length === 0}
          onClick={registrarVenta}
        >
          Registrar venta
          <span aria-hidden="true">→</span>
        </button>
        {mensaje && <p className="mensaje-venta" role="status">{mensaje}</p>}
        <p className="nota-prueba">
          Los datos actuales son de demostración; no se guardan ventas reales.
        </p>
      </section>
    </main>
  );
}