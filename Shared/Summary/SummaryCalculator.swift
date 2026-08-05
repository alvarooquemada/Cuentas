//
//  SummaryCalculator.swift
//  Cuentas
//
//  Todos los cálculos de totales viven aquí para que la app y el widget
//  den siempre el mismo número. Los totales se calculan en PLN (divisa de
//  referencia) y se convierten al final.
//

import Foundation
import SwiftData

struct Totals: Equatable {
    var incomePLN: Double = 0
    var expensePLN: Double = 0

    var balancePLN: Double { incomePLN - expensePLN }
    var isEmpty: Bool { incomePLN == 0 && expensePLN == 0 }
}

struct CategoryTotal: Identifiable, Equatable {
    var id: UUID
    var name: String
    var colorHex: String
    var symbolName: String
    var totalPLN: Double
    var count: Int
}

struct MonthTotal: Identifiable, Equatable {
    var id: Date { month }
    var month: Date
    var incomePLN: Double
    var expensePLN: Double

    var balancePLN: Double { incomePLN - expensePLN }
    var label: String { month.shortMonthLabel }
}

enum SummaryCalculator {

    // MARK: - Totales

    static func totals(_ movements: [Movement]) -> Totals {
        var result = Totals()
        for movement in movements {
            switch movement.kind {
            case .income: result.incomePLN += movement.amountPLN
            case .expense: result.expensePLN += movement.amountPLN
            }
        }
        result.incomePLN = Money.rounded(result.incomePLN)
        result.expensePLN = Money.rounded(result.expensePLN)
        return result
    }

    // MARK: - Desglose por categoría

    static func byCategory(_ movements: [Movement], kind: MovementKind) -> [CategoryTotal] {
        let uncategorizedID = UUID(uuidString: "00000000-0000-0000-0000-000000000000")!
        var buckets: [UUID: CategoryTotal] = [:]

        for movement in movements where movement.kind == kind {
            let category = movement.category
            let key = category?.uid ?? uncategorizedID
            var bucket = buckets[key] ?? CategoryTotal(
                id: key,
                name: category?.name ?? "Sin categoría",
                colorHex: category?.colorHex ?? "#8E8E93",
                symbolName: category?.symbolName ?? "questionmark.circle.fill",
                totalPLN: 0,
                count: 0
            )
            bucket.totalPLN += movement.amountPLN
            bucket.count += 1
            buckets[key] = bucket
        }

        return buckets.values
            .map { CategoryTotal(id: $0.id,
                                 name: $0.name,
                                 colorHex: $0.colorHex,
                                 symbolName: $0.symbolName,
                                 totalPLN: Money.rounded($0.totalPLN),
                                 count: $0.count) }
            .sorted { $0.totalPLN > $1.totalPLN }
    }

    // MARK: - Evolución mes a mes

    /// Devuelve un punto por mes entre el primer movimiento y el mes actual
    /// (rellenando los meses sin actividad con ceros).
    static func monthlySeries(_ movements: [Movement], maxMonths: Int = 12) -> [MonthTotal] {
        guard !movements.isEmpty else { return [] }

        var buckets: [Date: (income: Double, expense: Double)] = [:]
        for movement in movements {
            let key = movement.date.startOfMonth
            var entry = buckets[key] ?? (0, 0)
            switch movement.kind {
            case .income: entry.income += movement.amountPLN
            case .expense: entry.expense += movement.amountPLN
            }
            buckets[key] = entry
        }

        let currentMonth = Date.now.startOfMonth
        let earliest = buckets.keys.min() ?? currentMonth
        let calendar = Calendar.cuentas
        let span = calendar.dateComponents([.month], from: earliest, to: currentMonth).month ?? 0
        let monthCount = min(max(span + 1, 1), maxMonths)
        let firstShown = currentMonth.addingMonths(-(monthCount - 1))

        return (0..<monthCount).map { offset in
            let month = firstShown.addingMonths(offset)
            let entry = buckets[month] ?? (0, 0)
            return MonthTotal(month: month,
                              incomePLN: Money.rounded(entry.income),
                              expensePLN: Money.rounded(entry.expense))
        }
    }

    // MARK: - Consulta para el widget

    /// Lee la base de datos compartida y devuelve los totales del mes en curso.
    static func fetchTotals(from container: ModelContainer,
                            month reference: Date = .now) -> Totals {
        let start = reference.startOfMonth
        let end = reference.startOfNextMonth
        let context = ModelContext(container)
        let descriptor = FetchDescriptor<Movement>(
            predicate: #Predicate<Movement> { $0.date >= start && $0.date < end }
        )
        let movements = (try? context.fetch(descriptor)) ?? []
        return totals(movements)
    }
}
