//
//  SharedConfig.swift
//  Cuentas
//
//  Constantes compartidas entre la app y la extensión del widget.
//

import Foundation

enum SharedConfig {
    /// App Group que comparten la app y el widget. Debe existir en el perfil
    /// de aprovisionamiento de AMBOS targets.
    static let appGroupID = "group.com.alvaroquemada.Cuentas"

    /// Nombre del fichero de la base de datos de SwiftData dentro del App Group.
    static let storeFileName = "Cuentas.store"

    /// Esquema de URL para los deep links (declarado en Config/Cuentas-Info.plist).
    static let urlScheme = "cuentas"

    /// Deep link que abre directamente la pantalla de "añadir movimiento".
    static let addMovementURL = URL(string: "\(urlScheme)://add")!

    /// Deep link que abre el resumen del mes.
    static let summaryURL = URL(string: "\(urlScheme)://resumen")!

    /// Identificador del widget de balance.
    static let balanceWidgetKind = "CuentasBalanceWidget"
}
