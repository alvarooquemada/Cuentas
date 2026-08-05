# Cuentas — control de gastos del Erasmus en Varsovia

App de iPhone (SwiftUI + SwiftData) para apuntar gastos e ingresos en PLN
viendo siempre el equivalente en EUR, con widget de pantalla de inicio.

Todo se guarda **en local** (SwiftData dentro de un App Group). No hay
backend, ni cuenta, ni red.

---

## Abrir el proyecto

```bash
open Cuentas.xcodeproj
```

Requiere Xcode 15+ y iOS 17 o superior (el iPhone 13 llega hasta iOS 26,
así que va sobrado). El esquema `Cuentas` ya viene compartido y compila la
app y el widget de una vez.

### Antes de ejecutar en el iPhone

1. Selecciona el target **Cuentas** → *Signing & Capabilities* → elige tu
   equipo en **Team**.
2. Haz lo mismo con el target **CuentasWidgetExtension**.
3. Los dos targets ya traen la capability *App Groups* apuntando a
   `group.com.alvaroquemada.Cuentas` (ficheros en `Config/`). Si cambias
   los bundle IDs, cambia también el identificador del grupo en:
   - `Config/Cuentas.entitlements`
   - `Config/CuentasWidget.entitlements`
   - `Shared/SharedConfig.swift` → `SharedConfig.appGroupID`

   Los tres tienen que coincidir **exactamente** o la app y el widget verán
   bases de datos distintas.

En el simulador funciona sin cuenta de desarrollador de pago; en el
dispositivo físico los App Groups requieren cuenta de pago.

---

## Qué hace

### Movimientos
- Importe en **PLN o EUR**, con el equivalente en la otra divisa en vivo.
- Tipo: **gasto** o **ingreso**.
- Categoría (editable), concepto corto y fecha (hoy por defecto, con
  atajos *Hoy* / *Ayer*).
- Cada movimiento **guarda el tipo de cambio que había cuando lo creaste**,
  así que actualizar el cambio más adelante no reescribe el histórico.

### Listado
- Ordenado por fecha, agrupado por mes con el balance de cada mes.
- Filtros por **tipo** (todo / gastos / ingresos) y por **categoría**.
- Búsqueda por concepto o categoría, borrado deslizando, edición al tocar.

### Resúmenes
- Pantalla principal: gastado en el mes en curso a tamaño grande, ingresos,
  balance y en qué se está yendo el dinero.
- Pestaña *Gráficos* (Swift Charts): donut por categoría del mes que elijas
  y barras de **evolución mes a mes** del Erasmus.

### Categorías
Vienen sembradas ocho (comida, alojamiento, transporte, ocio, viajes,
facturas, beca/ingreso, otros) y desde *Ajustes → Categorías* se pueden
crear, renombrar, cambiar icono y color, reordenar y borrar. Al borrar una
categoría **no se borran sus movimientos**: quedan como «Sin categoría».

### Tipo de cambio
*Ajustes → Tipo de cambio*: se escribe a mano (złotys por euro) y se queda
fijo hasta que lo cambies. También se elige la divisa por defecto al
introducir, la divisa de los totales y si se muestra el equivalente.

### Widget
Widget **mediano** (y también pequeño) con el mes en curso: gastado,
ingresos y balance.
- El botón **«Apuntar»** del widget mediano abre la app directamente en la
  pantalla de nuevo movimiento (`cuentas://add`).
- Tocar el resto del widget abre el resumen (`cuentas://resumen`).
- Lee la misma base de datos que la app vía App Group; la app pide a
  WidgetKit que se refresque cada vez que guardas algo.

---

## Estructura

```
Cuentas.xcodeproj
Cuentas/                  target app
  CuentasApp.swift
  Views/                  Dashboard, alta, listado, gráficos, ajustes
  Assets.xcassets
Shared/                   compilado en AMBOS targets
  SharedConfig.swift      App Group, esquema de URL, kind del widget
  Models/                 Movement, Category (SwiftData)
  Persistence/            DataStore: contenedor en el App Group + siembra
  Settings/               AppSettings: tipo de cambio y divisas
  Summary/                SummaryCalculator: todos los totales
  Utils/                  divisas, fechas, colores
CuentasWidget/            target extensión
  CuentasWidgetBundle.swift
  BalanceWidget.swift
Config/                   Info.plist y entitlements de los dos targets
```

Los totales se calculan siempre en PLN dentro de `SummaryCalculator` y se
convierten al final, para que la app y el widget nunca den números
distintos.

---

## Regenerar el proyecto (opcional)

Si en algún momento el `.xcodeproj` se corrompe o quieres reconstruirlo,
hay un `project.yml` equivalente para [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
xcodegen generate
```

---

## Notas

- Los importes se guardan como `Double` redondeado a céntimos. Para gastos
  de Erasmus va sobrado; no es contabilidad bancaria.
- No hay iCloud: los datos viven en el iPhone. Si reinstalas la app, se van.
- Interfaz en español, orientación vertical.
