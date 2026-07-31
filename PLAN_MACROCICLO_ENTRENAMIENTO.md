# Plan de implementación: macrociclo de entrenamiento (refinado)

## 1. Decisiones arquitectónicas confirmadas

| Tema | Decisión |
|------|----------|
| Autenticación de persona | Login solo por cédula (`cc`). No se agrega login con contraseña para personas. El flujo sigue usando `?cc=...` en query params. |
| Almacenamiento de PDF | **No se guarda el archivo PDF**. Solo se extrae el texto, se muestra al usuario y se guardan los datos confirmados en JSON. |
| Librería de extracción PDF | `pdf-parse` (Node.js). Si las tablas resultan demasiado complejas, se evalúa `pdfjs-dist` como alternativa. |
| Identificación del admin | Usa el modelo `User` existente (`id` tipo `String`). `MacrocicloAuditLog.adminId` será `String?`. |
| Relación mesociclos ↔ etapas | Los mesociclos son independientes de etapas y periodos, pero sus fechas deben quedar alineadas dentro del rango total del macrociclo sin solaparse. |
| Guardado del wizard | Cada paso del wizard persiste en base de datos mediante Server Actions. El macrociclo siempre está en estado `borrador` hasta activarse. |
| Retorno desde nueva sesión | Al crear una sesión RM desde el flujo del macrociclo, se redirige a `/macrociclo/[id]/editar` (wizard), no al dashboard. |
| Cierre automático | Lazy: se verifica al consultar el dashboard o el detalle del macrociclo. |
| Snapshot RM | JSON puro en el campo `rmSnapshot`. |
| Volumen semanal | Campo numérico en **kilogramos**. |
| Auditoría | Incluye acciones de usuarios: creación de sesiones, creación de macrociclos y avances entre pasos. |

## 2. Alcance refinado

Se agrega una funcionalidad para crear, guardar como borrador, continuar, cerrar, eliminar y auditar macrociclos de entrenamiento.

### Dentro del alcance

- Macrociclo con objetivo `salud` o `competencia`.
- Fechas de inicio y fin.
- Evaluación antropométrica opcional extraída desde PDF (sin guardar el archivo).
- Sesión RM asociada, existente o nueva.
- Datos VO2Max.
- Periodos preparatorio y competitivo.
- Etapas por periodo.
- 8 mesociclos fijos.
- Microciclos semanales con frecuencia, volumen (kg) e intensidad (%).
- Dashboard con botón "Realizar macrociclo".
- Vista de detalle y edición del macrociclo.
- Panel administrativo con listado, detalle y auditoría.

### Fuera del alcance

- Periodo transitorio.
- Almacenamiento físico del PDF.
- OCR para PDFs escaneados (solo texto extraíble).
- Ejercicios detallados dentro de cada semana.

## 3. Reglas de producto refinadas

### Acceso y ciclo de vida

- El botón "Realizar macrociclo" estará en `app/dashboard/page.tsx`.
- La persona debe existir en el sistema para crear un macrociclo.
- El usuario puede crear un macrociclo aunque no tenga sesiones RM previas.
- Puede seleccionar cualquier sesión RM existente de la persona.
- Si decide realizar un nuevo test RM, se redirige a `/nueva-sesion?cc=...&macrocicloId=...&returnTo=macrociclo`.
- Al guardar la nueva sesión, se redirige de vuelta a `/macrociclo/[id]/editar`.
- El macrociclo se crea en estado `borrador` y persiste en cada paso.
- Máximo un macrociclo en estado `borrador` o `activo` por persona.
- Se permite cerrar manualmente un macrociclo de salud o competencia.
- Un macrociclo de competencia se cierra automáticamente un día después de `fechaCompetencia` (verificación lazy).
- Se permite eliminar un macrociclo mediante borrado lógico (`eliminado`).
- El admin puede auditar todos los macrociclos.

### Estados del macrociclo

- `borrador`: creado, incompleto o pendiente de activación.
- `activo`: completado y usable.
- `cerrado`: finalizado manualmente o automáticamente.
- `eliminado`: borrado lógico, visible solo para auditoría admin.

### Objetivos

