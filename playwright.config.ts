import { defineConfig, devices } from '@playwright/test';
import type { OpcionesDelPanel } from './pruebas/apoyo/panel';

const PUERTO = Number(process.env.PUERTO ?? 8099);
const BASE = process.env.BASE_URL ?? `http://localhost:${PUERTO}`;

export default defineConfig<OpcionesDelPanel>({
  testDir: './pruebas',

  // Secuencial. Los escenarios de alta crean incidencias de verdad y el
  // contador mira la colección entera: dos pruebas a la vez se mueven el
  // número la una a la otra y el fallo aparece en la prueba equivocada.
  // Lo que se ahorraría paralelizando son segundos; lo que costaría es una
  // suite que falla a veces, y una suite que falla a veces se relanza hasta
  // que pase.
  workers: 1,
  fullyParallel: false,

  // Cero reintentos, también en el CI.
  //
  // Un reintento convierte un fallo intermitente en un verde con asterisco, y
  // el asterisco no lo lee nadie. Si una prueba de aquí falla una de cada
  // cinco veces, lo que hay que arreglar es la prueba.
  retries: 0,

  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE,

    /**
     * La zona horaria se fija aquí, y es la decisión más importante del
     * archivo.
     *
     * Sin esto, una comprobación sobre una fecha pasa en el equipo de quien la
     * escribió y falla en el CI, que corre en UTC. El reflejo entonces es
     * relajar la aserción —comprobar solo que «hay algo con pinta de fecha»—
     * y con eso se pierde justo lo que había que comprobar.
     *
     * Con la zona fijada, el desfase deja de ser ruido y pasa a ser el
     * resultado: la pantalla enseña las 21:15 del día 2 para una incidencia
     * que la API guarda a las 02:15 del día 3.
     */
    timezoneId: 'America/Lima',
    locale: 'es-PE',

    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      // La pantalla tal cual, con sus cuatro defectos. Aquí la suite TIENE
      // que ponerse roja, y exactamente cuatro veces.
      name: 'defectuosa',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CANAL ?? 'chrome',
        corregida: false,
      },
    },
    {
      // La misma pantalla con los cuatro apagados. Aquí la suite tiene que
      // pasar entera: si falla algo, la aserción está inventando un defecto.
      name: 'corregida',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CANAL ?? 'chrome',
        corregida: true,
      },
    },
  ],

  // `channel` y no el chromium que trae Playwright: en una instalación sin el
  // headless shell descargado, lanzar chromium falla con un error de binario
  // que no dice nada sobre lo que falta. Con el Chrome del sistema funciona en
  // cualquier equipo que ya navegue, y en el CI se instala con
  // `npx playwright install chrome`.

  // Levanta la API y la interfaz antes de correr nada, y las apaga al acabar.
  // Sin esto, el primer escenario falla con «connection refused», que no es el
  // fallo que interesa.
  webServer: {
    command: 'node demo/servidor.js',
    url: `${BASE}/api/salud`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
    env: { PUERTO: String(PUERTO) },
  },
});
