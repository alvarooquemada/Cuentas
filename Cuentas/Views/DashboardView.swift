//
//  DashboardView.swift
//  Cuentas
//
//  Pantalla principal: de un vistazo, cuánto llevo gastado este mes.
//

import SwiftUI
import SwiftData

struct DashboardView: View {

    let onQuickAdd: () -> Void

    @Environment(AppSettings.self) private var settings

    @Query(sort: \Movement.date, order: .reverse)
    private var allMovements: [Movement]

    @Query(filter: #Predicate<Category> { !$0.isArchived },
           sort: \Category.sortIndex)
    private var categories: [Category]

    @State private var quickCategory: Category?

    private var monthMovements: [Movement] {
        allMovements.filter { $0.date.isInCurrentMonth }
    }

    private var monthTotals: Totals {
        SummaryCalculator.totals(monthMovements)
    }

    private var topCategories: [CategoryTotal] {
        Array(SummaryCalculator.byCategory(monthMovements, kind: .expense).prefix(4))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    monthCard
                    quickAddSection
                    if !topCategories.isEmpty { categoryBreakdown }
                    recentMovements
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Cuentas")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onQuickAdd) {
                        Image(systemName: "plus.circle.fill")
                    }
                    .accessibilityLabel("Añadir movimiento")
                }
            }
            .sheet(item: $quickCategory) { category in
                AddMovementView(preselectedCategory: category)
            }
        }
    }

    // MARK: - Tarjeta del mes

    private var monthCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text(Date.now.monthYearLabel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("1 € = \(String(format: "%.2f", settings.rate)) zł")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Gastado este mes")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(primary(monthTotals.expensePLN))
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .contentTransition(.numericText())
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                if settings.showsSecondaryCurrency {
                    Text(secondary(monthTotals.expensePLN))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            HStack(spacing: 12) {
                miniStat(title: "Ingresos",
                         value: monthTotals.incomePLN,
                         color: .green,
                         icon: "arrow.down.left")
                miniStat(title: "Balance",
                         value: monthTotals.balancePLN,
                         color: monthTotals.balancePLN < 0 ? .red : .green,
                         icon: "equal.circle",
                         signed: true)
            }
        }
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
    }

    private func miniStat(title: String,
                          value: Double,
                          color: Color,
                          icon: String,
                          signed: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(title, systemImage: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
                .labelStyle(.titleAndIcon)
            Text(Money.string(settings.convertFromPLN(value, to: settings.primaryCurrency),
                              currency: settings.primaryCurrency,
                              showsSign: signed))
                .font(.headline.weight(.semibold))
                .foregroundStyle(color)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Alta rápida

    private var quickAddSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Button(action: onQuickAdd) {
                Label("Añadir movimiento", systemImage: "plus")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)

            if !categories.isEmpty {
                Text("Atajos")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(categories) { category in
                            Button { quickCategory = category } label: {
                                Label(category.name, systemImage: category.symbolName)
                                    .font(.subheadline)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(Color(hex: category.colorHex).opacity(0.18),
                                                in: .capsule)
                                    .foregroundStyle(Color(hex: category.colorHex))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 1)
                }
            }
        }
    }

    // MARK: - Desglose

    private var categoryBreakdown: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("En qué se va el dinero")
                .font(.headline)
            ForEach(topCategories) { item in
                let share = monthTotals.expensePLN > 0 ? item.totalPLN / monthTotals.expensePLN : 0
                VStack(spacing: 6) {
                    HStack {
                        Image(systemName: item.symbolName)
                            .foregroundStyle(Color(hex: item.colorHex))
                            .frame(width: 22)
                        Text(item.name)
                            .font(.subheadline)
                        Spacer()
                        Text(primary(item.totalPLN))
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                    }
                    ProgressView(value: share)
                        .tint(Color(hex: item.colorHex))
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
    }

    // MARK: - Últimos movimientos

    private var recentMovements: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Últimos movimientos")
                .font(.headline)

            if allMovements.isEmpty {
                ContentUnavailableView("Todavía no hay nada",
                                       systemImage: "tray",
                                       description: Text("Añade tu primer gasto y aparecerá aquí."))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(allMovements.prefix(6))) { movement in
                        MovementRow(movement: movement)
                            .padding(.vertical, 10)
                        if movement.persistentModelID != allMovements.prefix(6).last?.persistentModelID {
                            Divider()
                        }
                    }
                }
                .padding(.horizontal, 16)
                .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
            }
        }
    }

    // MARK: - Helpers de formato

    private func primary(_ valuePLN: Double) -> String {
        Money.string(settings.convertFromPLN(valuePLN, to: settings.primaryCurrency),
                     currency: settings.primaryCurrency)
    }

    private func secondary(_ valuePLN: Double) -> String {
        "≈ " + Money.string(settings.convertFromPLN(valuePLN, to: settings.secondaryCurrency),
                            currency: settings.secondaryCurrency)
    }
}

#Preview {
    DashboardView(onQuickAdd: {})
        .environment(AppSettings.shared)
        .modelContainer(DataStore.makeContainer(inMemory: true))
}
