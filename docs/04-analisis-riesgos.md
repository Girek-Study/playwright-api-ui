# 4. Análisis de riesgos

El riesgo de una suite de interfaz no es que falle. Es que **se vuelva intermitente**, porque
la respuesta de todo el mundo a una prueba intermitente es añadir un reintento, y a partir de
ese día la suite ya no informa de nada aunque esté perfectamente escrita.

Seis riesgos. Dos abiertos.

---

## R-01 · Una prueba de fechas que depende de la máquina

**Severidad: alta. Mitigado, y es el eje del repositorio.**

`F-01` compara la hora que escribe la pantalla con la que guarda la API. Sin fijar la zona del
navegador, esa comparación **pasa en el equipo de quien la escribió y falla en el CI**, que
corre en UTC.

Y lo peor no es el fallo: es el arreglo. El reflejo ante un rojo así es relajar la aserción
—comprobar solo que «hay algo con pinta de fecha»— y con eso se borra justo lo que había que
comprobar. La prueba sigue ahí, en verde, sin comprobar nada.

```ts
use: {
  timezoneId: 'America/Lima',
  locale: 'es-PE',
}
```

Con la zona fijada, el desfase deja de ser ruido y pasa a ser el resultado.

## R-02 · Una prueba puede dejar de poder fallar sin que nadie se entere

**Severidad: media. Mitigado con una prueba sobre la prueba.**

F-01 solo detecta el desfase si la siembra tiene alguna hora que **cambie de día** entre UTC y
Lima. Las 02:15 UTC valen; las 14:00, no: en las dos zonas caen el mismo día, la aserción
pasaría y el defecto seguiría intacto.

Nadie cambiaría la siembra con mala intención. Se cambia porque hacían falta datos más
realistas, o porque alguien reordenó el array. Y a partir de ahí hay un escenario en verde que
ya no puede ponerse rojo.

**Qué lo tapa:** F-03 comprueba la siembra.

```ts
const cambianDeDia = pagina.datos.filter(
  (i) => diaEnZona(i.creadaEn, 'UTC') !== diaEnZona(i.creadaEn, ZONA_DEL_NAVEGADOR),
);
expect(cambianDeDia.length).toBeGreaterThan(0);
```

Es la única prueba del repositorio que no mira la pantalla. Mira si la suite sigue sirviendo.

## R-03 · Los escenarios se pisan los datos

**Severidad: media. Mitigado.**

Los escenarios de alta **crean incidencias de verdad**, y el contador mira la colección
entera. Si dos corren a la vez, se mueven el número el uno al otro y el fallo aparece en el
escenario equivocado.

Dos decisiones lo tapan:

**1. `workers: 1` y `fullyParallel: false`.** Lo que se ahorraría paralelizando son segundos;
lo que costaría es una suite que falla a veces.

**2. Ningún valor esperado escrito a mano.** Es la mitigación de verdad: cada escenario lee
de la API lo que debe salir en pantalla, justo antes de mirarla.

Se vio en la medición. El contador esperado por L-02 fue **14**, no 12, porque los escenarios
de alta habían corrido antes y habían creado dos incidencias:

```
Expected: "14 incidencias"
Received: "5 incidencias"
```

Con un `12` escrito en la prueba, el caso habría fallado igual **pero por el motivo
equivocado**, y el diagnóstico habría sido «hay que reiniciar el servidor entre corridas» en
vez de «el contador cuenta la página».

## R-04 · La suite puede pasar sin comprobar nada

**Severidad: alta. Mitigado con el CI.**

El verde de una suite vacía y el de una suite completa son el mismo pixel.

| Trabajo del CI | Pantalla | Exige |
| --- | --- | --- |
| `detecta` | con los 4 defectos | que **falle**, con **4 rojos**, y que sean **L-02, F-01, E-01 y A-02** |
| `no-miente` | con los 4 apagados | que **pase entera** |

El primero hace tres comprobaciones:

