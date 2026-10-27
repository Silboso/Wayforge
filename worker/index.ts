import { Hono } from 'hono';
import { estadoImportable, MAX_TAMANO_ESTADO, type MesaExportada } from '../compartido/sala';

export { Sala } from './sala';

const app = new Hono<{ Bindings: Env }>();

const ID_SALA = /^[a-z0-9]{6,32}$/;
const TIPOS_IMAGEN: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};
const MAX_IMAGEN = 15 * 1024 * 1024;

// Las imágenes van a R2 si la cuenta lo tiene configurado; si no, a Workers KV
function bucket(env: Env): R2Bucket | undefined {
  return (env as unknown as { IMAGENES?: R2Bucket }).IMAGENES;
}

async function guardarImagen(env: Env, clave: string, cuerpo: ArrayBuffer, tipo: string) {
  const r2 = bucket(env);
  if (r2) await r2.put(clave, cuerpo, { httpMetadata: { contentType: tipo } });
  else await env.IMAGENES_KV.put(clave, cuerpo, { metadata: { tipo } });
}

async function leerImagen(env: Env, clave: string): Promise<{ cuerpo: ReadableStream | ArrayBuffer; tipo: string } | null> {
  const r2 = bucket(env);
  if (r2) {
    const objeto = await r2.get(clave);
    return objeto ? { cuerpo: objeto.body, tipo: objeto.httpMetadata?.contentType ?? 'application/octet-stream' } : null;
  }
  const { value, metadata } = await env.IMAGENES_KV.getWithMetadata<{ tipo: string }>(clave, 'arrayBuffer');
  return value ? { cuerpo: value, tipo: metadata?.tipo ?? 'application/octet-stream' } : null;
}

// Código de sala: 6 caracteres fáciles de dictar (sin 0/o, 1/i/l)
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789';

function codigoSala(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALFABETO[b % ALFABETO.length]).join('');
}

// Crea la partida y devuelve su código y el código de GM (que solo se ve esta vez)
app.post('/api/salas', async (c) => {
  for (let intento = 0; intento < 5; intento++) {
    const codigo = codigoSala();
    const codigoGM = await c.env.SALAS.get(c.env.SALAS.idFromName(codigo)).inicializar();
    if (codigoGM) return c.json({ codigo, codigoGM });
  }
  return c.text('No se pudo crear la partida', 500);
});

// Abre una mesa exportada (Fase 7: campañas) en una sala nueva: sube sus imágenes, cambia las direcciones y
// le pasa el estado a la sala. Devuelve el código de la mesa y el código de GM nuevo
app.post('/api/salas/importar', async (c) => {
  let mesa: MesaExportada;
  try { mesa = await c.req.json<MesaExportada>(); } catch { return c.text('Ese archivo no es una mesa de Wayforge', 400); }
  if (mesa?.formato !== 'wayforge-mesa' || mesa.version !== 1 || typeof mesa.codigos?.sal !== 'string' || typeof mesa.codigos.personajes !== 'object') {
    return c.text('Ese archivo no es una mesa de Wayforge', 400);
  }
  const personajes = Object.entries(mesa.codigos.personajes ?? {}).filter(([id, h]) => typeof id === 'string' && typeof h === 'string' && h.length <= 200);
  for (let intento = 0; intento < 5; intento++) {
    const codigo = codigoSala();
    const sala = c.env.SALAS.get(c.env.SALAS.idFromName(codigo));
    const codigoGM = await sala.inicializar();
    if (!codigoGM) continue;
    // Las imágenes: cada data URL se vuelve un archivo de esta sala, y su dirección vieja se reemplaza en el estado
    let texto = JSON.stringify(mesa.estado ?? null);
    for (const [vieja, dato] of Object.entries(mesa.imagenes ?? {}).slice(0, 300)) {
      const m = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/.exec(dato);
      if (!m || !vieja.startsWith('/api/imagenes/')) continue;
      const cuerpo = Uint8Array.from(atob(m[2]!), (ch) => ch.charCodeAt(0));
      if (cuerpo.byteLength > MAX_IMAGEN) continue;
      const clave = `salas/${codigo}/${crypto.randomUUID()}.${TIPOS_IMAGEN[m[1]!]}`;
      await guardarImagen(c.env, clave, cuerpo.buffer, m[1]!);
      texto = texto.split(JSON.stringify(vieja).slice(1, -1)).join(`/api/imagenes/${clave}`);
    }
    if (texto.length > MAX_TAMANO_ESTADO) return c.text('La mesa es demasiado grande', 413);
    const estado = estadoImportable(JSON.parse(texto));
    if (!estado) return c.text('Algo en la mesa no cuadra: no se pudo abrir', 400);
    const ok = await sala.importar(estado, { sal: mesa.codigos.sal, personajes: Object.fromEntries(personajes) });
    if (!ok) return c.text('No se pudo abrir la mesa', 500);
    return c.json({ codigo, codigoGM });
  }
  return c.text('No se pudo crear la partida', 500);
});

app.get('/api/salas/:id', async (c) => {
  const id = c.req.param('id');
  if (!ID_SALA.test(id)) return c.json({ existe: false });
  return c.json({ existe: await c.env.SALAS.get(c.env.SALAS.idFromName(id)).existe() });
});

app.get('/api/salas/:id/ws', async (c) => {
  const id = c.req.param('id');
  if (!ID_SALA.test(id)) return c.text('Sala no válida', 400);
  const sala = c.env.SALAS.get(c.env.SALAS.idFromName(id));
  return sala.fetch(c.req.raw);
});

// Sube una imagen de mapa o token. El cuerpo es el archivo tal cual.
app.put('/api/salas/:id/imagenes', async (c) => {
  const id = c.req.param('id');
  if (!ID_SALA.test(id)) return c.text('Sala no válida', 400);
  const tipo = c.req.header('content-type') ?? '';
  const extension = TIPOS_IMAGEN[tipo];
  if (!extension) return c.text('Solo se aceptan imágenes PNG, JPG, WebP, GIF o AVIF', 415);
  const largo = Number(c.req.header('content-length') ?? 0);
  if (largo > MAX_IMAGEN) return c.text('La imagen pesa más de 15 MB', 413);

  const cuerpo = await c.req.arrayBuffer();
  if (cuerpo.byteLength > MAX_IMAGEN) return c.text('La imagen pesa más de 15 MB', 413);
  const clave = `salas/${id}/${crypto.randomUUID()}.${extension}`;
  await guardarImagen(c.env, clave, cuerpo, tipo);
  return c.json({ url: `/api/imagenes/${clave}` });
});

app.get('/api/imagenes/*', async (c) => {
  const clave = c.req.path.slice('/api/imagenes/'.length);
  if (!/^salas\/[a-z0-9]{6,32}\/[0-9a-f-]{36}\.[a-z]{3,4}$/.test(clave)) return c.notFound();
  const imagen = await leerImagen(c.env, clave);
  if (!imagen) return c.notFound();
  // La clave lleva un UUID: una imagen nunca cambia de contenido
  return new Response(imagen.cuerpo, {
    headers: {
      'content-type': imagen.tipo,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
});

export default app satisfies ExportedHandler<Env>;
