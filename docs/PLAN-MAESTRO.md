# PLAN MAESTRO DE IMPLEMENTACIÓN — APP_TEST_DE_RM

> Documento derivado de la auditoría del código real del repositorio (rama `NewApp`).
> Todas las referencias a archivos, funciones, modelos y campos corresponden a código existente y verificado.
> Fecha de elaboración: 2026-08-24.

---

## 0. RESUMEN DE LA AUDITORÍA (base sobre la que se apoya todo el plan)

### 0.1 Qué es hoy la aplicación

Una app Next.js 16 / React 19 / Prisma 7 sobre MariaDB con tres capas superpuestas que crecieron en momentos distintos:

| Capa | Archivos núcleo | Estado |
|---|---|---|
| Test de RM | `lib/rm.ts`, `lib/nacleiro.ts`, `actions/sesion.ts`, `app/nueva-sesion/**` | Funcional, con errores científicos graves |
| Recomendación simple | `lib/training.ts`, `lib/user-level.ts`, `components/results/**` | Correcta en su tabla, desconectada del resto |
| Macrociclo | `lib/macrociclo*.ts`, `services/macrociclo.service.ts`, `app/macrociclo/**` | Estructura sin motor: el humano calcula todo |

### 0.2 Defectos confirmados, con ubicación

**D-01 · RM global entre ejercicios distintos** — `actions/sesion.ts:429-444`
```ts
const finalRM = Math.max(...sanitizedEjercicios.map((item) => getFinalRM(item, rmMethod, persona.sexo)));
```
Se toma el máximo sobre *ejercicios diferentes*. La prensa de pierna domina siempre. Ese escalar se guarda en `Sesion.finalRM` y luego:
- `app/dashboard/page.tsx:200-210` lo usa como `latestGlobalRM`,
- `lib/user-level.ts:29-33` lo divide por la masa corporal para clasificar nivel,
- `components/results/TrainingRecommendations.tsx:100-101` calcula "peso sugerido" con él para *cualquier* objetivo.

Consecuencia: casi todos los usuarios se clasifican `advanced` y el peso sugerido no corresponde a ningún ejercicio real. **Es el defecto más grave del sistema.**

**D-02 · Sesgo por `Math.max` entre fórmulas** — `actions/sesion.ts:130-139`
```ts
estimated: Math.max(rm.epley, rm.brzycki)
```
Elegir el máximo de un conjunto de estimadores sesga sistemáticamente al alza. Un estimador debe ser uno definido, con banda de incertidumbre; nunca el máximo.

**D-03 · Diferenciación por sexo inexistente** — `lib/rm.ts:168-201`
`calculateRMFemenino` reimplementa las mismas ocho ecuaciones con los mismos coeficientes que la rama masculina (`0.0333`, `1.0278-0.0278r`, `r^0.1`, `1.013-0.0267123r`, `0.025`, `52.2+41.9e^-0.055r`, `48.8+53.8e^-0.075r`, `0.033`). El `if (normalizedSexo === "femenino")` no cambia ningún resultado. El sexo sí importa (las mujeres suelen completar más repeticiones a un mismo %1RM, sobre todo en tren inferior), pero eso no está modelado.

**D-04 · Fórmulas fuera de su rango de validez, con singularidades** — `lib/rm.ts:219,240`
`Brzycki` tiene denominador `1.0278 - 0.0278r`, cero en `r ≈ 36.97`; `Lander` tiene `1.013 - 0.0267123r`, cero en `r ≈ 37.92`. `safeDivide` devuelve 0 en el cero exacto, pero para `r > 37` el resultado es **negativo** y se persiste tal cual. No hay validación de rango en ningún punto.

Y el problema es estructural, no accidental: el protocolo actual fija la carga en un % de la masa corporal (`lib/rm.ts:337`), lo que empuja a repeticiones altas — justo donde las fórmulas dejan de ser válidas.

**D-05 · Casas inventa un RM no levantado** — `app/nueva-sesion/CasasProtocol.tsx:155-158`
```ts
const finalRM = Math.max(...calculatedSteps.map((step) => step.actualWeight || step.targetWeightMax), 0);
```
Si el atleta no registra pesos reales, `actualWeight` es `0` y se usa `targetWeightMax`, cuyo máximo es el escalón "Repetición 3 fuerte" = **115.8% del RM de referencia**. El sistema registra como medido un peso que nunca se levantó. Es un problema de validez *y* de seguridad, porque ese valor se usará para prescribir cargas.

**D-06 · Nacleiro sin validación ni redondeo** — `lib/nacleiro.ts`
`calculateKIES` divide por `series - 1` (división por cero con `series = 1`). `calculateInitialWeight` usa una función a trozos sobre `rm/bodyWeight` sin fuente documentada. `generateSeries` usa `Math.round`, produciendo pesos no cargables (existe `roundWeight` a 2.5 kg en `lib/training.ts:77-83`, pero no se usa aquí).

**D-07 · Los protocolos de laboratorio no se ligan a un ejercicio** — `Sesion.protocolData` (JSON) guarda `exerciseName` como texto libre en `CasasProtocol.tsx:127` y `NacleiroTable.tsx`. Un RM medido en laboratorio **no puede asociarse a una fila de `Ejercicio`**, así que no puede usarse para prescribir ese ejercicio. Es una laguna de modelado, no un bug de UI.

**D-08 · Guardar la periodización destruye la prescripción** — `services/macrociclo.service.ts:410-412`
```ts
await tx.macrocicloPeriodo.deleteMany({ where: { macrocicloId: id } });
await tx.macrocicloMesociclo.deleteMany({ where: { macrocicloId: id } });
await tx.macrocicloSemana.deleteMany({ where: { macrocicloId: id } });
```
El borrado de `MacrocicloMesociclo` arrastra en cascada `MesocicloCarga` (`schema.prisma:197`) y el de `MacrocicloSemana` arrastra `MacrocicloSemanaEjercicio` (`schema.prisma:233`). Cualquier reedición del paso 7 borra horas de trabajo del entrenador sin aviso.

**D-09 · Mapeo mesociclo↔semana por `tipo`** — `services/macrociclo.service.ts:452-490`
```ts
const mesocicloIdPorTipo = new Map<string, number>();
...
for (const m of mesociclosCreados) mesocicloIdPorTipo.set(m.tipo, m.id);
```
Un `Map` con clave `tipo` colapsa dos mesociclos del mismo tipo (dos "desarrollador" es una estructura perfectamente normal). Además, si no encuentra mesociclo, `if (!mesocicloId) return []` **descarta la semana en silencio**.

**D-10 · Distribución de semanas inconsistente** — `lib/macrociclo-periodizacion.ts:108-131`
`Math.max(1, raw)` garantiza ≥1 semana por ítem; si hay 8 mesociclos y 6 semanas totales, `usadas = 8`, `diferencia = -2`, y toda la diferencia se resta al mesociclo mayor con otro `Math.max(1, ...)`. Resultado: la suma de semanas **deja de coincidir** con `totalSemanas` y `asignarFechasConsecutivas` genera fechas más allá de `fechaFin`. No hay ninguna validación posterior que lo detecte.

**D-11 · No existe motor de planificación** — `lib/macrociclo-periodizacion.ts:280-292`
```ts
tipoMicrociclo: "corriente", frecuencia: 0, series: 0, repeticiones: 0, volumen: 0, intensidad: 0
```
Todas las semanas nacen vacías. El entrenador teclea series, repeticiones e intensidad semana por semana en `app/macrociclo/[id]/wizard-steps.tsx` (1580 líneas). Para un macrociclo de 24 semanas son ~100 entradas numéricas manuales, más la fórmula de RM por ejercicio y por semana.

**D-12 · No existe registro de ejecución.** Ninguna entidad del `schema.prisma` guarda lo que el atleta realmente hizo. `MacrocicloSemanaEjercicio` es solo prescripción. Sin ejecución no hay progresión real, ni autorregulación, ni análisis, ni verificación de adherencia. **Es el módulo ausente más importante.**

**D-13 · Tres sistemas de carga desconectados.**
- `lib/training.ts` — %1RM y rangos de repeticiones por objetivo×nivel (científicamente defendible, alineado con ACSM 2009), usado **solo** en el dashboard.
- `MacrocicloSemana` — kilogramos vía `peso = rm × intensidad/100`, `volumen = series × reps × peso` (`wizard-steps.tsx:728-731`).
- `MesocicloCarga` — **minutos** repartidos entre "direcciones" (físico/táctico/técnico/psicológico), modelo de planificación de deportes de conjunto.

Ninguno alimenta al otro. Además `PLAN_MACROCICLO_ENTRENAMIENTO.md` declara explícitamente que "el objetivo es solo informativo y no altera cálculos": el objetivo del atleta no influye en el plan.

**D-14 · Cuarto sistema paralelo de progresión** — `Persona.faseEntrenamiento` + `faseInicioAt` con avance automático a los 60 días (`components/dashboard/PhaseProgressionBanner.tsx:19-23`), independiente del macrociclo.

**D-15 · Efectos colaterales de guardar una sesión** — `actions/sesion.ts:418-427`
```ts
await tx.persona.update({ data: { masaCorporal: input.peso, nivelOverride: null, ... } })
```
Un test sobrescribe la masa corporal del atleta y **borra silenciosamente el `nivelOverride` que el entrenador fijó a mano**.

**D-16 · Sin trazabilidad de la fuente del RM.** `MacrocicloSemanaEjercicio` guarda `rm` y `peso` (bien: es un snapshot), pero no guarda de qué `Sesion`/`ResultadoEjercicio` salió, ni cuándo se calculó, ni con qué método. No se puede auditar una carga hasta su evaluación de origen.

**D-17 · Sin `Ejercicio` con semántica.** El modelo solo tiene `nombre`, `porcentajeMasaHombre`, `porcentajeMasaMujer`. No hay patrón de movimiento, grupo muscular, equipamiento, incremento mínimo de carga, ni si admite prescripción por %1RM. Los ids están hardcodeados (`@id` sin `autoincrement`) y `lib/ejercicios-config.ts` codifica `EXERCISES_WITHOUT_LOAD = new Set([4])`, atando lógica de negocio a un id literal.

**D-18 · Índice de fuerza no normalizado** — `lib/rm.ts:147-166`
`calculateStrengthIndex` suma valores por bandas de repeticiones (5..17) y clasifica con umbrales fijos (`≤53 Bajo`, `≤65 Regular`, `≤77 Buena`, `≤89 Muy buena`, resto `Excelente`) que asumen implícitamente los 6 ejercicios del seed. Si se evalúan 4 ejercicios, el máximo alcanzable es 68 y nadie puede ser "Excelente". Además `calculateRepetitionValue` recibe `_ejercicioId` y `_sexo` y los descarta (`void`), prometiendo una especificidad que no existe.

**D-19 · Sin autorización en rutas de persona.** `middleware.ts` protege solo `/admin/**`. Todo el flujo de la persona viaja como `?cc=` en la URL: conocer una cédula da acceso completo de lectura y escritura a datos de salud de terceros. Fuera del alcance funcional de este plan, pero es un riesgo real y se documenta como tal.

**D-20 · Sin runner de pruebas.** `package.json` no tiene `test`. Cero cobertura sobre las fórmulas, que es exactamente donde más duele.

### 0.3 Comparación sistema actual vs. sistema ideal

| Dimensión | Hoy | Debería ser |
|---|---|---|
| Unidad de RM | Escalar global por sesión | Por (atleta, ejercicio, fecha, método) con incertidumbre |
| Estimador | `max()` de 8 fórmulas | Fórmula primaria + banda; rango de reps validado |
| Prescripción | Tecleada semana a semana | Generada por motor, editable con trazabilidad del override |
| Ejecución | No existe | Entidad de primera clase; base de progresión y análisis |
| Progresión | Manual / banner de 60 días | Reglas por bloque + autorregulación por RIR |
| Deload | No existe | Programado + reactivo |
| Historia | Snapshots parciales, borrados en cascada | Inmutable, versionada, con linaje |
| Objetivo del atleta | Informativo | Selecciona plantilla, zonas y volúmenes |
| Trazabilidad | `MacrocicloAuditLog` (bueno) | + linaje dato→prescripción |

### 0.4 Supuestos declarados (por si alguno no coincide con tu intención)

- **A1.** El producto es **operado por un entrenador** y consultado por el atleta. La sección 11 del encargo lo indica explícitamente; el código actual, en cambio, es self-service por cédula. El plan mueve el producto hacia el modelo entrenador→atletas.
- **A2.** El contexto es entrenamiento de fuerza en sala/gimnasio, con vocabulario de periodización de escuela cubano-soviética (Matveyev/Forteza), que se conserva por ser el marco académico del proyecto.
- **A3.** Se mantiene MariaDB + Prisma + Next.js App Router. No hay reescritura.
- **A4.** Las medidas antropométricas (`lib/pdf-antropometria.ts`) y VO2máx se conservan como contexto de evaluación; no entran en el motor de prescripción de fuerza en las primeras fases.
- **A5.** Un macrociclo abierto por atleta sigue siendo la regla (`services/macrociclo.service.ts:66-72`).

---

## 1. VISIÓN FINAL DEL PRODUCTO

### 1.1 Qué problema resuelve

Un entrenador que planifica con criterio científico hace hoy tres trabajos separados: evalúa (test de RM), calcula (Excel de porcentajes, tonelaje y distribución de carga) y transcribe (la planilla que le entrega al atleta). Los tres se desincronizan en cuanto el atleta progresa o falla una sesión, y el vínculo entre "esta carga" y "la evaluación que la justifica" se pierde.

La aplicación resuelve **la cadena completa evaluación → prescripción → ejecución → reevaluación**, manteniendo en todo momento la trazabilidad de por qué una carga concreta fue prescrita, y garantizando que el pasado no se reescribe cuando el presente cambia.

### 1.2 Quién la usa

- **Entrenador / preparador físico** (usuario principal): crea atletas, ejecuta evaluaciones, genera y ajusta planificaciones, revisa adherencia y decide progresiones.
- **Atleta**: consulta su plan de la semana, registra lo que hizo y su RIR, ve su progreso.
- **Administrador**: gestiona el catálogo de ejercicios, usuarios y auditoría (ya existe en `app/admin/**`).

### 1.3 Flujo principal

```
Alta del atleta
   → Evaluación inicial (RM por ejercicio + antropometría + VO2máx opcional)
   → Definición de objetivo, fecha y disponibilidad
   → Generación automática del macrociclo (estructura + prescripción)
   → Revisión y ajuste del entrenador
   → Activación del plan
   → Ejecución semanal registrada por el atleta
   → Autorregulación y ajustes
   → Semana de evaluación → nuevo RM → nuevo bloque
```

### 1.4 Flujo de evaluación

1. El entrenador abre una **evaluación** para un atleta y elige la batería de ejercicios.
2. El sistema propone el método por ejercicio según historial de entrenamiento y disponibilidad de RM previo:
   - sin experiencia o < 4 meses → **estimación submáxima** (protocolo de repeticiones);
   - ≥ 4 meses y técnica validada → **Casas** o **Nacleiro** (aproximación al RM real).
3. Para la estimación, el sistema propone una carga inicial derivada del RM previo (o del % de masa corporal si es la primera vez) y **exige que las repeticiones caigan en la ventana válida (3–10)**. Fuera de ventana, propone recalibrar la carga y repetir la serie.
4. Se registra por ejercicio: carga real usada, peso del equipo, repeticiones, RIR si se conoce, y observaciones.
5. El sistema calcula el 1RM estimado con la fórmula primaria, muestra la banda de incertidumbre y guarda todas las fórmulas como referencia.
6. Cada resultado queda como un **RM por ejercicio con fecha, método y confianza**, y se convierte en el RM vigente de ese ejercicio.

### 1.5 Flujo de planificación

1. Entradas: objetivo, fecha objetivo o de competencia, días disponibles por semana, minutos por sesión, equipamiento, RM vigentes, historial y limitaciones.
2. El motor propone estructura (periodos → etapas → mesociclos → microciclos) desde una **plantilla según objetivo y duración**, ya rellena.
3. El motor asigna a cada mesociclo un **objetivo de bloque**: zona de %1RM, rango de repeticiones, RIR objetivo y series semanales por patrón de movimiento.
4. El motor selecciona ejercicios por patrón, distribuye series entre sesiones, calcula cargas desde el RM vigente y redondea al incremento del equipo.
5. El motor inserta descargas y valida el plan completo contra un conjunto de invariantes.
6. El entrenador ve el plan generado con **la explicación de cada decisión** y puede sobrescribir cualquier valor; cada override queda marcado y ya no se recalcula.

### 1.6 Flujo de seguimiento

El atleta ve la sesión del día con ejercicios, series, repeticiones objetivo, carga y RIR objetivo. Registra series realizadas: repeticiones logradas, carga usada y RIR percibido. El sistema calcula al vuelo el e1RM de la mejor serie y marca desviaciones respecto a lo prescrito.

### 1.7 Flujo de actualización

- **Dentro del microciclo**: si el rendimiento registrado se desvía sistemáticamente del objetivo, el sistema *propone* un ajuste de carga para la próxima sesión. La propuesta es explícita y requiere aceptación (del entrenador, o del atleta si el entrenador habilitó la autorregulación).
- **Entre mesociclos**: semana de evaluación → nuevo RM medido, o bien e1RM derivado de las mejores series registradas. El bloque siguiente se genera con el RM nuevo. **Los bloques ya ejecutados no se recalculan jamás.**
- **Cambio de disponibilidad**: el entrenador cambia días/semana o minutos/sesión desde una fecha; el motor regenera solo las semanas **futuras**.

### 1.8 Qué decide el sistema y qué decide el entrenador

