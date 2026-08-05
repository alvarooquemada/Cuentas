//
//  StatsView.swift
//  Cuentas
//
//  Desglose por categoría del mes elegido y evolución mes a mes del Erasmus.
//

import SwiftUI
import SwiftData
import Charts

struct StatsView: View {

    @Environment(AppSettings.self) private var settings

    @Query(sort: \Movement.date, order: .reverse)
    private var movements: [Movement]

    /// 0 = mes actual, -1 = mes anterior…
    @State private var monthOffset = 0
    @State private var chartKind: MovementKind = .expense

    private var selectedMonth: Date {
        Date.now.startOfMonth.addingMonths(monthOffset)
    }

    private var monthMovements: [Movement] {
        let start = selectedMonth
        let end = selectedMonth.startOfNextMonth
        return movements.filter { $0.date >= start && $0.date < end }
    }

    private var breakdown: [CategoryTotal] {
        SummaryCalculator.byCategory(monthMovements, kind: chartKind)
    }

    private var series: [MonthTotal] {
        SummaryCalculator.monthlySeries(movements)
    }

    private var monthTotal: Double {
        breakdown.reduce(0) { $0 + $1.totalPLN }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    monthPicker
                    kindPicker
                    donutCard
                    if !breakdown.isEmpty { breakdownList }
                    evolutionCard
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Gráficos")
        }
    }

    // MARK: - Selector de mes

    private var monthPicker: some View {
        HStack {
            Button {
                monthOffset -= 1
            } label: {
                Image(systemName: "chevron.left")
            }

            Spacer()
            Text(selectedMonth.monthYearLabel)
                .font(.headline)
            Spacer()

            Button {
                monthOffset += 1
            } label: {
                Image(systemName: "chevron.right")
            }
            .disabled(monthOffset >= 0)
        }
        .padding(.horizontal, 8)
        .padding(.top, 4)
    }

    private var kindPicker: some View {
        Picker("Tipo", selection: $chartKind) {
            ForEach(MovementKind.allCases) { kind in
                Text(kind == .expense ? "Gastos" : "Ingresos").tag(kind)
            }
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Donut

    private var donutCard: some View {
        VStack(spacing: 12) {
            if breakdown.isEmpty {
                ContentUnavailableView("Sin datos en \(selectedMonth.monthYearLabel)",
                                       systemImage: "chart.pie",
                                       description: Text("No hay \(chartKind == .expense ? "gastos" : "ingresos") registrados este mes."))
                    .frame(height: 200)
            } else {
                Chart(breakdown) { item in
                    SectorMark(
                        angle: .value("Importe", item.totalPLN),
                        innerRadius: .ratio(0.62),
                        angularInset: 1.5
                    )
                    .cornerRadius(4)
                    .foregroundStyle(Color(hex: item.colorHex))
                }
                .frame(height: 220)
                .chartBackground { _ in
                    VStack(spacing: 2) {
                        Text(chartKind == .expense ? "Gastado" : "Ingresado")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(Money.string(settings.convertFromPLN(monthTotal, to: settings.primaryCurrency),
                                          currency: settings.primaryCurrency,
                                          maxDecimals: 0))
                            .font(.title3.weight(.bold))
                            .monospacedDigit()
                            .minimumScaleFactor(0.6)
                            .lineLimit(1)
                            .padding(.horizontal, 24)
                    }
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
    }

    private var breakdownList: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(breakdown) { item in
                HStack(spacing: 10) {
                    Circle()
                        .fill(Color(hex: item.colorHex))
                        .frame(width: 10, height: 10)
                    Text(item.name)
                        .font(.subheadline)
                    Text("· \(item.count)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Spacer()
                    if monthTotal > 0 {
                        Text("\(Int((item.totalPLN / monthTotal * 100).rounded()))%")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Text(Money.string(settings.convertFromPLN(item.totalPLN, to: settings.primaryCurrency),
                                      currency: settings.primaryCurrency))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
    }

    // MARK: - Evolución mensual

    private var evolutionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Mes a mes")
                .font(.headline)

            if series.isEmpty {
                Text("Aún no hay histórico.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Chart {
                    ForEach(series) { point in
                        BarMark(
                            x: .value("Mes", point.label),
                            y: .value("Importe", settings.convertFromPLN(point.expensePLN,
                                                                        to: settings.primaryCurrency))
                        )
                        .position(by: .value("Tipo", "Gastos"))
                        .foregroundStyle(by: .value("Tipo", "Gastos"))

                        BarMark(
                            x: .value("Mes", point.label),
                            y: .value("Importe", settings.convertFromPLN(point.incomePLN,
                                                                        to: settings.primaryCurrency))
                        )
                        .position(by: .value("Tipo", "Ingresos"))
                        .foregroundStyle(by: .value("Tipo", "Ingresos"))
                    }
                }
                .chartForegroundStyleScale(["Gastos": Color.red, "Ingresos": Color.green])
                .chartLegend(position: .bottom)
                .frame(height: 220)

                VStack(spacing: 6) {
                    ForEach(series.reversed()) { point in
                        HStack {
                            Text(point.month.monthYearLabel)
                                .font(.caption)
                            Spacer()
                            Text(Money.string(settings.convertFromPLN(point.expensePLN,
                                                                      to: settings.primaryCurrency),
                                              currency: settings.primaryCurrency,
                                              maxDecimals: 0))
                                .font(.caption)
                                .foregroundStyle(.red)
                                .monospacedDigit()
                            Text(Money.string(settings.convertFromPLN(point.balancePLN,
                                                                      to: settings.primaryCurrency),
                                              currency: settings.primaryCurrency,
                                              maxDecimals: 0,
                                              showsSign: true))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(point.balancePLN < 0 ? .red : .green)
                                .monospacedDigit()
                                .frame(width: 90, alignment: .trailing)
                        }
                    }
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
    }
}

#Preview {
    StatsView()
        .environment(AppSettings.shared)
        .modelContainer(DataStore.makeContainer(inMemory: true))
}
