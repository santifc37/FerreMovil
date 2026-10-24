"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter();

  const [contrasena, setContrasena] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function iniciarSesion(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");
  setCargando(true);

    try {
      const respuesta = await fetch("/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  credentials: "include",
  body: JSON.stringify({ contrasena }),
});

      const datos = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        throw new Error(
          datos?.mensaje || datos?.error || "No se pudo iniciar sesión."
        );
      }

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo conectar con la API."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <path
              d="M9 17 24 8l15 9v19H9V17Z"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M18 36V24h12v12M5 17l19-12 19 12"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="brand-name">FERREMOVIL</p>
        <h1>
          Tu ferretería,
          <br />
          en la palma de tu mano.
        </h1>
        <p className="subtitle">
          Ingresa para administrar tus ventas e inventario.
        </p>

        <form onSubmit={iniciarSesion}>
          <label htmlFor="contrasena">Contraseña de acceso</label>
          <input
            id="contrasena"
            type="password"
            placeholder="Ingresa tu contraseña"
            value={contrasena}
            onChange={(event) => setContrasena(event.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p role="alert">{error}</p>}

          <button type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <p className="footer-note">Acceso privado · Ferretería</p>
      </section>
    </main>
  );
}