| Decide el sistema (automático, explicado, reversible) | Decide el entrenador (el sistema solo sugiere) |
|---|---|
| Reparto de semanas por periodo/etapa/mesociclo desde la plantilla | Estructura final y duración de cada bloque |
| Tipo de microciclo por semana y ubicación de descargas | Mover, añadir o quitar una descarga |
| Zona de %1RM, rango de reps y RIR por bloque | Sobrescribir la zona de cualquier bloque |
| Cálculo de la carga desde el RM vigente y redondeo | Fijar una carga concreta a mano |
| Volumen semanal por patrón dentro de rangos MEV–MAV | Volumen final |
| Selección inicial de ejercicios por patrón | Qué ejercicios entran realmente |
| Detección de desviación y **propuesta** de ajuste | Aplicar o rechazar el ajuste |
| Marcar un RM como caducado | Cuándo se reevalúa |
| Validación de invariantes y avisos | Ignorar un aviso dejando constancia |

**Regla rectora:** el sistema nunca cambia solo una prescripción ya publicada al atleta. Propone; el humano confirma; y todo queda versionado.

---

## 2. ARQUITECTURA FUNCIONAL FINAL

```
┌─────────────────────────────────────────────────────────────────┐
│  M1 · Atletas y contexto                                        │
│      Persona, antropometría, disponibilidad, historial          │
└───────────────┬─────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────┐   ┌───────────────────────────┐
│  M2 · Catálogo de ejercicios    │──▶│  M3 · Evaluación (RM)     │
│      patrón, músculo, equipo    │   │      test, protocolos     │
└───────────────┬─────────────────┘   └───────────┬───────────────┘
                │                                  │
                │                      ┌───────────▼───────────────┐
                │                      │  M4 · RM vigente          │
                │                      │      valor + linaje       │
                │                      └───────────┬───────────────┘
                │                                  │
┌───────────────▼──────────────────────────────────▼───────────────┐
│  M5 · Motor de planificación                                     │
│      plantillas · estructura · volumen · intensidad · deload     │
└───────────────┬──────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────┐
│  M6 · Plan (macro → meso → micro → sesión → prescripción)        │
└───────────────┬──────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────┐
│  M7 · Ejecución  (sesión realizada, series, RIR)                 │
└───────────────┬──────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────┐
│  M8 · Autorregulación y progresión (propone ajustes)             │
└───────────────┬──────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────────┐
│  M9 · Análisis e historial   ·   M10 · Auditoría y trazabilidad  │
└──────────────────────────────────────────────────────────────────┘
```

### M1 · Atletas y contexto

- **Objetivo:** representar a la persona entrenada y todo lo que condiciona su plan.
- **Funcionalidades:** alta/edición, antropometría (manual o PDF), disponibilidad semanal, historial de entrenamiento, limitaciones y lesiones, nivel.
- **Consume:** datos del entrenador, `lib/pdf-antropometria.ts`.
- **Produce:** perfil del atleta, restricciones para el motor.
- **Depende de:** nada.
- **Prioridad:** Alta (base).
- **Reutiliza:** `Persona`, `services/persona.service.ts`, `components/dashboard/**`.

### M2 · Catálogo de ejercicios

- **Objetivo:** dar semántica a los ejercicios para que el motor pueda razonar sobre ellos.
- **Funcionalidades:** patrón de movimiento, grupo muscular primario/secundario, equipamiento, incremento mínimo de carga, si admite %1RM, si es de tiempo, si es unilateral, si pertenece a la batería de evaluación.
- **Consume:** administración.
- **Produce:** universo de selección para el motor.
- **Depende de:** M1 (parcialmente, por equipamiento disponible).
- **Prioridad:** Alta — **sin esto el motor no puede seleccionar ejercicios ni redondear cargas**.
- **Reutiliza:** `Ejercicio`, `app/admin/ejercicios/page.tsx`, `lib/ejercicios-config.ts` (que desaparece absorbido aquí).

### M3 · Evaluación (motor de test de RM)

- **Objetivo:** producir estimaciones de 1RM defendibles y trazables por ejercicio.
- **Funcionalidades:** batería configurable, ramp-up de calibración, estimación submáxima, protocolo Casas, protocolo Nacleiro, validación de rango, banda de incertidumbre, comparación con evaluación anterior.
- **Consume:** M1, M2.
- **Produce:** `EvaluacionRm` + `ResultadoRm` por ejercicio.
- **Depende de:** M1, M2.
- **Prioridad:** Alta.
- **Reutiliza:** `lib/rm.ts`, `lib/nacleiro.ts`, `actions/sesion.ts`, `app/nueva-sesion/**`.

### M4 · RM vigente

- **Objetivo:** responder "¿cuál es el mejor 1RM conocido de este atleta en este ejercicio, hoy, y de dónde salió?".
- **Funcionalidades:** resolución del RM vigente por (atleta, ejercicio), caducidad configurable, linaje al resultado de origen, e1RM derivado de series registradas.
- **Consume:** M3, M7.
- **Produce:** el único input de carga que consume el motor.
- **Depende de:** M3.
- **Prioridad:** Alta — **es la pieza que resuelve el problema de retroactividad histórica**.
- **Reutiliza:** nada (nuevo).

### M5 · Motor de planificación

- **Objetivo:** convertir objetivo + disponibilidad + RM vigentes en un plan completo.
- **Funcionalidades:** plantillas de estructura, asignación de tipo de microciclo, objetivos de bloque, selección de ejercicios, distribución de volumen, cálculo de cargas, deload, validación.
- **Consume:** M1, M2, M4.
- **Produce:** propuesta de plan (objeto puro, sin persistir).
- **Depende de:** M1, M2, M4.
- **Prioridad:** Alta.
- **Reutiliza:** `lib/macrociclo-periodizacion.ts` (corregido), `lib/training.ts` (ampliado), `lib/mesociclo-carga.ts` (como capa de presupuesto de tiempo).

### M6 · Plan

- **Objetivo:** persistir la planificación con toda su trazabilidad.
- **Funcionalidades:** jerarquía macro→meso→micro→sesión→prescripción, estados, versionado, override marcado, regeneración parcial que respeta el pasado.
- **Consume:** M5.
- **Produce:** el plan que ve el atleta.
- **Depende de:** M5.
- **Prioridad:** Alta.
- **Reutiliza:** `Macrociclo`, `MacrocicloPeriodo`, `MacrocicloEtapa`, `MacrocicloMesociclo`, `MacrocicloSemana`, `MacrocicloSemanaEjercicio`, `services/macrociclo.service.ts`.

### M7 · Ejecución

- **Objetivo:** registrar lo que realmente ocurrió.
- **Funcionalidades:** sesión realizada, series con carga/reps/RIR, sesión saltada con motivo, notas, cálculo de e1RM por serie.
- **Consume:** M6.
- **Produce:** el insumo de M4, M8 y M9.
- **Depende de:** M6.
- **Prioridad:** Alta — **hoy no existe y bloquea todo lo demás**.
- **Reutiliza:** nada (nuevo).

### M8 · Autorregulación y progresión

- **Objetivo:** cerrar el ciclo entre lo planificado y lo ejecutado.
- **Funcionalidades:** detección de desviación, propuesta de ajuste de carga o volumen, deload reactivo, alerta de reevaluación, aplicación versionada del ajuste.
- **Consume:** M6, M7.
- **Produce:** propuestas de ajuste + nuevas versiones de prescripción.
- **Depende de:** M6, M7.
- **Prioridad:** Media (después de que exista ejecución).
- **Reutiliza:** absorbe `PhaseProgressionBanner` y `RetestReminderBanner`.

### M9 · Análisis e historial

- **Objetivo:** que el entrenador entienda la temporada.
- **Funcionalidades:** evolución del RM por ejercicio, tonelaje y series por patrón por semana, adherencia, comparación planificado vs realizado, distribución de intensidad.
- **Consume:** M4, M6, M7.
- **Produce:** vistas y export.
- **Depende de:** M7.
- **Prioridad:** Media.
- **Reutiliza:** `app/dashboard/page.tsx` (`getProgressSummary`).

### M10 · Auditoría y trazabilidad

- **Objetivo:** que toda carga sea rastreable hasta su evaluación de origen y todo cambio tenga autor.
- **Funcionalidades:** log de acciones (ya existe), linaje dato→prescripción, motivo de cada override.
- **Prioridad:** Alta (barata, se apoya en lo existente).
- **Reutiliza:** `MacrocicloAuditLog`, `auditarMacrociclo()`.

---

## 3. MODELO DE DOMINIO FINAL

Solo entidades con justificación. Se conservan los nombres existentes donde el modelo actual ya es correcto.

### 3.1 `Persona` (existente, ampliada)

- **Propósito:** el atleta.
- **Campos clave:** `cc`, `nombre`, `sexo`, `edad`, `talla`, `masaCorporal`, `nivelOverride`.
- **Nuevos:** `mesesEntrenamiento` (Int), `diasDisponibles` (Int), `minutosPorSesion` (Int), `equipamiento` (Json), `limitaciones` (String?).
- **Relaciones:** → `EvaluacionRm[]`, `Macrociclo[]`, `RmVigente[]`, `SesionRealizada[]`.
- **Históricos:** `masaCorporal` es el valor **actual**; el histórico vive en `EvaluacionRm.masaCorporal` y en `MedidaCorporal`.
- **Derivados:** IMC, ICC, nivel automático (calculado, nunca persistido salvo como override explícito).
- **Reglas:** `faseEntrenamiento` y `faseInicioAt` quedan **deprecados** — su función la absorbe el mesociclo activo (D-14).
- **Validaciones:** las de `helpers/validators.ts`, más `diasDisponibles ∈ [1,7]`, `minutosPorSesion ∈ [20,240]`.

### 3.2 `Ejercicio` (existente, ampliado — cambio estructural)

- **Propósito:** unidad de prescripción con semántica.
- **Nuevos campos:** `patron` (sentadilla | bisagra | empuje_horizontal | empuje_vertical | traccion_horizontal | traccion_vertical | core | accesorio | cardio), `musculoPrimario`, `musculosSecundarios` (Json), `equipamiento` (barra | mancuerna | maquina | polea | peso_corporal | otro), `incrementoMinimoKg` (Float, default 2.5), `admitePorcentajeRm` (Boolean), `esDeTiempo` (Boolean), `esUnilateral` (Boolean), `enBateriaEvaluacion` (Boolean), `activo` (Boolean).
- **Relaciones:** → `ResultadoRm[]`, `RmVigente[]`, `Prescripcion[]`.
- **Reglas:** `porcentajeMasaHombre/Mujer` se conservan **solo** para la carga inicial de calibración de la batería de evaluación; dejan de ser la carga definitiva del test.
- **Validaciones:** `incrementoMinimoKg > 0`; `esDeTiempo ⇒ admitePorcentajeRm = false` (esto sustituye a `EXERCISES_WITHOUT_LOAD`, D-17).

### 3.3 `EvaluacionRm` (renombre conceptual de `Sesion`)

- **Propósito:** un evento de evaluación de fuerza.
- **Campos:** `personaId`, `fecha`, `masaCorporal` (la del día), `mesesEntrenamiento`, `metodo` (estimacion | casas | nacleiro | directo), `observaciones`, `requestId` (idempotencia, ya existe), `protocolData` (Json).
- **Relaciones:** → `ResultadoRm[]`, ← `Persona`.
- **Históricos:** inmutable una vez cerrada. `masaCorporal` congelada aquí, nunca releída de `Persona`.
- **Reglas:** **se elimina el concepto de `finalRM`/`estimatedRM` a nivel de evaluación** (D-01). El RM vive en el resultado por ejercicio.
- **Validaciones:** `metodo ∈ métodos disponibles para mesesEntrenamiento`.

### 3.4 `ResultadoRm` (evolución de `ResultadoEjercicio`)

- **Propósito:** el 1RM de **un ejercicio** en **una evaluación**.
- **Campos:** `evaluacionId`, `ejercicioId`, `cargaKg`, `pesoEquipoKg`, `repeticiones`, `rirReportado` (Int?), `metodo`, `formulaPrimaria` (String), `rm1Estimado` (Float), `rmMin` (Float), `rmMax` (Float), `confianza` (alta | media | baja), `formulas` (Json con las 8), `fueraDeRango` (Boolean).
- **Relaciones:** ← `EvaluacionRm`, ← `Ejercicio`, → `RmVigente`.
- **Históricos:** inmutable.
- **Derivados:** `rm1Estimado`, `rmMin`, `rmMax`, `confianza`.
- **Reglas:** si `repeticiones > 10` ⇒ `fueraDeRango = true` y `confianza = "baja"`; si `> 15`, no se produce estimación utilizable para prescripción.
- **Validaciones:** `repeticiones ≥ 1`; `cargaKg ≥ 0`; ejercicio `esDeTiempo` no genera `rm1Estimado`.
- **Migración:** las 8 columnas `epley..baechle` se conservan durante la transición y luego se consolidan en `formulas` Json.

### 3.5 `RmVigente` (nueva — **pieza central**)

- **Propósito:** responder cuál es el 1RM de referencia hoy y de dónde vino.
- **Campos:** `personaId`, `ejercicioId`, `valorKg`, `origen` (test_directo | estimacion | e1rm_entrenamiento | manual), `resultadoRmId` (FK?), `serieRealizadaId` (FK?), `confianza`, `validoDesde` (DateTime), `validoHasta` (DateTime?), `calculadoEn`.
- **Relaciones:** ← `Persona`, ← `Ejercicio`, ← `ResultadoRm`/`SerieRealizada`.
- **Históricos:** **append-only**. Un RM nuevo no actualiza la fila: cierra la anterior (`validoHasta`) e inserta una nueva. Esto da una serie temporal completa y permite reconstruir qué RM regía en cualquier fecha pasada.
- **Reglas:** el motor solo consume el RM vigente **a la fecha de generación**; la prescripción copia el valor y el `rmVigenteId`.
- **Validaciones:** una sola fila abierta (`validoHasta = null`) por (persona, ejercicio); `@@unique` parcial garantizada por transacción.
- **Índices:** `@@index([personaId, ejercicioId, validoDesde])`.

### 3.6 `Macrociclo` (existente, ampliado)

- **Nuevos campos:** `plantillaId` (String?), `diasPorSemana` (Int), `minutosPorSesion` (Int), `version` (Int), `generadoEn` (DateTime?).
- **Regla nueva:** `objetivoTipo` **deja de ser informativo** y selecciona la plantilla y las zonas por defecto (corrige D-13).
- **Snapshots:** `rmSnapshot`, `medidasSnapshot`, `vo2maxSnapshot` se conservan como contexto, pero **dejan de ser la fuente de carga**: eso pasa a `RmVigente` + copia en la prescripción.

### 3.7 `MacrocicloMesociclo` (existente, ampliado)

- **Nuevos campos:** `objetivoBloque` (fuerza_maxima | hipertrofia | resistencia_fuerza | potencia | acumulacion | realizacion | recuperacion), `intensidadMinPct`, `intensidadMaxPct`, `repsMin`, `repsMax`, `rirObjetivo`, `seriesSemanalesPorPatron` (Json), `progresion` (lineal_intensidad | lineal_volumen | ondulante | mantenimiento).
- **Motivo:** hoy `tipo` es una etiqueta sin semántica computacional; estos campos son lo que el motor necesita para prescribir.

### 3.8 `MacrocicloSemana` (existente, ampliado)

- **Nuevos campos:** `esDeload` (Boolean), `factorVolumen` (Float, default 1), `factorIntensidad` (Float, default 1), `origen` (generado | ajustado).
- **Regla:** `volumen` e `intensidad` pasan a ser **derivados de las prescripciones**, no entradas manuales (corrige D-11).

### 3.9 `SesionPlanificada` (nueva)

- **Propósito:** la unidad que el atleta abre el día del entrenamiento. Hoy falta: se salta de semana a ejercicio.
- **Campos:** `semanaId`, `orden` (1..frecuencia), `fechaSugerida`, `duracionEstimadaMin`, `enfoque` (String?), `estado` (planificada | realizada | parcial | omitida).
- **Relaciones:** ← `MacrocicloSemana`, → `Prescripcion[]`, → `SesionRealizada?`.
- **Motivo:** sin esta entidad no se puede repartir series entre sesiones, ni cerrar el ciclo con la ejecución, ni respetar el presupuesto de minutos.

### 3.10 `Prescripcion` (evolución de `MacrocicloSemanaEjercicio`)

- **Propósito:** qué debe hacer el atleta en un ejercicio de una sesión.
- **Campos:** `sesionPlanificadaId`, `ejercicioId`, `orden`, `series`, `repeticionesObjetivo`, `repsMin`, `repsMax`, `porcentajeRm`, `rirObjetivo`, `cargaKg`, `descansoSeg`, `tempo` (String?), `notas`.
- **Trazabilidad:** `rmUsadoKg`, `rmVigenteId`, `formulaRm`, `calculadoEn`, `origen` (generado | ajustado_entrenador | autorregulado), `motivoAjuste` (String?), `version` (Int).
- **Históricos:** **inmutable tras publicarse**. Un ajuste crea una nueva versión y marca la anterior como `supersededBy`. Así, cambiar el RM de 100 a 110 kg **no reinterpreta** una prescripción de 70 kg hecha con RM 100.
- **Derivados:** `tonelaje = series × repeticionesObjetivo × cargaKg`.
- **Validaciones:** `cargaKg` múltiplo de `Ejercicio.incrementoMinimoKg`; `porcentajeRm ∈ (0,100]`; si `!admitePorcentajeRm`, `cargaKg` es nula y se prescribe por reps/tiempo.

### 3.11 `SesionRealizada` (nueva)

- **Propósito:** lo que ocurrió.
- **Campos:** `sesionPlanificadaId` (FK?, nullable para sesiones libres), `personaId`, `fecha`, `duracionMin`, `rpeSesion` (Int?), `estado` (completa | parcial | omitida), `motivoOmision`, `notas`.
- **Relaciones:** → `SerieRealizada[]`.
- **Históricos:** inmutable tras cerrarse.

### 3.12 `SerieRealizada` (nueva)

