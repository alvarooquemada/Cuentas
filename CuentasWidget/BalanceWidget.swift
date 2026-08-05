//
//  BalanceWidget.swift
//  CuentasWidget
//
//  Widget mediano con el balance del mes en curso. Lee la MISMA base de
//  datos de SwiftData que la app, alojada en el App Group.
//

import WidgetKit
import SwiftUI

struct BalanceEntry: TimelineEntry {
    let date: Date
    let totals: Totals
    let rate: Double
    let currency: Currency

    static let placeholder = BalanceEntry(
        date: .now,
        totals: Totals(incomePLN: 2400, expensePLN: 1685.40),
        rate: AppSettings.defaultRate,
        currency: .pln
    )
}

struct BalanceProvider: TimelineProvider {

    func placeholder(in context: Context) -> BalanceEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (BalanceEntry) -> Void) {
        completion(context.isPreview ? .placeholder : currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BalanceEntry>) -> Void) {
        let entry = currentEntry()
        // Nos volvemos a despertar dentro de una hora, o al empezar el mes
        // siguiente si eso ocurre antes (para resetear el total).
        let inAnHour = Date.now.addingTimeInterval(3600)
        let nextMonth = Date.now.startOfNextMonth
        let refresh = min(inAnHour, nextMonth)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private func currentEntry() -> BalanceEntry {
        BalanceEntry(date: .now,
                     totals: SummaryCalculator.fetchTotals(from: DataStore.shared),
                     rate: AppSettings.storedRate(),
                     currency: AppSettings.storedPrimaryCurrency())
    }
}

struct BalanceWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: SharedConfig.balanceWidgetKind,
                            provider: BalanceProvider()) { entry in
            BalanceWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Balance del mes")
        .description("Cuánto llevas gastado e ingresado este mes, con acceso rápido para apuntar un gasto.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Vista

struct BalanceWidgetView: View {

    let entry: BalanceEntry

    @Environment(\.widgetFamily) private var family

    private func money(_ valuePLN: Double,
                       signed: Bool = false,
                       compact: Bool = true) -> String {
        let converted: Double
        switch entry.currency {
        case .pln: converted = valuePLN
        case .eur: converted = entry.rate > 0 ? valuePLN / entry.rate : 0
        }
        return Money.string(converted,
                            currency: entry.currency,
                            maxDecimals: compact && abs(converted) >= 1000 ? 0 : 2,
                            showsSign: signed)
    }

    var body: some View {
        switch family {
        case .systemSmall: smallView
        default: mediumView
        }
    }

    // MARK: Small

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.date.monthYearLabel)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Spacer(minLength: 0)

            Text("Gastado")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(money(entry.totals.expensePLN))
                .font(.system(.title2, design: .rounded, weight: .bold))
                .minimumScaleFactor(0.5)
                .lineLimit(1)

            Spacer(minLength: 0)

            HStack(spacing: 4) {
                Image(systemName: "equal.circle.fill")
                Text(money(entry.totals.balancePLN, signed: true))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(entry.totals.balancePLN < 0 ? .red : .green)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .widgetURL(SharedConfig.addMovementURL)
    }

    // MARK: Medium

    private var mediumView: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(entry.date.monthYearLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                VStack(alignment: .leading, spacing: 0) {
                    Text("Gastado este mes")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(money(entry.totals.expensePLN))
                        .font(.system(size: 30, design: .rounded).weight(.bold))
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                HStack(spacing: 10) {
                    stat(icon: "arrow.down.left",
                         title: "Ingresos",
                         value: money(entry.totals.incomePLN),
                         color: .green)
                    stat(icon: "equal.circle",
                         title: "Balance",
                         value: money(entry.totals.balancePLN, signed: true),
                         color: entry.totals.balancePLN < 0 ? .red : .green)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Botón de alta rápida: abre la app directamente en "nuevo gasto".
            Link(destination: SharedConfig.addMovementURL) {
                VStack(spacing: 6) {
                    Image(systemName: "plus")
                        .font(.title2.weight(.bold))
                    Text("Apuntar")
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .foregroundStyle(.white)
                .frame(width: 76)
                .frame(maxHeight: .infinity)
                .background(Color.accentColor, in: .rect(cornerRadius: 16))
            }
        }
        // Tocar fuera del botón abre el resumen.
        .widgetURL(SharedConfig.summaryURL)
    }

    private func stat(icon: String, title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Label(title, systemImage: icon)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(color)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview(as: .systemMedium) {
    BalanceWidget()
} timeline: {
    BalanceEntry.placeholder
}
