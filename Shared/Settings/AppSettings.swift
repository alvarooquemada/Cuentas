//
//  AppSettings.swift
//  Cuentas
//
//  Preferencias (tipo de cambio, divisas) guardadas en el UserDefaults del
//  App Group para que el widget pueda leerlas sin abrir la base de datos.
//

import Foundation
import Observation

@Observable
final class AppSettings {

    static let shared = AppSettings()

    /// Tipo de cambio de partida (PLN por 1 EUR) si nunca se ha configurado.
    static let defaultRate: Double = 4.30

    private enum Key {
        static let rate = "exchangeRatePLNPerEUR"
        static let rateUpdatedAt = "exchangeRateUpdatedAt"
        static let inputCurrency = "inputCurrency"
        static let primaryCurrency = "primaryCurrency"
        static let showsSecondary = "showsSecondaryCurrency"
    }

    /// UserDefaults compartido; si el App Group no estuviera disponible
    /// (entitlement mal configurado) caemos a `.standard` para no crashear.
    static let defaults: UserDefaults = {
        UserDefaults(suiteName: SharedConfig.appGroupID) ?? .standard
    }()

    // Estado observable. Las propiedades públicas son computadas para poder
    // escribir en UserDefaults en el `set` (con @Observable no se pueden usar
    // observadores `didSet`).
    private var rateValue: Double
    private var rateUpdatedAtValue: Date?
    private var inputCurrencyValue: Currency
    private var primaryCurrencyValue: Currency
    private var showsSecondaryValue: Bool

    @ObservationIgnored
    private let store: UserDefaults

    private init() {
        let defaults = Self.defaults
        self.store = defaults
        self.rateValue = Self.storedRate(in: defaults)
        self.rateUpdatedAtValue = defaults.object(forKey: Key.rateUpdatedAt) as? Date
        self.inputCurrencyValue = Currency(rawValue: defaults.string(forKey: Key.inputCurrency) ?? "") ?? .pln
        self.primaryCurrencyValue = Self.storedPrimaryCurrency(in: defaults)
        self.showsSecondaryValue = defaults.object(forKey: Key.showsSecondary) as? Bool ?? true
    }

    // MARK: - Tipo de cambio

    /// Złotys por 1 euro. Se edita a mano desde Ajustes.
    var rate: Double {
        get { rateValue }
        set {
            let clean = newValue > 0 ? newValue : Self.defaultRate
            rateValue = clean
            store.set(clean, forKey: Key.rate)
            rateUpdatedAt = .now
        }
    }

    /// Cuándo se tocó el tipo de cambio por última vez.
    var rateUpdatedAt: Date? {
        get { rateUpdatedAtValue }
        set {
            rateUpdatedAtValue = newValue
            store.set(newValue, forKey: Key.rateUpdatedAt)
        }
    }

    // MARK: - Divisas

    /// Divisa preseleccionada al crear un movimiento nuevo.
    var inputCurrency: Currency {
        get { inputCurrencyValue }
        set {
            inputCurrencyValue = newValue
            store.set(newValue.rawValue, forKey: Key.inputCurrency)
        }
    }

    /// Divisa en la que se muestran totales y resúmenes.
    var primaryCurrency: Currency {
        get { primaryCurrencyValue }
        set {
            primaryCurrencyValue = newValue
            store.set(newValue.rawValue, forKey: Key.primaryCurrency)
        }
    }

    /// Mostrar debajo el equivalente en la otra divisa.
    var showsSecondaryCurrency: Bool {
        get { showsSecondaryValue }
        set {
            showsSecondaryValue = newValue
            store.set(newValue, forKey: Key.showsSecondary)
        }
    }

    var secondaryCurrency: Currency { primaryCurrency.other }

    // MARK: - Conversión con el tipo de cambio ACTUAL

    /// Convierte un importe ya normalizado a PLN hacia la divisa pedida.
    func convertFromPLN(_ valuePLN: Double, to currency: Currency) -> Double {
        switch currency {
        case .pln: return valuePLN
        case .eur: return rate > 0 ? Money.rounded(valuePLN / rate) : 0
        }
    }

    // MARK: - Lectura sin instancia (widget)

    static func storedRate(in defaults: UserDefaults = AppSettings.defaults) -> Double {
        let value = defaults.double(forKey: Key.rate)
        return value > 0 ? value : defaultRate
    }

    static func storedPrimaryCurrency(in defaults: UserDefaults = AppSettings.defaults) -> Currency {
        Currency(rawValue: defaults.string(forKey: Key.primaryCurrency) ?? "") ?? .pln
    }
}