- **Propósito:** el dato atómico de ejecución.
- **Campos:** `sesionRealizadaId`, `prescripcionId` (FK?), `ejercicioId`, `numeroSerie`, `cargaKg`, `repeticiones`, `rir` (Int?), `fallo` (Boolean), `e1rmKg` (Float, derivado).
- **Derivados:** `e1rmKg` desde carga, reps y RIR.
- **Motivo:** alimenta `RmVigente` (origen `e1rm_entrenamiento`) y el motor de autorregulación.

### 3.13 `AjustePropuesto` (nueva)

- **Propósito:** materializar la propuesta del sistema para que el humano decida, sin que el sistema actúe solo.
- **Campos:** `personaId`, `macrocicloId`, `alcance` (prescripcion | sesion | semana | mesociclo), `objetivoId`, `tipo` (subir_carga | bajar_carga | subir_volumen | bajar_volumen | deload | reevaluar_rm), `magnitud`, `justificacion` (String), `evidencia` (Json), `estado` (pendiente | aceptado | rechazado), `resueltoPor`, `resueltoEn`.

### 3.14 `MedidaCorporal` (nueva, opcional — Fase 7)

- **Propósito:** serie temporal antropométrica, hoy solo congelada en `Macrociclo.medidasSnapshot`.
- **Campos:** `personaId`, `fecha`, `origen` (manual | pdf), `datos` (Json con la forma de `MedidasSnapshot`).

### 3.15 Entidades que se conservan sin cambios

`User`, `AdminOtp`, `MacrocicloPeriodo`, `MacrocicloEtapa`, `MacrocicloAuditLog`, `MesocicloCarga`.

### 3.16 Entidades que se descartan explícitamente (evitar sobreingeniería)

- `ExerciseVariant` — el catálogo con `patron` + `equipamiento` cubre el caso sin una jerarquía extra.
- `TrainingBlock` genérico — `MacrocicloMesociclo` con `objetivoBloque` ya es eso.
- Motor de nutrición, sueño, wellness — fuera de alcance.
- Modelo de fatiga tipo *fitness-fatigue* (Banister) — atractivo, pero requiere una densidad de datos que este producto no tendrá; se descarta conscientemente (ver §19).

---

## 4. MODELO DE DATOS / EVOLUCIÓN DE LA BASE

### 4.1 Principio rector sobre el historial

> **Un dato que ya fue usado para decidir algo no puede cambiar de valor retroactivamente.**

Tres mecanismos lo garantizan:

1. **Copia con linaje.** Toda prescripción guarda `rmUsadoKg` (el valor) **y** `rmVigenteId` (de dónde salió). Si el RM cambia después, la prescripción antigua sigue mostrando 100 kg y apuntando al registro de RM que valía 100 kg.
2. **Append-only con vigencia.** `RmVigente` nunca hace `UPDATE` del valor: cierra la fila (`validoHasta`) y abre otra. Se puede reconstruir el RM de cualquier fecha.
3. **Versionado con supersede.** `Prescripcion` publicada es inmutable; los ajustes crean versiones nuevas encadenadas.

**El caso del enunciado, resuelto:** atleta con RM 100 kg, semana 3 prescrita a 70 kg (`rmUsadoKg = 100`, `porcentajeRm = 70`). En la semana 8 se reevalúa a 110 kg → nueva fila en `RmVigente`. Las semanas 9+ **aún no ejecutadas** se regeneran a 77 kg; las semanas 1–8 conservan 70 kg y siguen apuntando al RM de 100. El análisis histórico muestra "70 kg = 70% del RM de entonces", no "70 kg = 63.6% del RM de ahora".

### 4.2 Tabla de cambios

| # | Modelo | Cambio | Motivo | Migración | Impacto en datos | Riesgo |
|---|---|---|---|---|---|---|
| C-01 | `Ejercicio` | + `patron`, `musculoPrimario`, `musculosSecundarios`, `equipamiento`, `incrementoMinimoKg`, `admitePorcentajeRm`, `esDeTiempo`, `esUnilateral`, `enBateriaEvaluacion`, `activo` | D-17: el motor no puede razonar sin semántica | Aditiva + backfill en `prisma/seed.ts` para los 6 ejercicios existentes | Ninguno destructivo | Bajo |
| C-02 | `Ejercicio` | `id` pasa a `@default(autoincrement())` | Ids hardcodeados impiden ampliar el catálogo | Aditiva (los ids existentes se preservan; ajustar el `AUTO_INCREMENT` inicial) | Ninguno | Bajo |
| C-03 | `ResultadoEjercicio` | + `rm1Estimado`, `rmMin`, `rmMax`, `confianza`, `formulaPrimaria`, `fueraDeRango`, `rirReportado` | D-02, D-04: estimador único con banda | Aditiva + backfill calculado desde `carga`/`repeticiones` | Backfill recalcula, no borra | Medio — el backfill debe marcar `fueraDeRango` en filas históricas con reps > 10 |
| C-04 | `Sesion` | `finalRM`/`estimatedRM` marcados **deprecados**; nadie los lee para prescribir | D-01: el RM global no tiene sentido físico | No borrar aún; retirar lectores primero | Se conservan para no romper vistas | Medio — hay que encontrar **todos** los lectores (`dashboard/page.tsx`, `sesion/[id]/page.tsx`, wizard paso 2) |
| C-05 | **`RmVigente`** | Tabla nueva | D-01, D-16: fuente única y trazable de carga | Nueva + backfill desde el último `ResultadoEjercicio` por (persona, ejercicio) | Solo inserciones | Bajo |
| C-06 | `MacrocicloMesociclo` | + `objetivoBloque`, `intensidadMin/MaxPct`, `repsMin/Max`, `rirObjetivo`, `seriesSemanalesPorPatron`, `progresion` | D-11, D-13: el motor necesita objetivos de bloque | Aditiva con defaults por `tipo` | Ninguno | Bajo |
| C-07 | `MacrocicloSemana` | + `esDeload`, `factorVolumen`, `factorIntensidad`, `origen` | Deload y trazabilidad de override | Aditiva | Ninguno | Bajo |
| C-08 | **`SesionPlanificada`** | Tabla nueva | Falta el nivel "sesión" entre semana y ejercicio | Nueva + backfill: por cada `MacrocicloSemana` crear `frecuencia` sesiones | Solo inserciones | Medio — el backfill debe repartir las `MacrocicloSemanaEjercicio` existentes |
| C-09 | `MacrocicloSemanaEjercicio` → **`Prescripcion`** | Se recuelga de `SesionPlanificada`; + `repsMin/Max`, `porcentajeRm`, `rirObjetivo`, `descansoSeg`, `rmUsadoKg`, `rmVigenteId`, `origen`, `motivoAjuste`, `version`, `supersededById` | D-16: trazabilidad y versionado | Tabla nueva + copia de datos; la vieja se conserva una release | Copia, no borra | **Alto** — es el cambio de forma más grande |
| C-10 | **`SesionRealizada`**, **`SerieRealizada`** | Tablas nuevas | D-12: no existe ejecución | Nuevas, sin backfill posible | Ninguno | Bajo |
| C-11 | **`AjustePropuesto`** | Tabla nueva | El sistema propone, no actúa | Nueva | Ninguno | Bajo |
| C-12 | `Persona` | + `mesesEntrenamiento`, `diasDisponibles`, `minutosPorSesion`, `equipamiento`, `limitaciones`; `entrenado` deprecado; `faseEntrenamiento`/`faseInicioAt` deprecados | D-14: sistema paralelo de fases | Aditiva; retirar lectores de `faseEntrenamiento` (`PhaseProgressionBanner`, `TrainingRecommendations`) antes de borrar | Ninguno inmediato | Medio |
| C-13 | **`MedidaCorporal`** | Tabla nueva (Fase 7) | Antropometría como serie temporal | Nueva + backfill desde `Macrociclo.medidasSnapshot` | Solo inserciones | Bajo |
| C-14 | Índices | `@@index([personaId, ejercicioId, validoDesde])` en `RmVigente`; `@@index([sesionPlanificadaId])` en `Prescripcion`; `@@index([personaId, fecha])` en `SesionRealizada` | Rendimiento de las consultas del dashboard y del análisis | Aditiva | Ninguno | Bajo |

### 4.3 Regla de no-destrucción para la periodización

`guardarPeriodizacion()` (`services/macrociclo.service.ts:372-573`) debe dejar de hacer `deleteMany` (D-08). Sustitución:

1. Calcular la nueva estructura.
2. **Diferenciar** contra la existente por `orden` + rango de fechas.
3. Actualizar lo que cambió, insertar lo nuevo, **borrar solo lo que ya no tiene lugar**.
4. Antes de borrar una semana con prescripciones ya ejecutadas, **rechazar la operación** y exigir confirmación explícita.
5. Nunca borrar semanas cuya `fechaFin < hoy`.

Y el mapa `mesocicloIdPorTipo` (D-09) se reemplaza por indexación **por `orden`**, que sí es único dentro del macrociclo.

---

## 5. MOTOR DE TEST DE RM

### 5.1 Principio

Un 1RM es una **estimación con incertidumbre sobre un ejercicio concreto**, no un número global del atleta.

### 5.2 Flujo

```
Seleccionar atleta y batería de ejercicios
   → Por ejercicio: determinar método disponible (mesesEntrenamiento, RM previo, técnica)
   → Calcular carga objetivo de calibración
   → Ejecutar serie
   → ¿Reps dentro de la ventana válida (3-10)?
        NO  → ajustar carga (regla de recalibración) y repetir
        SÍ  → estimar 1RM
   → Guardar ResultadoRm (valor, banda, confianza, linaje)
   → Cerrar evaluación → actualizar RmVigente por ejercicio
```

### 5.3 Inputs

| Input | Fuente | Obligatorio |
|---|---|---|
| Masa corporal del día | Formulario | Sí |
| Meses de entrenamiento | `Persona.mesesEntrenamiento`, editable | Sí |
| Ejercicio | Catálogo, `enBateriaEvaluacion` | Sí |
| Carga usada (kg) | Formulario | Sí, salvo `esDeTiempo` |
| Peso del equipo (kg) | Formulario (`pesoEquipo`, ya existe) | No (default 0) |
| Repeticiones | Formulario | Sí |
| RIR al terminar | Formulario | No, recomendado |
| RM de referencia (Casas/Nacleiro) | `RmVigente` del ejercicio, no texto libre | Sí para esos métodos |

### 5.4 Validaciones (todas nuevas)

| Regla | Comportamiento |
|---|---|
| `repeticiones ∈ [1,10]` | Fuera → estimación marcada `fueraDeRango`, `confianza = baja` |
| `repeticiones > 15` | No se produce RM utilizable para prescripción; solo referencia |
| `repeticiones ≥ 30` | **Bloqueo duro** — evita las singularidades de Brzycki/Lander (D-04) |
| `cargaKg + pesoEquipoKg > 0` para ejercicios con carga | Error de validación |
| `cargaKg ≤ 3 × masaCorporal` | Aviso de dato probablemente erróneo |
| Casas/Nacleiro con `mesesEntrenamiento < 4` | Método no disponible (regla existente en `lib/training-flow.ts`, se conserva) |
| Casas sin pesos reales registrados | **No se puede cerrar el protocolo** (corrige D-05) |
| Salto de carga entre escalones > 15% | Aviso de seguridad |
| `esDeTiempo` | No se calcula 1RM; se registra repeticiones/tiempo |

### 5.5 Cálculo

**Estimación primaria — Epley**, para `1 ≤ r ≤ 10`:

```
1RM = carga × (1 + 0.0333 × r)
```

**Banda de incertidumbre:** se calculan las 8 fórmulas existentes y se reportan `min` y `max` como intervalo. **Nunca se usa `max()` como estimador puntual** (corrige D-02).

**Confianza:**

| Condición | Confianza |
|---|---|
| Método directo (Casas/Nacleiro completado con pesos reales) | Alta |
| Estimación con `r ≤ 5` y RIR ≤ 1 | Alta |
| Estimación con `r ≤ 10` | Media |
| `r > 10` o RIR no reportado y `r > 8` | Baja |

**e1RM desde entrenamiento** (para `RmVigente` origen `e1rm_entrenamiento`), variante de Epley con RIR:

```
e1RM = carga × (1 + 0.0333 × (repeticiones + RIR))
```

Solo se acepta si `repeticiones + RIR ≤ 10` y `RIR ≤ 3`.

### 5.6 Elección del método

| Situación | Método | Por qué |
|---|---|---|
| Primera evaluación, < 4 meses de entrenamiento | Estimación submáxima | Riesgo de lesión y técnica insuficiente para un máximo real; es la regla que ya aplica `lib/training-flow.ts` y es correcta |
| ≥ 4 meses, sin RM previo del ejercicio | Estimación submáxima | Se necesita una referencia antes de aproximarse al máximo |
| ≥ 4 meses, con RM previo y técnica validada, ejercicio con barra | **Casas** | Aproximación progresiva por escalones desde una referencia conocida |
| ≥ 4 meses, se busca el perfil carga-repetición | **Nacleiro** | Serie ascendente con incremento constante (KIES) |
| Ejercicio de tiempo o sin carga externa | Sin RM | No aplica |
| Reevaluación de rutina entre bloques | e1RM desde series registradas | Evita un test máximo innecesario |

### 5.7 Almacenamiento e historial

- `EvaluacionRm` inmutable, con la masa corporal congelada del día.
- `ResultadoRm` inmutable por ejercicio.
- Al cerrar la evaluación, por cada ejercicio: cerrar la fila abierta de `RmVigente` y abrir una nueva con `origen`, `resultadoRmId`, `confianza` y `validoDesde = fecha de evaluación`.
- **Nunca** se actualizan resultados anteriores ni prescripciones ya emitidas.

### 5.8 Incertidumbre, limitaciones y seguridad

- Las fórmulas predictivas tienen error típico del orden del 5–10% y crecen con las repeticiones; por eso la ventana 3–10 y la banda visible.
- Un 1RM fluctúa día a día (sueño, fatiga, nutrición): el %1RM es una **guía**, no una verdad; por eso el RIR objetivo acompaña siempre a la carga.
- El protocolo actual con carga = % de masa corporal empuja a repeticiones altas y por tanto a estimaciones malas. **Recomendación explícita:** los coeficientes `porcentajeMasaHombre/Mujer` deben recalibrarse para que el atleta caiga en 3–10 repeticiones, o bien usarse solo como punto de partida de un ramp-up.
- Seguridad: bloqueo de métodos máximos con < 4 meses; incrementos por escalón limitados; descansos del protocolo Casas ya implementados con temporizador (`CasasProtocol.tsx`), se conservan.

---

## 6. MOTOR DE PLANIFICACIÓN

### 6.1 Proceso

```
 1. Perfil del atleta            (nivel, historial, limitaciones, equipamiento)
 2. Objetivo y horizonte          (salud | competencia, fecha)
 3. Disponibilidad                (días/semana, minutos/sesión)
 4. RM vigentes por ejercicio     (M4)
        ↓
 5. Selección de plantilla        (objetivo × duración × nivel)
 6. Estructura temporal           (periodos → etapas → mesociclos → semanas)
 7. Objetivo de cada bloque       (zona %1RM, reps, RIR, series/patrón)
 8. Asignación de microciclos     (corriente/choque/recuperación/evaluación) + deload
 9. Selección de ejercicios       (por patrón, filtrada por equipo y RM disponible)
10. Volumen semanal por patrón    (MEV → MAV a lo largo del bloque)
11. Reparto en sesiones           (respetando el presupuesto de minutos)
12. Cálculo de carga              (RM vigente × % → redondeo al incremento del equipo)
13. Progresión intra-bloque       (ola de intensidad o de volumen)
14. Validación de invariantes
15. Presentación con justificación → revisión del entrenador → publicación
```

Los pasos 5–8 son estructura; 9–13, prescripción. Se pueden regenerar por separado: cambiar un ejercicio no rehace la estructura, y cambiar la estructura futura no toca lo ejecutado.

### 6.2 Naturaleza del motor

Función **pura** (`lib/planificacion/`), sin acceso a base de datos: recibe un `ContextoPlanificacion` y devuelve una `PropuestaPlan`. Esto la hace testeable sin infraestructura — decisivo dado que hoy no hay pruebas (D-20).

```ts
type ContextoPlanificacion = {
  atleta: { nivel, sexo, edad, masaCorporal, mesesEntrenamiento, limitaciones };
  objetivo: { tipo, fechaInicio, fechaFin, fechaCompetencia? };
  disponibilidad: { diasPorSemana, minutosPorSesion, equipamiento };
  rmVigentes: Array<{ ejercicioId, valorKg, confianza, validoDesde }>;
  catalogo: Ejercicio[];
  plantilla: PlantillaPeriodizacion;
  overrides: OverrideEntrenador[];
};
```

### 6.3 Regeneración parcial

Toda regeneración recibe una `fechaCorte` (por defecto, hoy). Semanas anteriores: intactas. Semanas posteriores: regeneradas, salvo prescripciones con `origen = "ajustado_entrenador"`, que se conservan. Es lo que hace que el plan sea vivo sin ser volátil.

---

## 7. REGLAS DEL MOTOR

Cada regla lleva su justificación. Todas son **parametrizables** y viven en un único módulo de configuración, no dispersas por componentes.

### R-01 · Selección de ejercicios
Por **patrón de movimiento**, no por nombre. Cada sesión cubre patrones según el enfoque del día; se prioriza el ejercicio con RM vigente de mayor confianza y equipamiento disponible.
*Justificación:* prescribir por patrón permite sustituir ejercicios sin romper el plan y evita duplicar estímulo sobre el mismo grupo muscular.

### R-02 · Frecuencia
2 sesiones por grupo muscular y semana como objetivo; con `diasPorSemana ≤ 2`, cuerpo completo; 3–4, torso/pierna o cuerpo completo; ≥ 5, división por patrón.
*Justificación:* repartir un mismo volumen semanal en ≥ 2 sesiones iguala o supera a concentrarlo en una sola; por debajo de 2 no hay ventaja demostrada de fraccionar más.