- `salud`: mejorar composición corporal. Requiere `fechaInicio` y `fechaFinalObjetivo`.
- `competencia`: competencia con fecha. Requiere `fechaInicio` y `fechaCompetencia`.
- En competencia, `fechaFin = fechaCompetencia`.
- En salud, `fechaFin = fechaFinalObjetivo`.
- El objetivo es solo informativo y no altera cálculos.

### RM

- La sesión RM predeterminada sugerida es la última por fecha, sin importar el método.
- El usuario puede seleccionar cualquier otra sesión RM de la persona.
- Al asociar una sesión RM, se duplican los resultados en `rmSnapshot` como JSON.
- El macrociclo puede estar en borrador sin RM asociada.
- Para activar el macrociclo debe existir una sesión RM asociada.

### VO2Max

Se registra un solo método por macrociclo:

- `leger`
- `cooper`
- `directo`

**Cooper:**

```txt
VO2max = (distancia_en_metros - 504.9) / 44.73
```

**Directo:** valor en `ml/kg/min`.

**Léger (course-navette 20 m):** se registra la etapa (palier) alcanzada. La velocidad final y el VO2Max se calculan automáticamente:

```txt
velocidad_kmh = 8.5 + 0.5 * (etapa - 1)
VO2max = 5.857 * velocidad_kmh - 19.458
```

### Evaluación antropométrica desde PDF

- El paso es opcional durante la creación y posterior a la activación.
- Se acepta **un solo PDF** por carga.
- No se guarda el archivo; solo se extrae texto y se guardan los datos confirmados en `medidasSnapshot`.
- Se muestra una vista de confirmación con datos extraídos, unidad y sección.
- El usuario puede editar manualmente cada campo antes de guardar.
- El usuario selecciona qué campos guardar.
- Si el PDF no contiene información antropométrica reconocible, se muestra un mensaje genérico y se permite continuar sin datos.
- Si se confirman datos de peso, talla, cintura o cadera, se actualizan también en `Persona`.

#### Campos a extraer inicialmente

```txt
metadata.nombre
metadata.evaluador
metadata.edad
metadata.genero
metadata.deporte
metadata.fechaEvaluacion

medidasBasicas.masaCorporalKg
medidasBasicas.tallaCm
medidasBasicas.tallaSentadoCm
medidasBasicas.envergaduraBrazosCm

pliegues.tricepsMm
pliegues.subescapularMm
pliegues.bicepsMm
pliegues.crestaIliacaMm
pliegues.supraespinalMm
pliegues.abdominalMm
pliegues.musloMm
pliegues.piernaMm

perimetros.brazoRelajadoCm
perimetros.brazoFlexionadoContraidoCm
perimetros.cinturaCm
perimetros.caderaCm
perimetros.musloMedioCm
perimetros.piernaCm

diametros.humeroCm
diametros.biestiloideoCm
diametros.femurCm

composicionCorporal.masaGrasaKg
composicionCorporal.masaLibreGrasaKg
composicionCorporal.tejidoAdiposoKg
composicionCorporal.tejidoMuscularKg
composicionCorporal.tejidoOseoKg

adiposidad.sumatorio6PlieguesMm
adiposidad.sumatorio8PlieguesMm

indicesSalud.indiceCinturaCadera
indicesSalud.indiceConicidad
indicesSalud.indiceCinturaTalla
indicesSalud.imc
```

#### Estrategia de parser

- Normalizar texto quitando tildes para búsquedas internas, conservando etiquetas originales para mostrar al usuario.
- Soportar coma decimal y convertir a punto.
- Tomar como valor principal la columna `Resultados`.
- Guardar valores previo, diferencia y puntuación Z en `extractedDataRaw`.
- Usar patrones por sección para evitar confundir campos homónimos (ej. `Pierna` en pliegues vs. perímetros).

### Periodos

- Disponibles: `preparatorio` y `competitivo`.
- Deben sumar 100%.
- Si solo se diligencia uno, el otro recibe el porcentaje restante.
- Si ambos están vacíos, no se puede continuar.
- Si ambos se diligencian, deben sumar 100%.
- Las fechas de periodo deben quedar seguidas, sin huecos.
- El rango total debe llegar hasta `fechaCompetencia` cuando el objetivo es competencia.

### Etapas

**Periodo preparatorio:**

- `general`
- `especifica`

**Periodo competitivo:**

