export type Categoria = {
  id: string;
  nombre: string;
  activo: boolean;
};

export type Unidad = {
  id: string;
  codigo: string;
  nombre: string;
};

export type ProductoCatalogo = {
  id: string;
  codigo: string;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  categoria_id: string;
  unidad_base_id: string;
  precio_compra: number;
  precio_venta: number;
  stock_minimo: number;
  activo: boolean;
};

export class ErrorApi extends Error {
  status: number;

  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.name = "ErrorApi";
    this.status = status;
  }
}

type Opciones = {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  claveIdempotencia?: string;
  signal?: AbortSignal;
};

export function esAborto(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * crypto.randomUUID solo existe en contextos seguros (HTTPS o localhost).
 * Al probar desde el celular por la red local no está disponible.
 */
export function nuevaClave(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Llama a la API a través del proxy de Next (/api/* → API_URL/*).
 * Si la sesión venció, vuelve al inicio de sesión.
 */
export async function api<T>(
  ruta: string,
  opciones: Opciones = {}
): Promise<T> {
  const cabeceras: Record<string, string> = {};

  if (opciones.cuerpo !== undefined) {
    cabeceras["Content-Type"] = "application/json";
  }

  if (opciones.claveIdempotencia) {
    cabeceras["Idempotency-Key"] = opciones.claveIdempotencia;
  }

  let respuesta: Response;

  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: opciones.metodo ?? "GET",
      credentials: "include",
      cache: "no-store",
      headers: cabeceras,
      body:
        opciones.cuerpo !== undefined
          ? JSON.stringify(opciones.cuerpo)
          : undefined,
      signal: opciones.signal,
    });
  } catch (error) {
    if (esAborto(error)) {
      throw error;
    }

    throw new ErrorApi(
      "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
      0
    );
  }

  const datos = await respuesta.json().catch(() => null);

  if (respuesta.status === 401 && typeof window !== "undefined") {
    // Recarga completa a propósito: esta función no vive dentro de un componente.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
    throw new ErrorApi("Tu sesión venció. Ingresa de nuevo.", 401);
  }

  if (!respuesta.ok) {
    throw new ErrorApi(
      datos?.error ||
        datos?.mensaje ||
        "No se pudo completar la solicitud.",
      respuesta.status
    );
  }

  return datos as T;
}

export function mensajeDeError(error: unknown, porDefecto: string): string {
  return error instanceof Error && error.message ? error.message : porDefecto;
}

/** Convierte "12,5" o "12.5" en número; devuelve null si no es válido. */
export function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");

  if (limpio === "") {
    return null;
  }

  const numero = Number(limpio);

  return Number.isFinite(numero) ? numero : null;
}