### R-03 · Volumen
Series efectivas por grupo muscular y semana: **mantenimiento ≥ 4**, **hipertrofia 10–20**, **fuerza 6–12** con más intensidad. El bloque empieza cerca del extremo bajo y progresa hacia el alto.
*Justificación:* relación dosis-respuesta creciente hasta un techo con retornos decrecientes; empezar bajo deja margen de progresión dentro del bloque.

### R-04 · Intensidad
Zona de %1RM por objetivo de bloque:

| Objetivo de bloque | %1RM | Reps | RIR |
|---|---|---|---|
| Resistencia de fuerza | 50–65 | 12–20 | 2–3 |
| Hipertrofia | 65–80 | 6–12 | 1–3 |
| Fuerza máxima | 80–92 | 3–6 | 1–2 |
| Potencia / realización | 85–95 | 1–3 | 1–2 |
| Recuperación / deload | 50–65 | 5–8 | 4–5 |

*Justificación:* alineado con la tabla ya presente en `lib/training.ts` (que refleja los modelos de progresión del ACSM) pero ampliada con RIR, que es lo que permite que la carga siga siendo correcta cuando el 1RM ha cambiado desde el último test.

### R-05 · Uso del RM
`carga = RM_vigente(ejercicio, fecha_generación) × %objetivo`, redondeada **hacia abajo** al `incrementoMinimoKg` del ejercicio. Se copian `rmUsadoKg` y `rmVigenteId` a la prescripción.
*Justificación:* redondear hacia abajo evita superar involuntariamente la zona objetivo; copiar el valor es lo que garantiza la inmutabilidad histórica.

### R-06 · Ejercicios sin RM
Si no hay RM vigente: se prescribe por rango de repeticiones y RIR objetivo, sin carga, y la primera sesión sirve de calibración. Nunca se extrapola el RM de un ejercicio a otro.
*Justificación:* la correlación de 1RM entre ejercicios distintos es demasiado débil para prescribir. Es exactamente el error que comete hoy `finalRM` (D-01).

### R-07 · Uso del RIR
Toda prescripción lleva RIR objetivo junto al %1RM. Si ambos entran en conflicto durante la ejecución, **manda el RIR**: el atleta ajusta la carga y el sistema lo registra como evidencia.
*Justificación:* el %1RM se calcula sobre un test pasado; el RIR se mide hoy. La autorregulación por RIR es lo que absorbe la deriva entre tests.

### R-08 · Progresión intra-mesociclo
- Bloques de fuerza: **ola de intensidad**, +2.5 a +5% de %1RM por semana durante 3 semanas.
- Bloques de hipertrofia: **ola de volumen**, +1 a +2 series por patrón por semana.
- Nunca subir volumen e intensidad la misma semana.

*Justificación:* progresar en un solo vector por vez mantiene el estímulo identificable y la fatiga acotada.

### R-09 · Progresión inter-mesociclo
Cada bloque reancla su carga al RM vigente al inicio del bloque. La semana de evaluación se ubica al final de cada bloque de acumulación o cada 8–12 semanas.
*Justificación:* usar todo un macrociclo con el RM inicial subestima progresivamente la carga; reevaluar cada semana es innecesario y fatigante.

### R-10 · Deload
- **Programado:** cada 4ª semana en bloques de acumulación (semanas 1-2-3 progresivas, 4 de descarga), o cada 3ª para atletas avanzados con alta intensidad.
- **Ejecución del deload:** volumen −40 a −50%, intensidad mantenida o −10%.
- **Reactivo:** se propone si se cumplen ≥ 2 de: caída del e1RM > 5% en dos sesiones consecutivas; RIR reportado sistemáticamente 2 puntos por debajo del objetivo; ≥ 2 sesiones omitidas por fatiga; RPE de sesión ≥ 9 en tres sesiones seguidas.

*Justificación:* reducir volumen conservando intensidad preserva la adaptación neural mientras disipa fatiga; el criterio reactivo evita descargas ciegas cuando el atleta está bien y descargas tardías cuando no.

### R-11 · Modificar una semana
Cambiar frecuencia, ejercicios o volumen de una semana **futura** regenera solo esa semana y respeta los overrides. Una semana pasada o en curso con ejecución registrada **no se regenera**: se crea una versión nueva y la anterior queda como histórico.

### R-12 · Modificar una sesión
Cambiar una prescripción crea `version + 1` con `origen = "ajustado_entrenador"` y `motivoAjuste`. Esa prescripción queda **anclada**: futuras regeneraciones no la sobrescriben salvo desanclaje explícito.

### R-13 · Rendimiento inferior al esperado
| Evidencia | Propuesta |
|---|---|
| No alcanza `repsMin` a la carga prescrita, 1 sesión | Ninguna (variabilidad normal) |
| No alcanza `repsMin`, 2 sesiones consecutivas | Bajar carga 5% |
| RIR reportado ≥ 2 por encima del objetivo, 2 sesiones | Subir carga 2.5–5% |
| Caída de e1RM > 10% respecto a la mejor marca del bloque | Proponer deload |
| ≥ 30% de sesiones omitidas en el microciclo | Revisar disponibilidad, no la carga |

Todas se materializan como `AjustePropuesto`; ninguna se aplica sola.
*Justificación:* una sola sesión mala es ruido; dos consecutivas son señal. Separar "no puede" de "no vino" evita bajar cargas por un problema de adherencia.

### R-14 · Cambio de disponibilidad
Se registra con fecha de efecto. El motor regenera solo desde esa fecha, redistribuyendo el volumen semanal entre el nuevo número de sesiones y manteniendo el volumen total por patrón. Si el volumen no cabe en el presupuesto de minutos, se reduce el trabajo accesorio antes que el principal.
*Justificación:* proteger el estímulo principal es la decisión correcta cuando el tiempo se reduce.

### R-15 · Caducidad del RM
Un RM con más de 12 semanas se marca `caducado` y genera un aviso de reevaluación; con más de 24 semanas, el motor lo usa pero rebaja la confianza a `baja` y lo señala en el plan.
*Justificación:* prescribir sobre un RM de hace medio año es prescribir a ciegas; bloquear la generación sería peor que avisar.

### R-16 · Invariantes de validación (bloquean la publicación)
1. Suma de semanas de periodos = suma de etapas = suma de mesociclos = total de semanas del macrociclo. **(corrige D-10)**
2. Ninguna fecha de bloque excede `fechaFin`.
3. Cada semana pertenece exactamente a un mesociclo. **(corrige D-09)**
4. Ninguna semana queda huérfana.
5. Al menos una descarga cada 6 semanas consecutivas de carga.
6. Ninguna prescripción con `porcentajeRm > 100`.
7. Ninguna carga que no sea múltiplo del incremento del ejercicio.
8. Ninguna sesión excede su presupuesto de minutos en más de un 20%.
9. Toda prescripción con carga tiene `rmVigenteId` y `rmUsadoKg`.
10. No hay dos semanas de choque consecutivas.

---

## 8. ALGORITMOS Y FÓRMULAS

### F-01 · Epley (estimador primario de 1RM)
- **Objetivo:** estimar 1RM desde una serie submáxima.
- **Inputs:** `carga` (kg), `repeticiones` (1–10).
- **Output:** 1RM (kg).
- **Fórmula:** `1RM = carga × (1 + 0.0333 × r)`
- **Rango válido:** `r ∈ [1,10]`; ideal `r ≤ 6`.
- **Limitaciones:** sobreestima con repeticiones altas; sensible al esfuerzo real de la serie (una serie no llevada cerca del fallo subestima).
- **Por qué esta:** es lineal, sin singularidades (a diferencia de Brzycki y Lander, que se anulan cerca de 37 reps — D-04), coincide con Brzycki alrededor de las 10 repeticiones y se extiende con naturalidad a la variante con RIR (F-03), que es la que cierra el ciclo con el registro de entrenamiento. Ya está implementada y probada en producción (`lib/rm.ts:203-211`).
- **Fuente:** Epley (1985); revisiones comparativas de ecuaciones predictivas de 1RM.

### F-02 · Banda de incertidumbre multi-fórmula
- **Objetivo:** comunicar el error de la estimación en vez de fingir precisión.
- **Inputs:** `carga`, `r`.
- **Output:** `{ min, max }` sobre las 8 fórmulas ya implementadas.
- **Rango válido:** el de F-01; fuera de él la banda se ensancha y se marca `fueraDeRango`.
- **Limitaciones:** es la dispersión entre modelos, no un intervalo de confianza estadístico. Debe etiquetarse así en la interfaz.
- **Por qué:** el código ya calcula las 8; usarlas como banda aprovecha ese trabajo y **elimina el sesgo de `max()`** (D-02).

### F-03 · e1RM con RIR
- **Objetivo:** estimar 1RM desde una serie de entrenamiento sin test dedicado.
- **Inputs:** `carga`, `repeticiones`, `RIR`.
- **Output:** 1RM (kg).
- **Fórmula:** `e1RM = carga × (1 + 0.0333 × (r + RIR))`
- **Rango válido:** `r + RIR ≤ 10`, `RIR ≤ 3`.
- **Limitaciones:** depende de la calibración del atleta al estimar su RIR; los principiantes lo sobrestiman.
- **Por qué:** convierte cada sesión en una micro-evaluación y reduce la necesidad de tests máximos.

### F-04 · Redondeo al incremento cargable
- **Inputs:** `pesoTeorico`, `incrementoMinimoKg`.
- **Output:** peso cargable (kg).
- **Fórmula:** `Math.floor(peso / incremento) × incremento`
- **Por qué hacia abajo:** truncar mantiene la carga dentro de la zona objetivo; `roundWeight` actual (`lib/training.ts:77-83`) redondea al más cercano y con incremento fijo de 2.5, lo que no sirve para mancuernas ni máquinas de placas.

### F-05 · Tonelaje
- **Fórmula:** `Σ (series × repeticiones × carga)`
- **Unidad:** kg.
- **Limitaciones importantes:** confunde 3×10×50 con 10×3×50 y penaliza el trabajo de alta intensidad. **No debe usarse como métrica principal de carga**; sirve para comparar semanas del mismo tipo dentro de un bloque.
- **Por qué se conserva:** ya existe (`MacrocicloSemana.volumen`, `wizard-steps.tsx:730`) y es el lenguaje del marco académico del proyecto.

### F-06 · Series efectivas por grupo muscular y semana
- **Fórmula:** `Σ series de ejercicios cuyo músculo primario = M` (+ 0.5 por músculo secundario).
- **Unidad:** series.
- **Por qué:** es la métrica de volumen con mejor respaldo dosis-respuesta y la que hace operativa la regla R-03. Complementa al tonelaje, no lo sustituye.

### F-07 · Intensidad relativa media de la semana
- **Fórmula:** `Σ(series × reps × %1RM) / Σ(series × reps)`
- **Unidad:** % de 1RM.
- **Por qué:** permite verificar que la ola de intensidad del bloque es la planificada, cosa que hoy no se puede comprobar.

### F-08 · Distribución de semanas por porcentaje (corregida)
- **Objetivo:** repartir N semanas entre bloques por porcentaje sin perder ni inventar semanas.
- **Algoritmo:** método del **mayor resto** (Hare) — asignar `floor(N × p / 100)` a cada bloque, repartir las semanas sobrantes a los mayores restos, respetando `min = 1` solo si `N ≥ número de bloques`; si `N < número de bloques`, **rechazar la configuración con un error explícito**.
- **Por qué:** el algoritmo actual (`lib/macrociclo-periodizacion.ts:108-131`) fuerza mínimo 1 y vuelca el resto sobre el mayor, rompiendo la suma y desbordando las fechas (D-10). El mayor resto garantiza `Σ = N` por construcción.

### F-09 · Léger (VO2máx)
- **Fórmulas:** `v = 8.5 + 0.5 × (etapa − 1)`; `VO2máx = 5.857 × v − 19.458`
- **Unidad:** ml/kg/min. **Rango:** etapas 1–21.
- **Estado:** ya implementada y correcta (`lib/macrociclo.ts:275-283`). Se conserva.

### F-10 · Cooper (VO2máx)
- **Fórmula:** `VO2máx = (distancia_m − 504.9) / 44.73`
- **Estado:** documentada en `PLAN_MACROCICLO_ENTRENAMIENTO.md`. Verificar que esté implementada donde se usa.

### F-11 · IMC e ICC
- **Estado:** implementadas en `helpers/calculations.ts`, con clasificación OMS. Correctas. Se conservan.
- **Limitación a documentar en UI:** el IMC no distingue masa magra de grasa y **no debe usarse como indicador en atletas**.

### F-12 · Índice de fuerza (revisado)
- **Problema actual:** suma no normalizada con umbrales que asumen 6 ejercicios (D-18).
- **Corrección:** `índice = (Σ valores / (n_ejercicios × valor_máximo)) × 100`, con umbrales sobre esa escala 0–100.
- **Limitación:** sigue siendo un indicador propio del proyecto, sin validación externa. Debe presentarse como referencia interna, no como estándar.

### F-13 · Métricas descartadas conscientemente
- **ACWR (razón carga aguda/crónica):** atractiva pero metodológicamente cuestionada (problemas de correlación espuria y de definición de ventanas). No se implementa.
- **Modelo fitness-fatiga (Banister/TRIMP):** requiere una densidad y regularidad de datos que este producto no tendrá. Descartado.
- **1RM predicho por antropometría:** sin base suficiente. Descartado.

---

## 9. API / BACKEND

### 9.1 Diagnóstico de la arquitectura actual

- Server Actions en `actions/*.ts` como mecanismo principal de mutación. **Correcto**, se conserva.
- Lógica de negocio en `services/*.ts`. **Correcto**, se refuerza.
- **Problema:** cada archivo de acciones instancia su propio `PrismaClient` (`actions/sesion.ts:41-57`, `services/persona.service.ts:44-61`, `app/dashboard/page.tsx:29-45`) en vez de usar `lib/prisma.ts`. `services/macrociclo.service.ts` sí lo usa bien.
- **Problema:** los cálculos viven en componentes cliente (`wizard-steps.tsx:713-731` calcula `peso` y `volumen` en el navegador y los envía por `FormData`), de modo que el servidor confía en números calculados por el cliente. Debe invertirse: el cliente envía intenciones, el servidor calcula.
- **Problema:** validación por parseo manual y disperso (`parseNonNegativeInt`, `parseNonNegativeNumber`, `parseProtocolData`). Funciona, pero es frágil y no compartida.

### 9.2 Capas objetivo

```
app/**            (páginas y componentes; sin cálculo de dominio)
   ↓
actions/**        (server actions: parseo, autorización, orquestación)
   ↓
services/**       (transacciones, persistencia, auditoría)
   ↓
lib/**            (dominio puro y testeable: rm, planificación, progresión)
```

**Regla nueva y no negociable:** ningún cálculo de prescripción o de RM ocurre en un componente cliente. El cliente puede previsualizar; el valor persistido siempre lo produce el servidor.

### 9.3 Módulos de dominio nuevos (`lib/`)

| Módulo | Responsabilidad |
|---|---|
| `lib/rm/formulas.ts` | Las 8 fórmulas + validación de rango (extraído de `lib/rm.ts`) |
| `lib/rm/estimacion.ts` | Estimador primario, banda, confianza, e1RM con RIR |
| `lib/rm/protocolos.ts` | Casas y Nacleiro con validación (hoy en componentes cliente) |
| `lib/rm/vigente.ts` | Resolución del RM vigente, caducidad |
| `lib/planificacion/plantillas.ts` | Plantillas de periodización por objetivo |
| `lib/planificacion/estructura.ts` | Reparto de semanas (F-08), asignación de microciclos, deload |
| `lib/planificacion/prescripcion.ts` | Selección de ejercicios, volumen, intensidad, carga |
| `lib/planificacion/validacion.ts` | Los 10 invariantes de R-16 |
| `lib/planificacion/motor.ts` | Orquestador puro: contexto → propuesta |
| `lib/progresion/reglas.ts` | R-08, R-09, R-13: detección y propuestas |
| `lib/progresion/deload.ts` | R-10 programado y reactivo |
| `lib/config/parametros.ts` | Todas las constantes (zonas, rangos, umbrales) en un solo sitio |

### 9.4 Servicios nuevos y modificados

| Servicio | Cambio |
|---|---|
| `services/rm.service.ts` | **Nuevo.** Crear evaluación, cerrar evaluación, actualizar `RmVigente` transaccionalmente |
| `services/planificacion.service.ts` | **Nuevo.** Generar plan, publicar, regenerar desde fecha respetando overrides |
| `services/ejecucion.service.ts` | **Nuevo.** Registrar sesión y series, calcular e1RM, disparar evaluación de progresión |
| `services/progresion.service.ts` | **Nuevo.** Crear, aceptar y rechazar `AjustePropuesto` |
| `services/macrociclo.service.ts` | Reescribir `guardarPeriodizacion` (diff en vez de `deleteMany`, D-08); indexar por `orden` (D-09) |
| `services/persona.service.ts` | Añadir disponibilidad; migrar a `lib/prisma.ts` |
| `services/ejercicio.service.ts` | **Nuevo.** CRUD del catálogo ampliado |

### 9.5 Server Actions

| Acción | Estado |
|---|---|
| `crearEvaluacionRmAction` | Nueva — sustituye a `createSesionAction` |
| `registrarResultadoRmAction` | Nueva — un ejercicio por vez, con validación de rango |
| `cerrarEvaluacionRmAction` | Nueva — dispara la actualización de `RmVigente` |
| `generarPlanAction` | Nueva — invoca el motor y devuelve propuesta **sin persistir** |
| `publicarPlanAction` | Nueva — persiste la propuesta y crea las prescripciones |
| `regenerarDesdeAction` | Nueva — regeneración parcial con `fechaCorte` |
| `ajustarPrescripcionAction` | Nueva — crea versión con `origen = ajustado_entrenador` |
| `registrarSesionRealizadaAction` | Nueva |
| `resolverAjustePropuestoAction` | Nueva |
| `createSesionAction` (`actions/sesion.ts:518`) | Se mantiene durante la transición, delegando al servicio nuevo |
| `guardarPeriodizacionAction` (`actions/macrociclo.ts:415`) | Se modifica para usar el diff no destructivo |
| `guardarCargaMesocicloAction` (`actions/macrociclo.ts:502`) | Se mantiene; pasa a ser el presupuesto de tiempo que restringe al motor |
| `avanzarAFuerzaAction`, `updateFaseEntrenamientoAction` (`actions/persona.ts:292,304`) | **Se retiran** al integrarse las fases en el mesociclo (D-14) |