- `precompetitiva`
- `competitiva`

Reglas:

- Solo se habilitan las etapas del periodo activo.
- Las etapas habilitadas por periodo deben sumar 100% de ese periodo.
- Si una sola etapa tiene porcentaje, la otra recibe el restante.
- Si ambas están vacías para un periodo activo, no se puede continuar.
- Las fechas de etapa deben quedar seguidas dentro de su periodo.

### Mesociclos

Orden fijo de 8 mesociclos:

1. `entrante`
2. `desarrollador`
3. `desarrollador_especifico`
4. `estabilizador`
5. `precompetitivo`
6. `choque`
7. `aproximacion`
8. `competencia`

Reglas:

- Los 8 mesociclos ocupan el 100% del tiempo total.
- El usuario asigna porcentaje a cada mesociclo.
- No se pueden repetir.
- Se respeta el orden fijo.
- Los mesociclos con porcentaje 0 no aplican.
- Los porcentajes asignados deben completar 100%.
- Si queda un único mesociclo sin porcentaje y hay porcentaje libre, se le asigna el restante.
- Los porcentajes se pueden modificar posteriormente desde la UI.
- Al modificar porcentajes se debe recalcular rangos con confirmación para no sobrescribir configuraciones semanales sin avisar.
- Los mesociclos no tienen relación directa con periodos ni etapas, pero sus fechas deben estar alineadas dentro del rango total.

### Microciclos semanales

Tipos disponibles:

- `evaluacion`
- `corriente`
- `competitivo`
- `precompetitivo`
- `choque`
- `recuperacion`
- `aproximacion`

Reglas:

- Asignación manual.
- El usuario puede asignar el mismo tipo a varias semanas.
- Cada semana debe tener:
  - Tipo de microciclo.
  - Frecuencia (número entero de sesiones por semana, >= 0).
  - Volumen en kilogramos (>= 0).
  - Intensidad porcentaje promedio semanal (0 a 100).
- No se requieren ejercicios ni sesiones detalladas dentro de cada semana.

## 4. Modelo de datos refinado

### Macrociclo

```prisma
model Macrociclo {
  id                Int      @id @default(autoincrement())
  personaId         Int
  objetivoTipo      String   // "salud" | "competencia"
  objetivoDetalle   String?
  fechaInicio       DateTime @db.Date
  fechaFin          DateTime @db.Date
  fechaCompetencia  DateTime? @db.Date
  estado            String   // "borrador" | "activo" | "cerrado" | "eliminado"
  pasoActual        Int      @default(1)
  sesionRmId        Int?
  rmSnapshot        Json?
  medidasSnapshot   Json?
  vo2maxSnapshot    Json?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  closedAt          DateTime?
  closedReason      String?  // "manual" | "auto_competencia"
  deletedAt         DateTime?

  persona    Persona              @relation(fields: [personaId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  sesionRm   Sesion?              @relation(fields: [sesionRmId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  periodos   MacrocicloPeriodo[]
  mesociclos MacrocicloMesociclo[]
  semanas    MacrocicloSemana[]
  auditLogs  MacrocicloAuditLog[]

  @@index([personaId, estado])
}
```

### MacrocicloPeriodo

```prisma
model MacrocicloPeriodo {
  id            Int     @id @default(autoincrement())
  macrocicloId  Int
  tipo          String  // "preparatorio" | "competitivo"
  porcentaje    Float
  fechaInicio   DateTime @db.Date
  fechaFin      DateTime @db.Date
  orden         Int

  macrociclo Macrociclo         @relation(fields: [macrocicloId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  etapas     MacrocicloEtapa[]

  @@index([macrocicloId, orden])
}
```

### MacrocicloEtapa

```prisma
model MacrocicloEtapa {
  id            Int     @id @default(autoincrement())
  periodoId     Int
  tipo          String  // "general" | "especifica" | "precompetitiva" | "competitiva"
  porcentaje    Float
  fechaInicio   DateTime @db.Date
  fechaFin      DateTime @db.Date
  orden         Int

  periodo MacrocicloPeriodo @relation(fields: [periodoId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@index([periodoId, orden])
}
```

### MacrocicloMesociclo

