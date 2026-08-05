//
//  CategoriesView.swift
//  Cuentas
//
//  Las categorías son mías: puedo crearlas, renombrarlas, cambiarles el
//  icono/color, reordenarlas y borrarlas.
//

import SwiftUI
import SwiftData

struct CategoriesView: View {

    @Environment(\.modelContext) private var context

    @Query(sort: \Category.sortIndex)
    private var categories: [Category]

    @State private var editingCategory: Category?
    @State private var isCreating = false
    @State private var pendingDeletion: Category?

    var body: some View {
        List {
            Section {
                ForEach(categories) { category in
                    Button { editingCategory = category } label: {
                        HStack(spacing: 12) {
                            Image(systemName: category.symbolName)
                                .foregroundStyle(Color(hex: category.colorHex))
                                .frame(width: 30, height: 30)
                                .background(Color(hex: category.colorHex).opacity(0.16), in: .circle)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(category.name)
                                Text("\(category.movementCount) movimiento\(category.movementCount == 1 ? "" : "s")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .buttonStyle(.plain)
                }
                .onDelete { offsets in
                    if let index = offsets.first { pendingDeletion = categories[index] }
                }
                .onMove(perform: move)
            } footer: {
                Text("Al borrar una categoría los movimientos NO se borran: se quedan como «Sin categoría».")
            }
        }
        .navigationTitle("Categorías")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { isCreating = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Nueva categoría")
            }
            ToolbarItem(placement: .topBarLeading) { EditButton() }
        }
        .sheet(item: $editingCategory) { category in
            CategoryEditorView(category: category)
        }
        .sheet(isPresented: $isCreating) {
            CategoryEditorView(category: nil, nextSortIndex: (categories.last?.sortIndex ?? -1) + 1)
        }
        .confirmationDialog("¿Borrar categoría?",
                            isPresented: Binding(get: { pendingDeletion != nil },
                                                 set: { if !$0 { pendingDeletion = nil } }),
                            titleVisibility: .visible) {
            Button("Borrar", role: .destructive) {
                if let pendingDeletion {
                    context.delete(pendingDeletion)
                    try? context.save()
                    DataStore.reloadWidgets()
                }
                pendingDeletion = nil
            }
            Button("Cancelar", role: .cancel) { pendingDeletion = nil }
        } message: {
            Text(pendingDeletion.map { "«\($0.name)» tiene \($0.movementCount) movimiento(s). Se quedarán sin categoría." } ?? "")
        }
    }

    private func move(from source: IndexSet, to destination: Int) {
        var reordered = categories
        reordered.move(fromOffsets: source, toOffset: destination)
        for (index, category) in reordered.enumerated() {
            category.sortIndex = index
        }
        try? context.save()
    }
}

// MARK: - Editor

struct CategoryEditorView: View {

    let category: Category?
    var nextSortIndex: Int = 0

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context

    @State private var name = ""
    @State private var symbolName = "tag.fill"
    @State private var colorHex = Color.categoryPalette[0]
    @State private var didLoad = false

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 12) {
                        Image(systemName: symbolName)
                            .font(.title3)
                            .foregroundStyle(Color(hex: colorHex))
                            .frame(width: 44, height: 44)
                            .background(Color(hex: colorHex).opacity(0.16), in: .circle)
                        TextField("Nombre", text: $name)
                            .textInputAutocapitalization(.words)
                    }
                }

                Section("Color") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44), spacing: 12)], spacing: 12) {
                        ForEach(Color.categoryPalette, id: \.self) { hex in
                            Circle()
                                .fill(Color(hex: hex))
                                .frame(width: 34, height: 34)
                                .overlay {
                                    if hex == colorHex {
                                        Image(systemName: "checkmark")
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(.white)
                                    }
                                }
                                .onTapGesture { colorHex = hex }
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section("Icono") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44), spacing: 12)], spacing: 12) {
                        ForEach(Category.availableSymbols, id: \.self) { symbol in
                            Image(systemName: symbol)
                                .frame(width: 34, height: 34)
                                .background(symbol == symbolName
                                            ? Color(hex: colorHex).opacity(0.2)
                                            : Color.clear,
                                            in: .rect(cornerRadius: 8))
                                .foregroundStyle(symbol == symbolName ? Color(hex: colorHex) : .primary)
                                .onTapGesture { symbolName = symbol }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle(category == nil ? "Nueva categoría" : "Editar categoría")
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
            }
            .onAppear {
                guard !didLoad else { return }
                didLoad = true
                if let category {
                    name = category.name
                    symbolName = category.symbolName
                    colorHex = category.colorHex
                }
            }
        }
    }

    private func save() {
        let cleanName = name.trimmingCharacters(in: .whitespaces)
        if let category {
            category.name = cleanName
            category.symbolName = symbolName
            category.colorHex = colorHex
        } else {
            context.insert(Category(name: cleanName,
                                    symbolName: symbolName,
                                    colorHex: colorHex,
                                    sortIndex: nextSortIndex))
        }
        try? context.save()
        DataStore.reloadWidgets()
        dismiss()
    }
}

#Preview {
    NavigationStack {
        CategoriesView()
    }
    .modelContainer(DataStore.makeContainer(inMemory: true))
}