### 9.6 API REST

Se mantiene mínima. Se añade solo lo que necesita un cliente que no sea una página del servidor:

- `POST /api/ejecucion/serie` — registro rápido de una serie desde el móvil, con idempotencia por `requestId` (mismo patrón que `Sesion.requestId`).
- Los endpoints existentes (`app/api/persona/medidas`, `app/api/users/**`, `auth`) se conservan.

### 9.7 Validación

Introducir un validador de esquemas compartido (Zod o equivalente) para las entradas de acciones. Motivo: hoy la validación está duplicada entre cliente y servidor, y los helpers manuales de `actions/sesion.ts:67-128` no expresan el esquema completo. Un esquema por acción, reutilizado por el formulario.

---

## 10. FRONTEND / UX

### 10.1 Pantallas objetivo

#### P-01 · Lista de atletas (nueva)
- **Objetivo:** punto de entrada del entrenador.
- **Muestra:** atleta, estado del plan, días desde la última evaluación, alertas (RM caducado, ajuste pendiente, adherencia baja).
- **Acciones:** abrir atleta, nuevo atleta, nueva evaluación.
- **Estados:** vacío ("aún no tienes atletas"), carga, error.

#### P-02 · Ficha del atleta (evolución de `app/dashboard/page.tsx`)
- **Muestra:** perfil, disponibilidad, **RM vigentes por ejercicio con fecha y confianza** (hoy se muestra un RM global sin sentido físico), plan activo, próxima sesión, adherencia, IMC/ICC.
- **Cambio principal:** desaparece el "nivel" derivado del máximo entre ejercicios (D-01) y aparece una tabla de RM por ejercicio.

#### P-03 · Evaluación de RM (evolución de `app/nueva-sesion/**`)
- **Objetivo:** ejecutar el test con seguridad y calidad de dato.
- **Muestra:** ejercicio actual, carga propuesta, ventana de repeticiones válida, temporizador de descanso (ya existe), resultado con banda de incertidumbre y comparación con la evaluación anterior.
- **Validaciones visibles:** aviso inmediato si las repeticiones caen fuera de 3–10, con propuesta de recalibrar la carga.
- **Errores:** protocolo Casas incompleto → no se puede cerrar (corrige D-05).

#### P-04 · Generador de plan (sustituye los pasos 4–8 del wizard)
- **Objetivo:** que el entrenador obtenga un plan completo respondiendo a 5 preguntas, no tecleando 100 números.
- **Inputs:** objetivo, fecha, días/semana, minutos/sesión, ejercicios disponibles.
- **Acciones:** generar, ver la justificación de cada decisión, ajustar, regenerar, publicar.
- **Estados:** generando, propuesta lista, con avisos de validación, publicado.

#### P-05 · Vista del plan (evolución de `app/macrociclo/[id]/page.tsx`)
- **Muestra:** línea temporal de bloques, ola de volumen e intensidad, semanas con su tipo de microciclo y descargas marcadas.
- **Acciones:** abrir semana, abrir sesión, regenerar desde una fecha.

#### P-06 · Editor de semana / sesión (evolución de `wizard-steps.tsx`)
- **Cambio principal:** deja de ser un formulario de captura para convertirse en un editor de **excepciones**: todo viene relleno y el entrenador solo toca lo que quiere cambiar. Cada valor tocado se marca como override.

#### P-07 · Sesión de entrenamiento del atleta (nueva)
- **Objetivo:** usarse con el teléfono en la mano, entre series.
- **Muestra:** ejercicio, series, reps objetivo, carga, RIR objetivo, temporizador.
- **Inputs:** reps logradas, carga usada, RIR percibido. Un toque por serie.
- **Estados:** en curso, completada, parcial, omitida con motivo.

#### P-08 · Ajustes propuestos (nueva)
- **Muestra:** propuesta, justificación en lenguaje llano y la evidencia que la sustenta.
- **Acciones:** aceptar, rechazar, modificar magnitud.

#### P-09 · Análisis (evolución de "Progreso inteligente")
- **Muestra:** evolución del RM por ejercicio, series semanales por grupo muscular, planificado vs realizado, distribución de intensidad, adherencia.

#### P-10 · Catálogo de ejercicios (evolución de `app/admin/ejercicios/page.tsx`)
- **Muestra y edita** los nuevos atributos semánticos de `Ejercicio`.

### 10.2 Destino de las pantallas actuales

| Pantalla actual | Destino |
|---|---|
| `app/page.tsx` (entrada por cédula) | **Se mantiene** temporalmente; se sustituye por login real de entrenador en la fase de autorización |
| `app/dashboard/page.tsx` | **Se divide:** ficha del atleta (P-02) + lista de atletas (P-01) |
| `app/nueva-sesion/NuevaSesionForm.tsx` | **Se modifica:** validación de rango y carga propuesta por ejercicio |
| `app/nueva-sesion/CasasProtocol.tsx` | **Se modifica:** exigir pesos reales; RM de referencia desde `RmVigente` |
| `app/nueva-sesion/NacleiroTable.tsx` | **Se modifica:** validar `series > 1`, redondear al incremento del ejercicio |
| `app/sesion/[id]/page.tsx` | **Se modifica:** resultados por ejercicio con banda; se elimina el RM global |
| `app/macrociclo/[id]/MacrocicloWizard.tsx` (9 pasos) | **Se combina:** pasos 4–8 → generador (P-04). Quedan 4 pasos: objetivo, evaluación, disponibilidad, revisión |
| `app/macrociclo/[id]/wizard-steps.tsx` (1580 líneas) | **Se divide** en componentes por paso y se reduce a editor de excepciones |
| `components/macrociclo/MesocicloCargaEditor.tsx` | **Se mantiene** como vista avanzada opcional (presupuesto de tiempo por direcciones) |
| `components/results/TrainingRecommendations.tsx` | **Se modifica:** por ejercicio, no sobre el RM global |
| `components/dashboard/PhaseProgressionBanner.tsx` | **Se elimina** al integrarse las fases en el mesociclo (D-14) |
| `components/dashboard/RetestReminderBanner.tsx` | **Se modifica:** avisa por ejercicio con RM caducado (R-15), no por días desde la última sesión |
| `components/ui/UserLevelSelector.tsx`, `UserLevelBadge.tsx` | **Se mantienen**, alimentados por un nivel bien calculado |
| `app/admin/**` | **Se mantiene**, ampliando el catálogo de ejercicios |

### 10.3 Estados obligatorios en cada pantalla

Toda pantalla nueva define explícitamente: **carga** (esqueleto, no spinner en blanco), **vacío** (con la acción que lo resuelve), **error** (mensaje accionable, no "algo salió mal"), **sin permiso**, y **datos parciales** (por ejemplo, plan generado con ejercicios sin RM: se muestra el plan y se marcan esos ejercicios).

---

## 11. EXPERIENCIA DEL ENTRENADOR

### 11.1 Lo que hoy cuesta y no debería

| Fricción actual | Dónde | Solución |
|---|---|---|
| Teclear series, reps e intensidad para cada semana | `wizard-steps.tsx`, paso 7 | El motor lo genera; el entrenador ajusta excepciones |
| Elegir la fórmula de RM por ejercicio y por semana | `wizard-steps.tsx:1116` | Fórmula primaria definida y documentada en el sistema, no una decisión por fila |
| Rellenar tres matrices de porcentajes que deben sumar 100 | `MesocicloCargaEditor` | Valores por defecto que ya suman 100; el entrenador solo desvía |
| Repetir la disponibilidad en cada mesociclo | Paso 8 | Se declara una vez en el atleta |
| Calcular pesos a mano desde el % | Fuera de la app | El motor calcula y redondea al incremento real |
| Recordar cuándo toca reevaluar | Fuera de la app | Alerta por ejercicio con RM caducado |
| Rehacer el plan tras un cambio | Se pierde el trabajo (D-08) | Regeneración parcial que respeta lo ejecutado y los overrides |

### 11.2 Lo que hay que maximizar

**Claridad.** Cada número prescrito muestra su procedencia: de qué RM salió, de qué evaluación, de qué fecha y con qué fórmula. Nada aparece sin origen.

**Control.** Cualquier valor generado es editable. Editar no es "romper el sistema": es declarar un override, que queda marcado y protegido de futuras regeneraciones.

**Trazabilidad.** Desde una carga de la semana 14 se puede navegar hasta la serie del test que la originó. `MacrocicloAuditLog` ya registra el "quién y cuándo"; falta el "de dónde salió el número", que aportan `rmVigenteId` y `rmUsadoKg`.

**Comprensión.** Cada bloque del plan lleva una frase que explica su lógica: *"Mesociclo desarrollador, 4 semanas: hipertrofia 65–80% con RIR 2, volumen creciente de 12 a 18 series semanales por patrón, descarga en la semana 4."* Y cada propuesta de ajuste muestra su evidencia.

### 11.3 Prueba de aceptación de la experiencia

> Un entrenador con un atleta nuevo debe poder pasar de "cero" a "plan de 16 semanas publicado" en **menos de 15 minutos**, de los cuales el test de RM ocupa la mayor parte, y sin hacer ni un solo cálculo a mano.

---

## 12. PLAN DE MIGRACIÓN

### ESTADO ACTUAL
Sesiones con RM global, macrociclos con prescripción manual, sin ejecución, con borrados destructivos.

### ESTADO INTERMEDIO A — "Datos correctos" (Fases 0–2)
- **Permanece:** todas las pantallas, todos los flujos, todos los datos.
- **Cambia:** se corrigen los cálculos y se deja de borrar datos; se añaden tablas y columnas nuevas **sin retirar las viejas**; se pueblan `RmVigente` y el catálogo ampliado por backfill.
- **Se elimina:** nada.
- **Puede romperse:** el backfill de `ResultadoEjercicio` si hay filas con repeticiones absurdas → se marcan `fueraDeRango` en vez de fallar.
- **Mitigación:** todo aditivo; copia de seguridad antes de cada migración; los lectores viejos siguen funcionando.

### ESTADO INTERMEDIO B — "Doble vía" (Fases 3–5)
- **Permanece:** el wizard manual, disponible como camino alternativo.
- **Cambia:** aparece el generador; el plan puede crearse de las dos formas; aparece el registro de ejecución.
- **Se elimina:** nada todavía.
- **Puede romperse:** un plan generado y otro manual conviviendo en el mismo macrociclo → se impide por estado del macrociclo.
- **Mitigación:** el generador escribe en las mismas tablas; la bandera `generadoEn` distingue el origen.

### ESTADO INTERMEDIO C — "Corte" (Fases 6–8)
- **Permanece:** los datos históricos completos.
- **Cambia:** el generador pasa a ser el camino por defecto; el wizard manual queda como modo avanzado; entran autorregulación y análisis.
- **Se elimina:** `PhaseProgressionBanner`, `avanzarAFuerzaAction`, la lectura de `Sesion.finalRM` para prescribir.
- **Se migra:** `MacrocicloSemanaEjercicio` → `Prescripcion` con `SesionPlanificada` intermedia.
- **Puede romperse:** macrociclos activos durante la migración.
- **Mitigación:** migrar solo macrociclos en estado `borrador` o `cerrado`; los `activo` se migran al cerrarse o mediante regeneración explícita del entrenador.

### ESTADO FINAL (Fases 9–10)
- **Se elimina definitivamente:** `Sesion.finalRM`, `Sesion.estimatedRM`, `Persona.entrenado`, `Persona.faseEntrenamiento`, `Persona.faseInicioAt`, `MacrocicloSemanaEjercicio`, `lib/ejercicios-config.ts`, `lib/rm-flow.ts`.
- Solo tras confirmar que ningún lector queda vivo (búsqueda exhaustiva + una release completa sin uso).

### Principios de migración

1. **Aditivo antes que destructivo.** Toda columna nueva llega antes de que se retire ninguna vieja.
2. **Expandir → migrar → contraer.** Nunca los tres en la misma release.
3. **Ninguna migración recalcula un dato histórico.** El backfill *deriva* valores nuevos; no reinterpreta los viejos.
4. **Copia de seguridad verificada** antes de cada migración que toque datos.
5. **Los macrociclos activos son sagrados.** Un atleta entrenando no puede quedarse sin plan por un despliegue.

---

## 13. PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 0 — Correcciones críticas y red de seguridad

**Objetivo:** detener el daño actual y poder verificar cualquier cambio posterior.

- **Funcionalidades:** ninguna nueva. Solo corrección.
- **Backend:** eliminar `Math.max` entre ejercicios (D-01) y entre fórmulas (D-02); validar rango de repeticiones (D-04); exigir pesos reales en Casas (D-05); validar `series > 1` en Nacleiro (D-06); dejar de borrar `nivelOverride` al guardar una sesión (D-15); sustituir `deleteMany` por diff en `guardarPeriodizacion` (D-08); indexar mesociclos por `orden` (D-09); reemplazar `distribuirSemanas` por el mayor resto (D-10).
- **Frontend:** avisos de rango en el formulario de sesión; bloqueo del cierre de Casas incompleto.
- **Base de datos:** ninguno.
- **Algoritmos:** F-01, F-02, F-08.
- **Tests:** unitarios de todas las fórmulas, incluidos los casos de singularidad; unitarios del reparto de semanas.
- **Dependencias:** ninguna. **Se puede empezar hoy.**
- **Riesgos:** cambiar el estimador altera los valores mostrados respecto a los históricos → se anota en la interfaz.
- **Aceptación:** ningún RM negativo o cero por repeticiones altas; ningún RM registrado sin peso real en Casas; guardar la periodización dos veces no pierde prescripciones; la suma de semanas siempre iguala al total.

### FASE 1 — Fundamentos del dominio

**Objetivo:** dar semántica a los ejercicios y unificar los parámetros.

- **Backend:** `services/ejercicio.service.ts`; `lib/config/parametros.ts` con todas las constantes; extraer `lib/rm/formulas.ts` y `lib/rm/estimacion.ts`.
- **Frontend:** editor del catálogo ampliado en admin.
- **BD:** C-01, C-02.
- **Tests:** unitarios del catálogo y de la configuración.
- **Dependencias:** Fase 0.
- **Riesgos:** el cambio a `autoincrement` en `Ejercicio.id` debe preservar los ids 1–6 existentes.
- **Aceptación:** los 6 ejercicios del seed tienen patrón, músculo, equipamiento e incremento; `EXERCISES_WITHOUT_LOAD` ha desaparecido, sustituido por `esDeTiempo`.

### FASE 2 — Modelo de datos e historia

**Objetivo:** que el RM sea por ejercicio, trazable e inmutable.

- **Backend:** `services/rm.service.ts`; `lib/rm/vigente.ts`.
- **Frontend:** tabla de RM vigentes en la ficha del atleta.
- **BD:** C-03, C-05, C-12, C-14 + backfill de `RmVigente`.
- **Tests:** integración de "cerrar evaluación → nueva fila vigente, anterior cerrada"; regresión del caso 100→110 kg.
- **Dependencias:** Fase 1.
- **Riesgos:** el backfill debe elegir bien el resultado más reciente por (persona, ejercicio).
- **Aceptación:** todo atleta con sesiones previas tiene RM vigentes por ejercicio; cambiar un RM no altera ningún valor histórico.

### FASE 3 — Motor de evaluación

**Objetivo:** evaluaciones de calidad, con incertidumbre explícita.

- **Backend:** `lib/rm/protocolos.ts` (Casas y Nacleiro salen del cliente); `crearEvaluacionRmAction`, `registrarResultadoRmAction`, `cerrarEvaluacionRmAction`.
- **Frontend:** P-03 con carga propuesta, ventana de repeticiones y banda de resultado.
- **BD:** ninguno adicional.
- **Tests:** unitarios de protocolos; e2e del flujo completo de evaluación.
- **Dependencias:** Fase 2.
- **Riesgos:** mover el cálculo de protocolos al servidor cambia la interactividad → mantener previsualización en cliente + cálculo en servidor.
- **Aceptación:** ninguna estimación fuera de rango se usa para prescribir; toda estimación muestra su banda.

### FASE 4 — Motor de planificación

**Objetivo:** generar el plan completo automáticamente. **Es el corazón del proyecto.**

- **Backend:** todo `lib/planificacion/**` + `services/planificacion.service.ts` + `generarPlanAction`, `publicarPlanAction`, `regenerarDesdeAction`.
- **Frontend:** P-04 (generador) y P-05 (vista del plan).
- **BD:** C-06, C-07, C-08, C-09.
- **Algoritmos:** F-04, F-05, F-06, F-07, F-08 + reglas R-01 a R-12 y R-16.
- **Tests:** unitarios por regla; property-based sobre los invariantes; snapshot de planes generados.
- **Dependencias:** Fases 1, 2, 3.
- **Riesgos:** el más alto del proyecto. **Mitigación:** el motor es puro y testeable; se desarrolla contra casos de referencia construidos con el entrenador antes de conectar la interfaz.
- **Aceptación:** un plan de 16 semanas se genera en menos de 2 s, cumple los 10 invariantes, y toda carga tiene `rmVigenteId` y `rmUsadoKg`.

### FASE 5 — Ejecución

**Objetivo:** cerrar el ciclo registrando lo que ocurre.

- **Backend:** `services/ejecucion.service.ts`, `registrarSesionRealizadaAction`, `POST /api/ejecucion/serie`.
- **Frontend:** P-07, optimizada para móvil.
- **BD:** C-10.
- **Algoritmos:** F-03.
- **Tests:** integración de registro y cálculo de e1RM; idempotencia del endpoint.
- **Dependencias:** Fase 4.
- **Riesgos:** uso en el gimnasio con conectividad mala → registro optimista con reintento.
- **Aceptación:** una sesión de 5 ejercicios se registra en menos de 2 minutos de interacción.

