import { expect, incidenciaDeLaApi, paginaDeLaApi, test } from './apoyo/panel';

/**
 * El alta: lo que la pantalla dice que pasó contra lo que pasó.
 *
 * Un formulario que confirma antes de tiempo es de los defectos más difíciles
 * de ver, porque por el camino feliz el mensaje acaba siendo verdad. Solo se
 * nota cuando la API falla, que es exactamente cuando nadie está mirando.
 */
test.describe('A · Crear una incidencia desde la pantalla', () => {
  test('A-01 · Lo que se guarda en la pantalla existe en la API', async ({ urlDelPanel, page, request }) => {
    await page.goto(urlDelPanel());

    const titulo = `Prueba de alta ${Date.now()}`;
    await page.locator('[data-prueba="campo-titulo"]').fill(titulo);
    await page.locator('[data-prueba="campo-prioridad"]').selectOption('ALTA');
    await page.locator('[data-prueba="guardar"]').click();

    const aviso = page.locator('[data-prueba="aviso"]');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText(/Guardada como INC-\d{4}/);

    // Y la comprobación que cierra el caso: preguntárselo a la API. Que la
    // pantalla diga «guardada» es lo que se quiere comprobar, no la prueba de
    // que lo esté.
    const id = (await aviso.textContent())!.match(/INC-\d{4}/)![0];
    const enLaApi = await incidenciaDeLaApi(request, id);
    expect(enLaApi.titulo).toBe(titulo);
    expect(enLaApi.prioridad).toBe('ALTA');
    expect(enLaApi.estado).toBe('ABIERTA');
  });

  test('A-02 · Si la API no guarda, la pantalla no puede decir que guardó', async ({ urlDelPanel,
    page,
    request,
  }) => {
    const antes = await paginaDeLaApi(request);

    await page.route('**/api/incidencias', async (ruta) => {
      if (ruta.request().method() !== 'POST') return ruta.continue();
      await ruta.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { codigo: 'ERROR_INTERNO', detalle: 'Vaya' } }),
      });
    });

    await page.goto(urlDelPanel());
    await page.locator('[data-prueba="campo-titulo"]').fill('Esta no se va a guardar');
    await page.locator('[data-prueba="guardar"]').click();

    const aviso = page.locator('[data-prueba="aviso"]');
    await expect(aviso).toBeVisible();

    // El usuario se marcha convencido de que dejó la incidencia puesta. Lo
    // descubre quien la busque dentro de tres semanas y no la encuentre, y
    // para entonces nadie relaciona la ausencia con un 500 de aquel martes.
    await expect(
      aviso,
      'La pantalla anunció que se guardó una incidencia que la API rechazó con un 500',
    ).not.toHaveText(/^Guardada$/);
    await expect(aviso).toHaveText(/no se guard/i);

    // Y que no se creara nada de verdad.
    const despues = await paginaDeLaApi(request);
    expect(despues.total).toBe(antes.total);
  });

  test('A-03 · Un título demasiado corto no crea nada', async ({ urlDelPanel, page, request }) => {
    const antes = await paginaDeLaApi(request);

    await page.goto(urlDelPanel());
    await page.locator('[data-prueba="campo-titulo"]').fill('abc');
    await page.locator('[data-prueba="guardar"]').click();

    // Aquí se comprueba el efecto, no el mensaje: la validación vive en la
    // API —que responde 400— y lo que importa es que la colección no crezca.
    // Exigir además un texto concreto mezclaría dos cosas, y A-02 ya cubre lo
    // que la pantalla tiene que decir cuando la API rechaza.
    await expect
      .poll(async () => (await paginaDeLaApi(request)).total, { timeout: 3000 })
      .toBe(antes.total);
  });

  test('A-04 · Tras guardar, el formulario queda listo para el siguiente', async ({ urlDelPanel, page }) => {
    await page.goto(urlDelPanel());

    await page.locator('[data-prueba="campo-titulo"]').fill(`Otra prueba ${Date.now()}`);
    await page.locator('[data-prueba="guardar"]').click();
    await expect(page.locator('[data-prueba="aviso"]')).toContainText(/Guardada como/);

    // Un campo que no se limpia hace que el siguiente que escriba a medias
    // cree un duplicado del anterior sin darse cuenta.
    await expect(page.locator('[data-prueba="campo-titulo"]')).toHaveValue('');
    await expect(page.locator('[data-prueba="tabla"]')).toBeVisible();
  });
});