```prisma
model MacrocicloMesociclo {
  id            Int     @id @default(autoincrement())
  macrocicloId  Int
  tipo          String  // "entrante" | "desarrollador" | "desarrollador_especifico" | "estabilizador" | "precompetitivo" | "choque" | "aproximacion" | "competencia"
  porcentaje    Float
  fechaInicio   DateTime @db.Date
  fechaFin      DateTime @db.Date
  orden         Int

  macrociclo Macrociclo        @relation(fields: [macrocicloId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  semanas    MacrocicloSemana[]

  @@index([macrocicloId, orden])
}
```

### MacrocicloSemana

```prisma
model MacrocicloSemana {
  id              Int     @id @default(autoincrement())
  macrocicloId    Int
  mesocicloId     Int
  numeroSemana    Int
  mesCalendario   Int
  fechaInicio     DateTime @db.Date
  fechaFin        DateTime @db.Date
  tipoMicrociclo  String  // "evaluacion" | "corriente" | "competitivo" | "precompetitivo" | "choque" | "recuperacion" | "aproximacion"
  frecuencia      Int
  volumen         Float   // kilogramos
  intensidad      Float   // 0 a 100
  notas           String?

  macrociclo Macrociclo        @relation(fields: [macrocicloId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  mesociclo  MacrocicloMesociclo @relation(fields: [mesocicloId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@index([macrocicloId, numeroSemana])
  @@index([mesocicloId])
}
```

### MacrocicloAuditLog

```prisma
model MacrocicloAuditLog {
  id           Int      @id @default(autoincrement())
  macrocicloId Int
  personaId    Int
  adminId      String?
  userType     String   // "persona" | "admin"
  action       String
  metadata     Json?
  before       Json?
  after        Json?
  createdAt    DateTime @default(now())

  macrociclo Macrociclo @relation(fields: [macrocicloId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@index([macrocicloId, createdAt])
  @@index([personaId, createdAt])
}
```

### Relación en Persona

```prisma
model Persona {
  ...
  macrociclos Macrociclo[]
}
```

### Relación en Sesion

```prisma
model Sesion {
  ...
  macrociclos Macrociclo[]
}
```

## 5. Regla de negocio: un solo macrociclo abierto

- Solo puede existir un macrociclo con estado `borrador` o `activo` por persona.
- Esta regla se protege mediante una transacción Prisma con `SELECT FOR UPDATE` sobre `Macrociclo` filtrando por `personaId` y estados abiertos.
- No se usa índice único parcial porque MySQL no lo soporta de forma portable.

## 6. Rutas y pantallas

### Dashboard

- Archivo: `app/dashboard/page.tsx`
- Cambios:
  - Agregar sección "Macrociclo de entrenamiento".
  - Botón principal "Realizar macrociclo".
  - Si existe macrociclo abierto, mostrar "Continuar macrociclo".
  - Si existen macrociclos cerrados, mostrar resumen del último.
  - Verificar cierre automático lazy antes de mostrar estado.
  - Enlaces a `/macrociclo/nuevo?cc=...` o `/macrociclo/[id]/editar`.

### Wizard de macrociclo

- `/macrociclo/nuevo/page.tsx` — inicia borrador y redirige al wizard.
- `/macrociclo/[id]/editar/page.tsx` — wizard editable.
- Componente compartido: `app/macrociclo/[id]/MacrocicloWizard.tsx`.

Pasos del wizard (cada uno guarda borrador):

1. Objetivo y fechas.
2. Carga opcional de PDF antropométrico.
3. Revisión/confirmación de datos extraídos.
4. Selección de RM o redirección a nuevo test.
5. VO2Max.
6. Periodos.
7. Etapas.
8. Mesociclos.
9. Microciclos por semana.
10. Revisión y activación.

### Detalle de macrociclo

- `/macrociclo/[id]/page.tsx`
- Funciones:
  - Ver resumen completo.
  - Editar porcentajes de mesociclos (con confirmación de recálculo).
  - Editar tipo de microciclo, frecuencia, volumen e intensidad por semana.
  - Cerrar macrociclo.
  - Eliminar macrociclo (lógico).
  - Cargar/reemplazar evaluación antropométrica.

### Administración

- `/app/admin/macrociclos/page.tsx` — listado con filtros.
- `/app/admin/macrociclos/[id]/page.tsx` — detalle y auditoría.

