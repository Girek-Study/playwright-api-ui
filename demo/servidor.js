// ============================================================================
//  Panel de incidencias: una API y la interfaz que la dibuja, en un proceso.
//
//  Las dos están aquí porque este repositorio compara una con la otra. Lo que
//  se prueba no es si la API responde bien ni si la pantalla pinta algo: es si
//  LO QUE LA PANTALLA ENSEÑA ES LO QUE LA API GUARDA.
//
//  La API es correcta. Los cuatro defectos están en la interfaz, y se apagan
//  todos con `?corregida=1` en la URL. El detalle está en docs/05-hallazgos.md.
//
//  Ningún dato real. Los solicitantes son correlativos propios (USR-0001), no
//  nombres ni correos de nadie.
// ============================================================================

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// 8099 y no 8080. El 8080 es el puerto más ocupado de cualquier equipo de
// desarrollo, y un servicio ajeno que responda 200 con HTML hace que las
// primeras comprobaciones vayan contra otro sitio sin que nada lo diga.
const PUERTO = Number(process.env.PUERTO ?? 8099);

const PUBLICO = path.join(__dirname, 'publico');

const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];
const ESTADOS = ['ABIERTA', 'EN_CURSO', 'CERRADA'];

/**
 * Doce incidencias con fechas fijas en UTC.
 *
 * Fijas y no generadas: una siembra con `new Date()` hace que la hora que
 * enseña la pantalla dependa de cuándo se arrancó el servidor, y entonces una
 * comprobación de formato de fecha no se puede escribir sin trampas.
 *
 * Las horas están elegidas a propósito alrededor de medianoche UTC: son las
 * que delatan un desfase de zona horaria. Una incidencia de las 14:00 UTC se
 * ve parecida en media Europa y en media América; una de las 02:00 UTC cambia
 * de DÍA.
 */
const SIEMBRA = [
  ['INC-0001', 'La exportación a Excel sale vacía', 'ALTA', 'ABIERTA', '2026-11-03T02:15:00Z', 'USR-0001', 1250.5],
  ['INC-0002', 'El buscador ignora las tildes', 'MEDIA', 'EN_CURSO', '2026-11-02T22:40:00Z', 'USR-0002', 340.25],
  ['INC-0003', 'Caída del servicio de firma', 'CRITICA', 'ABIERTA', '2026-11-03T01:05:00Z', 'USR-0003', 8900.75],
  ['INC-0004', 'El informe mensual duplica filas', 'ALTA', 'EN_CURSO', '2026-11-01T16:30:00Z', 'USR-0001', 2100],
  ['INC-0005', 'No llega el correo de alta', 'MEDIA', 'CERRADA', '2026-10-30T09:12:00Z', 'USR-0004', 180.4],
  ['INC-0006', 'El filtro de fechas pierde el último día', 'ALTA', 'ABIERTA', '2026-11-02T23:55:00Z', 'USR-0002', 760.1],
  ['INC-0007', 'Lentitud en el listado de clientes', 'BAJA', 'ABIERTA', '2026-10-29T11:45:00Z', 'USR-0005', 95],
  ['INC-0008', 'El PDF sale sin el logotipo', 'BAJA', 'CERRADA', '2026-10-28T14:20:00Z', 'USR-0003', 60.9],
  ['INC-0009', 'Doble cargo al reintentar el pago', 'CRITICA', 'EN_CURSO', '2026-11-03T03:40:00Z', 'USR-0006', 15400],
  ['INC-0010', 'El acceso con tarjeta falla de madrugada', 'ALTA', 'ABIERTA', '2026-11-03T00:30:00Z', 'USR-0004', 3200.6],
  ['INC-0011', 'Los adjuntos de más de 5 MB se cortan', 'MEDIA', 'ABIERTA', '2026-10-31T18:05:00Z', 'USR-0005', 420],
  ['INC-0012', 'El contador del panel no cuadra', 'MEDIA', 'EN_CURSO', '2026-11-01T07:50:00Z', 'USR-0006', 230.35],
];

const incidencias = new Map(
  SIEMBRA.map(([id, titulo, prioridad, estado, creadaEn, solicitante, coste]) => [
    id,
    { id, titulo, prioridad, estado, creadaEn, solicitante, coste },
  ]),
);

let siguienteId = SIEMBRA.length;

function nuevoId() {
  siguienteId += 1;
  return `INC-${String(siguienteId).padStart(4, '0')}`;
}

