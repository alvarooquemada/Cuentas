# Cuentas Web — app de finanzas instalable en el móvil

Versión web (PWA) de Cuentas: control de gastos e ingresos, categorías,
resumen mensual y gráficos. Funciona en **cualquier móvil** (iPhone o
Android) sin Mac, sin Xcode y sin App Store — se instala directamente
desde el navegador.

Todo se guarda **en local, en el propio navegador** (`localStorage`). No
hay servidor, ni cuenta, ni sincronización entre dispositivos. Usa
"Exportar copia" en Ajustes de vez en cuando para tener un backup.

---

## Cómo instalarla en el iPhone

1. Activa GitHub Pages para este repo (una sola vez): en GitHub, ve a
   **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   El workflow `.github/workflows/deploy-web.yml` ya está preparado; en
   cuanto haya una ejecución correcta, GitHub te da una URL del tipo
   `https://<usuario>.github.io/<repo>/`.
2. Abre esa URL en **Safari** en el iPhone (tiene que ser Safari, no Chrome,
   para que funcione "Añadir a pantalla de inicio" como app).
3. Toca el icono de **Compartir** (el cuadrado con la flecha hacia arriba).
4. Elige **"Añadir a pantalla de inicio"**.
5. Ya tienes un icono de "Cuentas" en tu pantalla de inicio que abre a
   pantalla completa, como una app nativa, y funciona sin conexión una vez
   cargada la primera vez.

En Android es el mismo proceso desde Chrome: menú (⋮) → **"Instalar
aplicación"** o **"Añadir a pantalla de inicio"**.

### Probarla sin desplegar nada (mientras desarrollas)

```bash
cd web
python3 -m http.server 8080
```

Y abre `http://localhost:8080` en el navegador de tu ordenador, o
`http://<ip-de-tu-ordenador>:8080` desde el móvil si están en la misma
red Wi-Fi.

---

## Qué hace

- **Movimientos**: importe, tipo (gasto/ingreso), categoría, concepto y
  fecha (con atajos Hoy/Ayer).
- **Resumen**: balance, ingresos y gastos del mes en curso, desglose por
  categoría (donut) y evolución de los últimos 6 meses (barras).
- **Listado**: agrupado por mes con balance de cada mes, filtros por tipo
  y categoría, y búsqueda por concepto o categoría.
- **Categorías**: ocho por defecto, se pueden crear, renombrar, cambiar
  icono/color y eliminar (los movimientos de una categoría eliminada
  quedan como "Sin categoría").
- **Divisa**: seleccionable en Ajustes (EUR, USD, GBP, PLN, MXN); se usa
  solo para formatear, no hay conversión entre divisas.
- **Exportar / Importar**: copia de seguridad en un archivo JSON.
- **Instalable (PWA)**: manifest + service worker, funciona offline tras
  la primera carga.

## Estructura

```
web/
  index.html          shell de la app y las 4 vistas (resumen, movimientos, añadir, ajustes)
  manifest.json        metadatos de instalación (nombre, iconos, colores)
  sw.js                 service worker: cachea los archivos para uso offline
  css/styles.css        estilos, con tema claro/oscuro automático
  js/store.js           capa de datos sobre localStorage (movimientos, categorías, ajustes)
  js/charts.js           gráficos donut y de barras dibujados en <canvas>, sin librerías externas
  js/app.js              lógica de la interfaz y navegación entre vistas
  icons/                 iconos de la app (192px, 512px, apple-touch-icon)
```

No usa frameworks ni build step: HTML/CSS/JS puro, así que cualquier
hosting de archivos estáticos (GitHub Pages, Netlify, Vercel...) sirve tal
cual con solo copiar la carpeta `web/`.