## 7. Acciones, servicios y librerías

### Archivos a crear

- `actions/macrociclo.ts` — Server Actions del wizard y operaciones de ciclo de vida.
- `services/macrociclo.service.ts` — lógica de negocio y transacciones.
- `lib/macrociclo.ts` — tipos y utilidades.
- `lib/macrociclo-periodizacion.ts` — cálculo de periodos, etapas, mesociclos y semanas.
- `lib/pdf-antropometria.ts` — extracción y mapeo de texto PDF.

### Responsabilidades

- Crear o recuperar borrador abierto.
- Proteger regla de un solo macrociclo abierto.
- Cerrar manual y automáticamente macrociclos de competencia vencidos.
- Validar porcentajes por nivel.
- Calcular semanas entre fechas.
- Convertir porcentajes a rangos de fecha.
- Extraer texto del PDF con `pdf-parse`.
- Mapear campos conocidos.
- Guardar datos confirmados.
- Duplicar snapshot RM como JSON.
- Persistir macrociclo completo en transacción Prisma.
- Actualizar medidas de persona cuando el usuario confirme.
- Registrar auditoría.

### Dependencia para PDF

```bash
npm install pdf-parse
```

Alternativa si las tablas son muy complejas: `pdfjs-dist`.

### Modificación en `actions/sesion.ts`

- Aceptar parámetros `macrocicloId` y `returnTo`.
- Si `returnTo === "macrociclo"` y existe `macrocicloId`, redirigir a `/macrociclo/[id]/editar`.
- Si no, mantener redirección actual al dashboard.

## 8. Validaciones principales

### Fechas

- `fechaInicio` obligatoria.
- Para competencia: `fechaCompetencia` obligatoria.
- Para salud: `fechaFinalObjetivo` obligatoria.
- La fecha final debe ser posterior a la fecha de inicio.
- El rango debe tener al menos 1 semana.

### Estado de macrociclo

- No permitir crear otro macrociclo `borrador` o `activo` si ya existe uno abierto.
- Permitir nuevo macrociclo solo si el anterior está `cerrado` o `eliminado`.
- No permitir editar datos estructurales de un macrociclo cerrado, salvo acciones administrativas.
- Cerrar automáticamente macrociclos de competencia cuando la fecha actual sea posterior a `fechaCompetencia + 1 día`.

### PDF antropométrico

- Opcional durante creación y posterior a activación.
- Solo se permite un PDF por carga.
- No se guarda el archivo.
- Si no se reconoce información antropométrica, mostrar mensaje genérico.
- No guardar datos no confirmados.
- Permitir corrección manual.

### Medidas

- No obligatorias.
- Peso > 0 si se diligencia.
- Talla > 0 si se diligencia.
- Talla sentado > 0 si se diligencia.
- Envergadura > 0 si se diligencia.
- Pliegues, perímetros y diámetros >= 0.

### RM

- El macrociclo puede ser borrador sin RM.
- Para activar debe existir una sesión RM asociada.
- La sesión RM debe pertenecer a la misma persona.
- Al asociar, duplicar resultados en `rmSnapshot`.

### VO2Max

- Solo un método activo.
- Cooper requiere distancia en metros.
- Directo requiere VO2Max relativo en `ml/kg/min`.
- Léger requiere la etapa (palier) alcanzada, un entero mayor o igual a 1.

### Porcentajes

- Periodos: preparatorio + competitivo = 100%.
- Etapas de cada periodo activo = 100%.
- Mesociclos = 100%.
- Campos vacíos equivalen a no asignado, salvo cuando se puede inferir el restante.

### Semanas

- Cada semana debe tener tipo de microciclo.
- Frecuencia: entero >= 0.
- Intensidad: 0 a 100.
- Volumen: >= 0 (kilogramos).

## 9. Algoritmo de distribución temporal

1. Calcular días totales entre `fechaInicio` y `fechaFin`.
2. Generar semanas completas o parciales desde `fechaInicio` hasta `fechaFin`.
3. Calcular cantidad total de semanas.
4. Completar porcentajes faltantes:
   - Periodos: si uno tiene valor y el otro está vacío, el otro = 100 - valor.
   - Etapas: misma regla dentro de cada periodo.
   - Mesociclos: si queda un único mesociclo vacío y hay porcentaje libre, asignarle el restante.
