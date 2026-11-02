import { expect, paginaDeLaApi, test } from './apoyo/panel';

/**
 * El listado, comparado con lo que la API guarda.
 *
 * Ninguna comprobación de este archivo escribe un valor esperado a mano. Lo
 * que se afirma siempre es que la pantalla y la API dicen lo mismo: si la
 * expectativa estuviera escrita en la prueba, lo que se comprobaría es que la
 * pantalla coincide con lo que yo creía.
 */
test.describe('L · El listado enseña lo que la API guarda', () => {
  test('L-01 · Cada fila trae los datos de su incidencia', async ({ urlDelPanel, page, request }) => {
    const pagina = await paginaDeLaApi(request);
    await page.goto(urlDelPanel());

    const filas = page.locator('[data-prueba="fila"]');
    await expect(filas).toHaveCount(pagina.datos.length);

    // Las cinco, no la primera. El registro que viene de otro sitio —de una
    // migración a medias, de un caché viejo— nunca es el primero: el primero
    // es el de siempre, el que está bien.
    for (const [indice, esperada] of pagina.datos.entries()) {
      const fila = filas.nth(indice);
      await expect(fila.locator('[data-prueba="id"]')).toHaveText(esperada.id);
      await expect(fila.locator('[data-prueba="titulo"]')).toHaveText(esperada.titulo);
      await expect(fila.locator('[data-prueba="prioridad"]')).toHaveText(esperada.prioridad);
      await expect(fila.locator('[data-prueba="estado"]')).toHaveText(
        esperada.estado.replace('_', ' '),
      );
    }
  });

  test('L-02 · El contador dice cuántas hay, no cuántas se ven', async ({ urlDelPanel, page, request }) => {
    const pagina = await paginaDeLaApi(request);
    await page.goto(urlDelPanel());

    await expect(page.locator('[data-prueba="fila"]')).toHaveCount(pagina.tam);

    // La API devuelve `total` (la colección) y `datos` (esta página), y son
    // números distintos. El contador tiene que pintar el primero.
    //
    // Si pinta el segundo, el número sigue siendo creíble —cinco, en una tabla
    // de cinco filas— y nadie sospecha. Quien mire el panel concluirá que hay
    // cinco incidencias abiertas cuando hay doce.
    await expect(page.locator('[data-prueba="contador"]')).toHaveText(
      `${pagina.total} incidencias`,
    );
  });

  test('L-03 · La segunda página trae otras incidencias, y son las de la API', async ({ urlDelPanel,
    page,
    request,
  }) => {
    const primera = await paginaDeLaApi(request, 1);
    const segunda = await paginaDeLaApi(request, 2);

    await page.goto(urlDelPanel());
    await expect(page.locator('[data-prueba="fila"]').first().locator('[data-prueba="id"]'))
      .toHaveText(primera.datos[0].id);

    await page.getByRole('button', { name: 'Siguiente' }).click();

    await expect(page.locator('[data-prueba="pagina"]')).toHaveText('Página 2');
    const ids = await page.locator('[data-prueba="fila"] [data-prueba="id"]').allTextContents();
    expect(ids).toEqual(segunda.datos.map((i) => i.id));

    // Y que de verdad haya cambiado: dos páginas con el mismo contenido serían
    // una paginación que no pagina, y el recuento de filas no lo delata.
    expect(ids).not.toEqual(primera.datos.map((i) => i.id));
  });

  test('L-04 · En la última página no se puede seguir avanzando', async ({ urlDelPanel, page, request }) => {
    const primera = await paginaDeLaApi(request);
    const ultima = Math.ceil(primera.total / primera.tam);

    await page.goto(urlDelPanel());
    for (let i = 1; i < ultima; i++) {
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await expect(page.locator('[data-prueba="pagina"]')).toHaveText(`Página ${i + 1}`);
    }

    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });

  test('L-05 · El importe se escribe como moneda y es el de la API', async ({ urlDelPanel, page, request }) => {
    const pagina = await paginaDeLaApi(request);
    await page.goto(urlDelPanel());

    // Este campo está bien a propósito. Una suite en la que todo lo que mira
    // está roto no ha demostrado que sepa distinguir: solo que siempre dice
    // que no.
    const esperado = new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
    }).format(pagina.datos[0].coste);

    await expect(
      page.locator('[data-prueba="fila"]').first().locator('[data-prueba="coste"]'),
    ).toHaveText(esperado);
  });
});
