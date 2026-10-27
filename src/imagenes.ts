// Sube una imagen a la sala (se guarda en KV, o en R2 si la cuenta lo tiene) y devuelve su URL.
// Antes la achica si hace falta: un retrato no necesita más de 512 px ni un mapa más de 5000; así la mesa carga rápido
// para todos y no se llena el almacenamiento. Los GIF (pueden ser animados) se suben tal cual.

export type UsoImagen = 'retrato' | 'handout' | 'mapa';

const LADO_MAXIMO: Record<UsoImagen, number> = { retrato: 512, handout: 2048, mapa: 5000 };
// Por debajo de esto, si además no se pasa de lado, se sube el archivo original
const PESO_LIBRE: Record<UsoImagen, number> = { retrato: 400_000, handout: 2_000_000, mapa: 6_000_000 };

export async function achicarImagen(archivo: File, uso: UsoImagen): Promise<Blob> {
  if (archivo.type === 'image/gif' || typeof createImageBitmap !== 'function') return archivo;
  let imagen: ImageBitmap;
  try { imagen = await createImageBitmap(archivo); } catch { return archivo; }
  const lado = Math.max(imagen.width, imagen.height);
  const max = LADO_MAXIMO[uso];
  if (lado <= max && archivo.size <= PESO_LIBRE[uso]) { imagen.close(); return archivo; }
  const escala = Math.min(1, max / lado);
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  const achicada = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/webp', 0.86));
  // Si el navegador no sabe hacer WebP (o salió más pesada), queda la original
  return achicada && achicada.type === 'image/webp' && achicada.size < archivo.size ? achicada : archivo;
}

export async function subirImagen(salaId: string, archivo: File, uso: UsoImagen = 'retrato'): Promise<string> {
  const cuerpo = await achicarImagen(archivo, uso);
  if (cuerpo.size > 15 * 1024 * 1024) throw new Error('La imagen pesa más de 15 MB, incluso achicada');
  const respuesta = await fetch(`/api/salas/${salaId}/imagenes`, {
    method: 'PUT',
    headers: { 'content-type': cuerpo.type },
    body: cuerpo,
  });
  if (!respuesta.ok) throw new Error((await respuesta.text()) || 'No se pudo subir la imagen');
  const { url } = (await respuesta.json()) as { url: string };
  return url;
}
