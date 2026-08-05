//
//  MovementRow.swift
//  Cuentas
//

import SwiftUI

struct MovementRow: View {

    let movement: Movement

    @Environment(AppSettings.self) private var settings

    private var color: Color {
        Color(hex: movement.category?.colorHex ?? "#8E8E93")
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: movement.category?.symbolName ?? "questionmark.circle.fill")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 36, height: 36)
                .background(color.opacity(0.16), in: .circle)

            VStack(alignment: .leading, spacing: 2) {
                Text(movement.note.isEmpty ? (movement.category?.name ?? "Sin categoría") : movement.note)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                HStack(spacing: 4) {
                    if !movement.note.isEmpty {
                        Text(movement.category?.name ?? "Sin categoría")
                        Text("·")
                    }
                    Text(movement.date.mediumLabel)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 2) {
                Text(Money.string(settings.convertFromPLN(movement.amountPLN,
                                                          to: settings.primaryCurrency) * movement.kind.sign,
                                  currency: settings.primaryCurrency,
                                  showsSign: true))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(movement.kind == .income ? .green : .primary)

                if settings.showsSecondaryCurrency {
                    Text(Money.string(settings.convertFromPLN(movement.amountPLN,
                                                              to: settings.secondaryCurrency),
                                      currency: settings.secondaryCurrency))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .monospacedDigit()
                }
            }
        }
    }
}
