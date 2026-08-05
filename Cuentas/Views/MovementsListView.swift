//
//  MovementsListView.swift
//  Cuentas
//
//  Listado ordenado por fecha con filtros por tipo y categoría.
//

import SwiftUI
import SwiftData

struct MovementsListView: View {

    let onAdd: () -> Void

    @Environment(\.modelContext) private var context
    @Environment(AppSettings.self) private var settings

    @Query(sort: \Movement.date, order: .reverse)
    private var movements: [Movement]

    @Query(sort: \Category.sortIndex)
    private var categories: [Category]

    @State private var kindFilter: KindFilter = .all
    @State private var categoryFilter: Category?
    @State private var searchText = ""
    @State private var editingMovement: Movement?

    enum KindFilter: Hashable, CaseIterable {
        case all, expense, income

        var label: String {
            switch self {
            case .all: return "Todo"
            case .expense: return "Gastos"
            case .income: return "Ingresos"
            }
        }

        var kind: MovementKind? {
            switch self {
            case .all: return nil
            case .expense: return .expense
            case .income: return .income
            }
        }
    }

    private var filtered: [Movement] {
        movements.filter { movement in
            if let kind = kindFilter.kind, movement.kind != kind { return false }
            if let categoryFilter,
               movement.category?.persistentModelID != categoryFilter.persistentModelID { return false }
            if !searchText.isEmpty {
                let haystack = movement.note + " " + (movement.category?.name ?? "")
                if !haystack.localizedCaseInsensitiveContains(searchText) { return false }
            }
            return true
        }
    }

    private struct MonthSection: Identifiable {
        var id: Date { month }
        let month: Date
        let movements: [Movement]
    }

    private var sections: [MonthSection] {
        Dictionary(grouping: filtered) { $0.date.startOfMonth }
            .map { MonthSection(month: $0.key, movements: $0.value) }
            .sorted { $0.month > $1.month }
    }

    private var filteredTotals: Totals {
        SummaryCalculator.totals(filtered)
    }

    var body: some View {
        NavigationStack {
            List {
                if !filtered.isEmpty {
                    Section {
                        HStack {
                            Text("\(filtered.count) movimiento\(filtered.count == 1 ? "" : "s")")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(Money.string(settings.convertFromPLN(filteredTotals.balancePLN,
                                                                      to: settings.primaryCurrency),
                                              currency: settings.primaryCurrency,
                                              showsSign: true))
                                .font(.footnote.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(filteredTotals.balancePLN < 0 ? .red : .green)
                        }
                    }
                }

                ForEach(sections) { section in
                    Section {
                        ForEach(section.movements) { movement in
                            Button { editingMovement = movement } label: {
                                MovementRow(movement: movement)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    delete(movement)
                                } label: {
                                    Label("Borrar", systemImage: "trash")
                                }
                            }
                        }
                    } header: {
                        HStack {
                            Text(section.month.monthYearLabel)
                            Spacer()
                            let total = SummaryCalculator.totals(section.movements)
                            Text(Money.string(settings.convertFromPLN(total.balancePLN,
                                                                      to: settings.primaryCurrency),
                                              currency: settings.primaryCurrency,
                                              showsSign: true))
                                .monospacedDigit()
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(text: $searchText, prompt: "Buscar por concepto o categoría")
            .overlay {
                if filtered.isEmpty {
                    ContentUnavailableView(movements.isEmpty ? "Sin movimientos" : "Nada con estos filtros",
                                           systemImage: movements.isEmpty ? "tray" : "line.3.horizontal.decrease.circle",
                                           description: Text(movements.isEmpty
                                                             ? "Añade tu primer gasto con el botón +."
                                                             : "Prueba a cambiar el tipo o la categoría."))
                }
            }
            .navigationTitle("Movimientos")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    filterMenu
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onAdd) { Image(systemName: "plus") }
                        .accessibilityLabel("Añadir movimiento")
                }
            }
            .safeAreaInset(edge: .top) {
                Picker("Tipo", selection: $kindFilter) {
                    ForEach(KindFilter.allCases, id: \.self) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.bottom, 8)
                .background(.bar)
            }
            .sheet(item: $editingMovement) { movement in
                AddMovementView(editing: movement)
            }
        }
    }

    private var filterMenu: some View {
        Menu {
            Picker("Categoría", selection: Binding(
                get: { categoryFilter?.persistentModelID },
                set: { newValue in
                    categoryFilter = categories.first { $0.persistentModelID == newValue }
                }
            )) {
                Text("Todas las categorías").tag(Optional<PersistentIdentifier>.none)
                ForEach(categories) { category in
                    Label(category.name, systemImage: category.symbolName)
                        .tag(Optional(category.persistentModelID))
                }
            }
        } label: {
            Image(systemName: categoryFilter == nil
                  ? "line.3.horizontal.decrease.circle"
                  : "line.3.horizontal.decrease.circle.fill")
        }
        .accessibilityLabel("Filtrar por categoría")
    }

    private func delete(_ movement: Movement) {
        context.delete(movement)
        try? context.save()
        DataStore.reloadWidgets()
    }
}

#Preview {
    MovementsListView(onAdd: {})
        .environment(AppSettings.shared)
        .modelContainer(DataStore.makeContainer(inMemory: true))
}
