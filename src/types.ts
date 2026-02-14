export type ScoreStatus = "READY_NOW" | "ALMOST_READY" | "GETTING_CLOSE" | "BUILDING" | "EARLY_STAGE" | "JUST_EXPLORING";

export interface ScoreInput {
  creditScoreRange: string | null;
  annualIncome: string | null;
  downPayment: string | null;
  priceRange: string | null;
  monthlyDebts: string | null;
  firstTimeBuyer: boolean | null;
  veteranStatus: string | null;
  // Phase 2 fields (optional for backward compatibility)
  employmentYears?: string | null;
  utahResident?: boolean | null;
  utahResidencyYears?: string | null;
  ruralInterest?: boolean | null;
}

export interface ScoreBreakdown {
  credit: number;
  dti: number;
  downPayment: number;
  employment: number;
  reserves: number;
  bonus: number;
  penalty: number;
}

export interface Gap {
  factor: string;
  severity: "high" | "medium" | "low";
  current: string;
  target: string;
  pointsLost: number;
  potentialGain: number;
  actionRequired: string;
}

export interface Recommendation {
  priority: number;
  category: string;
  title: string;
  description: string;
  impact: string;
}

export interface ProgramDetail {
  name: string;
  eligible: boolean;
  reason: string;
  benefit: string;
}

export type BlockerType = 'DTI' | 'DOWN_PAYMENT' | 'CREDIT' | 'EMPLOYMENT' | 'RESERVES' | 'NONE';

export interface Solution {
  type: 'ADJUST_PRICE' | 'PAY_DOWN_DEBT' | 'INCREASE_INCOME' | 'SAVE_MORE' | 'IMPROVE_CREDIT' | 'DPA_PROGRAMS' | 'COMBINATION';
  description: string;
  impact: string;
  timeline?: string;
  actionLabel: string;
  // For price adjustments:
  newPrice?: number;
  newScore?: number;
  newStatus?: string;
  monthlyPayment?: number;
  // For debt paydown:
  debtReduction?: number;
  // For income increase:
  incomeIncrease?: number;
}

export interface PrimaryBlocker {
  type: BlockerType;
  severity: 'critical' | 'significant' | 'minor';
  headline: string;
  subheadline: string;
  currentValue: string;
  targetValue: string;
  solutions: Solution[];
}

export interface SweetSpot {
  recommendedPrice: number;
  scoreAtPrice: number;
  statusAtPrice: ScoreStatus;
  timelineAtPrice: string;
  monthlyPayment: number;
  downPaymentNeeded: number;
  dtiAtPrice: number;
  whyThisWorks: string;
  comparedToTarget: {
    priceDifference: number;
    scoreDifference: number;
    paymentDifference: number;
  };
}

export interface PathToGoal {
  targetPrice: number;
  currentScore: number;
  requiredChanges: RequiredChange[];
  estimatedTimeline: string;
  encouragement: string;
}

export interface RequiredChange {
  type: 'debt_reduction' | 'income_increase' | 'savings_increase' | 'credit_improvement';
  amount: number;
  description: string;
  impact: string;
}

export interface ScoreResult {
  total: number;
  status: ScoreStatus;
  timeline: string;
  color: string;
  breakdown: ScoreBreakdown;
  programs: string[];
  programDetails: ProgramDetail[];
  gaps: Gap[];
  recommendations: Recommendation[];
  // Path Forward data
  primaryBlocker: PrimaryBlocker | null;
  sweetSpot: SweetSpot;
  pathToGoal: PathToGoal | null;
  // Parsed values for components
  parsedValues: {
    creditScore: number | null;
    monthlyIncome: number;
    annualIncome: number;
    monthlyDebts: number;
    targetPrice: number;
    savedAmount: number;
    currentDti: number;
  };
}

export interface AffordabilityResult {
  comfortable: {
    maxPrice: number;
    maxPayment: number;
    dti: number;
  };
  stretch: {
    maxPrice: number;
    maxPayment: number;
    dti: number;
  };
  atTargetPrice: {
    payment: number;
    dti: number;
  };
  monthlyIncome: number;
  monthlyDebts: number;
  currentRate: number;
}

export interface DPAEligibility {
  firstHome: { eligible: boolean; reason: string; benefit: string };
  homeAgain: { eligible: boolean; reason: string; benefit: string };
  fha: { eligible: boolean; reason: string; benefit: string };
  va: { eligible: boolean; reason: string; benefit: string };
  anyEligible: boolean;
  bestProgram: string | null;
  totalPotentialAssistance: number;
}

export interface ScoreValuesInput {
  creditScore: number | null;
  annualIncome: number;
  monthlyDebts: number;
  targetHomePrice: number;
  savedForDownPayment: number;
  firstTimeBuyer: boolean;
  veteranStatus: string | null;
  // Co-borrower (optional)
  coBorrowerCreditScore?: number | null;
  coBorrowerAnnualIncome?: number;
  coBorrowerMonthlyDebts?: number;
}
