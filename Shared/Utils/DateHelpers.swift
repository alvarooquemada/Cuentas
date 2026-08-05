//
//  DateHelpers.swift
//  Cuentas
//
//  Utilidades de fechas para agrupar por mes.
//

import Foundation

extension Calendar {
    /// Calendario con la zona horaria del dispositivo y locale español.
    static var cuentas: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "es_ES")
        calendar.firstWeekday = 2 // lunes
        return calendar
    }
}

extension Date {
    var startOfMonth: Date {
        let calendar = Calendar.cuentas
        let components = calendar.dateComponents([.year, .month], from: self)
        return calendar.date(from: components) ?? self
    }

    var startOfNextMonth: Date {
        let calendar = Calendar.cuentas
        return calendar.date(byAdding: .month, value: 1, to: startOfMonth) ?? self
    }

    func addingMonths(_ value: Int) -> Date {
        Calendar.cuentas.date(byAdding: .month, value: value, to: self) ?? self
    }

    /// "agosto 2026"
    var monthYearLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.calendar = .cuentas
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: self).capitalizedFirst
    }

    /// "ago" — para ejes de gráficos.
    var shortMonthLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.calendar = .cuentas
        formatter.dateFormat = "LLL"
        return formatter.string(from: self).replacingOccurrences(of: ".", with: "").capitalizedFirst
    }

    /// "5 ago 2026"
    var mediumLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "es_ES")
        formatter.calendar = .cuentas
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: self).replacingOccurrences(of: ".", with: "")
    }

    var isInCurrentMonth: Bool {
        Calendar.cuentas.isDate(self, equalTo: .now, toGranularity: .month)
    }
}

extension String {
    var capitalizedFirst: String {
        guard let first else { return self }
        return first.uppercased() + dropFirst()
    }
}
