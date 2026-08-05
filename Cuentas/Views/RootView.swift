//
//  RootView.swift
//  Cuentas
//

import SwiftUI
import SwiftData

enum AppTab: Hashable {
    case dashboard, movements, stats, settings
}

struct RootView: View {

    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase

    @State private var selectedTab: AppTab = .dashboard
    @State private var isAddingMovement = false

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView(onQuickAdd: { isAddingMovement = true })
                .tabItem { Label("Resumen", systemImage: "square.grid.2x2.fill") }
                .tag(AppTab.dashboard)

            MovementsListView(onAdd: { isAddingMovement = true })
                .tabItem { Label("Movimientos", systemImage: "list.bullet") }
                .tag(AppTab.movements)

            StatsView()
                .tabItem { Label("Gráficos", systemImage: "chart.pie.fill") }
                .tag(AppTab.stats)

            SettingsView()
                .tabItem { Label("Ajustes", systemImage: "gearshape.fill") }
                .tag(AppTab.settings)
        }
        .sheet(isPresented: $isAddingMovement) {
            AddMovementView()
        }
        .onAppear {
            DataStore.seedDefaultCategoriesIfNeeded(context)
            DataStore.reloadWidgets()
        }
        .onOpenURL(perform: handle)
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { DataStore.reloadWidgets() }
        }
    }

    /// Deep links del widget: cuentas://add y cuentas://resumen
    private func handle(_ url: URL) {
        guard url.scheme == SharedConfig.urlScheme else { return }
        switch url.host() {
        case "add":
            selectedTab = .dashboard
            isAddingMovement = true
        case "resumen":
            selectedTab = .dashboard
            isAddingMovement = false
        default:
            break
        }
    }
}

#Preview {
    RootView()
        .environment(AppSettings.shared)
        .modelContainer(DataStore.makeContainer(inMemory: true))
}
