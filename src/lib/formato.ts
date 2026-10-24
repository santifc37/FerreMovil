export const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Cantidades con hasta tres decimales (metros, kilos, etc.). */
export const cantidad = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 3,
});
