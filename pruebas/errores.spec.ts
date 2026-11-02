import { expect, test } from './apoyo/panel';

/**
 * Qué enseña la pantalla cuando la API no coopera.
 *
 * Estos escenarios no necesitan que el servicio falle de verdad: interceptan
 * la petición en el navegador y responden lo que haga falta. Es lo que hace
 * falta para probar un 500 sin tener que romper la API, y lo que convierte una
 * rama imposible de ensayar en un escenario de cuatro líneas.
 *
 *     await page.route('**\/api/incidencias*', (ruta) => ruta.fulfill({ status: 500 }));
 *
 * La rama de error es, con diferencia, la menos probada de cualquier interfaz,
 * y es la que decide si alguien se va a casa creyendo que no hay trabajo
 * pendiente.
 */
test.describe('E · La pantalla cuando la API no responde bien', () => {
  test('E-01 · Un 500 se enseña como error, no como lista vacía', async ({ urlDelPanel, page }) => {
    await page.route('**/api/incidencias*', (ruta) =>
      ruta.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { codigo: 'ERROR_INTERNO', detalle: 'Vaya' } }),
      }),
    );

    await page.goto(urlDelPanel());

    // «No hay incidencias» y «no he podido preguntarlo» son dos frases
    // distintas, y la segunda es la verdad. Quien lee la primera concluye que
    // no hay nada pendiente y cierra el panel.
    //
    // Un error dibujado como vacío no es una degradación elegante: es una
    // respuesta falsa con buena presentación.
    await expect(
      page.locator('[data-prueba="vacio"]'),
      'Un fallo del servicio no puede enseñarse como «no hay incidencias»',
    ).toBeHidden();

    await expect(page.locator('[data-prueba="fallo"]')).toBeVisible();
    await expect(page.locator('[data-prueba="tabla"]')).toBeHidden();
  });

  test('E-02 · Una colección vacía de verdad sí dice que está vacía', async ({ urlDelPanel, page }) => {
    await page.route('**/api/incidencias*', (ruta) =>
      ruta.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ datos: [], total: 0, pagina: 1, tam: 5 }),
      }),
    );

    await page.goto(urlDelPanel());

    // La otra mitad de E-01. Sin este escenario, una interfaz que enseñara
    // SIEMPRE el error pasaría E-01 con nota y sería igual de inútil.
    await expect(page.locator('[data-prueba="vacio"]')).toBeVisible();
    await expect(page.locator('[data-prueba="fallo"]')).toBeHidden();
    await expect(page.locator('[data-prueba="contador"]')).toHaveText('0 incidencias');
  });

  test('E-03 · Mientras la API tarda, la pantalla dice que está cargando', async ({ urlDelPanel, page }) => {
    let liberar: () => void = () => {};
    const enEspera = new Promise<void>((resolve) => {
      liberar = resolve;
    });

    await page.route('**/api/incidencias*', async (ruta) => {
      // La respuesta se queda retenida hasta que la prueba la suelte. Es más
      // fiable que un retardo fijo: con un `sleep` de dos segundos, la
      // comprobación compite con el reloj y falla en una máquina cargada.
      await enEspera;
      await ruta.continue();
    });

    await page.goto(urlDelPanel(), { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-prueba="cargando"]')).toBeVisible();
    await expect(page.locator('[data-prueba="vacio"]')).toBeHidden();
    await expect(page.locator('[data-prueba="fallo"]')).toBeHidden();

    liberar();
    await expect(page.locator('[data-prueba="tabla"]')).toBeVisible();
    await expect(page.locator('[data-prueba="cargando"]')).toBeHidden();
  });

  test('E-04 · Un corte de red se enseña como corte, no como vacío', async ({ urlDelPanel, page }) => {
    await page.route('**/api/incidencias*', (ruta) => ruta.abort('connectionrefused'));

    await page.goto(urlDelPanel());

    await expect(page.locator('[data-prueba="fallo"]')).toBeVisible();
    await expect(page.locator('[data-prueba="vacio"]')).toBeHidden();
  });

  test('E-05 · La pantalla no pide la colección entera para enseñar cinco filas', async ({ urlDelPanel,
    page,
  }) => {
    const peticiones: string[] = [];
    page.on('request', (p) => {
      if (p.url().includes('/api/incidencias')) peticiones.push(p.url());
    });

    await page.goto(urlDelPanel());
    await expect(page.locator('[data-prueba="tabla"]')).toBeVisible();

    // Que la paginación sea de verdad y no un recorte en el navegador. Una
    // interfaz que se baja las doce mil filas y enseña cinco funciona
    // perfectamente con doce, y tumba el servicio el día que haya doce mil.
    // Mirar la red es la única forma de distinguirlo desde fuera.
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0]).toContain('tam=5');
    expect(peticiones[0]).toContain('pagina=1');
  });
});
