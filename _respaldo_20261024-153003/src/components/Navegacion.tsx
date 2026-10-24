"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const enlaces = [
  { href: "/dashboard", texto: "Vender" },
  { href: "/productos", texto: "Productos" },
];

export default function Navegacion() {
  const ruta = usePathname();
  const router = useRouter();

  async function salir() {
    try {
      await api("/auth/logout", { metodo: "POST" });
    } catch {
      // Aunque falle la llamada, volvemos al inicio de sesión.
    }

    router.push("/");
  }

  return (
    <nav className="fm-nav" aria-label="Principal">
      <span className="fm-nav-marca">FERREMOVIL</span>

      <div className="fm-nav-enlaces">
        {enlaces.map((enlace) => (
          <Link
            key={enlace.href}
            href={enlace.href}
            className={ruta === enlace.href ? "fm-nav-activo" : undefined}
            aria-current={ruta === enlace.href ? "page" : undefined}
          >
            {enlace.texto}
          </Link>
        ))}

        <button type="button" className="fm-nav-salir" onClick={() => void salir()}>
          Salir
        </button>
      </div>
    </nav>
  );
}
