import { getState, persist, subscribe, resetState, exportData, importData } from "./state.js";
import * as Categories from "./categories.js";
import * as Movements from "./movements.js";
import * as Accounts from "./accounts.js";
import * as Transfers from "./transfers.js";
import * as Investments from "./investments.js";
import * as Watchlist from "./watchlist.js";
import * as Ideas from "./ideas.js";
import * as Goals from "./goals.js";
import * as NetWorth from "./networth.js";

export const Store = {
  subscribe,
  getState,
  getSettings() {
    return getState().settings;
  },
  updateSettings(patch) {
    const state = getState();
    state.settings = { ...state.settings, ...patch };
    persist();
  },
  exportData,
  importData,
  resetAll: resetState,

  // Categorías
  getCategories: Categories.getCategories,
  getCategory: Categories.getCategory,
  addCategory: Categories.addCategory,
  updateCategory: Categories.updateCategory,
  deleteCategory: Categories.deleteCategory,

  // Movimientos
  getMovements: Movements.getMovements,
  getMovement: Movements.getMovement,
  addMovement: Movements.addMovement,
  updateMovement: Movements.updateMovement,
  deleteMovement: Movements.deleteMovement,

  // Cuentas
  getAccounts: Accounts.getAccounts,
  getAccount: Accounts.getAccount,
  addAccount: Accounts.addAccount,
  updateAccount: Accounts.updateAccount,
  deleteAccount: Accounts.deleteAccount,
  getAccountBalance: Accounts.getAccountBalance,
  getTotalLiquidity: Accounts.getTotalLiquidity,
  adjustAccountBalance: Accounts.adjustAccountBalance,

  // Transferencias
  getTransfers: Transfers.getTransfers,
  addTransfer: Transfers.addTransfer,
  deleteTransfer: Transfers.deleteTransfer,

  // Inversiones
  getInvestments: Investments.getInvestments,
  getInvestment: Investments.getInvestment,
  addInvestment: Investments.addInvestment,
  updateInvestment: Investments.updateInvestment,
  deleteInvestment: Investments.deleteInvestment,
  addOperation: Investments.addOperation,
  updateOperation: Investments.updateOperation,
  deleteOperation: Investments.deleteOperation,
  computeInvestment: Investments.computeInvestment,
  getTotalInvestmentsValue: Investments.getTotalInvestmentsValue,

  // Seguimiento (watchlist)
  getWatchlist: Watchlist.getWatchlist,
  getWatchlistItem: Watchlist.getWatchlistItem,
  addWatchlistItem: Watchlist.addWatchlistItem,
  updateWatchlistItem: Watchlist.updateWatchlistItem,
  deleteWatchlistItem: Watchlist.deleteWatchlistItem,

  // Ideas
  getIdeas: Ideas.getIdeas,
  getIdea: Ideas.getIdea,
  addIdea: Ideas.addIdea,
  updateIdea: Ideas.updateIdea,
  deleteIdea: Ideas.deleteIdea,

  // Objetivos
  getGoals: Goals.getGoals,
  getGoal: Goals.getGoal,
  addGoal: Goals.addGoal,
  updateGoal: Goals.updateGoal,
  deleteGoal: Goals.deleteGoal,
  computeGoalProgress: Goals.computeGoalProgress,

  // Patrimonio
  computeNetWorth: NetWorth.computeNetWorth,
  getNetWorthHistory: NetWorth.getNetWorthHistory,
  recordNetWorthSnapshot: NetWorth.recordNetWorthSnapshot,
  netWorthChangeSince: NetWorth.netWorthChangeSince,
};

export const OPERATION_TYPES = Investments.OPERATION_TYPES;
export const INVESTMENT_TYPES = Investments.INVESTMENT_TYPES;
export const WATCHLIST_STATUSES = Watchlist.WATCHLIST_STATUSES;
export const GOAL_KINDS = Goals.GOAL_KINDS;

export * from "./utils.js";
