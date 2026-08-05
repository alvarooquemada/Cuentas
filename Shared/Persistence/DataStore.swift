//
//  DataStore.swift
//  Cuentas
//
//  Contenedor de SwiftData alojado en el App Group para que la app y la
//  extensión del widget lean exactamente la misma base de datos.
//

import Foundation
import SwiftData
import WidgetKit

enum DataStore {

    static let schema = Schema([Movement.self, Category.self])

    /// Contenedor compartido por toda la app (y por el widget).
    static let shared: ModelContainer = makeContainer()

    /// URL del fichero dentro del App Group. `nil` si el entitlement no está
    /// configurado (entonces se usa el almacenamiento local del target).
    static var groupStoreURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: SharedConfig.appGroupID)?
            .appending(path: SharedConfig.storeFileName)
    }

    static func makeContainer(inMemory: Bool = false) -> ModelContainer {
        if inMemory {
            let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            // En memoria no puede fallar salvo error de programación en el esquema.
            return try! ModelContainer(for: schema, configurations: configuration)
        }

        if let url = groupStoreURL {
            do {
                let configuration = ModelConfiguration(schema: schema, url: url)
                return try ModelContainer(for: schema, configurations: configuration)
            } catch {
                // App Group no disponible o store corrupto: seguimos con el
                // almacenamiento por defecto para que la app arranque igual.
                print("[Cuentas] No se pudo abrir el store del App Group: \(error)")
            }
        }

        do {
            return try ModelContainer(for: schema)
        } catch {
            fatalError("[Cuentas] No se pudo crear el ModelContainer: \(error)")
        }
    }

    // MARK: - Siembra inicial

    /// Crea las categorías por defecto la primera vez. Idempotente.
    @MainActor
    static func seedDefaultCategoriesIfNeeded(_ context: ModelContext) {
        let descriptor = FetchDescriptor<Category>()
        let existing = (try? context.fetchCount(descriptor)) ?? 0
        guard existing == 0 else { return }

        for (index, seed) in Category.seeds.enumerated() {
            context.insert(Category(name: seed.name,
                                    symbolName: seed.symbolName,
                                    colorHex: seed.colorHex,
                                    sortIndex: index))
        }
        try? context.save()
    }

    // MARK: - Widget

    /// Avisa a WidgetKit de que los datos han cambiado.
    static func reloadWidgets() {
        WidgetCenter.shared.reloadTimelines(ofKind: SharedConfig.balanceWidgetKind)
    }
}
