// ============================================================================
//  La interfaz del panel.
//
//  Aquí viven los cuatro defectos de este repositorio, y los cuatro tienen la
//  misma forma: la API devuelve un dato correcto y la pantalla enseña otra
//  cosa. Ninguno rompe nada. Los cuatro producen una pantalla que funciona.
//
//      D-01  la fecha se pinta en la zona del navegador, sin decirlo
//      D-02  el contador cuenta la página en vez de la colección
//      D-03  un error de la API se dibuja como «no hay incidencias»
//      D-04  el alta dice «Guardada» antes de saber si se guardó
//
//  Se apagan todos con `?corregida=1`. El detalle está en docs/05-hallazgos.md.
// ============================================================================

const CORREGIDA = new URLSearchParams(location.search).get('corregida') === '1';

const TAM = 5;
let paginaActual = 1;

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  $('modo').textContent = CORREGIDA ? 'interfaz corregida' : 'interfaz con 4 defectos';
  $('anterior').addEventListener('click', () => void irA(paginaActual - 1));
  $('siguiente').addEventListener('click', () => void irA(paginaActual + 1));
  $('alta').addEventListener('submit', (e) => void guardar(e));
  void cargar();
});

async function irA(pagina) {
  if (pagina < 1) return;
  paginaActual = pagina;
  await cargar();
}

// --- Fechas -----------------------------------------------------------------

/**
 * La fecha, como la ve quien mira la pantalla.
 *
 * D-01: `toLocaleString()` sin opciones usa la zona del navegador y NO dice
 * cuál es. La API guarda `2026-11-03T02:15:00Z`; en Lima eso son las 21:15 del
 * día 2, y la pantalla escribe «2/11/2026, 21:15» sin una sola pista de que
 * esa hora no es la del registro.
 *
 * Quien lea la pantalla y quien lea la base de datos verán DÍAS distintos para
 * la misma incidencia, y los dos tendrán razón.
 *
 * La versión corregida enseña la hora en la zona del registro y la nombra.
 */
function comoFecha(iso) {
  const d = new Date(iso);
  const formato = { dateStyle: 'short', timeStyle: 'short' };

  if (!CORREGIDA) {
    // Sin `timeZone`: Intl usa la del navegador. El formato es impecable y la
    // hora es real; lo único que falta es decir de qué zona es, y eso no se
    // nota mirando la pantalla.
    return new Intl.DateTimeFormat('es-PE', formato).format(d);
  }

  const partes = new Intl.DateTimeFormat('es-PE', { ...formato, timeZone: 'UTC' }).format(d);
  return `${partes} UTC`;
}

/**
 * El importe.
 *
 * Esto NO es uno de los defectos: está bien a propósito, para que la suite
 * tenga algo que comprobar que de verdad coincide. Una suite en la que todo
 * lo que mira está mal no demuestra que sepa distinguir.
 */
function comoImporte(numero) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(numero);
}

// --- Estados de la pantalla -------------------------------------------------

function mostrarSolo(cual) {
  for (const id of ['cargando', 'vacio', 'fallo', 'tabla']) {
    $(id).hidden = id !== cual;
  }
}

// --- Listado ----------------------------------------------------------------

