//
//  ColorHex.swift
//  Cuentas
//
//  Conversión entre Color y cadenas hexadecimales (las categorías guardan
//  su color como texto en SwiftData).
//

import SwiftUI

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)

        let r, g, b: Double
        switch cleaned.count {
        case 6:
            r = Double((value & 0xFF0000) >> 16) / 255
            g = Double((value & 0x00FF00) >> 8) / 255
            b = Double(value & 0x0000FF) / 255
        case 3:
            r = Double((value & 0xF00) >> 8) / 15
            g = Double((value & 0x0F0) >> 4) / 15
            b = Double(value & 0x00F) / 15
        default:
            r = 0.56; g = 0.56; b = 0.58 // gris de sistema
        }
        self.init(red: r, green: g, blue: b)
    }

    /// Paleta usada al crear categorías nuevas.
    static let categoryPalette: [String] = [
        "#FF9500", "#FF375F", "#5E5CE6", "#30B0C7",
        "#34C759", "#FFD60A", "#AF52DE", "#FF6482",
        "#0A84FF", "#8E8E93"
    ]
}