// --- Utilidades -------------------------------------------------------------

function responderJson(res, codigo, cuerpo) {
  const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'content-type': 'application/json; charset=utf-8',
    // Sin caché: si el navegador reutiliza una respuesta vieja, la pantalla
    // enseña datos de hace un rato y la comprobación acusa a la interfaz de
    // un desfase que es del caché.
    'cache-control': 'no-store',
  });
  res.end(texto);
}

function error(res, codigo, clave, detalle) {
  responderJson(res, codigo, { error: { codigo: clave, detalle } });
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function servirEstatico(res, ruta) {
  const nombre = ruta === '/' ? '/index.html' : ruta;
  const destino = path.join(PUBLICO, path.normalize(nombre).replace(/^(\.\.[/\\])+/, ''));
  if (!destino.startsWith(PUBLICO) || !fs.existsSync(destino)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('No existe');
  }
  res.writeHead(200, {
    'content-type': TIPOS[path.extname(destino)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(destino).pipe(res);
}

// --- La API -----------------------------------------------------------------

function manejarApi(req, res, url, cuerpo) {
  // GET /api/incidencias?pagina=1&tam=5
  if (req.method === 'GET' && url.pathname === '/api/incidencias') {
    const todas = [...incidencias.values()];
    const tam = Math.min(Number(url.searchParams.get('tam') ?? 5), 50);
    const pagina = Math.max(Number(url.searchParams.get('pagina') ?? 1), 1);
    const desde = (pagina - 1) * tam;

    return responderJson(res, 200, {
      datos: todas.slice(desde, desde + tam),
      // El total de la colección, no el de esta página. La API lo hace bien;
      // es la interfaz la que lo ignora.
      total: todas.length,
      pagina,
      tam,
    });
  }

  const detalle = /^\/api\/incidencias\/(INC-\d{4})$/.exec(url.pathname);
  if (req.method === 'GET' && detalle) {
    const encontrada = incidencias.get(detalle[1]);
    if (!encontrada) return error(res, 404, 'NO_ENCONTRADA', 'Esa incidencia no existe');
    return responderJson(res, 200, encontrada);
  }

  if (req.method === 'POST' && url.pathname === '/api/incidencias') {
    const mal = [];
    if (typeof cuerpo.titulo !== 'string' || cuerpo.titulo.trim().length < 5) {
      mal.push({ campo: 'titulo', motivo: 'al menos 5 caracteres' });
    }
    if (!PRIORIDADES.includes(cuerpo.prioridad)) {
      mal.push({ campo: 'prioridad', motivo: 'prioridad desconocida' });
    }
    if (mal.length) {
      return responderJson(res, 400, {
        error: { codigo: 'INCIDENCIA_INVALIDA', detalle: 'Revisa los campos', campos: mal },
      });
    }

    const nueva = {
      id: nuevoId(),
      titulo: cuerpo.titulo.trim(),
      prioridad: cuerpo.prioridad,
      estado: 'ABIERTA',
      creadaEn: new Date().toISOString(),
      solicitante: 'USR-0001',
      coste: 0,
    };
    incidencias.set(nueva.id, nueva);
    return responderJson(res, 201, nueva);
  }

  if (req.method === 'GET' && url.pathname === '/api/salud') {
    return responderJson(res, 200, { estado: 'arriba', incidencias: incidencias.size });
  }

  error(res, 404, 'RUTA_NO_ENCONTRADA', 'Esa ruta no existe');
}

// --- Servidor ---------------------------------------------------------------

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);

  if (!url.pathname.startsWith('/api/')) {
    return servirEstatico(res, url.pathname);
  }

  let crudo = '';
  req.on('data', (t) => {
    crudo += t;
  });
  req.on('end', () => {
    let json = {};
    if (crudo) {
      try {
        json = JSON.parse(crudo);
      } catch {
        return error(res, 400, 'JSON_INVALIDO', 'El cuerpo no es JSON válido');
      }
    }
    manejarApi(req, res, url, json);
  });
});

servidor.listen(PUERTO, () => {
  console.log(`Panel de incidencias en http://localhost:${PUERTO}`);
  console.log(`Interfaz corregida:     http://localhost:${PUERTO}/?corregida=1`);
  console.log(`${incidencias.size} incidencias sembradas, fechas fijas en UTC`);
});

module.exports = { PRIORIDADES, ESTADOS };