async function cargar() {
  mostrarSolo('cargando');

  let respuesta;
  try {
    respuesta = await fetch(`/api/incidencias?pagina=${paginaActual}&tam=${TAM}`);
  } catch (e) {
    // Un fallo de red. Hasta aquí las dos versiones hacen lo mismo.
    return pintarFallo('No se pudo contactar con el servicio.');
  }

  if (!respuesta.ok) {
    // D-03: la versión defectuosa trata un 500 como «no hay nada».
    //
    // Es el defecto más repetido que hay en una interfaz, y el más caro: quien
    // mira la pantalla concluye que no hay incidencias abiertas y se va a
    // casa. Un error dibujado como vacío no es un error degradado, es una
    // respuesta falsa.
    if (!CORREGIDA) {
      $('contador').textContent = '0 incidencias';
      return mostrarSolo('vacio');
    }
    return pintarFallo('No se pudieron cargar las incidencias. Vuelve a intentarlo.');
  }

  const pagina = await respuesta.json();

  if (pagina.datos.length === 0) {
    $('contador').textContent = '0 incidencias';
    return mostrarSolo('vacio');
  }

  // D-02: el contador.
  //
  // `datos.length` es lo que cabe en esta página —cinco— y `total` es lo que
  // hay —doce—. La API devuelve los dos; la pantalla elige el que no es.
  //
  // El número resultante es creíble, que es lo que lo hace peligroso: nadie
  // sospecha de un «5 incidencias» en una tabla con cinco filas.
  const cuantas = CORREGIDA ? pagina.total : pagina.datos.length;
  $('contador').textContent = `${cuantas} ${cuantas === 1 ? 'incidencia' : 'incidencias'}`;

  $('filas').replaceChildren(...pagina.datos.map(comoFila));
  $('pagina').textContent = `Página ${pagina.pagina}`;
  $('siguiente').disabled = pagina.pagina * pagina.tam >= pagina.total;
  $('anterior').disabled = pagina.pagina <= 1;

  mostrarSolo('tabla');
}

function comoFila(incidencia) {
  const tr = document.createElement('tr');
  tr.dataset.prueba = 'fila';
  tr.dataset.id = incidencia.id;

  const celdas = [
    ['id', incidencia.id],
    ['titulo', incidencia.titulo],
    ['prioridad', incidencia.prioridad],
    ['estado', incidencia.estado.replace('_', ' ')],
    ['creada', comoFecha(incidencia.creadaEn)],
    ['coste', comoImporte(incidencia.coste)],
  ];

  for (const [campo, valor] of celdas) {
    const td = document.createElement('td');
    td.dataset.prueba = campo;
    td.textContent = valor;
    tr.append(td);
  }
  return tr;
}

function pintarFallo(mensaje) {
  $('fallo').textContent = mensaje;
  $('contador').textContent = '';
  mostrarSolo('fallo');
}

// --- Alta -------------------------------------------------------------------

async function guardar(evento) {
  evento.preventDefault();
  const aviso = $('aviso');
  aviso.hidden = true;
  aviso.classList.remove('error');

  const cuerpo = {
    titulo: $('titulo').value,
    prioridad: $('prioridad').value,
  };

  // D-04: el aviso optimista.
  //
  // La versión defectuosa anuncia el éxito ANTES de saber si lo hubo. Si la
  // API responde 400 o 500, la pantalla ya dijo «Guardada» y el usuario se
  // marcha convencido. Lo descubre quien busque la incidencia dentro de tres
  // semanas y no la encuentre.
  //
  // Y es invisible por el camino feliz: cuando la API funciona, el mensaje
  // acaba siendo verdad.
  if (!CORREGIDA) {
    aviso.textContent = 'Guardada';
    aviso.hidden = false;
  }

  let respuesta;
  try {
    respuesta = await fetch('/api/incidencias', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    if (CORREGIDA) {
      aviso.textContent = 'No se pudo contactar con el servicio.';
      aviso.classList.add('error');
      aviso.hidden = false;
    }
    return;
  }

  if (!respuesta.ok) {
    if (CORREGIDA) {
      const fallo = await respuesta.json().catch(() => null);
      aviso.textContent = fallo?.error?.detalle
        ? `No se guardó: ${fallo.error.detalle}`
        : 'No se guardó la incidencia.';
      aviso.classList.add('error');
      aviso.hidden = false;
    }
    return;
  }

  const creada = await respuesta.json();
  aviso.textContent = `Guardada como ${creada.id}`;
  aviso.hidden = false;
  $('titulo').value = '';
  paginaActual = 1;
  await cargar();
}
