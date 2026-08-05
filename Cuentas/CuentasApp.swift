//
//  CuentasApp.swift
//  Cuentas
//
//  Control de gastos e ingresos del Erasmus en Varsovia.
//

import SwiftUI
import SwiftData

@main
struct CuentasApp: App {

    @State private var settings = AppSettings.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(settings)
                .tint(.accentColor)
        }
        .modelContainer(DataStore.shared)
    }
}
