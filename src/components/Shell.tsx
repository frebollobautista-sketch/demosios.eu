"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Header } from "./Header";
import { BannerAvatar } from "./BannerAvatar";
import { BannerSuscripcion } from "./BannerSuscripcion";
import { PERFIL_DEMO } from "@/lib/perfil/mock";
import { useSession } from "@/lib/auth/useSession";

const STORAGE_KEY = "ocre.suscripcion.cerrada";

/** Servidor: asumimos cerrado para no mostrar nada hasta hidratar. */
function getServerSnapshot(): boolean {
  return true;
}

/** Cliente: leemos la preferencia guardada. */
function getSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

/** Suscripción a cambios cross-tab. */
function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handler);
  // eventos internos de la misma pestaña:
  const internal = () => onStoreChange();
  window.addEventListener("ocre:suscripcion-cambio", internal);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("ocre:suscripcion-cambio", internal);
  };
}

function fireChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ocre:suscripcion-cambio"));
  }
}

/**
 * Shell cliente: aloja header + banner flotante de avatar + banner
 * de suscripción. Controla el estado abierto/cerrado del banner de
 * suscripción mediante localStorage y useSyncExternalStore — así el
 * SSR no parpadea y no caemos en setState dentro de useEffect.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const cerrada = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { user, cargando } = useSession();

  const abrir = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      fireChange();
    }
  }, []);

  const cerrar = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
      fireChange();
    }
  }, []);

  // Banner flotante del avatar solo cuando hay sesión. Cuando conectemos
  // las contribuciones reales, sustituimos PERFIL_DEMO por una lectura
  // de profiles + contribuciones del usuario actual.
  const mostrarAvatar = !cargando && user !== null;

  return (
    <>
      <Header onOpenSubscribe={abrir} />
      <main className="flex-1 w-full">{children}</main>
      <BannerSuscripcion abierto={!cerrada} onAbrir={abrir} onCerrar={cerrar} />
      {mostrarAvatar && <BannerAvatar perfil={PERFIL_DEMO} />}
    </>
  );
}
