import { Hono } from 'hono';

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
  await c.env.IMAGENES.put(clave, cuerpo, { httpMetadata: { contentType: tipo } });
  return c.json({ url: `/api/imagenes/${clave}` });
});

app.get('/api/imagenes/*', async (c) => {
  const clave = c.req.path.slice('/api/imagenes/'.length);
  const objeto = await c.env.IMAGENES.get(clave);
  if (!objeto) return c.notFound();
  // La clave lleva un UUID: una imagen nunca cambia de contenido
  return new Response(objeto.body, {
    headers: {
      'content-type': objeto.httpMetadata?.contentType ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
});

export default app satisfies ExportedHandler<Env>;
