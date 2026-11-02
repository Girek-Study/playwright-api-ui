# 1. Análisis de la pantalla

Una prueba de API comprueba lo que el servicio responde. Una prueba de interfaz comprueba que
la pantalla hace lo suyo. **Entre las dos hay un hueco**, y en ese hueco caben los cuatro
defectos de este repositorio.

Este documento dice qué hay en ese hueco, cómo se mira, y qué se quedó fuera con su motivo.

---

## El hueco

```
   ┌─────────────┐        ┌──────────────┐        ┌────────────┐
   │     API     │───────▶│  la pantalla │───────▶│  quien la  │
   │   correcta  │  JSON  │    la pinta  │  texto │     lee    │
   └─────────────┘        └──────────────┘        └────────────┘
         ▲                        ▲                      ▲
    se prueba con             se prueba con          no se prueba
    pruebas de API         pruebas de interfaz        casi nunca
```

Los dos extremos tienen dueño. La API se prueba con una suite de API y sale verde: devuelve
`2026-11-03T02:15:00Z`, que es un ISO 8601 impecable. La pantalla se prueba con una suite de
interfaz y sale verde: enseña una fecha, con su formato y todo.

**Lo que nadie comprueba es que las dos cosas sean la misma.** Y no lo son: en Lima, ese
instante son las 21:15 del día 2. La pantalla escribe un día distinto del que guarda la base
de datos, y las dos partes tienen razón.

Esa es la pregunta de este repositorio:

> **¿Lo que la pantalla enseña es lo que la API guarda?**

## Cómo se mira

Cada comprobación lee el dato **dos veces**, por dos caminos distintos, y compara:

```ts
const pagina = await paginaDeLaApi(request);        // por la API
await page.goto(urlDelPanel());                     // por la pantalla
await expect(page.locator('[data-prueba="contador"]'))
  .toHaveText(`${pagina.total} incidencias`);
```

Lo importante no es el `expect`: es que **el valor esperado no está escrito en la prueba**.
Si lo estuviera, lo que se comprobaría sería que la pantalla coincide con lo que yo creía, no
con lo que el sistema guarda. Y el día que la siembra cambie, habría que editar la prueba.

Playwright da las dos mitades en el mismo escenario: `request` habla con la API y `page`
habla con el navegador, con el mismo contexto y la misma `baseURL`.

## Los cuatro desajustes

Ninguno rompe nada. Los cuatro producen una pantalla que funciona.

### 1. La fecha se pinta en otra zona, y no lo dice

```
la API guarda       2026-11-03T02:15:00Z
la pantalla escribe 2/11/26, 9:15 p. m.
```

`Intl.DateTimeFormat` sin la opción `timeZone` usa la del navegador. El formato es impecable
y la hora es real; lo único que falta es **decir de qué zona es**, y eso no se nota mirando
la pantalla.

Quien lee el panel y quien consulta la base de datos discutirán sobre qué día entró la
incidencia. En un informe que cruza las dos fuentes, el desfase aparece como registros que no
cuadran y se acaba achacando a «un problema de datos».

### 2. El contador cuenta la página, no la colección

```
la API devuelve     { datos: [5 incidencias], total: 12 }
la pantalla escribe «5 incidencias»
```

La API da los dos números. La pantalla elige el que no es. Y **el resultado es creíble**, que
es lo que lo hace peligroso: nadie sospecha de un «5 incidencias» en una tabla con cinco
filas.

El coste no es el número: es la decisión que alguien toma mirándolo.

### 3. Un error se dibuja como lista vacía

```
la API responde     500 ERROR_INTERNO
la pantalla escribe «No hay incidencias.»
```

**«No hay nada» y «no he podido preguntarlo» son dos frases distintas, y la segunda es la
verdad.** Quien lee la primera concluye que no hay trabajo pendiente y cierra el panel.

Un error dibujado como vacío no es una degradación elegante: es una respuesta falsa con buena
presentación. Y es el defecto más repetido que hay en una interfaz, porque la rama de error
es la que nadie ensaya.

### 4. El aviso de guardado llega antes que la respuesta

```
la API responde     500
la pantalla escribe «Guardada»
```

El formulario anuncia el éxito **antes de saber si lo hubo**. Por el camino feliz el mensaje
acaba siendo verdad, así que no se nota nunca: solo falla cuando la API falla, que es
exactamente cuando nadie está mirando.

El usuario se marcha convencido de que dejó la incidencia puesta. Lo descubre quien la busque
dentro de tres semanas y no la encuentre, y para entonces nadie relaciona la ausencia con un
500 de aquel martes.

## La zona horaria es una decisión, no un detalle

```ts
use: {
  timezoneId: 'America/Lima',
  locale: 'es-PE',
}
```

Sin esas dos líneas, la comprobación de fechas **pasa en el equipo de quien la escribió y
falla en el CI**, que corre en UTC. Y el arreglo habitual ante ese fallo es relajar la
aserción —comprobar solo que «hay algo con pinta de fecha»— con lo que se pierde justo lo que
había que comprobar.

Con la zona fijada, el desfase deja de ser ruido y pasa a ser **el resultado**.

Hay una comprobación más, [F-03](02-diseno-de-casos.md), que vigila la propia siembra: si
alguien cambia las horas a media tarde, las 14:00 UTC y las 09:00 de Lima caen el mismo día y
la aserción de F-01 pasaría con el defecto intacto. **Una prueba que deja de poder fallar no
avisa de que ha dejado de servir**, así que hay otra que lo comprueba.

## Interceptar la red

Tres de los escenarios no necesitan que el servicio falle de verdad: responden ellos mismos
en lugar de la API.

```ts
await page.route('**/api/incidencias*', (ruta) => ruta.fulfill({ status: 500 }));
```

Es lo que convierte una rama imposible de ensayar —«¿y si el backend devuelve un 500?»— en un
escenario de cuatro líneas. Sin esto, probar el estado de error exige romper la API a
propósito, y nadie lo hace.

El mismo mecanismo sirve para la espera: en vez de un retardo fijo, la respuesta se **retiene
hasta que la prueba la suelte**. Un `sleep` de dos segundos compite con el reloj y falla en
una máquina cargada; una promesa retenida no compite con nada.

## Lo que no se prueba, y por qué

| Lo que falta | Por qué |
| --- | --- |
| Accesibilidad (contraste, foco, lectores) | Es otra disciplina con sus propias herramientas. Meter dos `axe` sueltos aquí daría la impresión de que está cubierta |
| Comparación visual de capturas | Una suite de capturas se rompe con cada cambio de fuente del sistema, y el equipo acaba aprobando las diferencias sin mirarlas |
| Otros navegadores | La pregunta de este repositorio no depende del motor. Correr tres navegadores triplicaría el tiempo sin añadir una comprobación distinta |
| Móvil | Lo mismo: el desajuste entre API y pantalla es el mismo en cualquier ancho |
| Que la API cumpla un contrato | Otro repositorio: [`karate-api-contract`](https://github.com/Girek-Study/karate-api-contract) |
| Qué deja el sistema si un flujo se rompe | Otro repositorio: [`restassured-api-flows`](https://github.com/Girek-Study/restassured-api-flows) |

Las dos primeras filas son decisiones, no olvidos. Las dos últimas son la frontera de este
repositorio: **aquí no se comprueba si la API está bien** —de hecho la API de ejemplo es
correcta— sino si la pantalla dice la verdad sobre ella.

---

Siguiente: [2. Diseño de casos](02-diseno-de-casos.md) — los 17 escenarios y las cuatro
técnicas.