### FASE 6 — Frontend y UX

**Objetivo:** el producto del entrenador.

- **Frontend:** P-01, P-02, P-06 (wizard reducido a editor de excepciones), P-10; división de `wizard-steps.tsx`.
- **Backend:** consultas agregadas para las listas.
- **Tests:** e2e de los flujos principales.
- **Dependencias:** Fases 4, 5.
- **Riesgos:** regresión al dividir un componente de 1580 líneas → dividir por pasos, uno por commit.
- **Aceptación:** la prueba de los 15 minutos (§11.3) se cumple.

### FASE 7 — Historial y análisis

- **Frontend:** P-09.
- **BD:** C-13 (`MedidaCorporal`).
- **Tests:** integración de las agregaciones.
- **Dependencias:** Fase 5.
- **Aceptación:** planificado vs realizado por semana, y evolución del RM por ejercicio, ambos correctos sobre datos reales.

### FASE 8 — Automatización y autorregulación

- **Backend:** `lib/progresion/**`, `services/progresion.service.ts`, `resolverAjustePropuestoAction`.
- **Frontend:** P-08.
- **BD:** C-11.
- **Algoritmos:** R-10, R-13, R-15.
- **Tests:** unitarios de cada disparador con series sintéticas.
- **Dependencias:** Fases 5, 7.
- **Riesgos:** exceso de propuestas → límite de una propuesta por alcance y por semana.
- **Aceptación:** ninguna propuesta se aplica sin aceptación humana; toda propuesta muestra su evidencia.

### FASE 9 — Consolidación de pruebas

- Cobertura completa de `lib/**`; e2e de los cuatro flujos principales; casos extremos del §16.4.
- **Aceptación:** el motor y las fórmulas por encima del 90% de cobertura de ramas.

### FASE 10 — Retirada de lo viejo y validación final

- Eliminar campos y componentes deprecados (§12, estado final), previa verificación de que no hay lectores.
- Validación deportiva con el entrenador sobre casos reales.
- **Aceptación:** los criterios de §17, todos.

---

## 14. ORDEN EXACTO DE IMPLEMENTACIÓN

Ordenado para minimizar retrabajo: primero lo que no depende de nada y evita corromper datos, después el dominio puro, después la persistencia, y solo al final la interfaz.

```
BLOQUE A — Red de seguridad (sin esto no se puede verificar nada)
  1. Instalar Vitest y añadir el script "test" a package.json
  2. Crear lib/rm/formulas.ts extrayendo las 8 funciones de lib/rm.ts (sin cambiar comportamiento)
  3. Escribir tests de caracterización de las 8 fórmulas con los valores actuales
  4. Añadir tests de singularidad: reps = 36, 37, 38, 40 en Brzycki y Lander

BLOQUE B — Corrección de cálculo (usa los tests del bloque A como red)
  5. Añadir validación de rango de repeticiones en lib/rm/formulas.ts
  6. Crear lib/rm/estimacion.ts: estimador primario (Epley) + banda + confianza
  7. Eliminar la rama de sexo duplicada de lib/rm.ts (D-03), documentando la decisión
  8. Modificar actions/sesion.ts: quitar Math.max entre ejercicios y entre fórmulas
  9. Modificar actions/sesion.ts: no borrar nivelOverride ni pisar masaCorporal sin aviso
 10. Modificar app/nueva-sesion/CasasProtocol.tsx: exigir pesos reales para cerrar
 11. Modificar lib/nacleiro.ts: validar series > 1 y redondear al incremento

BLOQUE C — Corrección estructural de la periodización
 12. Crear lib/planificacion/estructura.ts con el reparto por mayor resto (F-08)
 13. Tests del reparto: 4 semanas / 8 mesociclos, 52/2, porcentajes que no suman 100
 14. Sustituir distribuirSemanas en lib/macrociclo-periodizacion.ts
 15. Reescribir el mapeo mesociclo-semana por `orden` en services/macrociclo.service.ts
 16. Sustituir los tres deleteMany por un diff no destructivo
 17. Test de integración: guardar la periodización dos veces conserva las prescripciones

BLOQUE D — Catálogo de ejercicios
 18. Migración: campos nuevos de Ejercicio (C-01) con valores por defecto
 19. Actualizar prisma/seed.ts con la semántica de los 6 ejercicios
 20. Migración: Ejercicio.id a autoincrement preservando 1..6 (C-02)
 21. Crear services/ejercicio.service.ts
 22. Sustituir lib/ejercicios-config.ts por Ejercicio.esDeTiempo en todos sus usos
 23. Ampliar app/admin/ejercicios/page.tsx

BLOQUE E — RM por ejercicio y RM vigente
 24. Migración: campos nuevos de ResultadoEjercicio (C-03)
 25. Backfill: calcular rm1Estimado, banda, confianza y fueraDeRango en filas históricas
 26. Migración: tabla RmVigente (C-05)
 27. Backfill de RmVigente desde el último resultado por (persona, ejercicio)
 28. Crear lib/rm/vigente.ts (resolución + caducidad R-15)
 29. Crear services/rm.service.ts (crear/cerrar evaluación, actualizar vigente en transacción)
 30. Test de regresión del caso 100 -> 110 kg
 31. Retirar los lectores de Sesion.finalRM: dashboard/page.tsx, sesion/[id]/page.tsx, wizard paso 2
 32. Modificar lib/user-level.ts para clasificar por ejercicio, no por RM global
 33. Modificar components/results/TrainingRecommendations.tsx para trabajar por ejercicio

BLOQUE F — Disponibilidad del atleta
 34. Migración: campos de disponibilidad en Persona (C-12)
 35. Ampliar services/persona.service.ts y el formulario de la ficha
 36. Migrar actions/*.ts y app/dashboard/page.tsx a lib/prisma.ts

BLOQUE G — Motor de planificación (puro, sin base de datos)
 37. Crear lib/config/parametros.ts con zonas, rangos, umbrales y factores
 38. Crear lib/planificacion/plantillas.ts (salud y competencia, por duración)
 39. Completar lib/planificacion/estructura.ts: microciclos y ubicación de deload
 40. Crear lib/planificacion/prescripcion.ts: selección, volumen, intensidad, carga
 41. Crear lib/planificacion/validacion.ts con los 10 invariantes de R-16
 42. Crear lib/planificacion/motor.ts (contexto -> propuesta)
 43. Tests por regla + property-based sobre los invariantes
 44. Casos de referencia acordados con el entrenador, como snapshots

BLOQUE H — Persistencia del plan
 45. Migración: campos nuevos de MacrocicloMesociclo y MacrocicloSemana (C-06, C-07)
 46. Migración: tabla SesionPlanificada (C-08)
 47. Migración: tabla Prescripcion (C-09)
 48. Migración de datos: MacrocicloSemanaEjercicio -> SesionPlanificada + Prescripcion
 49. Crear services/planificacion.service.ts (generar, publicar, regenerar desde fecha)
 50. Test de integración: regenerar desde una fecha respeta pasado y overrides

BLOQUE I — Ejecución
 51. Migración: tablas SesionRealizada y SerieRealizada (C-10)
 52. Crear services/ejecucion.service.ts con e1RM (F-03)
 53. Crear POST /api/ejecucion/serie con idempotencia
 54. Conectar la ejecución con RmVigente (origen e1rm_entrenamiento)

BLOQUE J — Interfaz
 55. Crear la pantalla del generador (P-04)
 56. Crear la vista del plan (P-05)
 57. Crear la sesión del atleta (P-07)
 58. Dividir wizard-steps.tsx en componentes por paso
 59. Convertir el editor de semana en editor de excepciones (P-06)
 60. Dividir dashboard/page.tsx en lista de atletas (P-01) y ficha (P-02)

BLOQUE K — Análisis y automatización
 61. Consultas agregadas de análisis y pantalla P-09
 62. Migración: tabla AjustePropuesto (C-11)
 63. Crear lib/progresion/reglas.ts y deload.ts
 64. Crear services/progresion.service.ts y la pantalla P-08
 65. Retirar PhaseProgressionBanner y las acciones de fase

BLOQUE L — Cierre
 66. e2e de los cuatro flujos principales
 67. Casos extremos del §16.4
 68. Migración de retirada de campos deprecados
 69. Validación deportiva con el entrenador
 70. Documentar las decisiones del §18
```

---

## 15. TAREAS DE IMPLEMENTACIÓN

Complejidad: **S** (< 2 h), **M** (medio día), **L** (1–2 días), **XL** (> 2 días).

**TASK-001 · Instalar runner de pruebas**
Añadir Vitest y el script `test` a `package.json`. Configurar los alias `@/` de `tsconfig.json`.
*Archivos:* `package.json`, `vitest.config.ts` (nuevo).
*Dependencias:* ninguna. *Prioridad:* Crítica. *Complejidad:* S.
*Aceptación:* `npm test` ejecuta y pasa una prueba trivial; los imports con `@/` resuelven.

**TASK-002 · Extraer las fórmulas de RM**
Mover las 8 funciones de `lib/rm.ts` a `lib/rm/formulas.ts` sin cambiar comportamiento; `lib/rm.ts` reexporta.
*Archivos:* `lib/rm.ts`, `lib/rm/formulas.ts`.
*Dependencias:* TASK-001. *Prioridad:* Alta. *Complejidad:* S.
*Aceptación:* nada más cambia; `npm run build` y `npm run lint` pasan.

**TASK-003 · Tests de caracterización de las fórmulas**
Fijar el comportamiento actual antes de tocarlo, incluidas las singularidades.
*Archivos:* `lib/rm/formulas.test.ts` (nuevo).
*Dependencias:* TASK-002. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* cubre `r ∈ {1,3,5,8,10,15,20,36,37,38,40}` en las 8 fórmulas; documenta el resultado negativo actual de Brzycki y Lander.

**TASK-004 · Validación de rango de repeticiones**
`estimarRm()` devuelve `{ valor, min, max, confianza, fueraDeRango }` y rechaza `r ≥ 30`.
*Archivos:* `lib/rm/estimacion.ts` (nuevo), `lib/rm/formulas.ts`.
*Dependencias:* TASK-003. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* `r = 40` no produce nunca un valor negativo; `r = 12` marca `fueraDeRango`; `r = 5` da confianza alta o media.

**TASK-005 · Eliminar el `Math.max` entre ejercicios**
Quitar el cálculo de `finalRM`/`estimatedRM` como máximo entre ejercicios distintos.
*Archivos:* `actions/sesion.ts:130-151, 429-444`.
*Dependencias:* TASK-004. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* `Sesion.finalRM` deja de escribirse desde el máximo entre ejercicios; los RM se guardan por resultado.

**TASK-006 · Corregir efectos colaterales al guardar una sesión**
No borrar `nivelOverride`; actualizar `masaCorporal` solo con confirmación explícita.
*Archivos:* `actions/sesion.ts:418-427`.
*Dependencias:* ninguna. *Prioridad:* Alta. *Complejidad:* S.
*Aceptación:* tras guardar una sesión, el `nivelOverride` fijado por el entrenador persiste.

**TASK-007 · Exigir pesos reales en el protocolo Casas**
`finalRM` se calcula solo con `actualWeight`; sin pesos reales el protocolo no se cierra.
*Archivos:* `app/nueva-sesion/CasasProtocol.tsx:155-158`, `actions/sesion.ts:141-151`.
*Dependencias:* ninguna. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* con todos los campos vacíos, el botón de guardar está deshabilitado y `finalRM` es 0, no el 115.8% de la referencia.

**TASK-008 · Corregir Nacleiro**
Validar `series > 1`; redondear con `Ejercicio.incrementoMinimoKg`; documentar `calculateInitialWeight`.
*Archivos:* `lib/nacleiro.ts`, `app/nueva-sesion/NacleiroTable.tsx`.
*Dependencias:* TASK-018 para el incremento. *Prioridad:* Alta. *Complejidad:* M.
*Aceptación:* `generateSeries(rm, bw, 1)` no divide por cero; los pesos son cargables.

**TASK-009 · Unificar la rama de sexo en el cálculo de RM**
Eliminar `calculateRMFemenino` (idéntica a la masculina) y documentar la decisión.
*Archivos:* `lib/rm.ts:168-201, 287-317`.
*Dependencias:* TASK-003. *Prioridad:* Media. *Complejidad:* S.
*Aceptación:* ningún resultado cambia; queda registrado que la diferenciación por sexo está pendiente de datos.

**TASK-010 · Reparto de semanas por mayor resto**
Implementar F-08 y sustituir `distribuirSemanas`.
*Archivos:* `lib/planificacion/estructura.ts` (nuevo), `lib/macrociclo-periodizacion.ts:93-137`.
*Dependencias:* TASK-001. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* para cualquier entrada, `Σ semanas = totalSemanas`; con menos semanas que bloques, error explícito; ninguna fecha excede `fechaFin`.

**TASK-011 · Mapear semanas a mesociclos por `orden`**
Sustituir el `Map` indexado por `tipo`.
*Archivos:* `services/macrociclo.service.ts:452-490`.
*Dependencias:* TASK-010. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* con dos mesociclos "desarrollador", cada semana cae en el correcto y ninguna se descarta.

**TASK-012 · Guardado no destructivo de la periodización**
Reemplazar los tres `deleteMany` por diff; proteger semanas pasadas y con ejecución.
*Archivos:* `services/macrociclo.service.ts:372-573`.
*Dependencias:* TASK-011. *Prioridad:* Crítica. *Complejidad:* L.
*Aceptación:* guardar dos veces conserva `MesocicloCarga` y todas las prescripciones; intentar borrar una semana ejecutada devuelve error.

**TASK-013 · Ampliar el modelo `Ejercicio`**
Migración C-01 con los campos semánticos.
*Archivos:* `prisma/schema.prisma`, migración nueva.
*Dependencias:* ninguna. *Prioridad:* Alta. *Complejidad:* M.
*Aceptación:* migración aplicada sin pérdida; los 6 ejercicios conservan sus datos.

**TASK-014 · Poblar la semántica de los ejercicios del seed**
*Archivos:* `prisma/seed.ts`.
*Dependencias:* TASK-013. *Prioridad:* Alta. *Complejidad:* S.
*Aceptación:* los 6 tienen patrón, músculo, equipamiento e incremento; "Abdominales (1 minuto)" queda `esDeTiempo = true`.

**TASK-015 · Retirar `lib/ejercicios-config.ts`**
Sustituir `EXERCISES_WITHOUT_LOAD` por `Ejercicio.esDeTiempo` en todos sus usos.
*Archivos:* `lib/ejercicios-config.ts`, `actions/sesion.ts:9,131,388`.
*Dependencias:* TASK-014. *Prioridad:* Media. *Complejidad:* M.
*Aceptación:* no queda ningún id de ejercicio hardcodeado en la lógica.

**TASK-016 · `Ejercicio.id` a autoincrement**
*Archivos:* `prisma/schema.prisma`, migración.
*Dependencias:* TASK-013. *Prioridad:* Media. *Complejidad:* M.
*Aceptación:* se puede crear un ejercicio nuevo desde admin sin asignar id; los ids 1–6 no cambian.

**TASK-017 · Servicio de catálogo de ejercicios**
*Archivos:* `services/ejercicio.service.ts` (nuevo), `app/admin/ejercicios/page.tsx`.
*Dependencias:* TASK-016. *Prioridad:* Media. *Complejidad:* M.

**TASK-018 · Ampliar `ResultadoEjercicio`**
Migración C-03 y backfill de las filas históricas.
*Archivos:* `prisma/schema.prisma`, migración, `prisma/backfill-resultados.ts` (nuevo).
*Dependencias:* TASK-004. *Prioridad:* Crítica. *Complejidad:* L.
*Aceptación:* toda fila histórica tiene `rm1Estimado`, banda y confianza; las de reps > 10 quedan `fueraDeRango`.

**TASK-019 · Tabla `RmVigente`**
Migración C-05 + índices.
*Archivos:* `prisma/schema.prisma`, migración.
*Dependencias:* TASK-018. *Prioridad:* Crítica. *Complejidad:* M.

**TASK-020 · Backfill de `RmVigente`**
Una fila abierta por (persona, ejercicio) desde el resultado más reciente.
*Archivos:* `prisma/backfill-rm-vigente.ts` (nuevo).
*Dependencias:* TASK-019. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* ningún atleta con sesiones queda sin RM vigente; ninguna pareja tiene dos filas abiertas.

**TASK-021 · Módulo de RM vigente**
Resolución, caducidad (R-15) y linaje.
*Archivos:* `lib/rm/vigente.ts` (nuevo).
*Dependencias:* TASK-019. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* `resolverRmVigente(persona, ejercicio, fecha)` devuelve el valor correcto para **cualquier** fecha pasada.

**TASK-022 · Servicio de evaluación de RM**
Crear, registrar resultados y cerrar evaluación, actualizando `RmVigente` en la misma transacción.
*Archivos:* `services/rm.service.ts` (nuevo).
*Dependencias:* TASK-021. *Prioridad:* Crítica. *Complejidad:* L.
*Aceptación:* cerrar una evaluación cierra la fila vigente anterior y abre la nueva, atómicamente.

**TASK-023 · Test de regresión de retroactividad**
El caso 100 → 110 kg del §4.1.
*Archivos:* `services/rm.service.test.ts` (nuevo).
*Dependencias:* TASK-022. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* tras subir el RM, ninguna prescripción anterior cambia de `cargaKg` ni de `rmUsadoKg`.

**TASK-024 · Retirar los lectores del RM global**
*Archivos:* `app/dashboard/page.tsx:200-210`, `app/sesion/[id]/page.tsx`, `app/macrociclo/[id]/wizard-steps.tsx`, `components/results/TrainingRecommendations.tsx`, `lib/user-level.ts`.
*Dependencias:* TASK-022. *Prioridad:* Alta. *Complejidad:* L.
*Aceptación:* ninguna pantalla muestra un "RM" que no pertenezca a un ejercicio concreto.

