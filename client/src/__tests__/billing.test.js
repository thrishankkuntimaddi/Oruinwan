import { describe, expect, test } from 'vitest';
import { defaultOffer, formatMoney, priceLine } from '../features/billing/billing';

const OFFERS = [
    { cycle: 'monthly', currency: 'USD', unitAmount: 600 },
    { cycle: 'yearly', currency: 'USD', unitAmount: 6000 },
    { cycle: 'yearly', currency: 'INR', unitAmount: 478800 },
];

describe('Pro checkout helpers', () => {
    test('money from cents and paise', () => {
        expect(formatMoney(6000, 'USD')).toBe('$60');
        expect(formatMoney(478800, 'INR')).toBe('₹4,788');
        expect(formatMoney(null, 'USD')).toBe('');
    });

    test('price for the member count', () => {
        expect(priceLine(OFFERS[1], 4)).toBe('$60 per member a year · 4 members = $240 a year');
        expect(priceLine(OFFERS[0], 0)).toBe('$6 per member a month · 1 member = $6 a month');
    });

    test('yearly, in rupees for Indian browsers', () => {
        expect(defaultOffer(OFFERS, 'en-IN')).toBe(OFFERS[2]);
        expect(defaultOffer(OFFERS, 'en-US')).toBe(OFFERS[1]);
        expect(defaultOffer([], 'en-US')).toBeNull();
    });
});
