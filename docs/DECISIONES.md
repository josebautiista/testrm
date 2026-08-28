# Registro de decisiones (ADR) — APP_TEST_DE_RM

> Formato fijo por decisión: **Contexto → Decisión → Consecuencias → Fecha → Estado**.
> Este archivo se referencia desde `CLAUDE.md` y `AGENTS.md`: cualquier persona o agente
> que toque el dominio (RM, planificación, progresión) debe leerlo antes de cambiar una
> constante o una regla. Ver `docs/PLAN-MAESTRO.md` §18 para el índice original de ADRs
> pendientes.

---

## ADR-01 · Fórmula primaria para estimar 1RM: Epley

**Contexto.** El sistema calculaba 8 fórmulas y usaba `Math.max()` entre ellas como el
"1RM estimado" (D-02), lo que sesga sistemáticamente al alza — un estimador no puede ser
el máximo de un conjunto de estimadores.

**Decisión.** Epley (`1RM = carga × (1 + 0.0333 × r)`) es la fórmula primaria
(`lib/rm/formulas.ts calculateEpley`, usada en `lib/rm/estimacion.ts estimarRm`). Es
lineal, sin singularidades (a diferencia de Brzycki y Lander, que se anulan cerca de 37
repeticiones), coincide con Brzycki alrededor de las 10 repeticiones, y se extiende con
naturalidad a la variante con RIR (F-03, ADR-consecuente para e1RM de entrenamiento). Ya
estaba implementada y en producción antes de este cambio.

**Consecuencias.** Todo `rm1Estimado`/`ResultadoRm`/`RmVigente.origen=estimacion` usa
Epley. Las otras 7 fórmulas se conservan como referencia (banda de incertidumbre, ver
ADR-02), no como candidatas a estimador puntual.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-02 · Por qué no se usa `max()` entre fórmulas, y qué significa la banda

**Contexto.** D-02.

**Decisión.** Las 8 fórmulas se calculan siempre, pero se reportan como
`{ min, max }` (F-02, `getMinFormulaRM`/`getMaxFormulaRM` en `lib/rm/formulas.ts`) junto
al valor puntual de Epley. La banda es la **dispersión entre modelos**, no un intervalo de
confianza estadístico — debe presentarse así en la interfaz (`app/sesion/[id]/page.tsx`
ya lo hace: "Banda de incertidumbre").

**Consecuencias.** Ninguna decisión de prescripción (carga, clasificación de nivel) se
basa en el máximo de la banda. El backfill histórico (`prisma/backfill-resultados.ts`)
recalcula esta banda desde `carga`/`repeticiones` ya guardados, sin reinterpretar el
valor viejo.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-03 · Ventana válida de repeticiones (3–10) y qué pasa fuera de ella

**Contexto.** D-04: las fórmulas de Brzycki y Lander tienen singularidades cerca de
r≈37 y r≈38 respectivamente; el protocolo de carga por % de masa corporal empuja a
repeticiones altas, justo donde las fórmulas dejan de ser válidas.

**Decisión** (`lib/rm/estimacion.ts`):
- `REPETICIONES_VENTANA_VALIDA = [1, 10]` — dentro de esta ventana, confianza media o
  alta según RIR.
- `r > 10` → `fueraDeRango = true`, confianza `baja`, pero se sigue calculando un valor
  (D-04 no exige descartarlo, solo advertir).
- `r > REPETICIONES_LIMITE_UTILIZABLE (15)` → `noUtilizable = true`: no debe usarse para
  prescribir.
- `r >= REPETICIONES_BLOQUEO_DURO (30)` → bloqueo duro, valor = 0. Evita que Brzycki/Lander
  crucen su singularidad y devuelvan negativos.

**Consecuencias.** `AC-06` y `AC-07` (ningún 1RM se estima fuera de rango sin marcarlo;
ninguna fórmula produce negativos/infinitos/cero por reps altas) se cumplen por
construcción — cubierto por `lib/rm/formulas.test.ts` y `lib/rm/estimacion.test.ts`
(casos r=36,37,38,40).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-04 · Significado operativo del RIR y su escala

**Contexto.** El sistema necesita autorregular la carga entre evaluaciones (R-07, R-13).

**Decisión.** RIR (*Repetitions In Reserve*) es el número de repeticiones que el atleta
reporta que le quedaban en el tanque al terminar una serie, en una escala entera de 0
(fallo) a ~5. Se usa en tres puntos: `rirObjetivo` en cada `Prescripcion` (lo que el
motor espera), `rir` reportado en `SerieRealizada` (lo que ocurrió), y como input de e1RM
(F-03, `estimarE1rmConRir`).

**Consecuencias.** La escala no está calibrada por atleta — ADR-19 documenta que es menos
fiable en principiantes. `AJUSTE_UMBRALES.subirCargaRirPorEncimaDelObjetivo = 2` usa esta
escala para decidir cuándo proponer subir carga (R-13).

**Fecha.** 2026-08-27. **Estado.** Implementado (motor); calibración por experiencia del
atleta queda pendiente (mismo hueco que ADR-19).

---

## ADR-05 · RPE de sesión vs. RIR — por qué se registran aparte

**Contexto.** `SesionRealizada.rpeSesion` (RPE, 0–10, percepción global de la sesión) es
distinto de `SerieRealizada.rir` (por serie, por ejercicio).

**Decisión.** RIR mide el margen de una serie concreta; RPE de sesión mide la fatiga
acumulada del entrenamiento completo, y es el insumo del criterio reactivo de deload
(R-10: "RPE de sesión ≥ 9 en tres sesiones seguidas", `lib/progresion/deload.ts`). No son
intercambiables: una sesión puede tener series con buen RIR y aun así un RPE de sesión
alto por volumen o densidad.

**Consecuencias.** Ambos se registran siempre que estén disponibles; ninguno sustituye al
otro en las reglas de autorregulación.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-06 · Cómo se determina la intensidad: %1RM + RIR, y cuál manda en conflicto

**Contexto.** R-07: "el %1RM se calcula sobre un test pasado; el RIR se mide hoy."

**Decisión.** Toda `Prescripcion` con carga lleva `porcentajeRm` (derivado del
`RmVigente` al momento de generar el plan) y `rirObjetivo`. Si en ejecución el RIR real
diverge sistemáticamente del objetivo, manda el RIR — eso es exactamente lo que dispara
las propuestas de `lib/progresion/reglas.ts` (R-13): dos sesiones con RIR ≥2 por encima
del objetivo proponen subir carga; dos sin alcanzar `repsMin` proponen bajarla. El ajuste
nunca se aplica solo (AC-20): crea un `AjustePropuesto` que el entrenador acepta o
rechaza (`services/progresion.service.ts`).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-07 · Cómo se determina el volumen: series efectivas por patrón, no tonelaje

**Contexto.** R-03/F-05/F-06.

**Decisión.** `RANGOS_VOLUMEN` (`lib/config/parametros.ts`) define series por semana por
`objetivoBloque` (p.ej. hipertrofia 10–20, fuerza 6–12), no tonelaje. El tonelaje
(`Prescripcion.tonelaje`, F-05) se calcula y se guarda, pero solo como referencia
comparativa dentro de un mismo tipo de bloque — nunca decide el volumen prescrito.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-08 · Por qué el tonelaje se conserva pero no es la métrica principal

**Contexto.** F-05: tonelaje confunde `3×10×50` con `10×3×50` y penaliza el trabajo de
alta intensidad (pocas series pesadas dan tonelaje bajo aunque el estímulo sea alto).

**Decisión.** Se conserva (`MacrocicloSemana.volumen`, derivado de las prescripciones —
corrige D-11, que lo dejaba en 0 como entrada manual) porque es el lenguaje del marco
académico del proyecto (cubano-soviético, ver ADR-23) y sirve para comparar semanas del
mismo tipo dentro de un bloque. No es la métrica que decide el volumen (eso lo hace
ADR-07).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-09 · Reglas de progresión intra e inter mesociclo

**Contexto.** R-08/R-09.

**Decisión.**
- **Intra-mesociclo** (`lib/planificacion/prescripcion.ts`): bloques
  `lineal_intensidad` suben %1RM semana a semana con las series ancladas al mínimo del
  rango; bloques `lineal_volumen` hacen lo inverso; `ondulante` alterna por paridad de
  semana; `mantenimiento` (deload) usa siempre el mínimo. Nunca suben volumen e
  intensidad la misma semana — verificado en `lib/planificacion/prescripcion.test.ts`.
- **Inter-mesociclo**: cada mesociclo reancla su carga al `RmVigente` vigente **a la
  fecha de generación** del plan (no al RM del macrociclo original) — es lo que hace que
  el caso "RM 100→110 kg" no reescriba semanas ya publicadas (`lib/planificacion/motor.ts`
  + `services/rm.service.ts`, regresión cubierta en
  `services/rm.service.test.ts` y `lib/planificacion/motor.test.ts`).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-10 · Reglas de deload, programado y reactivo

