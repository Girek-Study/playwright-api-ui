# 2. Diseño de casos

17 escenarios en cuatro archivos. Cada uno lee el mismo dato por dos caminos —la API y la
pantalla— y afirma que coinciden.

---

## El reparto

| Archivo | Casos | Qué compara |
| --- | :-: | --- |
| [`listado.spec.ts`](../pruebas/listado.spec.ts) | L-01 … L-05 | la tabla contra la colección |
| [`fechas.spec.ts`](../pruebas/fechas.spec.ts) | F-01 … F-03 | la hora escrita contra la hora guardada |
| [`errores.spec.ts`](../pruebas/errores.spec.ts) | E-01 … E-05 | qué dice la pantalla cuando la API no coopera |
| [`alta.spec.ts`](../pruebas/alta.spec.ts) | A-01 … A-04 | lo que la pantalla dice que pasó contra lo que pasó |

Cuatro de los diecisiete están en rojo contra la pantalla defectuosa, **uno por defecto**:
L-02, F-01, E-01 y A-02.

## Cuatro técnicas

### 1. El valor esperado no se escribe en la prueba

```ts
const pagina = await paginaDeLaApi(request);
await expect(page.locator('[data-prueba="contador"]'))
  .toHaveText(`${pagina.total} incidencias`);
```

Si el número estuviera escrito a mano, lo que se comprobaría sería que la pantalla coincide
con lo que yo creía. Leyéndolo de la API, se comprueba que coincide con lo que el sistema
guarda — y el escenario sigue valiendo cuando la siembra cambie o cuando otro escenario cree
una incidencia.

Pasó en la medición: el contador esperado fue **14**, no 12, porque los escenarios de alta
habían corrido antes y habían creado dos. Con un `12` escrito a mano, el caso habría fallado
por el motivo equivocado.

### 2. Todas las filas, no la primera

```ts
for (const [indice, esperada] of pagina.datos.entries()) {
  const fila = filas.nth(indice);
  await expect(fila.locator('[data-prueba="id"]')).toHaveText(esperada.id);
  // …
}
```

El registro que viene de otro sitio —de una migración a medias, de un caché viejo— **nunca es
el primero**: el primero es el de siempre, el que está bien.

[F-02](../pruebas/fechas.spec.ts) hace lo mismo con las fechas y pasa en las dos versiones, a
propósito: sin ella, un listado que pintara todas las filas con la misma fecha —un error de
índice al construir la tabla— pasaría desapercibido mientras la primera cuadrase.

### 3. Interceptar la red para ensayar lo que no se puede provocar

```ts
await page.route('**/api/incidencias*', (ruta) =>
  ruta.fulfill({ status: 500, body: JSON.stringify({ error: { codigo: 'ERROR_INTERNO' } }) }),
);
```

La rama de error es la menos probada de cualquier interfaz porque provocarla exige romper el
backend. Interceptando, son cuatro líneas.

Y van en pareja, siempre:

| | E-01 | E-02 |
| --- | --- | --- |
| La API responde | `500` | `200` con `datos: []` |
| La pantalla debe decir | **no se pudo cargar** | **no hay incidencias** |

Sin E-02, una interfaz que enseñara **siempre** el error pasaría E-01 con nota y sería igual
de inútil. Una comprobación negativa sin su positiva no demuestra que el sistema distinga: solo
que dice que no.

La espera de E-03 usa el mismo mecanismo, pero reteniendo la respuesta en vez de falsearla:

```ts
await page.route('**/api/incidencias*', async (ruta) => {
  await enEspera;          // la suelta la prueba cuando ya ha comprobado el «Cargando»
  await ruta.continue();
});
```

Un `sleep` de dos segundos compite con el reloj y falla en una máquina cargada. Una promesa
retenida no compite con nada.

### 4. Mirar la red, no solo el DOM

```ts
expect(peticiones).toHaveLength(1);
expect(peticiones[0]).toContain('tam=5');
```

[E-05](../pruebas/errores.spec.ts) comprueba que la paginación sea de verdad y no un recorte
en el navegador. Una interfaz que se baja doce mil filas y enseña cinco **funciona
perfectamente con doce**, y tumba el servicio el día que haya doce mil. Desde el DOM se ven
cinco filas en los dos casos: la única forma de distinguirlo es mirar qué pidió.

