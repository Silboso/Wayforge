// Sube una imagen a la sala (se guarda en R2) y devuelve su URL.
export async function subirImagen(salaId: string, archivo: File): Promise<string> {
  const respuesta = await fetch(`/api/salas/${salaId}/imagenes`, {
    method: 'PUT',
    headers: { 'content-type': archivo.type },
    body: archivo,
  });
  if (!respuesta.ok) throw new Error((await respuesta.text()) || 'No se pudo subir la imagen');
  const { url } = (await respuesta.json()) as { url: string };
  return url;
}
