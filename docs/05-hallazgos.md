# 5. Hallazgos

**Cuatro los puse yo. Dos no.**

Los cuatro primeros son los desajustes que la pantalla trae de serie para demostrar que la
suite sirve: se apagan con `?corregida=1`, y el CI exige que la suite los detecte **y que no
detecte otra cosa**.

Los dos siguientes aparecieron montando esto, y los dos habrían dejado la suite diciendo algo
que no era.

| Id | Resumen | Severidad | Origen |
| --- | --- | :-: | :-: |
| [D-01](#d-01) | La fecha se pinta en otra zona y no lo dice | **Alta** | a propósito |
| [D-02](#d-02) | El contador cuenta la página, no la colección | Media | a propósito |
| [D-03](#d-03) | Un error de la API se dibuja como lista vacía | **Crítica** | a propósito |
| [D-04](#d-04) | El aviso de guardado llega antes que la respuesta | **Alta** | a propósito |
| [H-01](#h-01) | El defecto plantado traía un segundo defecto de regalo | Media | mío |
| [H-02](#h-02) | El interruptor de la suite no funcionaba en Windows | Media | mío |

Las dos corridas, con la misma suite y sin tocar una línea:

| Pantalla | Escenarios | Rojos | Cuáles |
| --- | :-: | :-: | --- |
| con los 4 desajustes | 17 | **4** | L-02, F-01, E-01, A-02 |
| con los 4 apagados | 17 | **0** | — |

---

# Parte 1 · Los cuatro de adorno

## D-01

**La fecha se pinta en otra zona, y no lo dice**

| | |
| --- | --- |
| **Lo detecta** | **F-01** |
| **Severidad** | Alta |

```
Error: La pantalla escribe «2/11/26, 9:15 p. m.» para una incidencia que la API
guarda a las 3/11/26, 2:15 a. m. UTC.

Expected substring: "3/11/26, 2:15 a. m."
Received string:    "2/11/26, 9:15 p. m."
```

No es que enseñe otra hora: **enseña otro día**. El 2 contra el 3.

La causa cabe en una opción que no está:

```js
// la pantalla defectuosa — usa la zona del navegador y no lo dice
new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(d)

// la corregida — la zona del registro, y la nombra
`${new Intl.DateTimeFormat('es-PE', { ...formato, timeZone: 'UTC' }).format(d)} UTC`
```

El formato es impecable y la hora es real. Lo único que falta es decir de qué zona es, y eso
**no se nota mirando la pantalla**: hace falta tener delante el valor que guarda la API.

Quien lee el panel y quien consulta la base de datos discutirán sobre cuándo entró la
incidencia, y los dos tendrán razón. En un informe que cruce las dos fuentes, el desfase
aparece como registros que no cuadran y se acaba achacando a «un problema de datos».

## D-02

**El contador cuenta la página, no la colección**

| | |
| --- | --- |
| **Lo detecta** | **L-02** |
| **Severidad** | Media |

```
Expected: "14 incidencias"
Received: "5 incidencias"
```

La API devuelve los dos números —`total` y `datos`— y la pantalla elige el que no es:

```js
const cuantas = CORREGIDA ? pagina.total : pagina.datos.length;
```

**El número resultante es creíble, y eso es lo que lo hace peligroso.** Nadie sospecha de un
«5 incidencias» en una tabla con cinco filas. Ni un esquema ni una prueba de API lo ven: el
`5` es un entero perfectamente válido y la API lo devolvió bien.

El coste no es el número. Es la decisión que alguien toma mirándolo.

## D-03

**Un error de la API se dibuja como lista vacía**

| | |
| --- | --- |
| **Lo detecta** | **E-01** |
| **Severidad** | Crítica |

```
Error: Un fallo del servicio no puede enseñarse como «no hay incidencias»

Locator:  locator('[data-prueba="vacio"]')
Expected: hidden
Received: visible
  14 × locator resolved to <p id="vacio">No hay incidencias.</p>
```

La API devolvió **500**. La pantalla escribió «No hay incidencias.» y puso el contador a cero.

**«No hay nada» y «no he podido preguntarlo» son dos frases distintas, y la segunda es la
verdad.** Quien lee la primera concluye que no hay trabajo pendiente y cierra el panel.

Un error dibujado como vacío no es una degradación elegante: es una respuesta falsa con buena
presentación. Y es el desajuste más repetido que hay en una interfaz, porque la rama de error
es la que nadie ensaya — provocarla exige romper el backend, y nadie rompe el backend para
mirar un mensaje.

Con `page.route` son cuatro líneas:

```ts
await page.route('**/api/incidencias*', (ruta) => ruta.fulfill({ status: 500 }));
```

## D-04

**El aviso de guardado llega antes que la respuesta**

| | |
| --- | --- |
| **Lo detecta** | **A-02** |
| **Severidad** | Alta |

```
Error: La pantalla anunció que se guardó una incidencia que la API rechazó con un 500

Expected pattern: not /^Guardada$/
Received string: "Guardada"
```

El formulario anuncia el éxito **antes de saber si lo hubo**:

```js
if (!CORREGIDA) {
  aviso.textContent = 'Guardada';
  aviso.hidden = false;
}
const respuesta = await fetch('/api/incidencias', { ... });   // y aquí puede fallar
```

Por el camino feliz el mensaje acaba siendo verdad, así que **no se nota nunca**. Solo falla
cuando la API falla, que es exactamente cuando nadie está mirando.

El usuario se marcha convencido de que dejó la incidencia puesta. Lo descubre quien la busque
dentro de tres semanas y no la encuentre, y para entonces nadie relaciona la ausencia con un
500 de aquel martes.

A-02 no se conforma con el mensaje: comprueba además que la colección **no creció**.

---

# Parte 2 · Los dos que no puse yo

## H-01

**El defecto plantado traía un segundo defecto de regalo**

| | |
| --- | --- |
| **Cómo se vio** | Escribiendo F-02, que tiene que pasar en las dos versiones |
| **Severidad** | Media |

La primera versión de D-01 estaba escrita así:

```js
if (!CORREGIDA) {
  return d.toLocaleString('es-PE');          // «2/11/2026, 21:15:00»
}
return `${new Intl.DateTimeFormat('es-PE', {
  timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short',
}).format(d)} UTC`;                           // «3/11/26, 2:15 a. m. UTC»
```

Entre las dos versiones no cambiaba **una** cosa, cambiaban dos: la zona y el formato. Año de
cuatro cifras contra dos, segundos contra ninguno, 24 horas contra a. m./p. m.

Eso rompía [F-02](../pruebas/fechas.spec.ts), que tiene que pasar en las dos versiones porque
comprueba que cada fila enseñe la fecha de **su** registro, en una zona o en la otra. Con dos
formatos distintos, la comparación fallaba contra la pantalla defectuosa **por el formato, no
por el desfase**, y habría habido cinco rojos en vez de cuatro.

La lección es sobre los defectos plantados, y vale fuera de este repositorio:

> **Un defecto inyectado tiene que cambiar exactamente una cosa.** Si cambia dos, el escenario
> que lo detecta ya no demuestra lo que dice demostrar: puede estar detectando la otra.

Y arreglarlo «ajustando la aserción para que tolere los dos formatos» habría sido peor:
tapar con una comprobación más laxa un problema de diseño del propio ejemplo.

**Corregido** dejando que lo único distinto sea la zona:

```js
const formato = { dateStyle: 'short', timeStyle: 'short' };
if (!CORREGIDA) {
  return new Intl.DateTimeFormat('es-PE', formato).format(d);
}
return `${new Intl.DateTimeFormat('es-PE', { ...formato, timeZone: 'UTC' }).format(d)} UTC`;
```

## H-02

**El interruptor de la suite no funcionaba en Windows**

| | |
| --- | --- |
| **Cómo se vio** | Escribiendo el `package.json` |
| **Severidad** | Media |

La primera forma de elegir qué versión de la pantalla se prueba fue una variable de entorno:

```json
"pruebas:corregida": "UI_CORREGIDA=1 playwright test"
```

Eso **no funciona en Windows**. `cmd` no entiende el prefijo de variable, así que el script
falla con un error de orden desconocida, y la salida habitual es añadir `cross-env` —una
dependencia más para resolver algo que Playwright ya resuelve— o escribir un `node -e` con
tres niveles de comillas que no lee nadie.

**Corregido** con una opción de proyecto, que es como está pensado:

```ts
projects: [
  { name: 'defectuosa', use: { corregida: false } },
  { name: 'corregida',  use: { corregida: true } },
]
```

```bash
npx playwright test --project=corregida
```

Y sale mejor de lo que estaba, que es lo que suele pasar cuando algo no se puede hacer de la
forma cómoda: ahora **el informe dice en qué versión falló cada escenario**, sin tener que
recordar con qué variable se lanzó.

```
[defectuosa] › pruebas/listado.spec.ts:33:7 › L-02 · El contador dice cuántas hay…
```

Lo apunto porque es un hallazgo de portabilidad, y los de portabilidad tienen una forma
característica: **funcionan perfectamente en el equipo de quien los escribe**. El primero que
clone el repositorio en otro sistema se encuentra con que la mitad de la demostración no se
puede lanzar.

---

## La decisión que salvó la medición

No es un hallazgo, pero sin ella la corrida habría salido mal y el diagnóstico habría sido el
equivocado.

Ninguna comprobación de esta suite escribe a mano el valor esperado: cada una lo lee de la
API justo antes de mirar la pantalla. En la corrida medida, el contador esperado por L-02 fue
**14**, no 12, porque los escenarios de alta habían corrido antes y habían creado dos
incidencias.

```
Expected: "14 incidencias"
Received: "5 incidencias"
```

Con un `12` escrito en la prueba, el caso habría fallado igual **pero por el motivo
equivocado**, y el diagnóstico habría sido «hay que reiniciar el servidor entre corridas» en
vez de «el contador cuenta la página». El rojo habría sido el correcto por casualidad, que es
la peor manera de acertar.

---

## Lo que se lleva de aquí

Los cuatro desajustes plantados tienen la misma forma, y no es casualidad: **la pantalla
enseña algo creíble que no es lo que el sistema guarda.**

| Lo que lee quien mira | Lo que guarda la API |
| --- | --- |
| «2/11/26, 9:15 p. m.» | `2026-11-03T02:15:00Z` — otro día |
| «5 incidencias» | 14 |
| «No hay incidencias.» | un 500 que nadie contó |
| «Guardada» | nada: la creación fue rechazada |

Ninguno rompe nada. Los cuatro producen una pantalla que funciona, con números razonables,
fechas con formato y mensajes tranquilizadores. **Una prueba de API los tiene todos en verde
—porque la API está bien— y una prueba de interfaz que solo mire la pantalla, también.**

Por eso cada escenario de aquí lee el dato dos veces. Y por eso el CI no se conforma con
exigir cuatro rojos: comprueba **cuáles**. Un control que no distingue un acierto de una
casualidad no es un control.
