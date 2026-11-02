# El trabajo de calidad, antes del código

Un repositorio de pruebas de interfaz enseña **cómo** se pulsa un botón y se lee un texto. No
enseña contra qué se compara ese texto, por qué una fecha es un problema y un importe no, qué
promesa de la pantalla no cubre ningún escenario, ni cómo se sabe que la suite no está pasando
en vano. Esta carpeta es esa parte.

| Documento | Qué contiene |
| --- | --- |
| [1. Análisis de la pantalla](01-analisis-de-la-pantalla.md) | El hueco entre la API y la interfaz, los cuatro desajustes que caben en él, y por qué la zona horaria es una decisión |
| [2. Diseño de casos](02-diseno-de-casos.md) | Los 17 escenarios, las cuatro técnicas, y la prueba que no mira la pantalla sino la propia suite |
| [3. Matriz de trazabilidad](03-matriz-trazabilidad.md) | 30 promesas de la pantalla, 25 con caso — y las **5 sin ninguno**, con su motivo |
| [4. Análisis de riesgos](04-analisis-riesgos.md) | Seis riesgos. El primero es una prueba de fechas que depende de la máquina |
| [5. Hallazgos](05-hallazgos.md) | **Seis.** Cuatro los puse yo. Dos no |

---

## La pregunta de este repositorio

No es si la API responde bien —responde bien— ni si la pantalla funciona —funciona—. Es:

> **¿Lo que la pantalla enseña es lo que la API guarda?**

```
   ┌─────────────┐        ┌──────────────┐        ┌────────────┐
   │     API     │───────▶│  la pantalla │───────▶│  quien la  │
   │   correcta  │  JSON  │    la pinta  │  texto │     lee    │
   └─────────────┘        └──────────────┘        └────────────┘
         ▲                        ▲                      ▲
    se prueba con             se prueba con          no se prueba
    pruebas de API         pruebas de interfaz        casi nunca
```

Los dos extremos tienen dueño y los dos salen verdes. En el hueco de en medio caben los cuatro
desajustes de este repositorio, y los cuatro tienen la misma forma:

| Lo que lee quien mira | Lo que guarda la API |
| --- | --- |
| «2/11/26, 9:15 p. m.» | `2026-11-03T02:15:00Z` — **otro día** |
| «5 incidencias» | 14 |
| «No hay incidencias.» | un **500** que nadie contó |
| «Guardada» | nada: la creación fue rechazada |

**La pantalla enseña algo creíble que no es lo que el sistema guarda.** Números razonables,
fechas con formato, mensajes tranquilizadores. Nada roto.

## El resultado medido

| Pantalla | Escenarios | Rojos | Cuáles |
| --- | :-: | :-: | --- |
| con los 4 desajustes | 17 | **4** | L-02, F-01, E-01, A-02 |
| con los 4 apagados | 17 | **0** | — |

Uno por desajuste, y el CI lo comprueba por nombre:

```bash
for CASO in 'L-02' 'F-01' 'E-01' 'A-02'; do
  grep -q "$CASO" corrida.log || exit 1
done
```

Contar cuatro rojos no basta. **Cuatro fallos pueden ser los cuatro buenos o cuatro
casualidades**, y el recuento no lo distingue.

## La decisión que sostiene todo

Ninguna comprobación escribe a mano el valor esperado. Cada una lo lee de la API justo antes
de mirar la pantalla:

```ts
const pagina = await paginaDeLaApi(request);
await expect(page.locator('[data-prueba="contador"]'))
  .toHaveText(`${pagina.total} incidencias`);
```

Si estuviera escrito, lo que se comprobaría sería que la pantalla coincide con **lo que yo
creía**, no con lo que el sistema guarda.

Y salvó la medición. El contador esperado fue **14**, no 12, porque los escenarios de alta
habían creado dos incidencias antes. Con un `12` escrito en la prueba, el caso habría fallado
igual pero por el motivo equivocado, y el diagnóstico habría sido «hay que reiniciar el
servidor» en vez de «el contador cuenta la página». **El rojo correcto por casualidad es la
peor manera de acertar.**

## Una prueba que no mira la pantalla

[F-03](02-diseno-de-casos.md) comprueba la propia suite.

F-01 solo puede detectar el desfase horario si la siembra tiene alguna hora que cambie de día
entre UTC y Lima. Las 02:15 UTC valen; las 14:00, no. Nadie cambiaría la siembra con mala
intención —se cambia porque hacían falta datos más realistas— y a partir de ahí hay un
escenario en verde que ya no puede ponerse rojo.

```ts
const cambianDeDia = pagina.datos.filter(
  (i) => diaEnZona(i.creadaEn, 'UTC') !== diaEnZona(i.creadaEn, 'America/Lima'),
);
expect(cambianDeDia.length).toBeGreaterThan(0);
```

**Una prueba que deja de poder fallar no avisa de que ha dejado de servir.**

## Y tres carencias que la suite no cubre

La matriz tiene 30 promesas y **cinco siguen sin escenario**. Tres de ellas son carencias
reales de la pantalla: no hay botón de reintento tras un fallo, los errores de validación no
dicen qué campo está mal, y el botón de guardar no se desactiva mientras la petición va por el
aire — así que dos clics crean dos incidencias.

Escribir esos escenarios antes que el arreglo dejaría la suite **roja de forma permanente**, y
una suite con rojos permanentes deja de mirarse en dos semanas: el rojo pasa a ser el fondo de
pantalla. Van a la matriz, no a `pruebas/`.

---

Volver al [README del repositorio](../README.md).