5. Para cada bloque porcentual:
   - `semanasBloque = round(totalSemanas * porcentaje / 100)`.
   - Asegurar mínimo 1 semana si el porcentaje es > 0 y hay semanas disponibles.
   - Ajustar diferencia final sumando/restando al bloque con mayor porcentaje.
6. Asignar fechas de inicio/fin a periodos de forma consecutiva.
7. Repetir distribución dentro de cada periodo para etapas.
8. Distribuir mesociclos sobre el rango total en el orden fijo.
9. Crear semanas con:
   - `numeroSemana`.
   - `fechaInicio`.
   - `fechaFin`.
   - `mesCalendario`.
   - `mesocicloId` según rango.
   - `tipoMicrociclo` manual (por defecto `corriente`).
   - `frecuencia` (por defecto 0).
   - `volumen` (por defecto 0).
   - `intensidad` (por defecto 0).

## 10. UI/UX

- Usar sistema de colores existente: `bg-bg-main`, `bg-bg-soft`, `text-text-primary`, `text-text-secondary`, `text-accent`.
- Formularios en secciones simples.
- Indicador de pasos compacto.
- En PDF: tabla con "dato extraído", "valor", "guardar", "editar".
- En porcentajes: mostrar total acumulado y estado "Faltan X%" o "Excede X%".
- En periodos: indicar que competitivo se autocompleta con el restante del preparatorio.
- En semanas: tabla responsiva o lista agrupada por mes:
  - Mes.
  - Semana.
  - Rango de fechas.
  - Mesociclo.
  - Tipo de microciclo.
  - Frecuencia.
  - Volumen (kg).
  - Intensidad (%).
- Guardar borrador automáticamente al avanzar de paso.

## 11. Fases de implementación

### Fase 1: Modelo de datos

1. Ajustar `prisma/schema.prisma` con modelos `Macrociclo`, `MacrocicloPeriodo`, `MacrocicloEtapa`, `MacrocicloMesociclo`, `MacrocicloSemana`, `MacrocicloAuditLog`.
2. Agregar relaciones `Persona.macrociclos` y `Sesion.macrociclos`.
3. Crear migración Prisma.
4. Ejecutar `prisma generate`.
5. Crear tipos auxiliares en `lib/macrociclo.ts`.

### Fase 2: Servicios base

1. Crear `services/macrociclo.service.ts`.
2. Implementar `crearORecuperarBorrador(cc)`.
3. Implementar bloqueo de más de un macrociclo abierto.
4. Implementar cierre manual.
5. Implementar cierre automático lazy.
6. Implementar eliminación lógica.
7. Implementar auditoría.

### Fase 3: Dashboard

1. Agregar sección "Macrociclo de entrenamiento" en `app/dashboard/page.tsx`.
2. Botón "Realizar macrociclo".
3. Detectar borrador abierto y mostrar "Continuar macrociclo".
4. Mostrar último macrociclo cerrado si aplica.
5. Aplicar cierre automático lazy antes de renderizar.

### Fase 4: Wizard — pasos 1 a 3 (objetivo, fechas, PDF)

1. Crear `/macrociclo/nuevo/page.tsx`.
2. Crear `/macrociclo/[id]/editar/page.tsx`.
3. Crear `MacrocicloWizard.tsx`.
4. Paso 1: objetivo y fechas.
5. Paso 2: carga de PDF.
6. Instalar `pdf-parse`.
7. Crear `lib/pdf-antropometria.ts`.
8. Paso 3: confirmación de datos extraídos.
9. Guardar borrador tras cada paso.

### Fase 5: Wizard — pasos 4 a 5 (RM y VO2Max)

1. Listar sesiones RM de la persona.
2. Mostrar última sesión como sugerida.
3. Permitir seleccionar cualquier sesión.
4. Duplicar snapshot RM como JSON.
5. Redirigir a `/nueva-sesion?cc=...&macrocicloId=...&returnTo=macrociclo`.
6. Modificar `actions/sesion.ts` para retornar al wizard.
7. Implementar formulario VO2Max con los tres métodos.

### Fase 6: Wizard — pasos 6 a 9 (periodización)