**Contexto.** R-10.

**Decisión.**
- **Programado** (`lib/planificacion/estructura.ts asignarMicrociclos`): cada
  `DELOAD.frecuenciaSemanasEstandar` (4) semanas, o cada
  `DELOAD.frecuenciaSemanasAvanzado` (3) para nivel avanzado — contador global sobre
  todo el macrociclo, no por mesociclo. Además, un microciclo "choque" nunca se repite
  dos semanas seguidas (R-16 #10): la segunda se convierte automáticamente en descarga.
- **Reactivo** (`lib/progresion/deload.ts evaluarDeloadReactivo`): requiere ≥2 de 4
  criterios (caída de e1RM >5% en dos sesiones, RIR sistemáticamente ≥2 por debajo del
  objetivo, ≥2 sesiones omitidas por fatiga, RPE de sesión ≥9 en tres sesiones seguidas).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-11 · Cuándo se actualiza el RM y cuándo caduca (12 y 24 semanas)

**Contexto.** R-15.

**Decisión** (`lib/rm/vigente.ts`):
- Una evaluación (test) siempre reemplaza el `RmVigente` (`actualizarRmVigente`, sin
  condición).
- Una serie de entrenamiento (e1RM) solo lo reemplaza si lo **supera**
  (`actualizarRmVigenteSiSupera`) — un entrenamiento no debe poder *bajar* el RM
  registrado, solo confirmarlo o mejorarlo.
- `> 12` semanas desde `validoDesde` → `caducado = true`, aviso de reevaluación, el
  motor lo sigue usando.
- `> 24` semanas → además `confianzaEfectiva = "baja"`, señalado en el plan
  (`lib/planificacion/motor.ts` avisos).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-12 · Cómo se manejan los ejercicios sin RM

**Contexto.** R-06.

**Decisión.** Si un ejercicio seleccionado no tiene `RmVigente` (o `admitePorcentajeRm
= false`, p.ej. `esDeTiempo`), se prescribe por `repsMin`/`repsMax`/`rirObjetivo` sin
`cargaKg` (`lib/planificacion/prescripcion.ts calcularPrescripcion`). El motor genera un
aviso explícito (E-09) en vez de fallar o inventar una carga.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-13 · Por qué el RM nunca se extrapola entre ejercicios

**Contexto.** D-01, el defecto más grave de la auditoría original: `Sesion.finalRM` se
calculaba como `Math.max()` entre el RM de ejercicios *distintos* (prensa de pierna
siempre dominaba sobre press de banca), y ese escalar se usaba para clasificar nivel y
sugerir peso para cualquier objetivo.

**Decisión.** El RM vive exclusivamente por (persona, ejercicio) en `RmVigente`. No
existe ningún mecanismo en el dominio que derive el RM de un ejercicio a partir del de
otro. `Sesion.finalRM`/`estimatedRM` a nivel de sesión solo se pueblan cuando son
inequívocos (un único ejercicio evaluado, o un protocolo Casas/Nacleiro sobre un
ejercicio de referencia) — nunca como máximo entre ejercicios distintos
(`actions/sesion.ts`).

**Consecuencias.** `AC-09` y `AC-11` se cumplen por construcción. La correlación de 1RM
entre patrones de movimiento distintos es demasiado débil para ser una base de
prescripción segura.

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-14 · Principio de inmutabilidad histórica y sus tres mecanismos

**Contexto.** §4.1 del plan: "un dato que ya fue usado para decidir algo no puede cambiar
de valor retroactivamente."

**Decisión.** Tres mecanismos, todos implementados:
1. **Copia con linaje.** Toda `Prescripcion` con carga guarda `rmUsadoKg` **y**
   `rmVigenteId` (`lib/planificacion/prescripcion.ts`, invariante R-16 #9, verificado en
   `lib/planificacion/validacion.ts`).
2. **Append-only con vigencia.** `RmVigente` nunca hace `UPDATE` del valor: cierra la fila
   (`validoHasta`) y abre otra (`services/rm.service.ts actualizarRmVigente`).
3. **Versionado con supersede.** `Prescripcion` publicada es inmutable; un ajuste crea
   `version + 1` y encadena `supersededById`, nunca reescribe la fila anterior
   (`services/planificacion.service.ts publicarPlan`, `services/progresion.service.ts
   aceptarAjustePropuesto`).

**Fecha.** 2026-08-27. **Estado.** Implementado y cubierto por pruebas de regresión
(`services/rm.service.test.ts`, `services/planificacion.service.test.ts`,
`services/progresion.service.test.ts`).

---

## ADR-15 · Cuándo un valor es override del entrenador y qué implica

**Contexto.** R-12.

**Decisión.** Una `Prescripcion` con `origen = "ajustado_entrenador"` (o
`"autorregulado"`, tras aceptar un `AjustePropuesto`) queda **anclada**:
`services/planificacion.service.ts publicarPlan` la salta explícitamente en cualquier
regeneración futura, sin importar qué calcule el motor para esa semana/ejercicio. Solo
`origen = "generado"` se sobrescribe libremente.

**Fecha.** 2026-08-27. **Estado.** Implementado, cubierto por
`services/planificacion.service.test.ts` (caso "respeta un override existente").

---

## ADR-16 · Origen de `porcentajeMasaHombre/Mujer` — sin fuente documentada

**Contexto.** Estos coeficientes fijan la carga de calibración del test de estimación
submáxima. Determinan la calidad de todas las estimaciones derivadas.

**Estado.** **Sin resolver.** No hay ninguna referencia bibliográfica en el código ni en
la documentación previa que los origine. Es la dependencia científica más crítica del
proyecto (§19.2 del plan). Pendiente de que el entrenador aporte la fuente o los declare
como convención propia — no se ha recalibrado ni inventado una fuente en este trabajo.

---

## ADR-17 · Origen del protocolo Casas (porcentajes y descansos)

**Contexto.** `app/nueva-sesion/CasasProtocol.tsx` codifica 11 pasos con porcentajes
(40%→115.8%) y descansos específicos.

**Estado.** **Sin resolver** en cuanto al origen: los porcentajes y descansos siguen sin
fuente documentada. Se corrigieron los defectos funcionales (D-05: no se puede cerrar el
protocolo sin pesos reales; H-07: hace falta marcar el levantamiento como completado) y
la estructura se ajustó a las pautas de la NSCA en número de intentos y techo de carga
(ver **ADR-32**).

---

## ADR-18 · Origen del protocolo Nacleiro y de la fórmula KIES

**Contexto.** `lib/nacleiro.ts calculateInitialWeight`/`calculateKIES`.

**Estado.** **Cerrado por ADR-31.** La fórmula KIES y `calculateInitialWeight` nunca
tuvieron fuente porque no correspondían a ningún protocolo publicado: el test real de
Naclerio son 8±2 series de 2–3 repeticiones con máxima aceleración y OMNI-RES. Se
eliminó `lib/nacleiro.ts` y se implementó el protocolo original.

---

## ADR-19 · Umbrales del índice de fuerza y su normalización

**Contexto.** D-18: `calculateStrengthIndex` sumaba valores por bandas de repeticiones
con umbrales fijos que asumían implícitamente 6 ejercicios evaluados.

**Estado.** **Pendiente** (F-12, TASK-053, no abordado en esta sesión — quedó en la
Etapa 9 del plan, "Consolidación de pruebas", fuera del alcance de las Etapas 1–8
completadas aquí). La corrección propuesta por el plan (normalizar por
`n_ejercicios × valor_máximo` a una escala 0–100) sigue sin implementar.

---

## ADR-20 · Umbrales de nivel (relación fuerza/peso) y su limitación

**Contexto.** `lib/user-level.ts getUserLevel`: `< 0.8` principiante, `≤ 1.2`
intermedio, resto avanzado (relación RM/masa corporal).

**Decisión.** Se conserva la función tal cual (es correcta como utilidad genérica), pero
se corrigió **quién la alimenta** (D-01): ya no recibe el máximo entre ejercicios
distintos, solo un RM inequívoco (ejercicio único o protocolo de referencia) o `0`
(clasifica como "beginner" por defecto, valor conservador).

**Limitación.** Los umbrales 0.8/1.2 no tienen fuente bibliográfica citada; es una
convención del proyecto anterior a esta auditoría, no revisada aquí.

**Fecha.** 2026-08-27. **Estado.** Consumidores corregidos; umbrales sin auditar.

---

## ADR-21 · Por qué se descartan ACWR y el modelo fitness-fatiga

**Contexto.** F-13.

**Decisión.** No se implementan. ACWR (razón carga aguda/crónica) tiene cuestionamientos
metodológicos serios documentados en la literatura reciente (problemas de correlación
espuria y de definición de ventanas). El modelo fitness-fatiga (Banister/TRIMP) requiere
una densidad y regularidad de datos que este producto no tendrá con uso real de gimnasio.

**Fecha.** 2026-08-27. **Estado.** Decisión de alcance, no revisitada en este trabajo.

---

## ADR-22 · Diferenciación por sexo: no existe

**Contexto.** D-03: `calculateRMFemenino` reimplementaba exactamente los mismos
coeficientes que la rama masculina bajo otro nombre — el parámetro `sexo` no cambiaba
ningún resultado.

**Decisión.** Se eliminó la rama duplicada (`lib/rm/formulas.ts calculateRM` ignora
`sexo` para el cálculo, lo acepta solo por compatibilidad de firma). Las mujeres suelen
completar más repeticiones a un mismo %1RM, sobre todo en tren inferior, pero esa
diferencia **no está modelada** — documentarlo como "no existe" es más honesto que
mantener un código que aparenta diferenciar sin hacerlo.

**Qué haría falta.** Nada por el lado del sexo: **ADR-35** documenta que la evidencia
(Nuzzo 2024) encuentra poca o ninguna influencia del sexo, la edad o el nivel, y que el
moderador real es el **ejercicio**. El hueco pendiente se redefine allí.

**Fecha.** 2026-08-27. **Estado.** Implementado (unificación); diferenciación real
pendiente de investigación.

---

## ADR-23 · Vocabulario de periodización adoptado y su escuela de origen

**Contexto.** El proyecto usa `entrante/desarrollador/desarrollador_especifico/
estabilizador/precompetitivo/choque/aproximacion/competencia` para mesociclos, y
`evaluacion/corriente/competitivo/precompetitivo/choque/recuperacion/aproximacion` para
microciclos.

**Decisión.** Se conserva: es el marco de periodización de escuela cubano-soviética
(Matveyev/Forteza), marco académico declarado del proyecto (§0.4 A2 del plan). El motor
nuevo (`lib/planificacion/plantillas.ts`) mapea cada tipo de mesociclo a un
`objetivoBloque` computacional (fuerza_maxima, hipertrofia, etc.) para que el vocabulario
académico y el motor convivan sin duplicar significado:
`OBJETIVO_BLOQUE_POR_MESOCICLO` y `MICROCICLO_BASE_POR_MESOCICLO`
(`lib/planificacion/plantillas.ts`, `lib/planificacion/estructura.ts`).

**Fecha.** 2026-08-27. **Estado.** Implementado.

---

## ADR-24 · Relación entre las "direcciones" en minutos y la prescripción en kg

**Contexto.** D-13: `MesocicloCarga` reparte minutos entre "direcciones" (físico,
táctico, técnico, psicológico) — un modelo de planificación de deportes de conjunto — sin
relación con `MacrocicloSemana` (kg) ni con el motor nuevo (`lib/planificacion/**`).

**Estado.** **Sin resolver.** `MesocicloCarga` se conserva como vista avanzada opcional
(§9.5 del plan), pero el motor nuevo no la lee ni la alimenta. Sigue siendo un tercer
sistema de carga desconectado — no se intentó conectarlo en este trabajo porque el plan
mismo lo marca como decisión abierta (Q-04: "¿se conservan las direcciones en minutos o
se simplifican?").

---

## ADR-25 · Modelo de autorización y su resolución (D-19, Q-06)

**Contexto.** Hasta esta sesión, `middleware.ts` solo protegía `/admin/**`; el resto del
flujo de persona viajaba como `?cc=` en la URL sin autenticación — conocer una cédula
daba acceso completo de lectura y escritura a datos de salud de terceros.

**Decisión.** El producto es operado por el entrenador (A1 del plan, confirmado
explícitamente: "el que registra el entrenamiento es el entrenador"). Se reutilizó el
sistema JWT ya existente (`lib/auth.ts`, cookie `auth_token`, `jose`/HS256) — antes
exclusivo de `/admin/**` — para proteger **toda la aplicación**. `middleware.ts` ahora
excluye solo `/login`, `/api/auth/**` y `/api/logout`; todo lo demás exige la misma
sesión.

**Consecuencias.** `?cc=` sigue siendo el mecanismo para que el entrenador *seleccione*
qué atleta está viendo (no es un secreto de acceso), pero ya no basta por sí solo:
primero hace falta la sesión. Verificado end-to-end (middleware redirige a `/login` sin
sesión; tras login, acceso concedido).

**Fecha.** 2026-08-27. **Estado.** Implementado. **Superado en parte por ADR-26** (ver
abajo): `User` sí terminó ganando un rol distintivo — la afirmación de este ADR de "un
solo tipo de cuenta" quedó obsoleta.

---

## ADR-26 · Roles admin/entrenador sobre `User`; atleta sigue sin cuenta propia

**Contexto.** El pedido explícito fue: solo un admin puede crear cuentas de entrenador,
y un entrenador puede registrar atletas. `Persona` (el atleta) nunca tuvo contraseña ni
inició sesión — es un registro que el entrenador consulta por cédula (ver "Persona" en
`CLAUDE.md`); confirmado con el usuario que eso se mantiene así (no se agrega login para
el atleta en este trabajo).

**Decisión.** Se añadió `User.role` (`"admin" | "entrenador"`, default `"entrenador"`,
migración `20260827131650_user_role`) en vez de una tabla de roles/permission separada —
solo hay dos valores y ninguna cuenta pertenece a más de uno. El JWT (`lib/auth.ts`)
ahora incluye `role` como claim firmado; `verifyAuthToken` lo valida contra `isRole()` y
descarta el token si el valor no es uno de los dos conocidos. `requireRole()` queda
disponible para Server Actions que necesiten restringir por rol.
Aplicado en: `POST/GET/PUT/DELETE /api/users` (403 si `role !== "admin"`), y
`middleware.ts` redirige `/admin/usuarios/**` a `/admin` si el rol no es admin (el resto
de `/admin/**` — personas, sesiones, macrociclos, ejercicios — sigue abierto a cualquier
entrenador, sin cambios). El nav admin (`AdminNav`) oculta el enlace "Usuarios" para
quien no es admin. No se agregó una comprobación de rol en `createPersonaAction`
(registro de atletas): como *todo* usuario autenticado ya es admin o entrenador por
construcción (no existe ningún otro rol que pueda iniciar sesión), esa comprobación
sería código muerto hoy — se documenta aquí para que quien introduzca un futuro rol
adicional sepa que debe añadirla entonces.

**Consecuencias.** El usuario "admin" sembrado (`prisma/seed.ts`, `lib/bootstrap.ts`) se
marca explícitamente `role: "admin"`; cualquier cuenta creada antes de esta migración
quedó en el default `"entrenador"` y se corrigió manualmente para `username: "admin"`.
Q-01 (¿multi-entrenador?) sigue sin resolver — puede haber múltiples cuentas
`role: "entrenador"`, pero no hay aislamiento de datos entre ellas (cualquier entrenador
ve todos los atletas), que es lo que esa pregunta realmente plantea.

**Fecha.** 2026-08-27. **Estado.** Implementado. Cobertura: `e2e/roles.spec.ts`.

---

## ADR-27 · El RIR reportado corrige la estimación puntual

**Contexto.** `estimarRm` aceptaba `rirReportado` pero solo lo usaba para resolver la
confianza: el valor de Epley se calculaba con las repeticiones *reportadas*. Además, el
formulario de evaluación nunca pedía el RIR, así que la rama `confianza = "alta"` (que
exige `reps <= 5 && rir <= 1`) era inalcanzable y el techo real del sistema era `"media"`.

**Decisión.** Las fórmulas predictivas modelan repeticiones **hasta el fallo**. Si el
atleta reporta RIR, las repeticiones efectivas son `repeticiones + rir` y ese es el valor
que entra a Epley y a la banda. `fueraDeRango` y `noUtilizable` también se resuelven
sobre las efectivas — una serie de 8 con 4 en reserva son 12 efectivas, y eso está fuera
de la ventana de validez aunque "8" no lo estuviera.

La **confianza**, en cambio, se sigue resolviendo sobre las repeticiones reportadas:
describe la calidad del dato que entregó el atleta, no la aritmética de la fórmula.

`app/nueva-sesion/EstimacionEjercicios.tsx` pide el RIR por ejercicio con una escala 0–4
y lo persiste en `ResultadoEjercicio.rirReportado` (la columna ya existía sin uso).

**Consecuencias.** Sin esta corrección Epley subestimaba sistemáticamente el 1RM de toda
serie que no llegó al fallo — el caso normal en un atleta prudente. Por encima de 4 no se
ofrece opción: la autopercepción de RIR pierde fiabilidad lejos del fallo.

**Fuente.** El error medio al reportar RIR en sujetos entrenados al 75 % del 1RM es de
0,65 ± 0,78 repeticiones, suficiente para corregir una estimación; empeora con cargas
ligeras y lejos del fallo.

**Fecha.** 2026-08-27. **Estado.** Implementado. Cobertura: `lib/rm/estimacion.test.ts`.

---

## ADR-28 · Ventana de precisión [3,8] y test adaptativo

**Contexto.** El flujo de estimación cargaba un porcentaje de la masa corporal y pedía
"la mayor cantidad de repeticiones". En un principiante eso son 15, 20 o 30 repeticiones
— exactamente la zona que ADR-03 marca `fueraDeRango` y luego `noUtilizable`. El sistema
estaba construido para generar estimaciones malas y después etiquetarlas como malas.

**Decisión.** Se añade `VENTANA_OPTIMA_TEST = [3, 8]`, distinta de la ventana de validez
`[1, 10]` de ADR-03: aquella dice si el número se puede guardar, esta dice si el intento
merece repetirse. `sugerirAjusteCarga()` invierte Epley hacia
`REPETICIONES_OBJETIVO_TEST = 5`, **acota el salto a la banda NSCA** del tren
correspondiente (5–10 % superior, 10–20 % inferior) y redondea al
`Ejercicio.incrementoMinimoKg` real del equipo.

La interfaz muestra el ajuste en vivo y ofrece un botón que aplica la carga sugerida y
arranca el descanso de 2–3 minutos. Un intento fuera de ventana **se puede guardar**: se
registra marcado como poco fiable y no reemplaza el `RmVigente`.

**Consecuencias.** El test deja de ser de un solo intento y pasa a ser iterativo, que es
como lo describe la NSCA (1RM alcanzado en 3–7 intentos).

**Fuente.** Reynolds, Gordon & Robergs (2006), JSCR: el 5RM predice el 1RM con R² 0,974–0,915,
mejor que 10RM y 20RM. La precisión cae ≈1,5 % por repetición por encima de 8.

**Fecha.** 2026-08-27. **Estado.** Implementado. Cobertura: `lib/rm/estimacion.test.ts`.

---

## ADR-29 · Cambio mínimo detectable antes de reemplazar un RM

**Contexto.** ADR-11 establece que una evaluación *siempre* reemplaza el `RmVigente`. Con
un CV test–retest mediano de 4,2 %, una diferencia menor a ~11,6 % entre dos tests es
indistinguible del error de medición: un mal día baja el RM registrado y con él toda la
prescripción de las semanas siguientes.

**Decisión.** No se cambia la regla de ADR-11 (la evaluación sigue mandando), pero se
expone el contexto: `compararConRmVigente()` calcula el delta contra el vigente y lo
contrasta con `CAMBIO_MINIMO_DETECTABLE = 1,96 · √2 · CV ≈ 11,6 %`. Los protocolos
directos muestran ese aviso en vivo antes de guardar, para que entrenador y atleta
decidan con el dato delante en vez de aceptar el número en silencio.

**Qué falta.** Calibrar el CV por atleta en vez de usar el mediano de la literatura, y
pedir confirmación explícita del entrenador cuando un test baje el RM por encima del
umbral. Queda como mejora, no como bloqueo.

**Fuente.** Grgic et al. (2020), *Sports Medicine – Open*, revisión sistemática de 32
estudios (n = 1595): ICC mediano 0,97; CV mediano 4,2 %.

**Fecha.** 2026-08-27. **Estado.** Implementado (aviso); calibración por atleta pendiente.

---

## ADR-30 · Un protocolo directo produce un `ResultadoEjercicio` y un RM medido

**Contexto.** Dos defectos encadenados:

1. El bucle que abre `RmVigente` en `actions/sesion.ts` recorre los resultados de la
   sesión. En un protocolo directo el formulario no emitía `ejercicioIds`, así que no
   había resultados y **el bucle no iteraba**: el RM medido por el método más preciso
   moría en `Sesion.finalRM` y la planificación seguía usando la estimación. Además
   `origen` estaba fijado a `"estimacion"`.
2. `NacleiroTable` derivaba el RM del `targetWeight` (peso *teórico*) del último grupo
   con repeticiones > 0. Los dos grupos finales valían 107,7 % y 115,8 % del RM tecleado
   a mano: escribir "1" registraba un RM un 15,8 % superior sin que nadie levantara nada.
   Es el mismo D-05 que se corrigió en Casas y quedó abierto aquí.

**Decisión.**
- Un protocolo directo exige elegir un `Ejercicio` del catálogo (antes era texto libre),
  y genera un `ResultadoEjercicio` con `confianza: "alta"`, `formulaPrimaria:
  "medicion_directa"` cuando el mejor intento fue de 1 repetición, y `RmVigente` con
  `origen: "test_directo"`.
- `resolverRmMedido()` (`lib/rm/protocolo.ts`) es la **única** fuente del RM de un
  protocolo: el peso más alto entre los pasos con `pesoReal > 0`, `repsReales > 0` y
  `completado === true`. Ni un peso objetivo, ni un intento fallido, ni una fila sin
  marcar pueden convertirse en el RM de nadie.
- Se añade la casilla explícita "completé el levantamiento con técnica válida" (H-07):
  antes Casas tomaba `max()` de los pesos registrados sin saber si el intento salió.

**Consecuencias.** `Sesion.estimatedRM` guarda ahora el RM de referencia con el que se
armaron los pesos y `Sesion.finalRM` el realmente levantado; la diferencia entre ambos
indica si la referencia estaba bien calibrada.

**Fecha.** 2026-08-27. **Estado.** Implementado. Cobertura: `lib/rm/protocolo.test.ts`.

---

## ADR-31 · Naclerio: grafía correcta y protocolo real — cierra ADR-18

**Contexto.** ADR-18 quedó "sin resolver": `lib/nacleiro.ts` implementaba un peso inicial
derivado de la fuerza relativa (`rel <= 1 → 0,3·RM`; `< 3 → 0,3·RM·rel`; si no
`0,666·RM`), una progresión lineal "KIES", y a continuación los mismos escalones
102,5 %→115,8 % de Casas. Ninguna fuente respalda eso, y el apellido estaba mal escrito.

**Decisión.** El autor es Fernando **Naclerio**. Su test progresivo (Naclerio & Figueroa,
2004) es: **8 ± 2 series de 2–3 repeticiones ejecutadas con máxima aceleración**, pausas
de 2 a 5 minutos, y RPE **OMNI-RES 0–10** registrado al final de cada serie; series 1–2 al
35–50 %, 3–4 al 55–65 %, 5–6 al 70–80 %, 7–8 al 85–95/100 %.

`PASOS_NACLERIO` en `lib/rm/protocolo.ts` implementa exactamente eso. Se eliminan
`lib/nacleiro.ts` (`calculateInitialWeight`, `calculateKIES`, `generateSeries`) y
`app/nueva-sesion/NacleiroTable.tsx`.

**Compatibilidad.** La columna `ResultadoEjercicio.nacleiro` y el valor
`Sesion.rmMethod = "nacleiro"` de sesiones históricas **no se migran**: se siguen
aceptando al leer y se muestran como "Test de Naclerio", pero el valor que se escribe
desde ahora es `"naclerio"`. Evitar una migración de datos por una falta de ortografía es
deliberado; el mapeo vive en `parseRMMethod` y `getMethodLabel`.

**Fecha.** 2026-08-27. **Estado.** Implementado. **Cierra ADR-18.**

---

## ADR-32 · Intentos máximos: 8±2 de Naclerio, 3–7 de la NSCA

**Contexto.** El Casas anterior tenía 11 pasos, 7 de ellos ≥ 95 %, con escalones
compuestos hasta el 115,8 % calculados sobre un RM teórico. La NSCA espera que el 1RM se
alcance en 3–7 intentos; más allá, la fatiga hace que el test mida cansancio.

**Decisión.**
- Casas se reduce a 7 pasos (4 aproximaciones + 3 intentos máximos), sin pasos por encima
  del 105 % del RM de referencia.
- Los intentos extra (`construirIntentosExtra`, máximo 2 — el "± 2" de Naclerio) suben el
  **incremento real del equipo** (`Ejercicio.incrementoMinimoKg`) sobre el peso realmente
  levantado, no un porcentaje compuesto sobre un número teórico. Solo aparecen si el
  último paso base salió completado.
- `resolverRmMedido` cuenta los intentos máximos y marca
  `excedeIntentosRecomendados` por encima de 7; la interfaz avisa y pide cerrar.

**Nota sobre ADR-17.** Los porcentajes y descansos de Casas siguen **sin fuente
bibliográfica** — eso no cambia. Lo que sí se corrigió es la estructura (número de
intentos y el techo de carga), que sí tiene respaldo.

**Fecha.** 2026-08-27. **Estado.** Implementado. Cobertura: `lib/rm/protocolo.test.ts`.

---

## ADR-33 · Cribado de seguridad antes de un test máximo

**Contexto.** El único gate hacia Casas/Naclerio era `trainingMonths < 4`, autorreportado
en un campo numérico libre. Además, el texto de la interfaz afirmaba que "los tests de
fuerza máxima requieren experiencia previa para evitar lesiones", que es más fuerte de lo
que la evidencia sostiene: Grgic (2020) muestra que el 1RM es fiable **con o sin**
familiarización, en no entrenados, adolescentes y mayores de 75.

**Decisión.** Se conserva el umbral de 4 meses como política del producto —documentada
como tal, no como afirmación clínica— y se añade un cribado explícito de cinco puntos que
debe confirmarse para habilitar un protocolo máximo: diagnóstico cardiovascular o tensión
no controlada, lesión activa en el patrón, dominio técnico del ejercicio, asistencia o
topes de seguridad, y patrón respiratorio (no Valsalva).

Si el cribado queda incompleto, el **método efectivo** vuelve a estimación sin borrar la
selección del atleta: se bloquea, no se pierde lo elegido.

**Qué falta.** Un PAR-Q completo persistido en `Persona`, en vez de una confirmación por
sesión que no deja rastro.

**Fuente.** Guías de evaluación de 1RM (ACI/NSW) sobre cribado, Valsalva y
contraindicaciones; Grgic et al. (2020) sobre seguridad y fiabilidad.

**Fecha.** 2026-08-27. **Estado.** Implementado (confirmación por sesión).

---

## ADR-34 · Orden de la batería de evaluación y descanso entre ejercicios

**Contexto.** El flujo de estimación listaba *todos* los ejercicios del catálogo en una
pantalla, sin orden prescrito ni descanso entre ellos. Seis series a máximas repeticiones
seguidas invalidan las últimas.

**Decisión.** `ordenarParaEvaluacion()` ordena por masa muscular implicada (sentadilla →
bisagra → empujes/tracciones verticales → horizontales → accesorio → core), y manda los
ejercicios `esDeTiempo` al final: no producen RM y fatigan el core antes de los
multiarticulares. La interfaz explica el orden y ofrece un descanso de 3 minutos entre
ejercicios (NSCA: 3–5 min entre tests de ejercicios distintos).

**Qué falta.** Un tope duro de ejercicios evaluables por sesión. Hoy se explica y se
ofrece el descanso, pero no se impide encadenar los seis.

**Fecha.** 2026-08-27. **Estado.** Implementado (orden y descanso); tope pendiente.

---

## ADR-35 · Diferenciación por ejercicio, no por sexo — matiza ADR-22

**Contexto.** ADR-22 eliminó una rama "femenino" que reimplementaba los mismos
coeficientes, y dejó anotado que faltaba respaldo bibliográfico para reintroducirla.

**Decisión.** Se mantiene: **no** hay diferenciación por sexo. La meta-regresión de Nuzzo
et al. (2024, *Sports Medicine* 54:303–321; 269 estudios, 7.289 sujetos) encontró que
sexo, edad y nivel de entrenamiento influyen poco o nada en la relación reps↔%1RM, y que
el **ejercicio** es el único moderador con efecto real —hasta el punto de requerir tablas
separadas para press de banca y prensa de piernas.

Es decir: el hueco de ADR-22 no era el sexo, era el ejercicio.

**Qué falta (no implementado aquí).** Curvas reps↔%1RM por ejercicio, o adoptar la
ecuación dependiente del peso absoluto optimizada sobre 303.494 series y 388 ejercicios
(`1RM = w · (1 + (r−1)^0,85 / (−2,55 + 4,58·ln w))`, SportRxiv 2026), que reduce la
inconsistencia un 17–22 % frente a Epley/Brzycki y cuya mayor ventaja está en ejercicios
ligeros y accesorios — justo donde esta app aplica hoy la fórmula clásica. Sería un
cambio de estimador primario y por tanto un ADR propio, con backfill y verificación.

Lo que sí se implementó del hallazgo: `resolverTren()` diferencia tren superior e inferior
para los incrementos de carga entre intentos (ADR-28) y para el orden de la batería
(ADR-34).

**Fecha.** 2026-08-27. **Estado.** Decisión de alcance. **Matiza ADR-22.**

---

## ADR-36 · La fase de entrenamiento se deriva del mesociclo activo — cierra D-14

**Contexto.** `Persona.faseEntrenamiento` se escribía en un único punto
(`actions/sesion.ts`): al guardar la primera sesión, si el campo era `null`, se fijaba
literalmente a `"resistencia"` con `faseInicioAt = new Date()`. Ningún otro punto del
código lo volvía a escribir, y `faseInicioAt` no se leía en ninguna parte.

El sistema que sí la movía —`PhaseProgressionBanner` (avance automático a los 60 días),
`avanzarAFuerzaAction` y `updateFaseEntrenamientoAction`— se retiró en TASK-051 porque
D-14 lo identificó como un **cuarto sistema de progresión paralelo** al macrociclo. Pero
se retiró el mecanismo de avance y quedaron la escritura inicial y el lector en la
interfaz. Resultado: *"Tu fase actual es: Resistencia"* era constante para todo atleta,
para siempre, incluso con un macrociclo de fuerza máxima en curso. Y como
`getRecommendedGoalsForPhase("resistencia")` devuelve `["endurance"]`, la tabla de
recomendaciones resaltaba **Resistencia** con el badge "Actual" para todo el mundo.

**Decisión.** `lib/planificacion/fase.ts` (dominio puro) resuelve la fase desde el plan:

- `resolverFaseActiva(mesociclos, fecha)` devuelve el mesociclo del macrociclo abierto
  cuyo rango `[fechaInicio, fechaFin]` contiene la fecha, con su posición en el
  macrociclo y los días que faltan para cerrarlo.
- `FASE_POR_OBJETIVO_BLOQUE` agrupa los siete `objetivoBloque` del motor en las tres
  orientaciones de la interfaz: `fuerza_maxima`/`realizacion`/`potencia` → **fuerza**;
  `hipertrofia`/`acumulacion` → **hipertrofia**; `resistencia_fuerza`/`recuperacion` →
  **resistencia**. `recuperacion` cae en resistencia porque comparte su zona de
  intensidad (50–65 % 1RM en `ZONAS_INTENSIDAD`): un bloque de descarga no se entrena
  como uno de fuerza máxima. Un test verifica que el mapeo sigue siendo coherente con
  esas zonas, para que no se desincronicen.
- `resolverObjetivoBloque()` usa la columna `MacrocicloMesociclo.objetivoBloque` cuando
  existe y, si falta (macrociclos anteriores a C-06/TASK-033, creados con el wizard
  manual), la deriva del `tipo` con `OBJETIVO_BLOQUE_POR_MESOCICLO` — la misma tabla que
  usa el motor de planificación, para no introducir un segundo criterio.
- **Sin bloque vigente hoy devuelve `null`, y eso es información**: la interfaz distingue
  "no tienes macrociclo abierto" de "tu plan no cubre la fecha de hoy", en vez de
  inventar una fase.

`actions/sesion.ts` deja de escribir `faseEntrenamiento`/`faseInicioAt`. Las columnas se
conservan en el esquema (siguen marcadas como deprecadas) pero ya no tienen ni escritores
ni lectores.

**Zona horaria.** Las fronteras de mesociclo son columnas `@db.Date`: Prisma las devuelve
a medianoche **UTC** y representan un día de calendario, no un instante. Compararlas con
componentes locales adelantaba un día entero la frontera en cualquier zona con
desplazamiento negativo (Colombia es UTC-5), con lo que el bloque habría cambiado un día
antes de tiempo. `diaDeFechaPlana()` las lee en UTC; `diaDeInstante()` lee "hoy" en local,
que es el día de calendario que le corresponde al atleta. Cubierto por test.

**Consecuencias en la interfaz.** El indicador deja de ser decorativo y explica su
procedencia: qué mesociclo es, cuál es su objetivo de bloque, en qué posición del
macrociclo está, cuándo termina y que la fase cambiará sola con el siguiente bloque. Si
el macrociclo está en borrador se advierte que las fechas pueden moverse.

**Fecha.** 2026-08-27. **Estado.** Implementado. **Cierra D-14.**
Cobertura: `lib/planificacion/fase.test.ts`.

---

## ADR-37 · Perfil deportivo: un motor para cualquier deporte, y los tres periodos

**Contexto.** El macrociclo no servía para "cualquier atleta de cualquier deporte" por
cuatro razones concretas:

1. `TipoPeriodo` solo tenía `preparatorio | competitivo`. **Faltaba el transitorio**, que
   es el tercer periodo del plan anual estándar en toda la literatura (Matveyev,
   Bompa/Haff). Sin él, terminar un macrociclo era un corte seco.
2. `ORDEN_MESES` era una lista cerrada de 8 mesociclos, siempre los mismos y en el mismo
   orden, con reparto porcentual hardcodeado y una única variante ("salud").
3. La app **no sabía de qué deporte se trataba**: `objetivoTipo` era `salud|competencia`
   y `objetivoDetalle` texto libre que no entraba en ningún cálculo.
4. Periodos y mesociclos eran **dos distribuciones porcentuales independientes** sobre la
   misma línea de tiempo. Nada garantizaba que el bloque "estabilizador" cayera dentro de
   la etapa "específica" a la que pertenece, y el entrenador cuadraba tres conjuntos de
   porcentajes a mano que debían sumar 100 cada uno.

Además, como `distribuirSemanasPorMayorResto` solo garantizaba 1 semana por bloque, un
macrociclo de 8 semanas generaba **8 bloques de 1 semana**.

**Decisión — no se pregunta el deporte por su nombre.** Hay cientos, no escala, y el
nombre no es computable. Se piden **tres descriptores** (`lib/planificacion/perfil.ts`),
que son el *needs analysis* de la NSCA reducido a lo que realmente cambia el plan:

| Descriptor | Valores | Qué decide |
|---|---|---|
| `capacidadDominante` | fuerza_potencia / resistencia / mixto_intermitente / tecnico_estetico | Qué objetivo de bloque predomina |
| `estructuraCalendario` | pico_unico / doble_pico / temporada_larga / sin_competencia | Periodización simple, doble o de temporada |
| `nivelAtleta` | beginner / intermediate / advanced | Si hay carga concentrada o no |

Esto se apoya en un hallazgo consolidado: **ningún modelo de periodización es superior**.
Los meta-análisis dan diferencias pequeñas entre lineal, ondulante y por bloques (bloques
algo mejor en avanzados; ondulante algo mejor para 1RM; sin diferencia en principiantes),
y la investigación 2019-2025 señala como determinante la existencia de variación
estructurada, no el modelo concreto. Por eso el motor es el mismo para todos y lo que
varía son estos parámetros.

**Decisión — la estructura se deriva, no se cuadra.** `construirEstructura(perfil,
totalSemanas)` produce la secuencia de bloques con sus semanas exactas, y **los periodos
y etapas se derivan agrupando bloques consecutivos**: alinean por construcción.
`lib/macrociclo-periodizacion.ts` solo traduce semanas a fechas. Desaparece toda una
clase de errores de cuadre y tres pasos del asistente.

**Reglas nuevas que esto habilita:**

- **Mínimo 2 semanas por bloque** (Issurin: los efectos residuales de un bloque de
  acumulación duran 12-30 días; uno de 1 semana no acumula nada). Si no caben todos, se
  **descartan bloques por prioridad** —choque, específico, precompetitivo, estabilizador,
  aproximación, desarrollador— y se explica cuál se quitó y por qué. Nunca se acortan.
- **Transitorio de 2-4 semanas absolutas** (Bompa), reservadas antes del reparto
  porcentual: un plan de un año no puede tener 8 semanas de descanso por proporción.
- **Un macrociclo que solo reentrena y descansa se rechaza**: si tras los descartes no
  sobrevive ningún bloque que desarrolle capacidad, se devuelve un error explícito con la
  duración mínima necesaria en vez de generar un plan vacío de contenido.
- `distribuirSemanasPorMayorResto` acepta `id`, no solo `tipo`. Sin eso no se pueden
  repetir bloques, y una periodización doble necesita exactamente eso: dos
  "competencia", dos "aproximacion", dos transitorios.

**Los pesos por capacidad dominante son convención del proyecto**, derivada del principio
de especificidad, no de una tabla publicada — misma honestidad que ADR-17. Lo que sí
tiene respaldo es la estructura sobre la que actúan.

**Cierre del macrociclo.** `cerrarMacrocicloLazy` cerraba un día después de
`fechaCompetencia`: el atleta competía y al día siguiente su plan desaparecía, sin
transitorio ni evaluación final. Ahora cierra al pasar `fechaFin`, que es donde termina
el transitorio (`closedReason: "auto_fin_transitorio"`).

**Esquema.** `Macrociclo` + `capacidadDominante`, `estructuraCalendario`, `nivelAtleta`;
nuevo modelo `MacrocicloCompetencia`. Migración `20260827194606_perfil_deportivo_competencias`.

**Fecha.** 2026-08-27. **Estado.** Implementado.
Cobertura: `lib/planificacion/perfil.test.ts` (incluye una prueba de propiedades sobre
240 combinaciones de perfil × duración), `lib/macrociclo-periodizacion.test.ts`.

---

## ADR-38 · Taper y semanas de evaluación: de etiquetas a cálculo

**Contexto.** La app tenía mesociclos llamados "aproximación" y "competencia", y un
`TipoMicrociclo` que incluía `"evaluacion"`. Ninguno de los tres hacía nada:
`MICROCICLO_BASE_POR_MESOCICLO` nunca producía una semana de evaluación, y no existía
ningún cálculo de reducción de carga previa a competir. Eran etiquetas.

Además `Macrociclo.fechaCompetencia` era **un único campo**. Con un solo campo no se
puede representar una liga de cinco meses ni un año de doble pico — y es el calendario lo
que determina si la periodización es simple, doble o múltiple.

**Decisión — taper calculado** (`lib/planificacion/taper.ts`). El meta-análisis de
Bosquet (27 estudios) es el respaldo más fuerte de toda la periodización: reducir el
volumen entre **41 % y 60 %** durante ~2 semanas, **sin tocar intensidad ni frecuencia**,
mejora el rendimiento en torno a un 2,2 %. Recortar más de un 60 % empeora el resultado, y
mantener la intensidad pesa más que mantener el volumen.

- `FACTORES_VOLUMEN_TAPER = [0.7, 0.45]`: la semana pegada a la competencia lleva el
  recorte más agresivo (55 %, centro de la ventana de Bosquet) y la anterior un 30 %. La
  progresión decreciente reproduce el descenso exponencial que el meta-análisis encontró
  superior al escalonado.
- `FACTOR_INTENSIDAD_TAPER = 1`, siempre. Es el error más común al afinar.
- Solo las competencias **principales** reciben las 2 semanas; las secundarias, 1. Afinar
  para cada fecha de una temporada larga equivale a no entrenar nunca.
- `revisarTaper()` avisa —sin bloquear— cuando una competencia principal no deja espacio
  para afinar, o cae fuera del rango del macrociclo.

**Decisión — evaluaciones colocadas automáticamente.** Semana 1 (línea base), cada 10
semanas (la recomendación habitual de seguimiento es retest cada 8-12) y la última semana
del plan. La evaluación final es lo que permite cerrar el macrociclo comparando contra el
punto de partida, con el cambio mínimo detectable de ADR-29 para no reportar ruido como
mejora.

**Decisión — calendario real.** Nuevo modelo `MacrocicloCompetencia` (nombre, fecha,
importancia). `Macrociclo.fechaCompetencia` se conserva y se puebla con la primera
competencia principal, porque el cierre automático y los planes antiguos dependen de él.

**Precedencia entre tipos de semana**, de mayor a menor: competencia > taper > evaluación
> descarga programada > tipo base del bloque. Una semana de competencia no se convierte en
descarga, y un taper no se pisa con un deload: el taper *es* la reducción planificada.

**Consecuencia en la interfaz.** El formulario ya no decide el tipo de semana: lo resuelve
el motor contra el calendario, y cada semana guarda en `notas` la explicación de por qué
es lo que es, que se muestra literalmente en el paso de Estructura.

**Fecha.** 2026-08-27. **Estado.** Implementado.
Cobertura: `lib/planificacion/taper.test.ts`.

---

## ADR-39 · Fechas objetivo: un plan de salud también tiene fechas que importan

**Contexto.** ADR-37 introdujo `estructuraCalendario = "sin_competencia"` para el objetivo
salud, y la interfaz **ocultaba el calendario de fechas** en ese modo. El razonamiento era
que sin competencias no hay nada que afinar. Pero eso dejaba fuera un caso real: alguien
que entrena por salud sí puede tener fechas que le importan —un chequeo médico, un viaje,
una caminata larga, una fecha en la que quiere sentirse de cierta forma— y el plan debería
poder organizarse alrededor de ellas.

Además, la pregunta de capacidad dominante estaba redactada solo para atletas
(*"¿Qué capacidad domina en **tu deporte**?"*, con ejemplos de disciplinas en cada
opción). Quien entrena por salud no tiene deporte y ninguna opción le hablaba: tenía que
adivinar. Justo lo contrario del criterio de explicarlo todo en la vista.

**Decisión — dos modos de calendario** (`ModoCalendario` en `lib/planificacion/taper.ts`):

| | `"competencia"` | `"objetivo"` |
|---|---|---|
| Semana de la fecha | Competitiva (se compite, no se entrena) | **Evaluación** (se mide justo cuando importa) |
| Afinamiento si es principal | 2 semanas (taper completo de Bosquet) | **1 semana** |
| Afinamiento si es secundaria | 1 semana | 0 |

El modo se deriva del perfil (`modoCalendarioDe`), no se guarda: es función de
`estructuraCalendario === "sin_competencia"`, así que no hace falta columna nueva.

**Por qué una sola semana de afinamiento y no dos.** Bajar algo el volumen antes de una
fecha en la que quieres rendir tiene sentido aunque no compitas —llegas descansado sin
perder forma—, pero el taper completo de dos semanas de Bosquet está medido sobre
rendimiento competitivo. Aplicarlo a un chequeo médico sería tomarse la evidencia más en
serio de lo que la evidencia dice.

**Por qué la fecha objetivo se evalúa.** Es lo que la vuelve útil como hito: si marcas una
fecha y no se mide nada ese día, la fecha no hace nada. Coexiste con las evaluaciones
automáticas de ADR-38 (semana 1, cada 10, y la última).

**Decisión — la pregunta de capacidad cambia de redacción, no de valores.**
`CAPACIDADES_SALUD` ofrece las mismas cuatro opciones con etiquetas y ejemplos para quien
no practica un deporte: "Ganar fuerza", "Ganar resistencia", "Mixto o equilibrado",
"Movilidad y control". El motor no cambia; cambia cómo se pregunta. Un test verifica que
ambos catálogos cubren exactamente los mismos valores y que ninguna descripción del
catálogo de salud menciona "deporte".

También se indica explícitamente que, sin competencias, la diferencia entre las cuatro
capacidades es de una o dos semanas por bloque —porque la secuencia de salud no tiene
bloques de potencia ni de realización, que es donde los multiplicadores muerden— y que
"Mixto o equilibrado" es la opción segura si no se tiene claro.

**Decisión — preselección desde el objetivo.** Si en el paso 1 se eligió objetivo
`salud`, el calendario se preselecciona en "Sin competencia". No se bloquea: alguien puede
entrenar por salud y aun así correr una carrera popular. Si el objetivo es salud y se
elige un calendario con competencias, se avisa sin impedirlo.

**Fecha.** 2026-08-27. **Estado.** Implementado.
Cobertura: `lib/planificacion/taper.test.ts`, `lib/planificacion/perfil.test.ts`.

---

## ADR-40 · La pregunta del calendario, formulada desde el usuario

**Contexto.** ADR-39 arregló la redacción de la pregunta de capacidad para quien no
practica un deporte, pero dejó intacta la del calendario. Tres de sus cuatro tarjetas
estaban escritas desde dentro del mundo competitivo —"Un pico en el año: *una competencia
principal manda sobre todas las demás*", "Dos picos", "Temporada larga tipo liga"— así que
alguien que entrena por salud leía tres opciones que no le hablaban y una cuarta por
descarte. Lo detectó el usuario al usarlo.

Había además un error de orden: la pregunta de capacidad **cambia de redacción según la
respuesta del calendario** (ADR-39), pero se mostraba antes que ella. El usuario veía la
versión deportiva de la primera pregunta hasta que respondía la segunda.

**Decisión — reordenar.** El calendario pasa a ser la pregunta 1 y la capacidad la 2. Una
pregunta cuya redacción depende de otra tiene que ir después.

**Decisión — formular desde lo que hace la persona.** La pregunta deja de ser "¿Cómo es tu
calendario?" (que presupone que tienes uno) y pasa a ser **"¿Compites en algo?"**. Las
etiquetas son respuestas, no vocabulario de periodización:

| Antes | Ahora |
|---|---|
| Sin competencia | **No compito** |
| Un pico en el año | **Tengo una fecha importante** |
| Dos picos | **Tengo dos fechas separadas** |
| Temporada larga tipo liga | **Compito seguido durante meses** |

"No compito" pasa a ser la **primera** opción, no la última: es el caso más común en esta
app. Y su descripción aclara explícitamente que se pueden fijar fechas igualmente, porque
esa era la duda que motivó ADR-39.

Los ejemplos incluyen deliberadamente casos no deportivos —"una prueba física de acceso",
"dos carreras objetivo al año"—: querer rendir un día concreto no implica competir, y
limitar los ejemplos a campeonatos volvía inalcanzables tres de las cuatro opciones para
quien no es atleta federado.

**Nota de método.** Los dos huecos que cierran ADR-39 y ADR-40 tienen la misma causa: se
escribió la interfaz asumiendo un atleta de competencia y después se intentó acomodar el
caso de salud por parches. Al añadir opciones nuevas conviene revisar que las que ya
existían sigan teniendo sentido desde el caso nuevo, no solo que la nueva encaje.

**Fecha.** 2026-08-27. **Estado.** Implementado.
Cobertura: `lib/planificacion/perfil.test.ts` (verifica que ninguna etiqueta use jerga,
que la primera opción sea la de no competir, y que los ejemplos cubran casos no
deportivos).

---

## ADR-41 · Revisión del flujo completo del macrociclo

Auditoría del asistente entero buscando supuestos de competencia que dejaran fuera al
objetivo salud. Cuatro hallazgos, uno de ellos ajeno a salud pero más grave que el resto.

### M-04 · El transitorio caía **antes** de la competencia (crítico)

El paso 1 hacía `setFechaFin(fechaCompetencia)`: el macrociclo terminaba el día de
competir. Pero ADR-37 reserva el transitorio al final del plan, así que este ocupaba las
últimas 2-4 semanas — que son exactamente las del taper y la competencia. Verificado en un
plan de 24 semanas con competencia el 14-feb:

```
Bloques finales:  choque 3 · aproximación 3 · competencia 1 · transitorio 2
Semanas finales:  22 taper · 23 taper · 24 competitivo
```

El bloque decía "descanso activo" mientras la semana decía "afinar y competir". La
consecuencia real: **un macrociclo de competencia nunca tenía periodo transitorio**, que es
justo la garantía que introdujo ADR-37.

**Decisión.** `fechaFin` deja de igualarse a la fecha de competencia. El paso 1 pide
siempre inicio y fin, y explica que hay que dejar 2-4 semanas después de la última
competencia. `revisarEspacioTransitorio()` (`lib/planificacion/taper.ts`) comprueba la
distancia entre la última competencia principal y `fechaFin`, y si no llega al mínimo
avisa con la fecha concreta que debería usarse. Comprobado tras el arreglo: los periodos
salen `preparatorio → competitivo → transitorio` y el transitorio queda después de
competir.

La comprobación normaliza ambas fechas con el mismo criterio a propósito: el resultado es
una diferencia, así que cualquier desplazamiento de zona horaria se cancela mientras las
dos entradas vengan del mismo origen.

### M-03 · Dos escritores para `fechaCompetencia`

El campo del paso 1 y el calendario del paso 2 escribían el mismo dato, y
`guardarCompetencias` pisaba al primero sin que se viera. **Decisión:** el campo del paso 1
desaparece; la fuente única es el calendario, que repuebla `fechaCompetencia` con la
primera competencia principal para el cierre automático y la compatibilidad.

### M-01 · Direcciones de carga de deporte de equipo para todos

`DIRECCIONES_POR_DEFECTO` era siempre `físico · táctico · técnico · psicológico`. A quien
entrena por salud, "entrenamiento táctico" no le dice nada; a un powerlifter tampoco. El
paso de carga le pedía repartir porcentajes entre categorías que no aplican.

**Decisión.** `direccionesPorDefectoPara(perfil)`:

| Perfil | Direcciones iniciales |
|---|---|
| Sin competencia | físico · técnico |
| Mixto o intermitente que compite | las cuatro |
| Resto (fuerza-potencia, resistencia, técnico-estético) | físico · técnico · psicológico |

El reparto inicial del volumen se **renormaliza a 100** sobre las direcciones que quedan.
Se siguen pudiendo añadir o quitar a mano: esto solo cambia con cuáles se arranca.

### M-02 · El detalle no mostraba el perfil

`app/macrociclo/[id]/page.tsx` mostraba objetivo, rango, sesión RM y VO2max, pero no
capacidad, calendario ni nivel — que son lo que determina toda la estructura — y seguía
mostrando "Fecha de competencia" en singular. **Decisión:** se muestra el perfil completo y
el calendario entero, con el título adaptado ("Fechas objetivo" o "Competencias").

**Fecha.** 2026-08-27. **Estado.** Implementado.
Cobertura: `lib/planificacion/taper.test.ts` (espacio para el transitorio),
`lib/mesociclo-carga.test.ts` (direcciones por perfil y renormalización a 100).

---

## ADR-42 · Los pasos del asistente, en un solo sitio

**Contexto.** ADR-37 insertó el paso de Perfil y fusionó los tres de porcentajes en uno,
así que el asistente pasó de 9 pasos a 8 y **toda la numeración se desplazó**:

| Paso | Antes | Ahora |
|---|---|---|
| Objetivo | 1 | 1 |
| Perfil | — | 2 |
| RM | 2 | 3 |
| VO2max | 3 | 4 |
| Estructura | 4-6 | 5 |
| Semanas | 7 | 6 |
| Carga | 8 | 7 |
| Revisión | 9 | 8 |

El número de cada paso estaba escrito como literal en cuatro sitios distintos —las
redirecciones de `actions/macrociclo.ts`, el `pasoActual` de
`services/macrociclo.service.ts`, el propio asistente y el *clamp* de
`editar/page.tsx`— y ninguno se actualizó. Los síntomas aparecieron de uno en uno según
el usuario avanzaba: guardar el perfil no pasaba al paso siguiente, guardar la sesión de
RM devolvía al paso anterior, y al recargar se volvía al paso 1.

**Decisión.** `PASO_WIZARD` y `TOTAL_PASOS_WIZARD` en `lib/macrociclo.ts` como fuente
única. Todos los literales se sustituyen por la constante con nombre, así que insertar o
mover un paso ya no obliga a recordar cuatro sitios.

Un test bloquea la regresión estructural: los pasos deben ser consecutivos desde 1 sin
huecos ni repetidos, el total debe coincidir, y el orden relativo debe seguir siendo el
del flujo real (perfil antes que RM, estructura después de las evaluaciones, revisión al
final).

**Lección.** Es el mismo patrón que ADR-40: un cambio estructural correcto en el dominio
dejó desactualizadas piezas periféricas que repetían un dato derivado. Cuando algo se
repite en cuatro archivos, el arreglo no es actualizar los cuatro sino que dejen de
repetirlo.

**Fecha.** 2026-08-27. **Estado.** Implementado. Cobertura: `lib/macrociclo.test.ts`.

---

## ADR-43 · El paso de Semanas propone en vez de preguntar

**Contexto — dos problemas encadenados.**

*Primero, un control muerto.* El paso de Semanas tenía un desplegable de tipo de
microciclo por semana que arrancaba en `"corriente"` fijo, sin leer nunca el tipo que
había calculado el paso de Estructura. Y desde ADR-38 el guardado ignora ese valor
(`tipoMicrociclo: semanaCalculada.tipoMicrociclo`). Es decir: **mostraba un valor
equivocado y además descartaba lo que el entrenador eligiera**. Debí quitarlo al cambiar
el guardado; lo detectó el usuario al ver que los tipos de una pestaña no coincidían con
los de la otra.

*Segundo, trabajo manual evitable.* El paso pedía frecuencia, series, repeticiones,
intensidad y volumen para cada semana —hasta 52 filas de cinco campos, todas arrancando en
cero— cuando todo eso ya es derivable de datos que el plan tiene.

**Relación entre los dos pasos.** Estructura define la **forma** (a qué bloque pertenece
cada semana y qué tipo es, todo derivado y de solo lectura); Semanas define el
**contenido** (qué se hace dentro). La confusión venía de que el contenido no sabía nada
de la forma.

**Decisión — el tipo lo muestra, no lo pregunta.** El desplegable se sustituye por el tipo
calculado en solo lectura, con la explicación de la semana (`notas`) debajo. La fuente
única es el motor.

**Decisión — configuración propuesta.** `lib/planificacion/sugerencia-semana.ts` deriva la
carga de cada semana:

| Campo | Origen |
|---|---|
| Intensidad | `ZONAS_INTENSIDAD[objetivoBloque]` progresando en el bloque × `factorIntensidad` |
| Series | `RANGOS_VOLUMEN[objetivoBloque]` progresando × `factorVolumen` |
| Repeticiones | Centro de `repsMin..repsMax` de la zona |
| Frecuencia | `Persona.diasDisponibles` (C-12) |
| Ejercicios | `rmSnapshot` + la fórmula elegida, como ya hacía |

**No reimplementa nada**: reutiliza `calcularIntensidadObjetivoPct` y
`calcularSeriesObjetivo` de `prescripcion.ts`, las mismas que usa el motor de
planificación. Introducir un segundo criterio de cálculo habría sido peor que el problema
original.

Para poder derivar esto, `SemanaCalculada` pasa a llevar el contexto que ya existía pero
no se exponía: `objetivoBloque`, `indiceEnBloque`, `totalSemanasBloque`, `factorVolumen`,
`factorIntensidad` y `esDeload`.

**Decisión — la sugerencia nunca pisa una decisión.** Dos acciones explícitas en vez de
autorrelleno silencioso: «Rellenar las semanas vacías (N)», que solo toca las que están en
cero, y «Recalcular todas», que sobrescribe y lo advierte. Una semana vacía es la señal de
"sin tocar" (`estaSinConfigurar`), así que no hace falta llevar estado extra de qué editó
el entrenador.

**Efecto lateral corregido.** El servicio no persistía `factorVolumen`/`factorIntensidad`/
`esDeload`: se quedaban en su valor por defecto de 1, así que **el recorte del taper no
llegaba a la base de datos** aunque el motor lo calculara. Ahora se guardan.

**Alcance.** Esto acerca el asistente manual al motor M5, que `docs/PLAN-MAESTRO.md`
describe como dos caminos que conviven (Estado Intermedio B). No se fusionan: el asistente
**siembra** desde los mismos parámetros en vez de duplicar el trabajo a mano. Fusionarlos
del todo sigue pendiente.

**Fecha.** 2026-08-27. **Estado.** Implementado.
Cobertura: `lib/planificacion/sugerencia-semana.test.ts` (la propuesta cae siempre dentro
de la zona e intervalo de volumen de su objetivo, el taper recorta series pero no
intensidad, y sin bloque asignado no se inventa carga).

---

## ADR-44 · El tipo de semana: el motor propone, el entrenador dispone

**Contexto.** ADR-38 puso el tipo de cada semana bajo control del motor, que lo resuelve
contra el calendario de competencias. ADR-43 quitó el desplegable del formulario porque
mostraba un valor equivocado y sus ediciones se descartaban al guardar. Correcto como
arreglo del defecto, pero excesivo como decisión de producto: el entrenador conoce
contextos que el plan no —una lesión, un viaje, un amistoso, una semana de exámenes— y
debe poder marcar una semana como descarga aunque al motor no le toque.

**Decisión.** El desplegable vuelve, con dos condiciones que lo distinguen del control
muerto anterior:

1. **Su valor por defecto es el tipo calculado**, no `"corriente"`. Una semana sin tocar
   muestra lo mismo que el paso de Estructura.
2. **El guardado lo respeta.** Si el valor que llega difiere del calculado, se trata como
   decisión del entrenador y manda:

```ts
const tipoFinal = tipoSolicitado && isTipoMicrociclo(tipoSolicitado)
  ? tipoSolicitado
  : tipoPropuesto;
```

No hace falta columna nueva para saber si es un override: **es override si difiere de lo
que el motor propone**, y el motor es determinista sobre los mismos datos.

**Los factores siguen al tipo.** `factoresPorTipoMicrociclo()` deriva
`factorVolumen`/`factorIntensidad`/`esDeload` del tipo que finalmente queda. Sin esto, una
semana marcada a mano como taper se guardaría con factor de volumen 1 — es decir, sería
una etiqueta sin efecto, que es justo el problema que ADR-38 vino a corregir. Un test
verifica que los factores derivados coinciden con los que el motor asigna al mismo tipo.

**Reversible.** Cuando el tipo difiere del propuesto, aparece un enlace que lo devuelve al
valor del plan, nombrándolo. Y «Recalcular todas» los restablece todos, avisando de que
también sobrescribe los tipos cambiados.

**Lo que no cambia.** Los números (series, repeticiones, intensidad) **no** se recalculan
al cambiar el tipo. Cambiar el tipo cambia el tipo; si el entrenador quiere además la
carga correspondiente, «Recalcular todas» se la da. Recalcular en silencio al tocar un
desplegable habría pisado ajustes deliberados.

**Fecha.** 2026-08-27. **Estado.** Implementado. Cobertura: `lib/planificacion/taper.test.ts`.

---

## Preguntas abiertas del plan aún sin resolver

Ver `docs/PLAN-MAESTRO.md` §19.3 para el detalle. Estado tras esta sesión:

| # | Pregunta | Estado |
|---|---|---|
| Q-01 | ¿Multi-entrenador o un solo entrenador? | Parcial — ahora puede haber varias cuentas `role: "entrenador"` (ADR-26), pero sin aislamiento de datos entre ellas |
| Q-02 | ¿Quién registra el entrenamiento? | **Resuelto**: el entrenador |
| Q-03 | ¿Se recalibran los coeficientes de masa corporal? | Sin resolver (ADR-16) |
| Q-04 | ¿Direcciones en minutos o se simplifican? | Sin resolver (ADR-24) |
| Q-05 | ¿Qué ejercicios entran más allá de los 6 actuales? | Sin resolver — catálogo ampliado con semántica (`Ejercicio.patron` etc.), pero el conjunto de 6 ejercicios no creció |
| Q-06 | ¿Autenticación real de persona? | **Resuelto** (ADR-25) |
| Q-07 | ¿Qué duraciones de macrociclo soportar? | Resuelto de forma general — el motor no está atado a duraciones fijas; probado en 8/12/16/24 semanas (`lib/planificacion/motor.test.ts`) |
