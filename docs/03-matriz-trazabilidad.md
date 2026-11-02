# 3. Matriz de trazabilidad

Una promesa de la pantalla por fila. La columna de la derecha dice qué escenario la comprueba,
y **cuatro filas no tienen ninguno**.

El oráculo de todas las filas es **la API**: lo que la pantalla tiene que enseñar es lo que el
servicio guarda. Cuando una fila dice «la pantalla debe», se puede ir a comprobar qué devuelve
la API para ese mismo dato.

---

## El listado

| # | La pantalla debe | Caso |
| --- | --- | :-: |
| LI-1 | Enseñar una fila por incidencia de la página | L-01 |
| LI-2 | Enseñar en cada fila **su** id, título, prioridad y estado | L-01 |
| LI-3 | **Contar la colección entera, no la página** | **L-02** |
| LI-4 | Escribir el importe como moneda y con el valor de la API | L-05 |
| LI-5 | Traducir el estado a algo legible (`EN_CURSO` → `EN CURSO`) | L-01 |
| LI-6 | Ordenar las filas como las ordena la API | — ⬇ |

**LI-6 no tiene caso.** La API no declara ningún orden, así que exigir uno desde la pantalla
sería inventar una regla. Lo que sí se comprueba —L-03— es que la segunda página traiga
**otras** incidencias, que es la promesa que sí existe.

## La paginación

| # | La pantalla debe | Caso |
| --- | --- | :-: |
| PA-1 | Traer la siguiente página al pulsar Siguiente | L-03 |
| PA-2 | Enseñar en qué página está | L-03 |
| PA-3 | Desactivar Siguiente en la última página | L-04 |
| PA-4 | Desactivar Anterior en la primera | L-04 |
| PA-5 | **Pedir solo la página**, no la colección entera | E-05 |
| PA-6 | Conservar la página al recargar | — ⬇ |

**PA-6 no tiene caso** porque la pantalla no promete conservarla: la página no va en la URL.
Es una carencia de diseño razonable de señalar, pero la prueba no es el sitio donde se
decide, y un escenario que la exigiera estaría rojo desde el primer día sin que nadie hubiese
acordado nada.

## Las fechas

| # | La pantalla debe | Caso |
| --- | --- | :-: |
| FE-1 | **Enseñar la hora que guarda la API, o decir en qué zona la enseña** | **F-01** |
| FE-2 | Enseñar en cada fila la fecha de **su** registro | F-02 |
| FE-3 | Usar un formato legible y estable | F-02 |
| FE-4 | (sobre la prueba) La siembra tiene que poder delatar un desfase | F-03 |

FE-4 no es una promesa de la pantalla: es una comprobación sobre la propia suite. Está en la
matriz porque **una prueba que deja de poder fallar no avisa de que ha dejado de servir**, y
si no está escrita en ningún sitio, nadie la recuerda.

## Los estados de la pantalla

| # | La pantalla debe | Caso |
| --- | --- | :-: |
| ES-1 | Decir que está cargando mientras la API tarda | E-03 |
| ES-2 | **Decir que falló cuando la API devuelve 500** | **E-01** |
| ES-3 | Decir que está vacío cuando de verdad está vacío | E-02 |
| ES-4 | Decir que falló cuando se corta la red | E-04 |
| ES-5 | Usar un hueco distinto para cada estado | E-01 … E-04 |
| ES-6 | Ofrecer reintentar tras un fallo | — ⬇ |

**ES-6 no tiene caso** porque la pantalla no tiene botón de reintento. Es lo siguiente que le
haría falta —un mensaje de error sin salida deja al usuario recargando a mano— y queda
nombrado aquí en vez de inventado en una prueba.

ES-5 merece una nota: los cuatro estados tienen su propio elemento (`cargando`, `vacio`,
`fallo`, `tabla`) y solo uno es visible a la vez. Una interfaz que use el mismo hueco para
«cargando», «vacío» y «error» **obliga a adivinar cuál de los tres está pasando**, y eso no
se puede comprobar desde fuera ni lo puede distinguir quien mira.

## El alta

| # | La pantalla debe | Caso |
| --- | --- | :-: |
| AL-1 | Crear de verdad lo que dice que creó | A-01 |
| AL-2 | Enseñar el identificador de lo creado | A-01 |
| AL-3 | **No anunciar éxito si la API no lo confirmó** | **A-02** |
| AL-4 | No crear nada si el título no es válido | A-03 |
| AL-5 | Limpiar el formulario tras guardar | A-04 |
| AL-6 | Refrescar el listado tras guardar | A-04 |
| AL-7 | Decir qué campo está mal | — ⬇ |
| AL-8 | Impedir el doble envío mientras se guarda | — ⬇ |

**AL-7 y AL-8 no tienen caso, y son los dos huecos que más me gustaría cerrar.** La API
devuelve `campos` con el motivo de cada error y la pantalla no los pinta; y el botón de
guardar no se desactiva mientras la petición va por el aire, así que dos clics seguidos crean
dos incidencias.

Las dos son carencias reales de la pantalla, no de la suite. **Escribir el escenario antes
que el arreglo dejaría la suite roja de forma permanente**, y una suite con rojos permanentes
deja de mirarse en dos semanas: el rojo pasa a ser el fondo de pantalla. Van a la matriz, no
a `pruebas/`.

---

## El recuento

| | Filas | Con caso | Sin caso |
| --- | :-: | :-: | :-: |
| Listado | 6 | 5 | 1 |
| Paginación | 6 | 5 | 1 |
| Fechas | 4 | 4 | 0 |
| Estados | 6 | 5 | 1 |
| Alta | 8 | 6 | 2 |
| **Total** | **30** | **25** | **5** |

25 de 30. De las cinco:

- **Dos** porque la pantalla no promete eso y exigirlo sería inventar un requisito (LI-6,
  PA-6).
- **Tres** porque son carencias reales que aún no tienen arreglo (ES-6, AL-7, AL-8), y el
  escenario quedaría rojo de forma permanente.

Ninguna se cubre «por si acaso». Un escenario que exige algo que el sistema no promete frena
el día que el sistema cambie de forma legítima, y lo que hace el equipo entonces es borrarlo.
Después de borrar dos o tres, deja de leer los demás.

## Las cuatro filas en negrita

**LI-3, FE-1, ES-2 y AL-3.** Son las cuatro que la pantalla defectuosa incumple, una por
defecto, y las únicas cuatro en rojo de los 17 escenarios.

Las cuatro se pueden describir con la misma frase: **la pantalla enseña algo creíble que no
es lo que el sistema guarda**. Un número razonable, una hora que existe, un «no hay nada» con
buena presentación, un «Guardada» que suena a confirmación.

Si esta matriz solo tuviera las otras 26 filas, la suite estaría **verde entera** contra una
pantalla que cuenta mal, fecha mal, esconde los errores y confirma lo que no ocurrió.

---

Siguiente: [4. Análisis de riesgos](04-analisis-riesgos.md).
