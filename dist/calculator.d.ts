import type { ScoreInput, ScoreResult, AffordabilityResult, ScoreValuesInput } from './types';
export declare function estimateMonthlyPayment(price: number, downPaymentPercent?: number): number;
export declare function calculateMaxPriceForDti(monthlyIncome: number, monthlyDebts: number, targetDti: number, downPaymentPercent?: number): number;
export declare function calculateAffordability(annualIncome: string | null, monthlyDebtsRange: string | null, targetPriceRange: string | null): AffordabilityResult;
export declare function calculateScoreAtPrice(input: ScoreInput, overridePrice: number): ScoreResult;
/**
 * Calculate score from exact numeric values (for TheHomeStretch What-If panel).
 * Takes exact numbers instead of range strings, converts them internally
 * using the reverse range mapping helpers, and calls calculateScore().
 *
 * When a co-borrower is provided:
 * - Uses the lower credit score of the two (as lenders do)
 * - Combines annual income
 * - Combines monthly debts
 */
export declare function calculateScoreFromValues(input: ScoreValuesInput): ScoreResult;
export declare function calculateScore(input: ScoreInput): ScoreResult;
