//
//  Movement.swift
//  Cuentas
//
//  Un movimiento = un gasto o un ingreso.
//

import Foundation
import SwiftData

enum MovementKind: String, Codable, CaseIterable, Identifiable, Hashable {
    case expense
    case income

    var id: String { rawValue }

    var label: String {
        switch self {
        case .expense: return "Gasto"
        case .income: return "Ingreso"
        }
    }

    var systemImage: String {
        switch self {
        case .expense: return "arrow.up.right"
        case .income: return "arrow.down.left"
        }
    }

    /// Multiplicador para calcular el balance.
    var sign: Double {
        self == .expense ? -1 : 1
    }
}

@Model
final class Movement {
    /// Identificador estable propio. No se llama `id` para no chocar con la
    /// conformidad a `Identifiable` que ya aporta `PersistentModel`.
    var uid: UUID = UUID()

    /// Importe SIEMPRE positivo, expresado en `currency`.
    var amount: Double = 0

    /// Divisa en la que se introdujo el importe ("PLN" / "EUR").
    var currencyCode: String = Currency.pln.rawValue

    /// Tipo de cambio (PLN por 1 EUR) vigente en el momento de crear el
    /// movimiento. Se guarda para que el histórico no cambie si más adelante
    /// actualizo el tipo de cambio en Ajustes.
    var rate: Double = AppSettings.defaultRate

    var kindRaw: String = MovementKind.expense.rawValue

    /// Concepto corto: "café en Zielona", "billete Kraków"...
    var note: String = ""

    var date: Date = Date()
    var createdAt: Date = Date()

    var category: Category?

    init(amount: Double,
         currency: Currency,
         rate: Double,
         kind: MovementKind,
         note: String,
         date: Date,
         category: Category?) {
        self.uid = UUID()
        self.amount = Money.rounded(abs(amount))
        self.currencyCode = currency.rawValue
        self.rate = rate > 0 ? rate : AppSettings.defaultRate
        self.kindRaw = kind.rawValue
        self.note = note
        self.date = date
        self.createdAt = .now
        self.category = category
    }

    // MARK: - Acceso tipado

    var kind: MovementKind {
        get { MovementKind(rawValue: kindRaw) ?? .expense }
        set { kindRaw = newValue.rawValue }
    }

    var currency: Currency {
        get { Currency(rawValue: currencyCode) ?? .pln }
        set { currencyCode = newValue.rawValue }
    }

    // MARK: - Conversión

    /// Importe en złotys, usando el tipo de cambio guardado en el movimiento.
    var amountPLN: Double {
        switch currency {
        case .pln: return amount
        case .eur: return Money.rounded(amount * rate)
        }
    }

    /// Importe en euros, usando el tipo de cambio guardado en el movimiento.
    var amountEUR: Double {
        switch currency {
        case .eur: return amount
        case .pln: return rate > 0 ? Money.rounded(amount / rate) : 0
        }
    }

    func amount(in currency: Currency) -> Double {
        currency == .pln ? amountPLN : amountEUR
    }

    /// Importe con signo (negativo si es gasto), en złotys.
    var signedPLN: Double {
        amountPLN * kind.sign
    }
}
