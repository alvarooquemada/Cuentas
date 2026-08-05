//
//  Category.swift
//  Cuentas
//
//  Categorías de gasto/ingreso. Son editables desde la app: las que vienen
//  de fábrica sólo son una siembra inicial, se pueden renombrar o borrar.
//

import Foundation
import SwiftData

@Model
final class Category {
    var uid: UUID = UUID()
    var name: String = ""
    var symbolName: String = "tag.fill"
    var colorHex: String = "#8E8E93"
    var sortIndex: Int = 0

    /// Si es `true`, no aparece al crear movimientos nuevos pero se conserva
    /// para no romper el histórico.
    var isArchived: Bool = false

    @Relationship(deleteRule: .nullify, inverse: \Movement.category)
    var movements: [Movement]? = []

    init(name: String,
         symbolName: String,
         colorHex: String,
         sortIndex: Int) {
        self.uid = UUID()
        self.name = name
        self.symbolName = symbolName
        self.colorHex = colorHex
        self.sortIndex = sortIndex
        self.isArchived = false
        self.movements = []
    }

    var movementCount: Int {
        movements?.count ?? 0
    }
}

// MARK: - Categorías por defecto

extension Category {
    struct Seed {
        let name: String
        let symbolName: String
        let colorHex: String
    }

    /// Se crean la primera vez que se abre la app.
    static let seeds: [Seed] = [
        Seed(name: "Comida",        symbolName: "fork.knife",              colorHex: "#FF9500"),
        Seed(name: "Alojamiento",   symbolName: "house.fill",              colorHex: "#5E5CE6"),
        Seed(name: "Transporte",    symbolName: "tram.fill",               colorHex: "#30B0C7"),
        Seed(name: "Ocio",          symbolName: "wineglass.fill",          colorHex: "#FF375F"),
        Seed(name: "Viajes",        symbolName: "airplane",                colorHex: "#0A84FF"),
        Seed(name: "Facturas",      symbolName: "doc.text.fill",           colorHex: "#AF52DE"),
        Seed(name: "Beca/Ingreso",  symbolName: "graduationcap.fill",      colorHex: "#34C759"),
        Seed(name: "Otros",         symbolName: "ellipsis.circle.fill",    colorHex: "#8E8E93")
    ]

    /// Símbolos SF ofrecidos al crear/editar una categoría.
    static let availableSymbols: [String] = [
        "fork.knife", "cart.fill", "house.fill", "bed.double.fill",
        "tram.fill", "bus.fill", "bicycle", "car.fill", "airplane",
        "wineglass.fill", "cup.and.saucer.fill", "film.fill", "music.note",
        "doc.text.fill", "bolt.fill", "wifi", "phone.fill",
        "graduationcap.fill", "banknote.fill", "gift.fill",
        "cross.case.fill", "tshirt.fill", "book.fill", "dumbbell.fill",
        "scissors", "pawprint.fill", "tag.fill", "ellipsis.circle.fill"
    ]
}