1. Que el build falle. Si pasa, la suite no está comparando nada.
2. Que falle **cuatro veces**. Tres significa que alguien debilitó una aserción; cinco, que
   hay un desajuste nuevo sin mirar.
3. Que sean **esos** cuatro. Cuatro fallos pueden ser los cuatro buenos o cuatro
   casualidades, y el recuento no lo distingue.

```bash
for CASO in 'L-02' 'F-01' 'E-01' 'A-02'; do
  grep -q "$CASO" corrida.log || exit 1
done
```

## R-05 · Una comprobación negativa sin su positiva

**Severidad: media. Mitigado por diseño.**

E-01 exige que un 500 se enseñe como error. Una pantalla que enseñara **siempre** el error lo
pasaría con nota, y sería igual de inútil.

Por eso los escenarios de estado van en pareja: E-02 exige que una colección vacía de verdad
se enseñe como vacía, y E-03 que mientras se carga se diga que se está cargando. **Una
comprobación negativa sin su positiva no demuestra que el sistema distinga: solo que dice que
no.**

El mismo criterio está en L-05, el importe, que está bien a propósito en las dos versiones.
Una suite en la que todo lo que mira está roto no ha demostrado que sepa distinguir.

## R-06 · Los selectores atados al estilo

**Severidad: baja. Mitigado, con una excepción deliberada.**

Todo se elige por `data-prueba`. Una clase de CSS es una decisión de estilo: el día que
alguien cambie `.contador`, la suite se rompe sin que el comportamiento haya cambiado, y un
rojo que no corresponde a un defecto enseña al equipo a ignorar los rojos.

La excepción son los botones, que se eligen por papel y texto:

```ts
page.getByRole('button', { name: 'Siguiente' })
```

Ahí el texto **sí** es parte de lo que se comprueba: si el botón deja de llamarse «Siguiente»,
alguien tiene que enterarse.

---

## Lo que queda abierto

**La pantalla tiene tres carencias que la suite no cubre**, y están en la
[matriz](03-matriz-trazabilidad.md): no hay botón de reintento tras un fallo (ES-6), los
errores de validación no dicen qué campo está mal (AL-7), y el botón de guardar no se
desactiva mientras la petición va por el aire, así que dos clics crean dos incidencias
(AL-8).

Escribir esos escenarios antes que el arreglo dejaría la suite **roja de forma permanente**, y
una suite con rojos permanentes deja de mirarse en dos semanas: el rojo pasa a ser el fondo de
pantalla. Están en la matriz, no en `pruebas/`.

**El segundo abierto es el alcance.** Esta suite corre en un solo navegador y no mira
accesibilidad ni diferencias visuales. Las dos cosas son decisiones con motivo —están en el
[documento 1](01-analisis-de-la-pantalla.md)— pero siguen siendo huecos, y conviene que
figuren como tales y no como «no hacía falta».

## Resumen

| Id | Riesgo | Severidad | Estado |
| --- | --- | :-: | --- |
| [R-01](#r-01--una-prueba-de-fechas-que-depende-de-la-máquina) | Fechas que dependen de la máquina | **Alta** | Mitigado fijando la zona |
| [R-02](#r-02--una-prueba-puede-dejar-de-poder-fallar-sin-que-nadie-se-entere) | Una prueba que deja de poder fallar | Media | Mitigado con F-03 |
| [R-03](#r-03--los-escenarios-se-pisan-los-datos) | Los escenarios se pisan los datos | Media | Mitigado: secuencial y sin valores a mano |
| [R-04](#r-04--la-suite-puede-pasar-sin-comprobar-nada) | Pasar sin comprobar nada | **Alta** | Mitigado con `detecta` |
| [R-05](#r-05--una-comprobación-negativa-sin-su-positiva) | Negativa sin positiva | Media | Mitigado por diseño |
| [R-06](#r-06--los-selectores-atados-al-estilo) | Selectores atados al estilo | Baja | Mitigado con `data-prueba` |

---

Siguiente: [5. Hallazgos](05-hallazgos.md) — cuatro los puse yo. Dos no.
