"use client";

import { useServerInsertedHTML } from "next/navigation";

// Aplica la clase "dark" en <html> antes de la hidratación para evitar el
// flash de tema incorrecto. Inyectado vía useServerInsertedHTML (fuera del
// árbol de React que se hidrata) en vez de <script>/<Script> en el JSX —
// React 19 marca cualquier <script> renderizado dentro de un componente con
// "Encountered a script tag while rendering React component" y fuerza a
// regenerar todo el subárbol de RootLayout en el cliente en cada carga.
const THEME_INIT_SCRIPT = `(function(){try{var saved=window.localStorage.getItem("theme");var isDark=saved!=="light";document.documentElement.classList.toggle("dark",isDark);}catch(e){document.documentElement.classList.add("dark");}})();`;

export function ThemeScript() {
  useServerInsertedHTML(() => (
    <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
  ));

  return null;
}