1. Implementar periodos preparatorio y competitivo.
2. Implementar etapas por periodo.
3. Implementar 8 mesociclos en orden fijo.
4. Implementar cálculo de semanas.
5. Implementar redondeo y ajuste al bloque más largo.
6. Crear semanas con valores por defecto.

### Fase 7: Wizard — paso 10 (revisión y activación)

1. Vista de resumen.
2. Validar RM asociada.
3. Activar macrociclo (`estado = activo`).
4. Registrar auditoría.

### Fase 8: Detalle de macrociclo

1. Crear `/macrociclo/[id]/page.tsx`.
2. Mostrar resumen completo.
3. Editar mesociclos con confirmación de recálculo.
4. Editar semanas.
5. Cerrar macrociclo.
6. Eliminar macrociclo.
7. Cargar/corregir antropometría posterior a la creación.

### Fase 9: Administración

1. Crear `/app/admin/macrociclos/page.tsx`.
2. Crear `/app/admin/macrociclos/[id]/page.tsx`.
3. Listar macrociclos con filtros.
4. Ver detalle y auditoría.

### Fase 10: QA

1. Persona sin sesiones RM.
2. Persona con una sesión RM.
3. Persona con múltiples sesiones RM.
4. Nuevo test RM desde macrociclo y retorno.
5. Objetivo salud.
6. Objetivo competencia.
7. PDF con campos completos.
8. PDF con campos parciales.
9. PDF no antropométrico (mensaje genérico).
10. Porcentajes autocompletados.
11. Redondeos con rangos cortos.
12. Cierre manual.
13. Cierre automático un día después de competencia.
14. Carga antropométrica posterior a activación.
15. Auditoría de usuario y admin.
16. Modo oscuro y responsive.
17. `npm run lint`.
18. `npm run build`.

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Extracción de PDF varía según formato | Empezar con `pdf-parse` y patrones por sección. Ajustar con PDFs reales. |
| PDF escaneado sin texto extraíble | Mostrar mensaje genérico y permitir entrada manual. OCR queda fuera del alcance. |
| Condición de carrera al crear borrador | Transacción con `SELECT FOR UPDATE` sobre macrociclos abiertos de la persona. |
| Wizard largo con pérdida de datos | Guardar borrador tras cada paso mediante Server Actions. |
| Recálculo de mesociclos borra semanas | Pedir confirmación explícita antes de recalcular. |
| Redondeo de semanas genera huecos o sobrantes | Ajustar diferencia al bloque con mayor porcentaje y validar suma total. |
| Snapshot RM como JSON | Documentar que es inmutable histórico. No consultar por ejercicio dentro del snapshot. |
| Modificación de `/nueva-sesion` | Mantener comportamiento actual si no hay `returnTo=macrociclo`. |

## 13. Entregables

- Migración Prisma con modelos de macrociclo.
- Servicios y acciones para crear, guardar, continuar, cerrar y eliminar macrociclos.
- Cierre automático lazy un día después de `fechaCompetencia`.
- Botón "Realizar macrociclo" en dashboard.
- Wizard con 10 pasos y borrador persistente.
- Extracción opcional de PDF antropométrica con `pdf-parse`.
- Confirmación de datos extraídos durante o después de la creación.
- Selección de sesión RM existente.
- Redirección a nuevo test RM y retorno al wizard.
- Snapshot RM duplicado como JSON.
- Registro VO2Max con test de Léger, Cooper o directo.
- Periodos preparatorio y competitivo.
- Etapas por periodo.
- 8 mesociclos en orden fijo.
- Microciclos semanales manuales.
- Frecuencia, volumen (kg) e intensidad (%) por semana.
- Vista de detalle/edición.
- Vista admin con auditoría.
- QA con lint y build exitosos.

## 14. Checklist de inicio

Antes de escribir código:

- [ ] Confirmar que `DATABASE_URL` está configurado.
- [ ] Hacer backup de la base de datos actual.
- [ ] Confirmar que el modelo `User` existente se usa para admin.
- [ ] Tener a la mano el PDF de ejemplo para calibrar el parser.
- [ ] Definir si se despliega en Vercel (impacta storage de PDF, aunque aquí no se guarda).
- [ ] Confirmar que no se requiere login de persona (solo cédula).
