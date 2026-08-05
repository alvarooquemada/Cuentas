//
//  AddMovementView.swift
//  Cuentas
//
//  Alta (y edición) de un movimiento. Pensada para meter un gasto en 3
//  toques: el teclado numérico sale solo y la fecha ya viene puesta a hoy.
//

import SwiftUI
import SwiftData

struct AddMovementView: View {

    /// Si viene informado, editamos ese movimiento en vez de crear uno nuevo.
    var editing: Movement?
    /// Categoría preseleccionada (atajos del panel principal).
    var preselectedCategory: Category?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Environment(AppSettings.self) private var settings

    @Query(filter: #Predicate<Category> { !$0.isArchived },
           sort: \Category.sortIndex)
    private var categories: [Category]

    @State private var amountText = ""
    @State private var kind: MovementKind = .expense
    @State private var currency: Currency = .pln
    @State private var note = ""
    @State private var date = Date()
    @State private var selectedCategory: Category?
    @State private var didLoad = false

    @FocusState private var amountFocused: Bool

    private var amountValue: Double {
        Double(amountText.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    private var canSave: Bool { amountValue > 0 }

    private var convertedText: String {
        let other = currency.other
        let value: Double
        switch (currency, other) {
        case (.pln, .eur): value = settings.rate > 0 ? amountValue / settings.rate : 0
        case (.eur, .pln): value = amountValue * settings.rate
        default: value = amountValue
        }
        return "≈ " + Money.string(value, currency: other)
    }

    var body: some View {
        NavigationStack {
            Form {
                amountSection
                typeSection
                categorySection
                detailsSection
            }
            .navigationTitle(editing == nil ? "Nuevo movimiento" : "Editar movimiento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar", action: save)
                        .disabled(!canSave)
                        .fontWeight(.semibold)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Listo") { amountFocused = false }
                }
            }
            .onAppear(perform: loadIfNeeded)
        }
    }

    // MARK: - Secciones

    private var amountSection: some View {
        Section {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                TextField("0", text: $amountText)
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .keyboardType(.decimalPad)
                    .focused($amountFocused)
                    .multilineTextAlignment(.leading)

                Picker("Divisa", selection: $currency) {
                    ForEach(Currency.allCases) { option in
                        Text(option.rawValue).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 120)
            }
            .padding(.vertical, 4)

            if amountValue > 0 {
                Text(convertedText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        } footer: {
            Text("Tipo de cambio actual: 1 € = \(String(format: "%.2f", settings.rate)) zł. Se guarda con el movimiento, así el histórico no cambia si luego lo actualizas.")
        }
    }

    private var typeSection: some View {
        Section {
            Picker("Tipo", selection: $kind) {
                ForEach(MovementKind.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var categorySection: some View {
        Section("Categoría") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
                ForEach(categories) { category in
                    categoryChip(category)
                }
            }
            .padding(.vertical, 4)

            if categories.isEmpty {
                Text("No hay categorías. Créalas en Ajustes → Categorías.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func categoryChip(_ category: Category) -> some View {
        let isSelected = selectedCategory?.persistentModelID == category.persistentModelID
        let color = Color(hex: category.colorHex)
        return Button {
            selectedCategory = category
        } label: {
            HStack(spacing: 6) {
                Image(systemName: category.symbolName)
                Text(category.name)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .font(.footnote.weight(isSelected ? .semibold : .regular))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(isSelected ? color.opacity(0.9) : color.opacity(0.14),
                        in: .rect(cornerRadius: 12))
            .foregroundStyle(isSelected ? Color.white : color)
        }
        .buttonStyle(.plain)
    }

    private var detailsSection: some View {
        Section {
            TextField("Concepto (ej. café en Zielona)", text: $note)
                .textInputAutocapitalization(.sentences)

            DatePicker("Fecha", selection: $date, displayedComponents: .date)
                .environment(\.locale, Locale(identifier: "es_ES"))

            HStack {
                Button("Hoy") { date = .now }
                    .buttonStyle(.bordered)
                Button("Ayer") { date = Calendar.cuentas.date(byAdding: .day, value: -1, to: .now) ?? .now }
                    .buttonStyle(.bordered)
            }
            .font(.footnote)
        }
    }

    // MARK: - Carga y guardado

    private func loadIfNeeded() {
        guard !didLoad else { return }
        didLoad = true

        if let movement = editing {
            amountText = String(format: "%.2f", movement.amount)
            kind = movement.kind
            currency = movement.currency
            note = movement.note
            date = movement.date
            selectedCategory = movement.category
        } else {
            currency = settings.inputCurrency
            selectedCategory = preselectedCategory ?? categories.first
            // Pequeño retardo: si se pide el foco en el mismo ciclo en que
            // aparece la hoja, UIKit todavía no tiene el campo montado.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                amountFocused = true
            }
        }
    }

    private func save() {
        guard canSave else { return }
        let cleanNote = note.trimmingCharacters(in: .whitespacesAndNewlines)

        if let movement = editing {
            movement.amount = Money.rounded(amountValue)
            movement.currency = currency
            movement.rate = settings.rate
            movement.kind = kind
            movement.note = cleanNote
            movement.date = date
            movement.category = selectedCategory
        } else {
            let movement = Movement(amount: amountValue,
                                    currency: currency,
                                    rate: settings.rate,
                                    kind: kind,
                                    note: cleanNote,
                                    date: date,
                                    category: selectedCategory)
            context.insert(movement)
            settings.inputCurrency = currency
        }

        try? context.save()
        DataStore.reloadWidgets()
        dismiss()
    }
}

#Preview {
    AddMovementView()
        .environment(AppSettings.shared)
        .modelContainer(DataStore.makeContainer(inMemory: true))
}