## Los 17, uno a uno

| Caso | Qué compara | Rojo contra la pantalla defectuosa |
| --- | --- | :-: |
| L-01 | cada fila contra su incidencia en la API | |
| **L-02** | el contador contra `total` | ✗ |
| L-03 | la segunda página contra la de la API, y que cambie | |
| L-04 | que en la última página no se pueda avanzar | |
| L-05 | el importe con formato de moneda, y el de la API | |
| **F-01** | la hora escrita contra la guardada | ✗ |
| F-02 | que cada fila enseñe la fecha de **su** registro | |
| F-03 | que la siembra todavía pueda delatar un desfase | |
| **E-01** | un 500 contra «no hay incidencias» | ✗ |
| E-02 | una colección vacía de verdad | |
| E-03 | que se vea «Cargando» mientras la API tarda | |
| E-04 | un corte de red | |
| E-05 | que no pida la colección entera | |
| A-01 | lo creado en la pantalla, consultado en la API | |
| **A-02** | que no diga «Guardada» si la API devolvió 500 | ✗ |
| A-03 | que un título corto no cree nada | |
| A-04 | que el formulario quede limpio | |

Cuatro merecen una nota.

**L-05 está bien a propósito.** El importe se formatea correctamente en las dos versiones. Una
suite en la que todo lo que mira está roto no ha demostrado que sepa distinguir: solo que
siempre dice que no.

**F-03 comprueba la prueba, no la pantalla.** Si alguien cambia la siembra a horas de media
tarde, las 14:00 UTC y las 09:00 de Lima caen el mismo día y F-01 pasaría con el defecto
intacto. Una prueba que deja de poder fallar no avisa de que ha dejado de servir.

**A-03 comprueba el efecto, no el mensaje.** La validación vive en la API, que responde 400,
y lo que importa es que la colección no crezca. Exigir además un texto concreto mezclaría dos
cosas, y A-02 ya cubre qué tiene que decir la pantalla cuando la API rechaza.

**A-01 no se conforma con el aviso.** Que la pantalla diga «Guardada como INC-0013» es lo que
se quiere comprobar, no la prueba de que lo esté: el escenario saca el identificador del
aviso y **se lo pregunta a la API**.

## Cómo se eligen los elementos

Todo con `data-prueba`:

```html
<td data-prueba="creada">3/11/26, 2:15 a. m. UTC</td>
```

Y no con clases de CSS ni con la posición en el árbol. Una clase es una decisión de estilo:
el día que alguien cambie `.contador` por otra cosa, la suite se rompe sin que el
comportamiento haya cambiado. Un atributo puesto para esto dice en el propio HTML que algo
depende de él.

La excepción son los botones, que se eligen por su papel y su texto:

```ts
page.getByRole('button', { name: 'Siguiente' })
```

Porque ahí el texto **sí** es parte de lo que se comprueba: si el botón deja de llamarse
«Siguiente», alguien tiene que enterarse.

## La opción de proyecto, y por qué no es una variable de entorno

```ts
projects: [
  { name: 'defectuosa', use: { corregida: false } },
  { name: 'corregida',  use: { corregida: true } },
]
```

```bash
npx playwright test --project=corregida
```

Con una variable de entorno, `UI_CORREGIDA=1 npx playwright test` funciona en Linux y **no en
Windows**, y el `package.json` acaba con un script ilegible para sortearlo. Con una opción de
proyecto se elige igual en los dos sitios, y además el informe dice en qué versión falló cada
escenario sin tener que recordar con qué variable se lanzó.

## Lo que se dejó fuera

| | Por qué |
| --- | --- |
| Reintentos (`retries`) | Un reintento convierte un fallo intermitente en un verde con asterisco, y el asterisco no lo lee nadie. Si una prueba falla una de cada cinco veces, lo que hay que arreglar es la prueba |
| Ejecución en paralelo | Los escenarios de alta crean incidencias y el contador mira la colección entera: dos a la vez se mueven el número el uno al otro y el fallo sale en el escenario equivocado |
| Tres navegadores | La pregunta no depende del motor. Triplicaría el tiempo sin añadir una comprobación distinta |

---

Siguiente: [3. Matriz de trazabilidad](03-matriz-trazabilidad.md).