**TASK-025 · Disponibilidad en `Persona`**
Migración C-12 y formulario.
*Archivos:* `prisma/schema.prisma`, `services/persona.service.ts`, ficha del atleta.
*Dependencias:* ninguna. *Prioridad:* Alta. *Complejidad:* M.

**TASK-026 · Unificar el cliente Prisma**
*Archivos:* `actions/sesion.ts:41-57`, `actions/persona.ts`, `actions/macrociclo.ts`, `services/persona.service.ts:44-61`, `app/dashboard/page.tsx:29-45`.
*Dependencias:* ninguna. *Prioridad:* Media. *Complejidad:* M.
*Nota:* `CLAUDE.md` pide hoy seguir el patrón local de cada archivo. Esta tarea cambia esa convención **deliberadamente**; hay que actualizar `CLAUDE.md` en el mismo commit.

**TASK-027 · Parámetros centralizados**
*Archivos:* `lib/config/parametros.ts` (nuevo).
*Dependencias:* ninguna. *Prioridad:* Alta. *Complejidad:* M.
*Aceptación:* zonas de intensidad, rangos de reps, RIR, umbrales de volumen, factores de deload y umbrales de ajuste viven en un solo archivo.

**TASK-028 · Plantillas de periodización**
*Archivos:* `lib/planificacion/plantillas.ts` (nuevo).
*Dependencias:* TASK-027. *Prioridad:* Alta. *Complejidad:* L.
*Aceptación:* dado objetivo, duración y nivel, devuelve periodos, etapas, mesociclos y objetivos de bloque; cubre 8, 12, 16 y 24 semanas.

**TASK-029 · Estructura temporal completa**
Microciclos y ubicación de descargas (R-10).
*Archivos:* `lib/planificacion/estructura.ts`.
*Dependencias:* TASK-028. *Prioridad:* Alta. *Complejidad:* L.
*Aceptación:* nunca dos semanas de choque seguidas; al menos una descarga cada 6 semanas.

**TASK-030 · Prescripción**
Selección de ejercicios, volumen, intensidad y carga (R-01 a R-07).
*Archivos:* `lib/planificacion/prescripcion.ts` (nuevo).
*Dependencias:* TASK-021, TASK-027, TASK-029. *Prioridad:* Crítica. *Complejidad:* XL.
*Aceptación:* toda carga es múltiplo del incremento del ejercicio y lleva `rmVigenteId`; los ejercicios sin RM se prescriben por reps y RIR.

**TASK-031 · Validación de invariantes**
Los 10 de R-16.
*Archivos:* `lib/planificacion/validacion.ts` (nuevo).
*Dependencias:* TASK-030. *Prioridad:* Crítica. *Complejidad:* M.
*Aceptación:* cada invariante tiene su test de violación; el motor no publica un plan inválido.

**TASK-032 · Motor de planificación**
*Archivos:* `lib/planificacion/motor.ts` (nuevo).
*Dependencias:* TASK-028..031. *Prioridad:* Crítica. *Complejidad:* L.
*Aceptación:* función pura, sin Prisma; un plan de 16 semanas en menos de 2 s.

**TASK-033 · Persistencia de la estructura del plan**
Migraciones C-06, C-07, C-08.
*Archivos:* `prisma/schema.prisma`, migraciones.
*Dependencias:* TASK-032. *Prioridad:* Alta. *Complejidad:* L.

**TASK-034 · Tabla `Prescripcion` y migración de datos**
C-09 + traslado de `MacrocicloSemanaEjercicio`.
*Archivos:* `prisma/schema.prisma`, migración, `prisma/migrate-prescripciones.ts` (nuevo).
*Dependencias:* TASK-033. *Prioridad:* Alta. *Complejidad:* XL.
*Aceptación:* toda `MacrocicloSemanaEjercicio` existente tiene su `Prescripcion` equivalente; ninguna se pierde.

**TASK-035 · Servicio de planificación**
Generar, publicar y regenerar desde fecha respetando overrides.
*Archivos:* `services/planificacion.service.ts` (nuevo).
*Dependencias:* TASK-034. *Prioridad:* Crítica. *Complejidad:* XL.
*Aceptación:* regenerar desde la semana 9 no modifica ninguna fila de las semanas 1–8 ni ningún override posterior.

**TASK-036 · Tablas de ejecución**
C-10.
*Archivos:* `prisma/schema.prisma`, migración.
*Dependencias:* TASK-034. *Prioridad:* Alta. *Complejidad:* M.

**TASK-037 · Servicio de ejecución**
Registro de series y e1RM (F-03).
*Archivos:* `services/ejecucion.service.ts` (nuevo).
*Dependencias:* TASK-036. *Prioridad:* Alta. *Complejidad:* L.

**TASK-038 · Endpoint de registro rápido de serie**
*Archivos:* `app/api/ejecucion/serie/route.ts` (nuevo).
*Dependencias:* TASK-037. *Prioridad:* Media. *Complejidad:* M.
*Aceptación:* idempotente por `requestId`; dos envíos iguales crean una sola serie.

**TASK-039 · Pantalla del generador de plan (P-04)**
*Archivos:* `app/macrociclo/[id]/generar/page.tsx` (nuevo).
*Dependencias:* TASK-035. *Prioridad:* Alta. *Complejidad:* XL.

**TASK-040 · Vista del plan (P-05)**
*Archivos:* `app/macrociclo/[id]/page.tsx`.
*Dependencias:* TASK-035. *Prioridad:* Alta. *Complejidad:* L.

**TASK-041 · Sesión del atleta (P-07)**
*Archivos:* `app/entrenamiento/[sesionId]/page.tsx` (nuevo).
*Dependencias:* TASK-037. *Prioridad:* Alta. *Complejidad:* XL.

**TASK-042 · Dividir `wizard-steps.tsx`**
1580 líneas → un componente por paso.
*Archivos:* `app/macrociclo/[id]/wizard-steps.tsx` y nuevos.
*Dependencias:* TASK-039. *Prioridad:* Media. *Complejidad:* XL.
*Nota:* un paso por commit, con verificación visual entre commits.

**TASK-043 · Editor de excepciones (P-06)**
*Archivos:* los componentes de TASK-042.
*Dependencias:* TASK-042. *Prioridad:* Media. *Complejidad:* L.
*Aceptación:* todo valor llega relleno; los valores tocados quedan marcados como override.

**TASK-044 · Lista de atletas y ficha (P-01, P-02)**
*Archivos:* `app/dashboard/page.tsx` dividido.
*Dependencias:* TASK-024, TASK-025. *Prioridad:* Alta. *Complejidad:* L.

**TASK-045 · Análisis (P-09)**
*Archivos:* `app/analisis/[personaId]/page.tsx` (nuevo).
*Dependencias:* TASK-037. *Prioridad:* Media. *Complejidad:* L.

**TASK-046 · `MedidaCorporal`**
C-13 + backfill desde `medidasSnapshot`.
*Archivos:* `prisma/schema.prisma`, migración, script.
*Dependencias:* ninguna. *Prioridad:* Baja. *Complejidad:* M.

**TASK-047 · Reglas de progresión**
R-08, R-09, R-13.
*Archivos:* `lib/progresion/reglas.ts` (nuevo).
*Dependencias:* TASK-037. *Prioridad:* Media. *Complejidad:* L.

**TASK-048 · Deload programado y reactivo**
R-10.
*Archivos:* `lib/progresion/deload.ts` (nuevo).
*Dependencias:* TASK-047. *Prioridad:* Media. *Complejidad:* M.

**TASK-049 · `AjustePropuesto` y su servicio**
C-11 + `services/progresion.service.ts`.
*Dependencias:* TASK-048. *Prioridad:* Media. *Complejidad:* L.
*Aceptación:* ninguna propuesta modifica una prescripción sin aceptación explícita.

**TASK-050 · Pantalla de ajustes (P-08)**
*Archivos:* `app/ajustes/page.tsx` (nuevo).
*Dependencias:* TASK-049. *Prioridad:* Media. *Complejidad:* M.

**TASK-051 · Retirar el sistema de fases paralelo**
*Archivos:* `components/dashboard/PhaseProgressionBanner.tsx` (borrar), `actions/persona.ts:292-320`, `lib/training.ts:9-16`, `prisma/schema.prisma`.
*Dependencias:* TASK-035. *Prioridad:* Media. *Complejidad:* M.

**TASK-052 · Alerta de reevaluación por ejercicio**
*Archivos:* `components/dashboard/RetestReminderBanner.tsx`.
*Dependencias:* TASK-021. *Prioridad:* Media. *Complejidad:* S.
*Aceptación:* avisa por ejercicio con RM de más de 12 semanas, no por días desde la última sesión.

**TASK-053 · Corregir el índice de fuerza**
F-12: normalizar por número de ejercicios.
*Archivos:* `lib/rm.ts:108-166`.
*Dependencias:* TASK-002. *Prioridad:* Media. *Complejidad:* M.
*Aceptación:* con 4 o con 6 ejercicios la escala es comparable; se elimina la firma engañosa con `_ejercicioId`/`_sexo`.

**TASK-054 · Suite e2e**
*Archivos:* `e2e/**` (nuevo).
*Dependencias:* TASK-041, TASK-044. *Prioridad:* Alta. *Complejidad:* XL.

**TASK-055 · Retirada de campos deprecados**
*Archivos:* `prisma/schema.prisma`, migración final.
*Dependencias:* TASK-051, TASK-054. *Prioridad:* Baja. *Complejidad:* M.
*Aceptación:* búsqueda exhaustiva sin resultados antes de borrar cada campo.

**TASK-056 · Documentación de decisiones**
El §18 de este documento, como archivo vivo.
*Archivos:* `docs/DECISIONES.md` (nuevo), `CLAUDE.md`, `AGENTS.md`.
*Dependencias:* ninguna. *Prioridad:* Alta. *Complejidad:* M.

---

## 16. TESTING

Hoy no hay ninguna prueba (`package.json` no define `test`). Todo lo que sigue es nuevo, y **TASK-001 es la primera tarea de todo el plan** por ese motivo.

### 16.1 Unitarios — dominio puro

**Fórmulas (`lib/rm/formulas.test.ts`)**
- Las 8 fórmulas con valores de referencia calculados a mano.
- Repeticiones 1, 3, 5, 8, 10 → resultados dentro de un ±1% de lo esperado.
- **Singularidades:** `r = 36, 37, 38, 40` en Brzycki y Lander no producen valores negativos ni `Infinity`.
- `carga = 0`, `reps = 0`, `NaN`, `Infinity`, negativos.
- Idempotencia del redondeo a dos decimales.

**Estimación (`lib/rm/estimacion.test.ts`)**
- `rmMin ≤ valor ≤ rmMax` siempre.
- `confianza` correcta en cada banda de repeticiones.
- `fueraDeRango` con `r > 10`; rechazo con `r ≥ 30`.
- e1RM con RIR: `carga 100, r 5, RIR 2` equivale a `carga 100, r 7, RIR 0`.

**Conversiones (`helpers/units.test.ts`)**
- Libras → kg, centímetros → metros, y sobre todo los **umbrales de autoconversión** (talla > 3 se interpreta como cm, peso > 150 como libras): probar exactamente 3, 3.01, 150, 150.01.

**Redondeo de carga (F-04)**
- Incrementos de 1, 2.5, 5 y 20 kg; siempre múltiplo exacto; nunca por encima del teórico.

**Reparto de semanas (F-08)**
- `Σ = N` para 200 combinaciones aleatorias de porcentajes y N (property-based).
- Porcentajes que no suman 100.
- Menos semanas que bloques → error explícito.
- Un solo bloque al 100%.

**Reglas de progresión (`lib/progresion/reglas.test.ts`)**
- Una sesión mala no dispara ajuste; dos consecutivas sí.
- RIR sistemáticamente alto → propuesta de subir carga.
- Sesiones omitidas → propuesta sobre disponibilidad, **no** sobre carga.

**Deload (`lib/progresion/deload.test.ts`)**
- Programado cada 4ª semana.
- Reactivo con 2 de 4 criterios; no con 1.

**Validación (`lib/planificacion/validacion.test.ts`)**
- Un test por invariante, construyendo un plan que lo viola.

**Índice de fuerza**
- Escala comparable con 4 y con 6 ejercicios (F-12).

### 16.2 Integración

- **Cerrar evaluación** → `RmVigente` anterior cerrado, nuevo abierto, exactamente una fila abierta por pareja.
- **Generar y publicar plan** → estructura y prescripciones coherentes; toda carga con `rmVigenteId`.
- **Regenerar desde fecha** → semanas anteriores byte a byte idénticas; overrides conservados.
- **Guardar periodización dos veces** → `MesocicloCarga` y prescripciones intactas (regresión de D-08).
- **Dos mesociclos del mismo tipo** → cada semana en el mesociclo correcto (regresión de D-09).
- **Registrar serie** → e1RM correcto y `RmVigente` actualizado solo si supera al vigente.
- **Idempotencia**: dos envíos con el mismo `requestId` crean un solo registro (el patrón ya existe en `Sesion.requestId`).

### 16.3 End-to-end

1. **Alta y evaluación:** crear atleta → evaluación de 5 ejercicios → ver RM vigentes con banda.
2. **Planificación:** objetivo y disponibilidad → generar → ajustar una semana → publicar → ver el plan.
3. **Ejecución:** abrir la sesión del día → registrar todas las series → ver la sesión completada y el e1RM.
4. **Ciclo completo:** ejecutar 3 semanas → reevaluar → regenerar → **comprobar que las semanas ejecutadas no cambiaron**.

### 16.4 Casos extremos (todos detectados durante la auditoría)

| # | Caso | Comportamiento esperado |
|---|---|---|
| E-01 | Atleta hace 40 repeticiones | No se produce RM negativo; se pide recalibrar la carga |
| E-02 | Atleta hace 1 repetición | RM = carga; confianza alta |
| E-03 | Ejercicio de tiempo (abdominales) | No se calcula RM; no entra en la prescripción por %1RM |
| E-04 | Casas sin ningún peso registrado | No se puede cerrar el protocolo |
| E-05 | Nacleiro con `series = 1` | Error de validación, no división por cero |
| E-06 | Macrociclo de 4 semanas con 8 mesociclos | Error explícito antes de generar |
| E-07 | Dos mesociclos del mismo tipo | Semanas correctamente asignadas |
| E-08 | Macrociclo de 1 día | Rechazado con mensaje claro |
| E-09 | Plan con un ejercicio sin RM | Se genera; ese ejercicio se prescribe por reps y RIR y se marca |
| E-10 | RM de hace 8 meses | El plan se genera con aviso de confianza baja |
| E-11 | Atleta cambia de 4 a 2 días/semana en la semana 6 | Semanas 1–5 intactas; 6+ redistribuidas conservando el volumen por patrón |
| E-12 | Atleta omite 3 sesiones seguidas | Propuesta sobre disponibilidad, no bajada de carga |
| E-13 | Se sube el RM a mitad de macrociclo | Semanas pasadas con la carga original; futuras con la nueva |
| E-14 | Entrenador sobrescribe una carga y luego regenera | El override sobrevive |
| E-15 | Cambio de masa corporal entre evaluaciones | Cada evaluación conserva la masa corporal de su día |
| E-16 | Dos envíos simultáneos del mismo formulario | Un solo registro (idempotencia) |
| E-17 | Fecha de competencia anterior a la de inicio | Rechazado en validación |
| E-18 | Persona sin ninguna sesión pide un plan | Se ofrece evaluación primero; no se genera con RM inventados |
| E-19 | Carga que no es múltiplo del incremento | Imposible por construcción (F-04) |
| E-20 | Prescripción publicada que se intenta editar | Se crea versión nueva; la anterior queda intacta |

### 16.5 Qué no se va a probar (decisión explícita)

- Componentes puramente presentacionales sin lógica.
- La extracción de PDF (`lib/pdf-antropometria.ts`): depende de formatos externos; se cubre con unos pocos PDFs de referencia como *fixtures*, no con pruebas exhaustivas.

---

## 17. CRITERIOS DE ACEPTACIÓN DEL PRODUCTO

### 17.1 Integridad histórica

- **AC-01.** Un cambio de RM no modifica retroactivamente ninguna carga prescrita en entrenamientos ya publicados o ejecutados.
- **AC-02.** Toda carga prescrita puede rastrearse hasta la evaluación concreta, el ejercicio y la fórmula que la originaron.
- **AC-03.** Es posible reconstruir cuál era el RM vigente de cualquier ejercicio en cualquier fecha pasada.
- **AC-04.** Ninguna operación de edición del plan borra datos ya ejecutados sin confirmación explícita.
- **AC-05.** Cada evaluación conserva la masa corporal, los meses de entrenamiento y el método del día en que se hizo.

### 17.2 Validez científica

- **AC-06.** Ningún 1RM se estima fuera del rango de validez de la fórmula sin quedar marcado como tal.
- **AC-07.** Ninguna fórmula produce valores negativos, infinitos ni cero por repeticiones altas.
- **AC-08.** Ningún RM se registra sin que el atleta haya levantado realmente esa carga o una serie submáxima real.
- **AC-09.** Ningún RM de un ejercicio se usa para prescribir otro ejercicio.
- **AC-10.** Toda estimación se presenta con su banda de incertidumbre y su nivel de confianza.
- **AC-11.** El nivel del atleta nunca se deriva del máximo entre ejercicios distintos.

### 17.3 Coherencia deportiva

- **AC-12.** El sistema genera una planificación coherente con el objetivo, la disponibilidad y el nivel del atleta.
- **AC-13.** Todo mesociclo tiene una zona de intensidad, un rango de repeticiones y un RIR objetivo coherentes entre sí.
- **AC-14.** Ningún bloque de acumulación supera 6 semanas consecutivas sin descarga.
- **AC-15.** El volumen semanal por grupo muscular se mantiene dentro de los rangos definidos para el objetivo del bloque.
- **AC-16.** Volumen e intensidad nunca aumentan en la misma semana.
- **AC-17.** Toda carga prescrita es efectivamente cargable con el equipamiento declarado.
- **AC-18.** La suma de semanas de periodos, etapas y mesociclos iguala siempre al total del macrociclo, y ninguna fecha excede el fin.

