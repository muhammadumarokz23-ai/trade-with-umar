import { InstrumentInfo, PositionCalculation, RiskSettings } from '../types/trading';

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  accountBalance: 100000, // Institutional $100k funded account benchmark
  riskPercentage: 1.0, // 1% per trade
  maxDailyLossPercentage: 3.0, // 3% daily limit
  maxConsecutiveLosses: 3,
  maxOpenPositions: 4,
  dailyTradeLimit: 5,
  minRiskReward: 2.0, // 1:2 minimum
  atrMultiplier: 1.5,
  slippagePips: 0.5,
  spreadFilterMaxPips: 3.0,
};

export class RiskEngine {
  /**
   * Calculate precise institutional position size and lot size.
   * Takes contract size, tick size, and currency risk into account.
   */
  static calculatePosition(
    instrument: InstrumentInfo,
    settings: RiskSettings,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): PositionCalculation {
    const warnings: string[] = [];

    // Verify valid prices
    const riskDistance = Math.abs(entryPrice - stopLoss);
    const rewardDistance = Math.abs(takeProfit - entryPrice);

    if (riskDistance <= 0) {
      return {
        symbol: instrument.symbol,
        market: instrument.market,
        entryPrice,
        stopLoss,
        takeProfit,
        riskAmountCurrency: 0,
        riskReward: 0,
        stopLossPipsOrTicks: 0,
        positionSizeUnits: 0,
        recommendedLots: 0,
        estimatedMarginRequired: 0,
        spreadCostEstimated: 0,
        isCompliant: false,
        warnings: ['Stop Loss cannot equal entry price.'],
      };
    }

    const rrRatio = Number((rewardDistance / riskDistance).toFixed(2));
    if (rrRatio < settings.minRiskReward) {
      warnings.push(`Risk-to-Reward ratio (1:${rrRatio}) is below the required institutional minimum of 1:${settings.minRiskReward}.`);
    }

    // Risk amount in USD (or base currency)
    const riskAmountCurrency = (settings.accountBalance * settings.riskPercentage) / 100;

    // Check spread filter
    if (instrument.spreadTypicalPips > settings.spreadFilterMaxPips) {
      warnings.push(`Spread (${instrument.spreadTypicalPips} pips) exceeds maximum safety filter (${settings.spreadFilterMaxPips} pips).`);
    }

    let positionSizeUnits = 0;
    let recommendedLots = 0;
    let stopLossPipsOrTicks = 0;

    if (instrument.market === 'forex') {
      // Forex calculation:
      // For pairs where USD is quote (EURUSD, GBPUSD, AUDUSD): Pip size is typically 0.0001 (or 0.01 for JPY pairs)
      const pipSize = instrument.symbol.includes('JPY') ? 0.01 : instrument.symbol.startsWith('XAU') ? 0.1 : 0.0001;
      stopLossPipsOrTicks = Number((riskDistance / pipSize).toFixed(1));

      // Pip value per standard lot (100,000 units) for EURUSD is $10 USD
      // For XAUUSD: 1 lot = 100 oz. 1 pip (0.1) = $10 USD
      const pipValuePerStandardLot = instrument.symbol.startsWith('XAU') ? 10 : 10;
      const totalPipsWithSlippage = stopLossPipsOrTicks + settings.slippagePips;

      if (totalPipsWithSlippage > 0 && pipValuePerStandardLot > 0) {
        recommendedLots = Number((riskAmountCurrency / (totalPipsWithSlippage * pipValuePerStandardLot)).toFixed(2));
        positionSizeUnits = Math.round(recommendedLots * instrument.contractSize);
      }
    } else if (instrument.market === 'crypto') {
      // Crypto calculation:
      // 1 unit = 1 coin. Risk distance in USDT = |Entry - SL|
      stopLossPipsOrTicks = Number(riskDistance.toFixed(instrument.precision));
      positionSizeUnits = Number((riskAmountCurrency / riskDistance).toFixed(4));
      recommendedLots = positionSizeUnits; // 1 lot = 1 unit for crypto contracts
    } else {
      // Stock calculation:
      // Shares = Risk Amount / |Entry - SL|
      stopLossPipsOrTicks = Number(riskDistance.toFixed(2));
      positionSizeUnits = Math.floor(riskAmountCurrency / riskDistance);
      recommendedLots = positionSizeUnits;
    }

    // Estimated margin required (assuming standard leverage: Forex 1:100, Crypto 1:10, Stocks 1:2)
    let leverage = 1;
    if (instrument.market === 'forex') leverage = 100;
    else if (instrument.market === 'crypto') leverage = 10;
    else if (instrument.market === 'stock') leverage = 2;

    const notionalValue = positionSizeUnits * entryPrice;
    const estimatedMarginRequired = Number((notionalValue / leverage).toFixed(2));

    const spreadCostEstimated = Number((instrument.spreadTypicalPips * (positionSizeUnits * (instrument.tickSize || 0.01))).toFixed(2));

    // Institutional sanity caps
    if (estimatedMarginRequired > settings.accountBalance * 0.5) {
      warnings.push('Position exceeds 50% account margin allocation. Leverage reduction recommended.');
    }

    const isCompliant = warnings.length === 0;

    return {
      symbol: instrument.symbol,
      market: instrument.market,
      entryPrice,
      stopLoss,
      takeProfit,
      riskAmountCurrency: Number(riskAmountCurrency.toFixed(2)),
      riskReward: rrRatio,
      stopLossPipsOrTicks,
      positionSizeUnits,
      recommendedLots,
      estimatedMarginRequired,
      spreadCostEstimated,
      isCompliant,
      warnings,
    };
  }
}
