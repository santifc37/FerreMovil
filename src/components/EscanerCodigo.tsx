"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

type Props = {
  titulo?: string;
  /** Si es true, la cámara sigue activa después de cada lectura. */
  continuo?: boolean;
  /** Mensaje sobre la última lectura (solo en modo continuo). */
  estado?: { tipo: "ok" | "error"; texto: string } | null;
  /** Botón extra bajo el mensaje, por ejemplo "Crear producto con este código". */
  accion?: { texto: string; alHacerClick: () => void } | null;
  onDetectar: (codigo: string) => void;
  onCerrar: () => void;
};

const ESPERA_MISMO_CODIGO_MS = 2000;

function mensajeDeCamara(error: unknown): string {
  const nombre = error instanceof Error ? error.name : "";

  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    return "No hay permiso para usar la cámara. Actívalo en el navegador o escribe el código a mano.";
  }

  if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
    return "No se encontró una cámara en este dispositivo. Escribe el código a mano.";
  }

  if (nombre === "NotReadableError") {
    return "La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.";
  }

  return "No se pudo iniciar la cámara. Escribe el código a mano.";
}

export default function EscanerCodigo({
  titulo = "Escanear código",
  continuo = false,
  estado = null,
  accion = null,
  onDetectar,
  onCerrar,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const alDetectar = useRef(onDetectar);
  const ultimaLectura = useRef<{ texto: string; hora: number } | null>(null);

  const [errorCamara, setErrorCamara] = useState(() =>
    typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia
      ? "La cámara solo funciona con una conexión segura (https). Escribe el código a mano."
      : ""
  );
  const [manual, setManual] = useState("");

  // Siempre usamos la versión más reciente de la función, sin reiniciar la cámara.
  useEffect(() => {
    alDetectar.current = onDetectar;
  });

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    let activo = true;
    let controles: IScannerControls | undefined;
    const lector = new BrowserMultiFormatReader();

    lector
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        video,
        (resultado) => {
          // Sin resultado = todavía no se ve ningún código; es lo normal.
          if (!resultado || !activo) {
            return;
          }

          const texto = resultado.getText().trim();

          if (!texto) {
            return;
          }

          const ahora = Date.now();
          const anterior = ultimaLectura.current;

          if (
            anterior &&
            anterior.texto === texto &&
            ahora - anterior.hora < ESPERA_MISMO_CODIGO_MS
          ) {
            return;
          }

          ultimaLectura.current = { texto, hora: ahora };
          navigator.vibrate?.(60);
          alDetectar.current(texto);
        }
      )
      .then((c) => {
        if (activo) {
          controles = c;
        } else {
          c.stop();
        }
      })
      .catch((error: unknown) => {
        if (activo) {
          setErrorCamara(mensajeDeCamara(error));
        }
      });

    return () => {
      activo = false;
      controles?.stop();
    };
  }, []);

  function enviarManual(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const codigo = manual.trim();

    if (!codigo) {
      return;
    }

    setManual("");
    alDetectar.current(codigo);
  }

  return (
    <div
      className="fm-modal-fondo fm-modal-escaner"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) {
          onCerrar();
        }
      }}
    >
      <section
        className="fm-modal fm-escaner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="escaner-titulo"
      >
        <header className="fm-modal-cabecera">
          <h2 id="escaner-titulo">{titulo}</h2>
          <button
            type="button"
            className="fm-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar escáner"
          >
            ×
          </button>
        </header>

        <div className="fm-video-caja">
          <video ref={videoRef} muted playsInline />
          {!errorCamara && <div className="fm-video-marco" aria-hidden="true" />}
        </div>

        {errorCamara ? (
          <p className="fm-aviso fm-aviso-error" role="alert">
            {errorCamara}
          </p>
        ) : (
          <p className="fm-ayuda">
            Apunta la cámara al código de barras o QR del producto.
          </p>
        )}

        {continuo && estado && (
          <p
            className={`fm-aviso ${
              estado.tipo === "ok" ? "fm-aviso-ok" : "fm-aviso-error"
            }`}
            role="status"
          >
            {estado.texto}
          </p>
        )}

        {continuo && accion && (
          <button
            type="button"
            className="fm-btn fm-btn-claro fm-btn-bloque"
            onClick={accion.alHacerClick}
          >
            {accion.texto}
          </button>
        )}

        <form className="fm-manual" onSubmit={enviarManual}>
          <label htmlFor="codigo-manual">¿No lee? Escribe el código</label>
          <div className="fm-manual-fila">
            <input
              id="codigo-manual"
              value={manual}
              onChange={(evento) => setManual(evento.target.value)}
              placeholder="Código o código de barras"
              autoComplete="off"
              inputMode="text"
            />
            <button type="submit" className="fm-btn" disabled={!manual.trim()}>
              Usar
            </button>
          </div>
        </form>

        {continuo && (
          <button type="button" className="fm-btn fm-btn-bloque" onClick={onCerrar}>
            Listo
          </button>
        )}
      </section>
    </div>
  );
}