### 17.4 Control del entrenador

- **AC-19.** Todo valor generado automáticamente es editable, y editarlo lo protege de futuras regeneraciones.
- **AC-20.** Ningún ajuste automático se aplica sin aceptación humana explícita.
- **AC-21.** Cada recomendación del sistema muestra la evidencia concreta en la que se basa.
- **AC-22.** Cada bloque del plan lleva una explicación en lenguaje llano de su lógica.

### 17.5 Experiencia

- **AC-23.** De atleta nuevo a plan de 16 semanas publicado en menos de 15 minutos, sin cálculos manuales.
- **AC-24.** Registrar una sesión de 5 ejercicios lleva menos de 2 minutos de interacción en el móvil.
- **AC-25.** Ninguna pantalla presenta un estado vacío sin indicar la acción que lo resuelve.

### 17.6 Técnicos

- **AC-26.** `lib/**` supera el 90% de cobertura de ramas.
- **AC-27.** Un plan de 16 semanas se genera en menos de 2 segundos.
- **AC-28.** Ninguna migración pierde datos; toda migración es reversible o tiene copia verificada.
- **AC-29.** Ningún cálculo de prescripción o de RM ocurre en un componente cliente.
- **AC-30.** `npm run build` y `npm run lint` pasan sin avisos nuevos.

---

## 18. DECISIONES QUE DEBEN QUEDAR DOCUMENTADAS

Destino propuesto: **`docs/DECISIONES.md`**, un registro de decisiones con formato fijo (contexto → decisión → consecuencias → fecha → estado), enlazado desde `CLAUDE.md` y `AGENTS.md` para que cualquier persona o agente que trabaje en el repositorio lo lea antes de tocar el dominio.

Además, cada constante numérica del dominio debe vivir en `lib/config/parametros.ts` **con un comentario que cite su justificación**, no dispersa en componentes.

| # | Decisión a documentar | Dónde |
|---|---|---|
| ADR-01 | Fórmula primaria para estimar 1RM (Epley) y por qué, no las otras siete | `docs/DECISIONES.md` + `lib/rm/estimacion.ts` |
| ADR-02 | Por qué no se usa `max()` entre fórmulas y qué significa la banda | Ídem |
| ADR-03 | Ventana válida de repeticiones (3–10) y qué pasa fuera de ella | Ídem |
| ADR-04 | Significado operativo de RIR en este sistema y su escala | `docs/DECISIONES.md` |
| ADR-05 | Significado de RPE de sesión y por qué se registra aparte del RIR | Ídem |
| ADR-06 | Cómo se determina la intensidad: %1RM + RIR, y cuál manda en conflicto | Ídem |
| ADR-07 | Cómo se determina el volumen: series efectivas por grupo muscular, no tonelaje | Ídem |
| ADR-08 | Por qué el tonelaje se conserva pero no es la métrica principal | Ídem |
| ADR-09 | Reglas de progresión intra e inter mesociclo | `lib/progresion/reglas.ts` |
| ADR-10 | Reglas de deload, programado y reactivo | `lib/progresion/deload.ts` |
| ADR-11 | Cuándo se actualiza el RM y cuándo caduca (12 y 24 semanas) | `lib/rm/vigente.ts` |
| ADR-12 | Cómo se manejan los ejercicios sin RM | `lib/planificacion/prescripcion.ts` |
| ADR-13 | Por qué el RM nunca se extrapola entre ejercicios | `docs/DECISIONES.md` |
| ADR-14 | Principio de inmutabilidad histórica y sus tres mecanismos | Ídem, y en `CLAUDE.md` |
| ADR-15 | Cuándo un valor es override del entrenador y qué implica | Ídem |
| ADR-16 | Origen y estado de los coeficientes `porcentajeMasaHombre/Mujer` | Ídem — **hoy no tienen fuente documentada** |
| ADR-17 | Origen del protocolo Casas (porcentajes y descansos) | Ídem |
| ADR-18 | Origen del protocolo Nacleiro y de la fórmula KIES | Ídem — `calculateInitialWeight` no tiene fuente |
| ADR-19 | Umbrales del índice de fuerza y su normalización | `lib/rm.ts` |
| ADR-20 | Umbrales de nivel (relación fuerza/peso) y su limitación | `lib/user-level.ts` |
| ADR-21 | Por qué se descartan ACWR y el modelo fitness-fatiga | `docs/DECISIONES.md` |
| ADR-22 | Diferenciación por sexo: estado actual (no existe) y qué haría falta | Ídem |
| ADR-23 | Vocabulario de periodización adoptado y su escuela de origen | Ídem |
| ADR-24 | Relación entre las "direcciones" en minutos y la prescripción en kg | Ídem |
| ADR-25 | Modelo de autorización de personas y su riesgo actual | Ídem |

**Nota sobre ADR-16, 17 y 18:** son los tres puntos del sistema donde hay números sin fuente conocida. Es imprescindible que el entrenador aporte la referencia bibliográfica o la declare como convención propia del proyecto. Un número sin origen en un motor de prescripción es una deuda científica, no técnica.

---

## 19. DEPENDENCIAS Y RIESGOS

### 19.1 Dependencias técnicas

- Prisma 7 + adaptador MariaDB: las migraciones con cambio de clave primaria (`Ejercicio.id` a autoincrement) requieren cuidado en MySQL/MariaDB.
- Next.js 16 Server Actions: `redirect()` dentro de `try/catch` puede tragarse la excepción de control (patrón presente en `actions/sesion.ts:529-547`); revisar al refactorizar.
- Sin runner de pruebas: **bloquea de facto todo el plan**. TASK-001 es la primera tarea por eso.
- `pdfjs-dist` para antropometría: dependencia frágil frente a cambios de formato del PDF de origen.

### 19.2 Dependencias científicas

- **Los coeficientes `porcentajeMasaHombre/Mujer` no tienen fuente documentada** y determinan la carga del test, y por tanto la calidad de todas las estimaciones. Es la dependencia científica más crítica del proyecto.
- Los porcentajes y descansos del protocolo Casas y la fórmula KIES de Nacleiro necesitan referencia.
- Los rangos de volumen (10–20 series semanales) provienen de literatura sobre hipertrofia en poblaciones concretas; su extrapolación al contexto del proyecto debe validarla el entrenador.
- La escala RIR requiere que el atleta esté calibrado; en principiantes es poco fiable durante las primeras semanas.

### 19.3 Decisiones aún abiertas

| # | Decisión pendiente | Impacto si se decide tarde |
|---|---|---|
| Q-01 | ¿El producto es multi-entrenador o de un solo entrenador? | Afecta al modelo de autorización y a todas las consultas |
| Q-02 | ¿El atleta registra su propio entrenamiento, o lo hace el entrenador? | Afecta a P-07 y al modelo de acceso |
| Q-03 | ¿Se recalibran los coeficientes de masa corporal del test? | Afecta a la validez de todas las estimaciones |
| Q-04 | ¿Se conservan las "direcciones" en minutos o se simplifican? | Afecta a `MesocicloCarga` y al paso 8 |
| Q-05 | ¿Qué ejercicios entran en el catálogo más allá de los 6 actuales? | Afecta a la utilidad real del motor |
| Q-06 | ¿Se implementa autenticación real de persona? | Riesgo de privacidad de datos de salud |
| Q-07 | ¿Qué duraciones de macrociclo hay que soportar? | Determina cuántas plantillas hay que construir |

**Q-03 y Q-05 conviene resolverlas antes de la Fase 4**, porque condicionan el diseño del motor. Las demás pueden decidirse sobre la marcha.

### 19.4 Riesgos de migración

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Backfill de `RmVigente` elige el resultado equivocado | Media | Alto | Ejecutar primero en modo simulación y revisar una muestra |
| Migración de `MacrocicloSemanaEjercicio` pierde filas | Media | Alto | Migrar copiando, conservar la tabla origen una release, comparar recuentos |
| Un macrociclo activo queda inconsistente | Media | Alto | Migrar solo `borrador` y `cerrado`; los activos, al cerrarse |
| El backfill de resultados marca mal `fueraDeRango` | Alta | Medio | Es conservador: ante la duda, confianza baja |
| Cambio de `Ejercicio.id` rompe referencias | Baja | Alto | Preservar los ids existentes; ajustar el contador |

### 19.5 Riesgos de arquitectura

- **El motor de planificación es un componente grande y nuevo.** Mitigación: función pura, testeable, desarrollada contra casos de referencia antes de conectar la interfaz.
- **Dividir `wizard-steps.tsx` (1580 líneas) puede introducir regresiones.** Mitigación: un paso por commit, verificación visual entre commits, e2e antes de empezar.
- **Dos caminos de creación de plan conviviendo** durante el estado intermedio B. Mitigación: bandera de origen y bloqueo por estado.
- **Sin pruebas hoy**, cualquier refactor es a ciegas. Mitigación: TASK-001 a TASK-003 primero, siempre.

### 19.6 Riesgos de UX

- El generador puede producir planes que al entrenador le parezcan mal y no sepa por qué. Mitigación: explicación por bloque y trazabilidad por número (§11.2).
- La automatización puede sentirse como pérdida de control. Mitigación: todo editable, todo override respetado.
- Registrar cada serie puede resultar tedioso y bajar la adherencia. Mitigación: un toque por serie, valores prellenados con lo prescrito.

### 19.7 Riesgos de modelado

- **Versionar prescripciones multiplica las filas.** Un macrociclo de 24 semanas × 4 sesiones × 6 ejercicios = 576 prescripciones; con versiones, más. Es perfectamente manejable en MariaDB con los índices adecuados, pero hay que dimensionarlo desde el principio.
- **`Json` en Prisma no se valida.** `direcciones`, `volumen`, `microciclos`, `sesiones`, `rmSnapshot`, `medidasSnapshot` son Json sin esquema. Mitigación: validador de esquemas en la frontera de lectura y escritura, y versionar el formato del Json.
- **Elegir mal la granularidad de `SesionPlanificada`** obligaría a rehacer la Fase 4. Mitigación: es la decisión de modelado que más conviene revisar con el entrenador antes de escribir código.

### 19.8 Riesgos de métricas

- **%1RM asume un 1RM estable**, cuando fluctúa a diario. Mitigación: el RIR acompaña siempre a la carga.
- **Tonelaje** confunde estructuras de serie muy distintas (F-05). Mitigación: no usarlo como métrica principal.
- **ACWR**: descartada por cuestionamientos metodológicos serios.
- **IMC en atletas**: no distingue masa magra de grasa. Debe etiquetarse en la interfaz.
- **RIR autorreportado**: sesgado en principiantes. Mitigación: ponderar la confianza por experiencia del atleta.
- **Índice de fuerza propio**: sin validación externa. Debe presentarse como referencia interna.

### 19.9 Problemas futuros previsibles

- Ejercicios unilaterales y con carga asimétrica: el modelo actual asume carga única.
- Superseries y circuitos: no caben en el modelo de prescripción propuesto sin un campo de agrupación.
- Múltiples atletas entrenando a la vez: exige un modo "sesión de grupo".
- Internacionalización (pedida en `plan.txt`, bloque 10): conviene extraer los textos a claves **antes** de escribir las pantallas nuevas, no después.
- Libras en vez de kilogramos: los helpers de unidades ya existen, pero el dominio asume kg en todas partes.

---

# 20. PLAN DE EJECUCIÓN RECOMENDADO

La versión ejecutable. Qué hacer el lunes, qué después, y cuándo dar cada etapa por terminada.

### ETAPA 1 — "Que nada esté mal calculado" · TASK-001 a TASK-012 · ~1 semana

**El lunes por la mañana:** TASK-001 (instalar Vitest), TASK-002 (extraer las fórmulas) y TASK-003 (tests de caracterización). Al final del primer día ya existe una red de seguridad y se puede tocar el dominio sin miedo.

**Resto de la semana:** TASK-004 a TASK-012 — validación de rango, retirada de los `Math.max`, corrección de Casas y Nacleiro, reparto de semanas por mayor resto, mapeo por `orden`, y guardado no destructivo de la periodización.

**Terminada cuando:** `npm test` pasa; ningún RM negativo con repeticiones altas; Casas no se cierra sin pesos reales; guardar la periodización dos veces conserva las prescripciones; la suma de semanas siempre iguala al total.

> Esta etapa no añade ninguna funcionalidad y es, con diferencia, la de mejor relación valor/esfuerzo del plan: detiene la corrupción de datos que hoy está ocurriendo.

### ETAPA 2 — "Que los datos signifiquen algo" · TASK-013 a TASK-026 · ~2 semanas

Catálogo de ejercicios con semántica, RM por ejercicio, `RmVigente` con linaje, backfills, y retirada de los lectores del RM global.

**Terminada cuando:** todo atleta tiene RM vigentes por ejercicio con fecha y confianza; ninguna pantalla muestra un RM que no pertenezca a un ejercicio; el test de regresión 100→110 kg pasa.

> **Aquí es donde queda resuelto el problema de retroactividad histórica del enunciado.**

### ETAPA 3 — "Que el motor exista" · TASK-027 a TASK-032 · ~3 semanas

Todo `lib/planificacion/**` como dominio puro: parámetros, plantillas, estructura, prescripción, validación y motor. Sin base de datos y sin interfaz.

**Antes de empezar:** resolver Q-03 (coeficientes de masa corporal) y Q-05 (catálogo de ejercicios), y acordar con el entrenador 3 casos de referencia que sirvan de snapshot.

**Terminada cuando:** el motor genera los 3 casos de referencia y el entrenador los valida deportivamente; los 10 invariantes tienen su test; la generación tarda menos de 2 s.

> Es la etapa de mayor riesgo y mayor valor. Que sea código puro y testeable es precisamente lo que la hace abordable.

### ETAPA 4 — "Que el plan se guarde bien" · TASK-033 a TASK-035 · ~2 semanas

Migraciones de estructura, `SesionPlanificada`, `Prescripcion`, migración de datos y servicio de planificación con regeneración parcial.

**Terminada cuando:** regenerar desde la semana 9 deja intactas las semanas 1–8 y todos los overrides; ninguna `MacrocicloSemanaEjercicio` se pierde en la migración.

### ETAPA 5 — "Que se registre lo que pasa" · TASK-036 a TASK-038 · ~1 semana

Tablas de ejecución, servicio con e1RM y endpoint idempotente.

**Terminada cuando:** una serie registrada produce e1RM correcto y actualiza `RmVigente` solo si mejora el vigente.

> A partir de aquí el sistema tiene, por primera vez, el ciclo completo cerrado.

### ETAPA 6 — "Que se pueda usar" · TASK-039 a TASK-044 · ~3 semanas

Generador, vista del plan, sesión del atleta, división del wizard, editor de excepciones, lista y ficha de atletas.

**Terminada cuando:** se cumple la prueba de los 15 minutos (§11.3) y la de los 2 minutos por sesión (AC-24).

### ETAPA 7 — "Que se entienda" · TASK-045, TASK-046 · ~1 semana

Análisis, planificado vs realizado, evolución del RM, `MedidaCorporal`.

**Terminada cuando:** el entrenador puede responder "¿cómo va la temporada?" sin salir de la aplicación.

### ETAPA 8 — "Que se ajuste solo (pero pidiendo permiso)" · TASK-047 a TASK-052 · ~2 semanas

Reglas de progresión, deload, `AjustePropuesto`, pantalla de ajustes, retirada del sistema de fases paralelo, alerta de reevaluación por ejercicio.

**Terminada cuando:** ninguna propuesta se aplica sin aceptación humana y toda propuesta muestra su evidencia.

### ETAPA 9 — "Que esté probado" · TASK-053, TASK-054 · ~2 semanas

Índice de fuerza corregido, suite e2e, los 20 casos extremos del §16.4.

**Terminada cuando:** `lib/**` supera el 90% de cobertura de ramas y los 4 flujos e2e pasan.

### ETAPA 10 — "Que quede limpio y documentado" · TASK-055, TASK-056 · ~1 semana

Retirada de campos y componentes deprecados, `docs/DECISIONES.md`, actualización de `CLAUDE.md` y `AGENTS.md`, validación deportiva final.

**Terminada cuando:** los 30 criterios de aceptación del §17 se cumplen y las 25 decisiones del §18 están documentadas.

---

### Resumen de secuencia

```
Semana  1     ETAPA 1   Correcciones críticas          ← empezar aquí, hoy
Semanas 2-3   ETAPA 2   Datos con significado          ← resuelve la retroactividad
Semanas 4-6   ETAPA 3   Motor de planificación         ← mayor riesgo y mayor valor
Semanas 7-8   ETAPA 4   Persistencia del plan
Semana  9     ETAPA 5   Ejecución                      ← se cierra el ciclo
Semanas 10-12 ETAPA 6   Interfaz del entrenador
Semana  13    ETAPA 7   Análisis
Semanas 14-15 ETAPA 8   Autorregulación
Semanas 16-17 ETAPA 9   Testing
Semana  18    ETAPA 10  Limpieza y documentación
```

### Los tres puntos de decisión que no se pueden posponer

1. **Antes de la Etapa 3:** ¿se recalibran los coeficientes de masa corporal del test (Q-03) y qué ejercicios entran en el catálogo (Q-05)? Sin esto, el motor se construye sobre una base cuestionable.
2. **Antes de la Etapa 4:** ¿es correcta la granularidad de `SesionPlanificada`? Es la decisión de modelado más cara de revertir.
3. **Antes de la Etapa 6:** ¿quién registra el entrenamiento, el atleta o el entrenador (Q-02)? Determina el diseño de la pantalla más usada del producto.

### Y si solo hubiera tiempo para una cosa

**La Etapa 1.** Corrige defectos que ahora mismo están produciendo datos incorrectos y destruyendo trabajo del entrenador, no cuesta más de una semana, y no requiere ninguna decisión previa.
