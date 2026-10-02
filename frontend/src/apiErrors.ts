import i18n from "./i18n";

const EXACT: Record<string, string> = {
  "Corredor no encontrado": "errors.brokerNotFound",
  "Título no encontrado": "errors.instrumentNotFound",
  "Movimiento no encontrado": "errors.tradeNotFound",
  "Objetivo no encontrado": "errors.targetNotFound",
  "Precio no encontrado": "errors.priceNotFound",
  "Ya existe un corredor con ese nombre": "errors.brokerExists",
  "Ya existe un título con ese nombre": "errors.instrumentExists",
  "No se puede inactivar: el título todavía tiene saldo mayor a 0": "errors.cannotInactivate",
  "No se puede comprar un título inactivo; actívelo primero": "errors.cannotBuyInactive",
  "No se puede borrar: hay movimientos con este corredor": "errors.cannotDeleteBroker",
  "No se puede borrar: hay movimientos, precios u objetivos de este título":
    "errors.cannotDeleteInstrument",
  "No se puede borrar: el saldo del corredor quedaría negativo": "errors.cannotDeleteTrade",
  broker_not_found: "errors.brokerNotFound",
  instrument_not_found: "errors.instrumentNotFound",
  trade_not_found: "errors.tradeNotFound",
  target_not_found: "errors.targetNotFound",
  price_not_found: "errors.priceNotFound",
  fx_rate_not_found: "errors.fxNotFound",
  fx_source_unavailable: "errors.fxSourceUnavailable",
  broker_exists: "errors.brokerExists",
  instrument_exists: "errors.instrumentExists",
  cannot_inactivate: "errors.cannotInactivate",
  cannot_buy_inactive: "errors.cannotBuyInactive",
  cannot_delete_broker: "errors.cannotDeleteBroker",
  cannot_delete_instrument: "errors.cannotDeleteInstrument",
  cannot_delete_trade: "errors.cannotDeleteTrade",
  cannot_change_currency: "errors.cannotChangeCurrency",
  sell_exceeds_balance: "errors.sellExceedsBalance",
  negative_balance: "errors.negativeBalance",
  fiduciary_not_found: "errors.fiduciaryNotFound",
  fund_not_found: "errors.fundNotFound",
  fund_trade_not_found: "errors.fundTradeNotFound",
  fund_target_not_found: "errors.fundTargetNotFound",
  unit_value_not_found: "errors.unitValueNotFound",
  fiduciary_exists: "errors.fiduciaryExists",
  fund_exists: "errors.fundExists",
  cannot_inactivate_fund: "errors.cannotInactivateFund",
  cannot_subscribe_inactive: "errors.cannotSubscribeInactive",
  cannot_delete_fiduciary: "errors.cannotDeleteFiduciary",
  cannot_delete_fund: "errors.cannotDeleteFund",
  cannot_delete_fund_trade: "errors.cannotDeleteFundTrade",
  redeem_exceeds_balance: "errors.redeemExceedsBalance",
  cannot_change_fund_currency: "errors.cannotChangeFundCurrency",
};

export function translateApiError(msg: string): string {
  if (EXACT[msg]) return i18n.t(EXACT[msg]);
  if (msg.startsWith("La venta supera el saldo")) return i18n.t("errors.sellExceedsBalance");
  return msg;
}
