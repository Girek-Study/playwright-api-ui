import { test as base, type APIRequestContext } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * Apoyo compartido. Nada de esto son comprobaciones: está aquí para que un
 * escenario se lea como lo que compara y no como una pila de fetch.
 */

export interface OpcionesDelPanel {
  /**
   * Qué versión de la pantalla se prueba. La API es idéntica en las dos; lo
   * único que cambia es cómo dibuja.
   *
   * Es una opción de proyecto y no una variable de entorno a propósito: con
   * `--project=corregida` se elige desde la línea de órdenes igual en Windows
   * que en Linux, y el informe dice en qué versión falló cada escenario sin
   * tener que recordar con qué variable se lanzó.
   */
  corregida: boolean;
}

export interface UtilesDelPanel {
  /** La URL del panel, con el interruptor de la versión corregida si toca. */
  urlDelPanel: (extra?: Record<string, string>) => string;
}

export const test = base.extend<OpcionesDelPanel & UtilesDelPanel>({
  corregida: [false, { option: true }],

  urlDelPanel: async ({ corregida }, usar) => {
    await usar((extra: Record<string, string> = {}) => {
      const parametros = new URLSearchParams(extra);
      if (corregida) parametros.set('corregida', '1');
      const cola = parametros.toString();
      return cola ? `/?${cola}` : '/';
    });
  },
});


export interface Incidencia {
  id: string;
  titulo: string;
  prioridad: string;
  estado: string;
  creadaEn: string;
  solicitante: string;
  coste: number;
}

export interface PaginaDeIncidencias {
  datos: Incidencia[];
  total: number;
  pagina: number;
  tam: number;
}

/**
 * Lee una página directamente de la API.
 *
 * Es la otra mitad de cada comprobación de este repositorio: la pantalla dice
 * una cosa, la API dice otra, y lo que se afirma es que coinciden. Sin esta
 * función habría que escribir en la prueba el valor esperado, y entonces lo
 * que se comprobaría es que la pantalla coincide con lo que yo creía, no con
 * lo que el sistema guarda.
 */
export async function paginaDeLaApi(
  request: APIRequestContext,
  pagina = 1,
  tam = 5,
): Promise<PaginaDeIncidencias> {
  const respuesta = await request.get(`/api/incidencias?pagina=${pagina}&tam=${tam}`);
  if (!respuesta.ok()) {
    throw new Error(`La API respondió ${respuesta.status()} al preparar el escenario`);
  }
  return respuesta.json();
}

export async function incidenciaDeLaApi(
  request: APIRequestContext,
  id: string,
): Promise<Incidencia> {
  const respuesta = await request.get(`/api/incidencias/${id}`);
  if (!respuesta.ok()) {
    throw new Error(`La API respondió ${respuesta.status()} al pedir ${id}`);
  }
  return respuesta.json();
}

/**
 * Una fecha ISO escrita en una zona concreta, con el mismo formato corto que
 * usa la pantalla.
 *
 * La zona se nombra en el argumento y no se toma del entorno: una prueba de
 * fechas que depende de la zona de la máquina pasa en un sitio y falla en
 * otro, y el arreglo habitual —relajar la aserción— borra justo lo que había
 * que comprobar.
 */
export function enZona(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/** El día del mes que le corresponde a una fecha ISO en una zona dada. */
export function diaEnZona(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-PE', { timeZone, day: 'numeric' }).format(new Date(iso));
}
