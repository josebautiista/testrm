import { prisma } from "@/lib/prisma";
import { validatePersonaInput } from "@/helpers/validators";

export type FichaAtleta = {
  nombre: string;
  sexo: string;
  masaCorporal: number;
  edad: number;
  talla: number;
};

export async function guardarYVincularAtleta({
  cc, version, datos, autor,
}: {
  cc: string;
  version: string;
  datos?: FichaAtleta;
  autor: { userId: string; username: string };
}) {
  return prisma.$transaction(async (tx) => {
    const persona = await tx.persona.findUnique({ where: { cc } });
    if (!persona) throw new Error("El atleta ya no existe. Vuelve a buscar su cédula.");

    if (datos) {
      validatePersonaInput({ cc, ...datos });
      const antes: FichaAtleta = {
        nombre: persona.nombre, sexo: persona.sexo,
        masaCorporal: persona.masaCorporal, edad: persona.edad, talla: persona.talla,
      };
      // Comparación atómica: una lectura previa por sí sola no evita carreras.
      const actualizado = await tx.persona.updateMany({
        where: { id: persona.id, updatedAt: new Date(version) },
        data: {
          ...datos,
          updatedAt: new Date(Math.max(Date.now(), persona.updatedAt.getTime() + 1)),
        },
      });
      if (actualizado.count !== 1) {
        throw new Error("Otro entrenador modificó esta ficha. Recarga los datos antes de guardar.");
      }
      await tx.personaCambio.create({
        data: {
          personaId: persona.id, autorId: autor.userId, autorNombre: autor.username,
          antes, despues: datos,
        },
      });
    }

    // Añadir sin editar conserva la versión más reciente, incluso si cambió
    // mientras el formulario estaba abierto. La clave compuesta evita duplicados.
    await tx.personaEntrenador.upsert({
      where: { personaId_entrenadorId: { personaId: persona.id, entrenadorId: autor.userId } },
      create: { personaId: persona.id, entrenadorId: autor.userId },
      update: {},
    });
    return persona.cc;
  });
}
