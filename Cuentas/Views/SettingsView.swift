//
//  SettingsView.swift
//  Cuentas
//
//  Tipo de cambio, divisas y categorías.
//

import SwiftUI
import SwiftData

struct SettingsView: View {

    @Environment(AppSettings.self) private var settings
    @Environment(\.modelContext) private var context

    @Query private var movements: [Movement]

    @State private var rateText = ""
    @State private var showsDeleteConfirmation = false

    var body: some View {
        @Bindable var settings = settings

        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text("1 € =")
                        TextField("4,30", text: $rateText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .monospacedDigit()
                            .onSubmit(commitRate)
                        Text("zł")
                            .foregroundStyle(.secondary)
                    }

                    Button("Aplicar tipo de cambio", action: commitRate)
                        .disabled(parsedRate == nil || parsedRate == settings.rate)

                    if let updated = settings.rateUpdatedAt {
                        LabeledContent("Actualizado", value: updated.mediumLabel)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Tipo de cambio")
                } footer: {
                    Text("Se aplica a los movimientos nuevos y a la conversión de los totales. Cada movimiento guarda el tipo que había cuando lo creaste, así que el histórico en su divisa original no se toca.")
                }

                Section("Divisas") {
                    Picker("Divisa al introducir", selection: $settings.inputCurrency) {
                        ForEach(Currency.allCases) { currency in
                            Text("\(currency.rawValue) · \(currency.displayName)").tag(currency)
                        }
                    }
                    Picker("Divisa de los totales", selection: $settings.primaryCurrency) {
                        ForEach(Currency.allCases) { currency in
                            Text("\(currency.rawValue) · \(currency.displayName)").tag(currency)
                        }
                    }
                    Toggle("Mostrar equivalente", isOn: $settings.showsSecondaryCurrency)
                }

                Section {
                    NavigationLink {
                        CategoriesView()
                    } label: {
                        Label("Categorías", systemImage: "square.grid.2x2")
                    }
                }

                Section("Widget") {
                    Label("Mantén pulsada la pantalla de inicio → «Editar» → «+» → Cuentas",
                          systemImage: "square.text.square")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    LabeledContent("Movimientos guardados", value: "\(movements.count)")
                    Button("Borrar todos los movimientos", role: .destructive) {
                        showsDeleteConfirmation = true
                    }
                    .disabled(movements.isEmpty)
                } header: {
                    Text("Datos")
                } footer: {
                    Text("Todo se guarda sólo en el iPhone (SwiftData + App Group). No hay servidor ni cuenta.")
                }
            }
            .navigationTitle("Ajustes")
            .onAppear {
                if rateText.isEmpty {
                    rateText = String(format: "%.2f", settings.rate).replacingOccurrences(of: ".", with: ",")
                }
            }
            .onChange(of: settings.primaryCurrency) { _, _ in DataStore.reloadWidgets() }
            .confirmationDialog("¿Borrar todos los movimientos?",
                                isPresented: $showsDeleteConfirmation,
                                titleVisibility: .visible) {
                Button("Borrar todo", role: .destructive, action: deleteAllMovements)
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Esta acción no se puede deshacer. Las categorías se conservan.")
            }
        }
    }

    private var parsedRate: Double? {
        let value = Double(rateText.replacingOccurrences(of: ",", with: "."))
        guard let value, value > 0 else { return nil }
        return value
    }

    private func commitRate() {
        guard let parsedRate else { return }
        settings.rate = parsedRate
        rateText = String(format: "%.2f", parsedRate).replacingOccurrences(of: ".", with: ",")
        DataStore.reloadWidgets()
    }

    private func deleteAllMovements() {
        for movement in movements {
            context.delete(movement)
        }
        try? context.save()
        DataStore.reloadWidgets()
    }
}

#Preview {
    SettingsView()
        .environment(AppSettings.shared)
        .modelContainer(DataStore.makeContainer(inMemory: true))
}
