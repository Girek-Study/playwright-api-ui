import { diaEnZona, enZona, expect, paginaDeLaApi, test } from './apoyo/panel';

/**
 * La hora que enseña la pantalla contra la hora que guarda la API.
 *
 * Es el desajuste más caro de los que caben entre una API y su interfaz, y el
 * que menos se prueba, porque las dos partes están bien por separado: la API
 * guarda un ISO 8601 correcto con su Z, y la pantalla pinta una hora que
 * existe. Lo único que no cuadra es que no son la misma.
 *
 * La zona del navegador la fija `playwright.config.ts` en America/Lima. Sin
 * esa línea, estas comprobaciones pasarían en un equipo y fallarían en el CI,
 * que corre en UTC, y el arreglo habitual —comprobar solo que «hay algo con
 * pinta de fecha»— borra justo lo que había que comprobar.
 */
test.describe('F · Fechas: lo que se guarda contra lo que se lee', () => {
  const ZONA_DEL_NAVEGADOR = 'America/Lima';

  test('F-01 · La fecha de la pantalla es la que guardó la API', async ({ urlDelPanel, page, request }) => {
    const pagina = await paginaDeLaApi(request);
    const primera = pagina.datos[0];

    await page.goto(urlDelPanel());
    const enPantalla = await page
      .locator('[data-prueba="fila"]')
      .first()
      .locator('[data-prueba="creada"]')
      .textContent();

    // La API guarda `2026-11-03T02:15:00Z`. En Lima eso son las 21:15 del
    // día 2: la pantalla no solo enseña otra hora, enseña otro DÍA.
    //
    // Quien lea el panel y quien consulte la base de datos discutirán sobre
    // cuándo entró la incidencia, y los dos tendrán razón.
    const comoLaGuardaLaApi = enZona(primera.creadaEn, 'UTC');
    const comoLaPintaElNavegador = enZona(primera.creadaEn, ZONA_DEL_NAVEGADOR);
    expect(
      comoLaGuardaLaApi,
      'la siembra tiene que incluir una hora que cambie de día entre las dos zonas',
    ).not.toBe(comoLaPintaElNavegador);

    expect(
      enPantalla,
      `La pantalla escribe «${enPantalla}» para una incidencia que la API guarda a las ` +
        `${comoLaGuardaLaApi} UTC. Si la hora se pinta en la zona del navegador, tiene que ` +
        `decirlo; si no lo dice, el lector supone que es la del registro.`,
    ).toContain(comoLaGuardaLaApi);
  });

  test('F-02 · Ninguna fila enseña una fecha inventada', async ({ urlDelPanel, page, request }) => {
    const pagina = await paginaDeLaApi(request);
    await page.goto(urlDelPanel());

    const textos = await page
      .locator('[data-prueba="fila"] [data-prueba="creada"]')
      .allTextContents();

    // Esta comprobación pasa en las dos versiones, y está para eso: cada hora
    // de la pantalla se corresponde con el registro de SU fila, en una zona o
    // en la otra. Sin ella, un listado que pintara todas las fechas iguales
    // —un error de índice al construir la fila— pasaría desapercibido mientras
    // la primera cuadrase.
    expect(textos).toHaveLength(pagina.datos.length);
    for (const [indice, incidencia] of pagina.datos.entries()) {
      const posibles = [
        enZona(incidencia.creadaEn, 'UTC'),
        enZona(incidencia.creadaEn, ZONA_DEL_NAVEGADOR),
      ];
      expect(
        posibles.some((p) => textos[indice].includes(p)),
        `La fila ${indice + 1} enseña «${textos[indice]}», que no es ${incidencia.creadaEn} ` +
          `ni en UTC ni en ${ZONA_DEL_NAVEGADOR}`,
      ).toBe(true);
    }
  });

  test('F-03 · Las fechas de la siembra sirven para notar un desfase', async ({ request }) => {
    const pagina = await paginaDeLaApi(request);

    // Una comprobación sobre la propia prueba, y no sobra.
    //
    // Si alguien cambia la siembra a horas de media tarde, F-01 dejaría de
    // detectar el desfase: las 14:00 UTC y las 09:00 de Lima son el mismo día
    // y la aserción pasaría con el defecto intacto. Una prueba que deja de
    // poder fallar no avisa de que ha dejado de servir.
    const cambianDeDia = pagina.datos.filter(
      (i) => diaEnZona(i.creadaEn, 'UTC') !== diaEnZona(i.creadaEn, ZONA_DEL_NAVEGADOR),
    );

    expect(
      cambianDeDia.length,
      'La primera página necesita al menos una incidencia cuya hora caiga en días ' +
        'distintos según la zona; si no, F-01 no puede detectar el desfase.',
    ).toBeGreaterThan(0);
  });
});
