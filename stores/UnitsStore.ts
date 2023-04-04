import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import FiatStore from './FiatStore';
import FeeUtils from './../utils/FeeUtils';
import { Units } from '../enums';

type UnitsType = 'sats' | 'BTC' | 'fiat';

// 100_000_000
export const SATS_PER_BTC = 100000000;

interface ValueDisplayProps {
    amount: string;
    unit: Units;
    symbol?: string;
    negative?: boolean;
    plural?: boolean;
    rtl?: boolean;
    space?: boolean;
}

export default class UnitsStore {
    @observable public units: UnitsType = Units.sats;
    settingsStore: SettingsStore;
    fiatStore: FiatStore;

    constructor(settingsStore: SettingsStore, fiatStore: FiatStore) {
        this.settingsStore = settingsStore;
        this.fiatStore = fiatStore;
    }

    @action
    public changeUnits = () => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;

        if (!fiat || fiat === 'Disabled') {
            this.units = this.units == Units.sats ? Units.BTC : Units.sats;
        } else {
            switch (this.units) {
                case Units.sats:
                    this.units = Units.BTC;
                    break;
                case Units.BTC:
                    this.units = Units.fiat;
                    break;
                case Units.fiat:
                    this.units = Units.sats;
                    break;
            }
        }
    };

    @action
    public resetUnits = () => {
        this.units = Units.sats;
    };

    @action getUnformattedAmount = (
        value: string | number = 0,
        fixedUnits?: string
    ): ValueDisplayProps => {
        const { settings } = this.settingsStore;
        const { fiat, display } = settings;
        const showAllDecimalPlaces: boolean =
            (display && display.showAllDecimalPlaces) || false;
        const units = fixedUnits || this.units;

        const sats = Number(value);
        const negative = sats < 0;
        const absValueSats = Math.abs(sats);

        if (units === Units.BTC) {
            return {
                amount: FeeUtils.toFixed(
                    absValueSats / SATS_PER_BTC,
                    showAllDecimalPlaces
                ),
                unit: Units.BTC,
                negative,
                space: false
            };
        } else if (units === Units.sats) {
            return {
                amount: this.fiatStore.numberWithCommas(absValueSats),
                unit: Units.sats,
                negative,
                plural: !(Number(value) === 1 || Number(value) === -1)
            };
        } else {
            const currency = fiat;

            // TODO: is this the right place to catch this?
            if (!currency || currency === 'Disabled') {
                return {
                    amount: 'Disabled',
                    unit: Units.fiat,
                    symbol: '$'
                };
            }

            if (this.fiatStore.fiatRates && this.fiatStore.fiatRates.filter) {
                const fiatEntry = this.fiatStore.fiatRates.filter(
                    (entry: any) => entry.code === fiat
                )[0];
                const rate = (fiatEntry && fiatEntry.rate) || 0;
                const { symbol, space, rtl, separatorSwap } =
                    this.fiatStore.getSymbol();

                const amount = (
                    FeeUtils.toFixed(absValueSats / SATS_PER_BTC) * rate
                ).toFixed(2);

                return {
                    amount: separatorSwap
                        ? this.fiatStore.numberWithDecimals(amount)
                        : this.fiatStore.numberWithCommas(amount),
                    unit: Units.fiat,
                    symbol,
                    negative,
                    plural: false,
                    rtl,
                    space
                };
            } else {
                return { error: 'Error fetching fiat rates' };
            }
        }
    };

    @action
    public getAmount = (value: string | number = 0, fixedUnits?: string) => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;
        const units = fixedUnits || this.units;

        const [wholeSats] = value.toString().split('.');
        if (units === Units.BTC) {
            // handle negative values
            const valueToProcess = (wholeSats && wholeSats.toString()) || '0';
            if (valueToProcess.includes('-')) {
                const processedValue = valueToProcess.split('-')[1];
                return `-₿${FeeUtils.toFixed(
                    Number(processedValue) / SATS_PER_BTC
                )}`;
            }

            return `₿${FeeUtils.toFixed(
                Number(wholeSats || 0) / SATS_PER_BTC
            )}`;
        } else if (units === Units.sats) {
            const sats = `${this.fiatStore.numberWithCommas(value) || 0} ${
                Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
            }`;
            return sats;
        } else if (units === Units.fiat && fiat) {
            if (this.fiatStore.fiatRates && this.fiatStore.fiatRates.filter) {
                const fiatEntry = this.fiatStore.fiatRates.filter(
                    (entry: any) => entry.code === fiat
                )[0];
                const { code } = fiatEntry;
                const rate = (fiatEntry && fiatEntry.rate) || 0;
                const { symbol, space, rtl, separatorSwap } =
                    this.fiatStore.symbolLookup(code);

                const amount = (
                    FeeUtils.toFixed(Number(wholeSats || 0) / SATS_PER_BTC) *
                    rate
                ).toFixed(2);

                const formattedAmount = separatorSwap
                    ? this.fiatStore.numberWithDecimals(amount)
                    : this.fiatStore.numberWithCommas(amount);

                if (rtl) {
                    return `${formattedAmount}${space ? ' ' : ''}${symbol}`;
                } else {
                    return `${symbol}${space ? ' ' : ''}${formattedAmount}`;
                }
            } else {
                return '$N/A';
            }
        }
    };
}
