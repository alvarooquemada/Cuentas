//
//  Money.swift
//  Cuentas
//
//  Divisas y formateo de importes.
//

import Foundation

enum Currency: String, CaseIterable, Codable, Identifiable, Hashable {
    case pln = "PLN"
    case eur = "EUR"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .pln: return "zł"
        case .eur: return "€"
        }
    }

    var displayName: String {
        switch self {
        case .pln: return "Złoty polaco"
        case .eur: return "Euro"
        }
    }

    var other: Currency {
        self == .pln ? .eur : .pln
    }
}

enum Money {
    /// Formatea un importe con el símbolo de su divisa.
    /// - Parameter maxDecimals: usa 0 para vistas compactas (widget).
    static func string(_ value: Double,
                       currency: Currency,
                       maxDecimals: Int = 2,
                       showsSign: Bool = false) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "es_ES")
        formatter.minimumFractionDigits = maxDecimals == 0 ? 0 : 2
        formatter.maximumFractionDigits = maxDecimals
        formatter.usesGroupingSeparator = true

        let magnitude = abs(value)
        let number = formatter.string(from: NSNumber(value: magnitude)) ?? "0"

        var prefix = ""
        if showsSign {
            prefix = value < 0 ? "−" : "+"
        } else if value < 0 {
            prefix = "−"
        }

        switch currency {
        case .pln: return "\(prefix)\(number) \(currency.symbol)"
        case .eur: return "\(prefix)\(number) \(currency.symbol)"
        }
    }

    /// Versión compacta para espacios pequeños: 12.480 zł en vez de 12.480,00 zł.
    static func compact(_ value: Double, currency: Currency) -> String {
        string(value, currency: currency, maxDecimals: abs(value) >= 1_000 ? 0 : 2)
    }

    /// Redondea a céntimos para evitar arrastrar errores de coma flotante.
    static func rounded(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}
