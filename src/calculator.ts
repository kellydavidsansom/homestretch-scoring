import type {
  ScoreStatus,
  ScoreInput,
  ScoreBreakdown,
  Gap,
  Recommendation,
  ProgramDetail,
  Solution,
  PrimaryBlocker,
  SweetSpot,
  PathToGoal,
  RequiredChange,
  ScoreResult,
  AffordabilityResult,
  DPAEligibility,
  ScoreValuesInput,
} from './types';

// Credit score range to approximate score mapping
function getCreditScore(range: string | null): number | null {
  if (!range) return null;

  const mapping: Record<string, number> = {
    "below-580": 550,
    "580-619": 600,
    "620-659": 640,
    "660-699": 680,
    "700-739": 720,
    "740-plus": 760,
    "not-sure": null as unknown as number,
  };

  return mapping[range] ?? null;
}

// Calculate credit points (30 max)
function calculateCreditPoints(creditScore: number | null): number {
  if (!creditScore) return 15; // Unknown - middle estimate

  if (creditScore >= 740) return 30;
  if (creditScore >= 720) return 27;
  if (creditScore >= 700) return 24;
  if (creditScore >= 680) return 20;
  if (creditScore >= 660) return 17;
  if (creditScore >= 640) return 14;
  if (creditScore >= 620) return 10;
  if (creditScore >= 580) return 5;
  if (creditScore >= 500) return 2;
  return 0;
}

// Get income amount from range
function getIncomeAmount(range: string | null): number {
  if (!range) return 60000; // Default assumption

  const mapping: Record<string, number> = {
    "under-40k": 35000,
    "40k-60k": 50000,
    "60k-80k": 70000,
    "80k-100k": 90000,
    "100k-150k": 125000,
    "150k-180k": 165000,
    "180k-220k": 200000,
    "220k-plus": 250000,
  };

  return mapping[range] ?? 60000;
}

// Get price amount from range
function getPriceAmount(range: string | null): number {
  if (!range) return 500000; // Default assumption (Utah avg ~$589k)

  const mapping: Record<string, number> = {
    "under-400k": 350000,
    "400k-500k": 450000,
    "500k-600k": 550000,
    "600k-700k": 650000,
    "700k-800k": 750000,
    "800k-900k": 850000,
    "900k-1m": 950000,
    "1m-plus": 1200000,
  };

  return mapping[range] ?? 500000;
}

// Get down payment amount from range
function getDownPaymentAmount(range: string | null): number {
  if (!range) return 20000; // Default assumption

  const mapping: Record<string, number> = {
    "under-10k": 5000,
    "10k-25k": 17500,
    "25k-50k": 37500,
    "50k-75k": 62500,
    "75k-100k": 87500,
    "100k-140k": 120000,
    "140k-180k": 160000,
    "180k-220k": 200000,
    "220k-260k": 240000,
    "260k-plus": 300000,
  };

  return mapping[range] ?? 20000;
}

// Get monthly debt amount from range
function getMonthlyDebtAmount(range: string | null): number {
  if (!range) return 0; // Default to no debt if not specified

  const mapping: Record<string, number> = {
    none: 0,
    "under-250": 125,
    "250-500": 375,
    "500-1000": 750,
    "1000-2000": 1500,
    "2000-2500": 2250,
    "2500-3000": 2750,
    "3000-plus": 3500,
  };

  return mapping[range] ?? 0;
}

// Current mortgage rate - TODO: make configurable per tenant
const CURRENT_RATE = 0.06; // 6.0% as of Jan 2025

// Estimate monthly payment (PITI)
export function estimateMonthlyPayment(price: number, downPaymentPercent: number = 0.035): number {
  // Assumptions: 6.0% rate, 30-year, 1.2% property tax, $100/mo insurance
  const downPayment = price * downPaymentPercent;
  const loanAmount = price - downPayment;
  const monthlyRate = CURRENT_RATE / 12;
  const numPayments = 360;

  const mortgage =
    (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  const propertyTax = (price * 0.012) / 12;
  const insurance = 100;
  const pmi = (loanAmount * 0.008) / 12; // ~0.8% PMI

  return mortgage + propertyTax + insurance + pmi;
}

// Calculate DTI points (25 max)
function calculateDtiPoints(
  monthlyIncome: number,
  targetPrice: number,
  monthlyDebts: number
): number {
  // Calculate DTI based on estimated mortgage payment plus actual debt
  const estimatedPayment = estimateMonthlyPayment(targetPrice);
  const totalObligations = estimatedPayment + monthlyDebts;
  const dti = (totalObligations / monthlyIncome) * 100;

  if (dti < 28) return 25;
  if (dti < 36) return 22;
  if (dti < 41) return 18;
  if (dti < 44) return 14;
  if (dti < 50) return 10;
  if (dti < 57) return 5;
  return 0;
}

// Calculate down payment points (20 max)
function calculateDownPaymentPoints(
  saved: number,
  targetPrice: number,
  veteranStatus: string | null
): number {
  // VA eligible gets automatic 15 points (0% down available)
  if (
    veteranStatus &&
    ["active", "veteran", "guard-reserve", "spouse"].includes(veteranStatus)
  ) {
    return 15;
  }

  const percentage = (saved / targetPrice) * 100;

  if (percentage >= 20) return 20;
  if (percentage >= 15) return 17;
  if (percentage >= 10) return 14;
  if (percentage >= 5) return 10;
  if (percentage >= 3.5) return 7;
  if (percentage >= 3) return 5;
  if (percentage >= 1) return 3;
  return 1;
}

// Calculate employment points (15 max)
// In simplified flow, we assume stable employment
function calculateEmploymentPoints(): number {
  return 12; // Assume 2+ years, reasonable default
}

// Calculate reserves points (10 max)
// In simplified flow, estimate based on down payment saved
function calculateReservesPoints(saved: number, targetPrice: number): number {
  // Assume some portion is reserves after down payment
  const downPaymentNeeded = targetPrice * 0.035;
  const reserves = Math.max(0, saved - downPaymentNeeded);
  const monthlyPiti = estimateMonthlyPayment(targetPrice);
  const months = reserves / monthlyPiti;

  if (months >= 6) return 10;
  if (months >= 4) return 8;
  if (months >= 3) return 6;
  if (months >= 2) return 4;
  if (months >= 1) return 2;
  return 0;
}

// Calculate bonus points
function calculateBonusPoints(
  firstTimeBuyer: boolean | null,
  veteranStatus: string | null
): number {
  let bonus = 0;

  // Veteran status
  if (
    veteranStatus &&
    ["active", "veteran", "guard-reserve", "spouse"].includes(veteranStatus)
  ) {
    bonus += 10;
  }

  // First-time buyer
  if (firstTimeBuyer === true) {
    bonus += 5;
  }

  return bonus;
}

// Get status from score
function getStatus(score: number): ScoreStatus {
  if (score >= 85) return "READY_NOW";
  if (score >= 75) return "ALMOST_READY";
  if (score >= 60) return "GETTING_CLOSE";
  if (score >= 45) return "BUILDING";
  if (score >= 25) return "EARLY_STAGE";
  return "JUST_EXPLORING";
}

// Get timeline from score
function getTimeline(score: number): string {
  if (score >= 85) return "0-1 months";
  if (score >= 75) return "1-2 months";
  if (score >= 60) return "3-6 months";
  if (score >= 45) return "6-12 months";
  if (score >= 25) return "12-18 months";
  return "18+ months";
}

// Get color from status
function getColor(status: ScoreStatus): string {
  const colors: Record<ScoreStatus, string> = {
    READY_NOW: "red",
    ALMOST_READY: "orange",
    GETTING_CLOSE: "yellow",
    BUILDING: "blue",
    EARLY_STAGE: "blue",
    JUST_EXPLORING: "blue",
  };
  return colors[status];
}

// Match programs
function matchPrograms(
  creditScore: number | null,
  firstTimeBuyer: boolean | null,
  veteranStatus: string | null,
  income: number
): ProgramDetail[] {
  const programs: ProgramDetail[] = [];
  const score = creditScore || 650;

  // VA Loan
  if (
    veteranStatus &&
    ["active", "veteran", "guard-reserve", "spouse"].includes(veteranStatus)
  ) {
    programs.push({
      name: "VA Loan",
      eligible: true,
      reason: "Military service",
      benefit: "0% down payment, no PMI",
    });
  }

  // FHA Loan
  if (score >= 580) {
    programs.push({
      name: "FHA Loan",
      eligible: true,
      reason: score >= 580 ? "Credit score qualifies" : "Need 580+ credit",
      benefit: "3.5% down payment",
    });
  }

  // Conventional
  if (score >= 620) {
    programs.push({
      name: "Conventional Loan",
      eligible: true,
      reason: "Credit score qualifies",
      benefit: "Competitive rates, 3-5% down",
    });
  }

  // Utah FirstHome (first-time buyer program)
  if (firstTimeBuyer && score >= 660 && income < 141400) {
    programs.push({
      name: "Utah FirstHome",
      eligible: true,
      reason: "First-time buyer with qualifying credit and income",
      benefit: "Up to 6% down payment assistance",
    });
  }

  // Utah HomeAgain
  if (score >= 660 && income < 141400) {
    programs.push({
      name: "Utah HomeAgain",
      eligible: true,
      reason: "Credit and income qualify",
      benefit: "Down payment assistance available",
    });
  }

  return programs;
}

// Identify gaps
function identifyGaps(
  creditScore: number | null,
  creditPoints: number,
  downPaymentPoints: number,
  dtiPoints: number,
  saved: number,
  targetPrice: number
): Gap[] {
  const gaps: Gap[] = [];

  // Credit gap
  if (creditPoints < 20) {
    gaps.push({
      factor: "credit",
      severity: creditPoints < 10 ? "high" : "medium",
      current: creditScore ? `${creditScore}` : "Unknown",
      target: "680+",
      pointsLost: 30 - creditPoints,
      potentialGain: Math.min(10, 30 - creditPoints),
      actionRequired: "Improve credit score to unlock better rates",
    });
  }

  // Down payment gap
  if (downPaymentPoints < 10) {
    const percentage = ((saved / targetPrice) * 100).toFixed(1);
    gaps.push({
      factor: "down_payment",
      severity: downPaymentPoints < 5 ? "high" : "medium",
      current: `${percentage}%`,
      target: "5%+",
      pointsLost: 20 - downPaymentPoints,
      potentialGain: Math.min(7, 20 - downPaymentPoints),
      actionRequired: `Save more for down payment`,
    });
  }

  // DTI gap
  if (dtiPoints < 14) {
    gaps.push({
      factor: "dti",
      severity: dtiPoints < 5 ? "high" : "medium",
      current: "High",
      target: "Under 43%",
      pointsLost: 25 - dtiPoints,
      potentialGain: Math.min(10, 25 - dtiPoints),
      actionRequired: "Reduce debt or increase income",
    });
  }

  return gaps.sort((a, b) => b.potentialGain - a.potentialGain);
}

// Generate recommendations
function generateRecommendations(gaps: Gap[]): Recommendation[] {
  return gaps.map((gap, index) => {
    switch (gap.factor) {
      case "credit":
        return {
          priority: index + 1,
          category: "credit",
          title: "Boost Your Credit Score",
          description:
            "Pay down credit cards to below 30% of limits, avoid new credit applications, and dispute any errors on your report.",
          impact: `+${gap.potentialGain} points to your Home Ready Score`,
        };
      case "down_payment":
        return {
          priority: index + 1,
          category: "savings",
          title: "Build Your Down Payment",
          description:
            "Set up automatic transfers to savings. Look into down payment assistance programs you may qualify for.",
          impact: `+${gap.potentialGain} points to your Home Ready Score`,
        };
      case "dti":
        return {
          priority: index + 1,
          category: "debt",
          title: "Lower Your Debt-to-Income Ratio",
          description:
            "Focus on paying off high-interest debt or consider a lower price point to improve your DTI ratio.",
          impact: `+${gap.potentialGain} points to your Home Ready Score`,
        };
      default:
        return {
          priority: index + 1,
          category: "general",
          title: "Improve Your Profile",
          description: gap.actionRequired,
          impact: `+${gap.potentialGain} points`,
        };
    }
  });
}

// ============================================================================
// DPA PROGRAM ELIGIBILITY (Utah-specific)
// ============================================================================

// Program limits (2025 Utah values)
const PROGRAM_LIMITS = {
  firstHome: {
    incomeLimitSmallHousehold: 121200,  // 1-2 person
    incomeLimitLargeHousehold: 141400,  // 3+ person
    minCreditScore: 660,
    maxAssistancePercent: 0.06,
  },
  homeAgain: {
    incomeLimit: 141400,
    minCreditScore: 660,
    maxAssistancePercent: 0.06,
  },
  fha: {
    minCreditScore35Down: 580,
    minCreditScore10Down: 500,
  },
};

function checkDPAEligibility(
  creditScore: number | null,
  annualIncome: number,
  targetPrice: number,
  firstTimeBuyer: boolean | null,
  veteranStatus: string | null
): DPAEligibility {
  const score = creditScore || 650; // Default assumption if unknown
  const isVeteran = veteranStatus && ["active", "veteran", "guard-reserve", "spouse"].includes(veteranStatus);

  // Check Utah FirstHome (first-time buyer program)
  const firstHomeEligible =
    firstTimeBuyer === true &&
    score >= PROGRAM_LIMITS.firstHome.minCreditScore &&
    annualIncome <= PROGRAM_LIMITS.firstHome.incomeLimitLargeHousehold;

  const firstHomeResult = {
    eligible: firstHomeEligible,
    reason: !firstTimeBuyer
      ? "First-time buyer status required"
      : score < PROGRAM_LIMITS.firstHome.minCreditScore
        ? `Requires 660+ credit (yours is ~${score})`
        : annualIncome > PROGRAM_LIMITS.firstHome.incomeLimitLargeHousehold
          ? `Income over $141,400 limit`
          : "You qualify!",
    benefit: `Up to ${formatCurrency(targetPrice * PROGRAM_LIMITS.firstHome.maxAssistancePercent)} (6%)`,
  };

  // Check Utah HomeAgain (no first-time requirement)
  const homeAgainEligible =
    score >= PROGRAM_LIMITS.homeAgain.minCreditScore &&
    annualIncome <= PROGRAM_LIMITS.homeAgain.incomeLimit;

  const homeAgainResult = {
    eligible: homeAgainEligible,
    reason: score < PROGRAM_LIMITS.homeAgain.minCreditScore
      ? `Requires 660+ credit (yours is ~${score})`
      : annualIncome > PROGRAM_LIMITS.homeAgain.incomeLimit
        ? `Income over $141,400 limit`
        : "You qualify!",
    benefit: `Up to ${formatCurrency(targetPrice * PROGRAM_LIMITS.homeAgain.maxAssistancePercent)} (6%)`,
  };

  // Check FHA eligibility
  const fhaEligible = score >= PROGRAM_LIMITS.fha.minCreditScore10Down;
  const fhaDownPercent = score >= PROGRAM_LIMITS.fha.minCreditScore35Down ? 3.5 : 10;

  const fhaResult = {
    eligible: fhaEligible,
    reason: !fhaEligible
      ? `Requires 500+ credit (yours is ~${score})`
      : `${fhaDownPercent}% down payment`,
    benefit: `${fhaDownPercent}% down (${formatCurrency(targetPrice * (fhaDownPercent / 100))})`,
  };

  // Check VA eligibility
  const vaResult = {
    eligible: !!isVeteran,
    reason: isVeteran ? "Military service qualifies you" : "Requires military service",
    benefit: "0% down payment, no PMI",
  };

  // Calculate total potential assistance
  let totalAssistance = 0;
  if (firstHomeEligible) {
    totalAssistance += targetPrice * 0.06;
  } else if (homeAgainEligible) {
    totalAssistance += targetPrice * 0.06;
  }

  // Determine best program
  let bestProgram: string | null = null;
  if (isVeteran) {
    bestProgram = "VA Loan (0% down, no PMI)";
  } else if (firstHomeEligible) {
    bestProgram = "Utah FirstHome (up to 6% down payment help)";
  } else if (homeAgainEligible) {
    bestProgram = "Utah HomeAgain (up to 6% down payment help)";
  } else if (fhaEligible) {
    bestProgram = `FHA (${fhaDownPercent}% down)`;
  }

  return {
    firstHome: firstHomeResult,
    homeAgain: homeAgainResult,
    fha: fhaResult,
    va: vaResult,
    anyEligible: firstHomeEligible || homeAgainEligible || fhaEligible || !!isVeteran,
    bestProgram,
    totalPotentialAssistance: totalAssistance,
  };
}

// ============================================================================
// PATH FORWARD CALCULATIONS
// ============================================================================

// Calculate what monthly debt reduction is needed to hit target DTI
function calculateDebtReductionForDti(
  monthlyIncome: number,
  currentDebts: number,
  housingPayment: number,
  targetDti: number
): number {
  const maxTotalObligations = monthlyIncome * (targetDti / 100);
  const currentTotal = housingPayment + currentDebts;
  const reduction = currentTotal - maxTotalObligations;
  return Math.max(0, Math.round(reduction));
}

// Calculate what monthly income increase is needed to hit target DTI
function calculateIncomeForDti(
  currentIncome: number,
  monthlyDebts: number,
  housingPayment: number,
  targetDti: number
): number {
  const totalObligations = housingPayment + monthlyDebts;
  const requiredIncome = totalObligations / (targetDti / 100);
  const increase = requiredIncome - currentIncome;
  return Math.max(0, Math.round(increase));
}

// Calculate current DTI
function calculateCurrentDti(
  monthlyIncome: number,
  monthlyDebts: number,
  housingPayment: number
): number {
  return Math.round(((housingPayment + monthlyDebts) / monthlyIncome) * 100);
}

// Detect the primary blocker preventing home readiness
function detectPrimaryBlocker(
  creditScore: number | null,
  creditPoints: number,
  dtiPoints: number,
  downPaymentPoints: number,
  monthlyIncome: number,
  monthlyDebts: number,
  targetPrice: number,
  saved: number,
  veteranStatus: string | null,
  annualIncome: number,
  firstTimeBuyer: boolean | null
): PrimaryBlocker | null {
  // Check DPA eligibility upfront
  const dpaEligibility = checkDPAEligibility(
    creditScore,
    annualIncome,
    targetPrice,
    firstTimeBuyer,
    veteranStatus
  );
  const housingPayment = estimateMonthlyPayment(targetPrice);
  const currentDti = calculateCurrentDti(monthlyIncome, monthlyDebts, housingPayment);
  const downPaymentPercent = (saved / targetPrice) * 100;

  // Check DTI first (most common blocker)
  if (currentDti > 50) {
    const solutions: Solution[] = [];

    // Option 1: Lower price
    const affordablePrice = calculateMaxPriceForDti(monthlyIncome, monthlyDebts, 43);
    if (affordablePrice > 0 && affordablePrice < targetPrice) {
      const newPayment = estimateMonthlyPayment(affordablePrice);
      solutions.push({
        type: 'ADJUST_PRICE',
        description: `Target homes around ${formatCurrency(affordablePrice)} instead`,
        impact: `Brings your DTI to 43% - within lender guidelines`,
        actionLabel: 'See homes in this range',
        newPrice: affordablePrice,
        monthlyPayment: Math.round(newPayment),
      });
    }

    // Option 2: Pay down debt
    const debtReduction = calculateDebtReductionForDti(monthlyIncome, monthlyDebts, housingPayment, 43);
    if (debtReduction > 0 && debtReduction <= monthlyDebts) {
      solutions.push({
        type: 'PAY_DOWN_DEBT',
        description: `Reduce monthly debt payments by ${formatCurrency(debtReduction)}/mo`,
        impact: `Brings your DTI to 43% at your target price`,
        timeline: debtReduction > 500 ? '6-12 months' : '3-6 months',
        actionLabel: 'See payoff strategies',
        debtReduction,
      });
    }

    // Option 3: Increase income
    const incomeIncrease = calculateIncomeForDti(monthlyIncome, monthlyDebts, housingPayment, 43);
    if (incomeIncrease > 0) {
      solutions.push({
        type: 'INCREASE_INCOME',
        description: `Increase monthly income by ${formatCurrency(incomeIncrease)}`,
        impact: `Brings your DTI to 43% at your target price`,
        timeline: '3-6 months',
        actionLabel: 'Explore options',
        incomeIncrease,
      });
    }

    return {
      type: 'DTI',
      severity: currentDti > 57 ? 'critical' : 'significant',
      headline: `Your dream home at ${formatCurrency(targetPrice)} would take about ${currentDti}% of your monthly income`,
      subheadline: `Lenders typically want to see 43% or less. Here are your options:`,
      currentValue: `${currentDti}%`,
      targetValue: '43% or less',
      solutions,
    };
  }

  // Check DTI (moderate - 43-50%)
  if (currentDti > 43 && currentDti <= 50) {
    const solutions: Solution[] = [];

    // Can still qualify for FHA at higher DTI (if eligible)
    if (dpaEligibility.fha.eligible) {
      solutions.push({
        type: 'DPA_PROGRAMS',
        description: `FHA loans allow up to 50% DTI with compensating factors`,
        impact: `You may still qualify - let's discuss your full picture`,
        actionLabel: 'Explore FHA options',
      });
    }

    // Option: Lower price for more comfort
    const comfortablePrice = calculateMaxPriceForDti(monthlyIncome, monthlyDebts, 36);
    if (comfortablePrice > 0 && comfortablePrice < targetPrice * 0.9) {
      solutions.push({
        type: 'ADJUST_PRICE',
        description: `For more financial breathing room, consider ${formatCurrency(comfortablePrice)}`,
        impact: `Comfortable 36% DTI with room for life's surprises`,
        actionLabel: 'See comfortable range',
        newPrice: comfortablePrice,
        monthlyPayment: Math.round(estimateMonthlyPayment(comfortablePrice)),
      });
    }

    return {
      type: 'DTI',
      severity: 'minor',
      headline: `At ${formatCurrency(targetPrice)}, about ${currentDti}% of your income goes to housing + debt`,
      subheadline: `This is on the higher side (lenders prefer 43%), but you have options:`,
      currentValue: `${currentDti}%`,
      targetValue: '43% or less',
      solutions,
    };
  }

  // Check down payment
  const isVeteranEligible = veteranStatus && ["active", "veteran", "guard-reserve", "spouse"].includes(veteranStatus);
  const minDownPayment = isVeteranEligible ? 0 : targetPrice * 0.035;
  if (saved < minDownPayment) {
    const shortfall = minDownPayment - saved;
    const solutions: Solution[] = [];

    // Option 1: Lower price to match savings
    const affordableWithSavings = saved / 0.035;
    if (affordableWithSavings >= 200000) {
      solutions.push({
        type: 'ADJUST_PRICE',
        description: `Your ${formatCurrency(saved)} covers 3.5% down on a ${formatCurrency(affordableWithSavings)} home`,
        impact: `Ready to buy today at this price point`,
        actionLabel: 'See homes in range',
        newPrice: Math.round(affordableWithSavings / 5000) * 5000,
        monthlyPayment: Math.round(estimateMonthlyPayment(affordableWithSavings)),
      });
    }

    // Option 2: Save more
    const monthsToSave = Math.ceil(shortfall / 500); // Assume $500/mo savings
    solutions.push({
      type: 'SAVE_MORE',
      description: `Save ${formatCurrency(shortfall)} more to reach 3.5% down`,
      impact: `At $500/month, that's about ${monthsToSave} months`,
      timeline: `${monthsToSave} months`,
      actionLabel: 'Create savings plan',
    });

    // Option 3: DPA programs (only if eligible)
    if (dpaEligibility.firstHome.eligible) {
      solutions.push({
        type: 'DPA_PROGRAMS',
        description: `Utah FirstHome could provide ${dpaEligibility.firstHome.benefit}`,
        impact: `First-time buyer program with 6% down payment assistance`,
        actionLabel: 'Learn about FirstHome',
      });
    } else if (dpaEligibility.homeAgain.eligible) {
      solutions.push({
        type: 'DPA_PROGRAMS',
        description: `Utah HomeAgain could provide ${dpaEligibility.homeAgain.benefit}`,
        impact: `Down payment assistance up to 6% — no first-time buyer requirement`,
        actionLabel: 'Learn about HomeAgain',
      });
    } else if (dpaEligibility.fha.eligible && !dpaEligibility.firstHome.eligible && !dpaEligibility.homeAgain.eligible) {
      // Explain why down payment assistance isn't available but FHA is
      const whyNoAssistance = annualIncome > PROGRAM_LIMITS.homeAgain.incomeLimit
        ? `Your income exceeds assistance limits ($141k)`
        : (creditScore && creditScore < 660)
          ? `Down payment assistance requires 660+ credit`
          : `You may not qualify for Utah assistance programs`;
      solutions.push({
        type: 'DPA_PROGRAMS',
        description: `${whyNoAssistance}, but FHA allows ${dpaEligibility.fha.benefit}`,
        impact: `Lower down payment requirement than conventional loans`,
        actionLabel: 'Explore FHA options',
      });
    }

    return {
      type: 'DOWN_PAYMENT',
      severity: shortfall > 20000 ? 'significant' : 'minor',
      headline: `You've saved ${formatCurrency(saved)} — great start!`,
      subheadline: `For a ${formatCurrency(targetPrice)} home, you'd need about ${formatCurrency(minDownPayment)} (3.5% down). Here's how to bridge the gap:`,
      currentValue: formatCurrency(saved),
      targetValue: formatCurrency(minDownPayment),
      solutions,
    };
  }

  // Check for low down payment even if technically meeting minimum
  // (scoring 7 or less out of 20 means very thin margins)
  if (downPaymentPoints <= 7 && !isVeteranEligible) {
    const downPaymentPercent = (saved / targetPrice) * 100;
    const solutions: Solution[] = [];

    // Option 1: Lower price to get comfortable down payment
    const comfortablePrice = saved / 0.05; // 5% down for comfort
    if (comfortablePrice >= 200000 && comfortablePrice < targetPrice * 0.9) {
      solutions.push({
        type: 'ADJUST_PRICE',
        description: `At ${formatCurrency(comfortablePrice)}, your savings cover a healthy 5% down`,
        impact: `More equity from day one, lower monthly payment`,
        actionLabel: 'See homes in range',
        newPrice: Math.round(comfortablePrice / 5000) * 5000,
        monthlyPayment: Math.round(estimateMonthlyPayment(comfortablePrice)),
      });
    }

    // Option 2: Save more
    const targetSaved = targetPrice * 0.05; // 5% target
    const additionalNeeded = targetSaved - saved;
    if (additionalNeeded > 0) {
      const monthsToSave = Math.ceil(additionalNeeded / 500);
      solutions.push({
        type: 'SAVE_MORE',
        description: `Save ${formatCurrency(additionalNeeded)} more to reach 5% down`,
        impact: `Better equity position and possible PMI savings`,
        timeline: `${monthsToSave} months at $500/mo`,
        actionLabel: 'Create savings plan',
      });
    }

    // Option 3: DPA programs (only if eligible)
    if (dpaEligibility.firstHome.eligible) {
      solutions.push({
        type: 'DPA_PROGRAMS',
        description: `Utah FirstHome could provide ${dpaEligibility.firstHome.benefit}`,
        impact: `First-time buyer program — covers most or all of your down payment`,
        actionLabel: 'Learn about FirstHome',
      });
    } else if (dpaEligibility.homeAgain.eligible) {
      solutions.push({
        type: 'DPA_PROGRAMS',
        description: `Utah HomeAgain could provide ${dpaEligibility.homeAgain.benefit}`,
        impact: `Down payment assistance up to 6% — no first-time buyer requirement`,
        actionLabel: 'Learn about HomeAgain',
      });
    } else {
      // Explain why down payment assistance isn't available
      const reasons: string[] = [];
      if (annualIncome > PROGRAM_LIMITS.homeAgain.incomeLimit) {
        reasons.push(`income under $141k`);
      }
      if (creditScore && creditScore < 660) {
        reasons.push(`660+ credit`);
      }
      if (reasons.length > 0) {
        solutions.push({
          type: 'DPA_PROGRAMS',
          description: `Utah down payment assistance programs require ${reasons.join(' and ')}`,
          impact: dpaEligibility.fha.eligible
            ? `FHA is available with ${dpaEligibility.fha.benefit}`
            : `Work on qualifying factors to unlock assistance`,
          actionLabel: 'See your options',
        });
      }
    }

    return {
      type: 'DOWN_PAYMENT',
      severity: downPaymentPoints <= 3 ? 'significant' : 'minor',
      headline: `You've saved ${formatCurrency(saved)} (${downPaymentPercent.toFixed(1)}% of your target)`,
      subheadline: downPaymentPercent < 3.5
        ? `You'll need at least 3.5% down (${formatCurrency(targetPrice * 0.035)}) for FHA. Here's how to get there:`
        : `That's enough for minimum down payment, but here's how to strengthen your position:`,
      currentValue: formatCurrency(saved),
      targetValue: `5%+ (${formatCurrency(targetPrice * 0.05)})`,
      solutions,
    };
  }

  // Check credit score
  if (creditScore !== null && creditScore < 620) {
    const solutions: Solution[] = [];

    if (dpaEligibility.fha.eligible && creditScore >= 580) {
      solutions.push({
        type: 'DPA_PROGRAMS',
        description: `With a ${creditScore} score, you qualify for FHA loans today`,
        impact: dpaEligibility.fha.benefit,
        actionLabel: 'Explore FHA options',
      });
    }

    // Show what they could unlock with better credit
    const potentialDpaValue = targetPrice * 0.06;
    solutions.push({
      type: 'IMPROVE_CREDIT',
      description: `Getting to 660+ unlocks Utah Housing assistance programs`,
      impact: annualIncome <= PROGRAM_LIMITS.homeAgain.incomeLimit
        ? `Could mean ${formatCurrency(potentialDpaValue)} in down payment help`
        : `Better rates and more loan options`,
      timeline: '3-6 months with focused effort',
      actionLabel: 'See credit tips',
    });

    return {
      type: 'CREDIT',
      severity: creditScore < 580 ? 'critical' : 'significant',
      headline: `Your credit score around ${creditScore} ${creditScore >= 580 ? 'qualifies you for FHA today' : 'needs some work'}`,
      subheadline: creditScore >= 580
        ? annualIncome <= PROGRAM_LIMITS.homeAgain.incomeLimit
          ? `Getting to 660 unlocks Utah Housing assistance worth up to ${formatCurrency(potentialDpaValue)}.`
          : `Getting to 660 unlocks better rates and more options.`
        : `Most lenders need 580+ for FHA, 620+ for conventional loans.`,
      currentValue: `${creditScore}`,
      targetValue: '660+',
      solutions,
    };
  }

  // Check credit (moderate - 620-659)
  if (creditScore !== null && creditScore >= 620 && creditScore < 660) {
    const solutions: Solution[] = [];

    solutions.push({
      type: 'DPA_PROGRAMS',
      description: `You qualify for conventional loans at current rates`,
      impact: `Good options available today`,
      actionLabel: 'See your options',
    });

    // Only mention assistance if they'd qualify based on income
    if (annualIncome <= PROGRAM_LIMITS.homeAgain.incomeLimit) {
      solutions.push({
        type: 'IMPROVE_CREDIT',
        description: `Bumping to 660+ unlocks Utah Housing down payment assistance`,
        impact: `Up to 6% down payment assistance (${formatCurrency(targetPrice * 0.06)})`,
        timeline: '2-4 months',
        actionLabel: 'Quick credit wins',
      });
    } else {
      solutions.push({
        type: 'IMPROVE_CREDIT',
        description: `Bumping to 660+ unlocks better rates`,
        impact: `Lower monthly payments and more loan options`,
        timeline: '2-4 months',
        actionLabel: 'Quick credit wins',
      });
    }

    return {
      type: 'CREDIT',
      severity: 'minor',
      headline: `Your credit score around ${creditScore} qualifies you for conventional loans`,
      subheadline: annualIncome <= PROGRAM_LIMITS.homeAgain.incomeLimit
        ? `A small boost to 660+ unlocks Utah's best assistance programs:`
        : `A small boost to 660+ unlocks better rates:`,
      currentValue: `${creditScore}`,
      targetValue: '660+',
      solutions,
    };
  }

  // No major blockers - user is in good shape!
  return null;
}

// Calculate the "sweet spot" - an affordable price that maximizes their score
function calculateSweetSpot(
  monthlyIncome: number,
  monthlyDebts: number,
  saved: number,
  targetPrice: number,
  input: ScoreInput
): SweetSpot {
  // Calculate comfortable price (36% DTI)
  const comfortablePrice = calculateMaxPriceForDti(monthlyIncome, monthlyDebts, 36);

  // Calculate stretch price (43% DTI)
  const stretchPrice = calculateMaxPriceForDti(monthlyIncome, monthlyDebts, 43);

  // Determine recommended price based on their situation
  let recommendedPrice: number;
  let whyThisWorks: string;

  if (targetPrice <= comfortablePrice) {
    // Their target is already comfortable
    recommendedPrice = targetPrice;
    whyThisWorks = `Your target price fits comfortably within your budget with room to spare.`;
  } else if (targetPrice <= stretchPrice) {
    // Their target is achievable but stretched
    recommendedPrice = comfortablePrice;
    whyThisWorks = `This price gives you financial breathing room while still getting a great home.`;
  } else {
    // Their target exceeds guidelines - recommend stretch price
    recommendedPrice = stretchPrice;
    whyThisWorks = `This is the maximum lenders will typically approve. It keeps you within guidelines.`;
  }

  // Round to nearest $5k
  recommendedPrice = Math.round(recommendedPrice / 5000) * 5000;

  // Calculate score at recommended price
  const priceRange = getPriceRangeFromAmount(recommendedPrice);
  const scoreAtRecommended = calculateScoreInternal({
    ...input,
    priceRange,
  });

  // Calculate payment and DTI at recommended price
  const payment = estimateMonthlyPayment(recommendedPrice);
  const dtiAtPrice = calculateCurrentDti(monthlyIncome, monthlyDebts, payment);

  // Calculate target price metrics for comparison
  const targetPayment = estimateMonthlyPayment(targetPrice);
  const targetScore = calculateScoreInternal(input);

  return {
    recommendedPrice,
    scoreAtPrice: scoreAtRecommended.total,
    statusAtPrice: scoreAtRecommended.status,
    timelineAtPrice: scoreAtRecommended.timeline,
    monthlyPayment: Math.round(payment),
    downPaymentNeeded: Math.round(recommendedPrice * 0.035),
    dtiAtPrice,
    whyThisWorks,
    comparedToTarget: {
      priceDifference: targetPrice - recommendedPrice,
      scoreDifference: scoreAtRecommended.total - targetScore.total,
      paymentDifference: Math.round(targetPayment - payment),
    },
  };
}

// Calculate path to reach their goal price if different from sweet spot
function calculatePathToGoal(
  monthlyIncome: number,
  monthlyDebts: number,
  saved: number,
  targetPrice: number,
  sweetSpot: SweetSpot,
  currentScore: number
): PathToGoal | null {
  // If target matches sweet spot, no path needed
  if (Math.abs(targetPrice - sweetSpot.recommendedPrice) < 10000) {
    return null;
  }

  // If target is lower than sweet spot, no path needed
  if (targetPrice < sweetSpot.recommendedPrice) {
    return null;
  }

  const requiredChanges: RequiredChange[] = [];
  const housingPayment = estimateMonthlyPayment(targetPrice);
  const currentDti = calculateCurrentDti(monthlyIncome, monthlyDebts, housingPayment);

  // Calculate what's needed to make target work
  if (currentDti > 43) {
    // Option A: Debt reduction
    const debtReduction = calculateDebtReductionForDti(monthlyIncome, monthlyDebts, housingPayment, 43);
    if (debtReduction > 0 && debtReduction <= monthlyDebts) {
      requiredChanges.push({
        type: 'debt_reduction',
        amount: debtReduction,
        description: `Reduce monthly debt by ${formatCurrency(debtReduction)}`,
        impact: 'Brings DTI to 43%',
      });
    }

    // Option B: Income increase
    const incomeIncrease = calculateIncomeForDti(monthlyIncome, monthlyDebts, housingPayment, 43);
    if (incomeIncrease > 0) {
      requiredChanges.push({
        type: 'income_increase',
        amount: incomeIncrease,
        description: `Increase monthly income by ${formatCurrency(incomeIncrease)}`,
        impact: 'Brings DTI to 43%',
      });
    }
  }

  // Check down payment gap
  const downPaymentNeeded = targetPrice * 0.035;
  if (saved < downPaymentNeeded) {
    requiredChanges.push({
      type: 'savings_increase',
      amount: downPaymentNeeded - saved,
      description: `Save ${formatCurrency(downPaymentNeeded - saved)} more for down payment`,
      impact: 'Meets 3.5% down requirement',
    });
  }

  if (requiredChanges.length === 0) {
    return null;
  }

  // Estimate timeline based on required changes
  let estimatedMonths = 0;
  requiredChanges.forEach(change => {
    if (change.type === 'debt_reduction') {
      estimatedMonths = Math.max(estimatedMonths, Math.ceil(change.amount * 12 / 1000)); // Rough estimate
    } else if (change.type === 'savings_increase') {
      estimatedMonths = Math.max(estimatedMonths, Math.ceil(change.amount / 500));
    } else if (change.type === 'income_increase') {
      estimatedMonths = Math.max(estimatedMonths, 6); // Income changes take time
    }
  });

  let estimatedTimeline: string;
  if (estimatedMonths <= 3) estimatedTimeline = '1-3 months';
  else if (estimatedMonths <= 6) estimatedTimeline = '3-6 months';
  else if (estimatedMonths <= 12) estimatedTimeline = '6-12 months';
  else estimatedTimeline = '12+ months';

  return {
    targetPrice,
    currentScore,
    requiredChanges,
    estimatedTimeline,
    encouragement: `Your ${formatCurrency(targetPrice)} goal is achievable! Here's what it takes:`,
  };
}

// Helper to format currency
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}k`;
  }
  return `$${Math.round(amount)}`;
}

// Internal score calculation without path forward (to avoid recursion)
function calculateScoreInternal(input: ScoreInput): { total: number; status: ScoreStatus; timeline: string } {
  const creditScore = getCreditScore(input.creditScoreRange);
  const income = getIncomeAmount(input.annualIncome);
  const targetPrice = getPriceAmount(input.priceRange);
  const saved = getDownPaymentAmount(input.downPayment);
  const monthlyDebts = getMonthlyDebtAmount(input.monthlyDebts);
  const monthlyIncome = income / 12;

  const creditPoints = calculateCreditPoints(creditScore);
  const dtiPoints = calculateDtiPoints(monthlyIncome, targetPrice, monthlyDebts);
  const downPaymentPoints = calculateDownPaymentPoints(saved, targetPrice, input.veteranStatus);
  const employmentPoints = calculateEmploymentPoints();
  const reservesPoints = calculateReservesPoints(saved, targetPrice);
  const bonusPoints = calculateBonusPoints(input.firstTimeBuyer, input.veteranStatus);

  const total = Math.max(0, Math.min(100,
    creditPoints + dtiPoints + downPaymentPoints + employmentPoints + reservesPoints + bonusPoints
  ));

  return {
    total,
    status: getStatus(total),
    timeline: getTimeline(total),
  };
}

// ============================================================================
// AFFORDABILITY CALCULATIONS
// ============================================================================

// Calculate max affordable price given a target DTI
export function calculateMaxPriceForDti(
  monthlyIncome: number,
  monthlyDebts: number,
  targetDti: number,
  downPaymentPercent: number = 0.035
): number {
  // Max total obligations = income * targetDti
  const maxTotalObligations = monthlyIncome * (targetDti / 100);
  const maxHousingPayment = maxTotalObligations - monthlyDebts;

  if (maxHousingPayment <= 0) return 0;

  // Reverse engineer price from PITI payment
  // PITI = mortgage + tax + insurance + PMI
  // We need to solve for price iteratively since PMI depends on loan amount
  let price = 300000; // Starting guess
  for (let i = 0; i < 20; i++) {
    const payment = estimateMonthlyPayment(price, downPaymentPercent);
    const ratio = maxHousingPayment / payment;
    price = price * ratio;
    // Clamp to reasonable bounds
    price = Math.max(100000, Math.min(2000000, price));
  }

  return Math.round(price / 5000) * 5000; // Round to nearest $5k
}

export function calculateAffordability(
  annualIncome: string | null,
  monthlyDebtsRange: string | null,
  targetPriceRange: string | null
): AffordabilityResult {
  const income = getIncomeAmount(annualIncome);
  const monthlyIncome = income / 12;
  const monthlyDebts = getMonthlyDebtAmount(monthlyDebtsRange);
  const targetPrice = getPriceAmount(targetPriceRange);

  // Calculate comfortable (36% DTI) and stretch (43% DTI) budgets
  const comfortablePrice = calculateMaxPriceForDti(monthlyIncome, monthlyDebts, 36);
  const stretchPrice = calculateMaxPriceForDti(monthlyIncome, monthlyDebts, 43);

  // Calculate payments at each level
  const comfortablePayment = estimateMonthlyPayment(comfortablePrice);
  const stretchPayment = estimateMonthlyPayment(stretchPrice);
  const targetPayment = estimateMonthlyPayment(targetPrice);

  return {
    comfortable: {
      maxPrice: comfortablePrice,
      maxPayment: Math.round(comfortablePayment),
      dti: 36,
    },
    stretch: {
      maxPrice: stretchPrice,
      maxPayment: Math.round(stretchPayment),
      dti: 43,
    },
    atTargetPrice: {
      payment: Math.round(targetPayment),
      dti: Math.round(((targetPayment + monthlyDebts) / monthlyIncome) * 100),
    },
    monthlyIncome: Math.round(monthlyIncome),
    monthlyDebts,
    currentRate: CURRENT_RATE * 100,
  };
}

// Calculate score at a specific price point (for slider)
export function calculateScoreAtPrice(
  input: ScoreInput,
  overridePrice: number
): ScoreResult {
  // Create modified input with the override price
  const priceRange = getPriceRangeFromAmount(overridePrice);
  return calculateScore({
    ...input,
    priceRange,
  });
}

// Helper to convert price amount back to range string
function getPriceRangeFromAmount(price: number): string {
  if (price < 400000) return "under-400k";
  if (price < 500000) return "400k-500k";
  if (price < 600000) return "500k-600k";
  if (price < 700000) return "600k-700k";
  if (price < 800000) return "700k-800k";
  if (price < 900000) return "800k-900k";
  if (price < 1000000) return "900k-1m";
  return "1m-plus";
}

// ============================================================================
// REVERSE RANGE MAPPING HELPERS (for calculateScoreFromValues)
// ============================================================================

// Convert exact credit score to range string
function getCreditScoreRange(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 740) return "740-plus";
  if (score >= 700) return "700-739";
  if (score >= 660) return "660-699";
  if (score >= 620) return "620-659";
  if (score >= 580) return "580-619";
  return "below-580";
}

// Convert exact annual income to range string
function getIncomeRange(income: number): string {
  if (income >= 220000) return "220k-plus";
  if (income >= 180000) return "180k-220k";
  if (income >= 150000) return "150k-180k";
  if (income >= 100000) return "100k-150k";
  if (income >= 80000) return "80k-100k";
  if (income >= 60000) return "60k-80k";
  if (income >= 40000) return "40k-60k";
  return "under-40k";
}

// Convert exact price to range string
function getPriceRange(price: number): string {
  return getPriceRangeFromAmount(price);
}

// Convert exact down payment amount to range string
function getDownPaymentRange(amount: number): string {
  if (amount >= 260000) return "260k-plus";
  if (amount >= 220000) return "220k-260k";
  if (amount >= 180000) return "180k-220k";
  if (amount >= 140000) return "140k-180k";
  if (amount >= 100000) return "100k-140k";
  if (amount >= 75000) return "75k-100k";
  if (amount >= 50000) return "50k-75k";
  if (amount >= 25000) return "25k-50k";
  if (amount >= 10000) return "10k-25k";
  return "under-10k";
}

// Convert exact monthly debt amount to range string
function getMonthlyDebtRange(debt: number): string {
  if (debt >= 3000) return "3000-plus";
  if (debt >= 2500) return "2500-3000";
  if (debt >= 2000) return "2000-2500";
  if (debt >= 1000) return "1000-2000";
  if (debt >= 500) return "500-1000";
  if (debt >= 250) return "250-500";
  if (debt > 0) return "under-250";
  return "none";
}

// ============================================================================
// calculateScoreFromValues - NEW wrapper for exact numeric inputs
// ============================================================================

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
export function calculateScoreFromValues(input: ScoreValuesInput): ScoreResult {
  // Handle co-borrower: use lower credit score, combine income and debts
  let effectiveCreditScore = input.creditScore;
  let effectiveAnnualIncome = input.annualIncome;
  let effectiveMonthlyDebts = input.monthlyDebts;

  if (input.coBorrowerAnnualIncome !== undefined && input.coBorrowerAnnualIncome > 0) {
    effectiveAnnualIncome += input.coBorrowerAnnualIncome;
  }

  if (input.coBorrowerMonthlyDebts !== undefined && input.coBorrowerMonthlyDebts > 0) {
    effectiveMonthlyDebts += input.coBorrowerMonthlyDebts;
  }

  if (input.coBorrowerCreditScore !== undefined && input.coBorrowerCreditScore !== null) {
    if (effectiveCreditScore === null) {
      effectiveCreditScore = input.coBorrowerCreditScore;
    } else {
      // Lenders use the lower of the two credit scores
      effectiveCreditScore = Math.min(effectiveCreditScore, input.coBorrowerCreditScore);
    }
  }

  // Convert exact values to range strings using reverse mapping helpers
  const scoreInput: ScoreInput = {
    creditScoreRange: getCreditScoreRange(effectiveCreditScore),
    annualIncome: getIncomeRange(effectiveAnnualIncome),
    downPayment: getDownPaymentRange(input.savedForDownPayment),
    priceRange: getPriceRange(input.targetHomePrice),
    monthlyDebts: getMonthlyDebtRange(effectiveMonthlyDebts),
    firstTimeBuyer: input.firstTimeBuyer,
    veteranStatus: input.veteranStatus,
  };

  return calculateScore(scoreInput);
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

// Main scoring function
export function calculateScore(input: ScoreInput): ScoreResult {
  // Parse input values
  const creditScore = getCreditScore(input.creditScoreRange);
  const income = getIncomeAmount(input.annualIncome);
  const targetPrice = getPriceAmount(input.priceRange);
  const saved = getDownPaymentAmount(input.downPayment);
  const monthlyDebts = getMonthlyDebtAmount(input.monthlyDebts);
  const monthlyIncome = income / 12;

  // Calculate component scores
  const creditPoints = calculateCreditPoints(creditScore);
  const dtiPoints = calculateDtiPoints(monthlyIncome, targetPrice, monthlyDebts);
  const downPaymentPoints = calculateDownPaymentPoints(
    saved,
    targetPrice,
    input.veteranStatus
  );
  const employmentPoints = calculateEmploymentPoints();
  const reservesPoints = calculateReservesPoints(saved, targetPrice);

  // Calculate modifiers
  const bonusPoints = calculateBonusPoints(
    input.firstTimeBuyer,
    input.veteranStatus
  );
  const penaltyPoints = 0; // No penalty data in simplified flow

  // Calculate total
  const baseScore =
    creditPoints +
    dtiPoints +
    downPaymentPoints +
    employmentPoints +
    reservesPoints;
  const total = Math.max(0, Math.min(100, baseScore + bonusPoints - penaltyPoints));

  // Determine status
  const status = getStatus(total);
  const timeline = getTimeline(total);
  const color = getColor(status);

  // Match programs
  const programDetails = matchPrograms(
    creditScore,
    input.firstTimeBuyer,
    input.veteranStatus,
    income
  );
  const programs = programDetails
    .filter((p) => p.eligible)
    .map((p) => p.name);

  // Identify gaps
  const gaps = identifyGaps(
    creditScore,
    creditPoints,
    downPaymentPoints,
    dtiPoints,
    saved,
    targetPrice
  );

  // Generate recommendations
  const recommendations = generateRecommendations(gaps);

  // Calculate current DTI for parsed values
  const housingPayment = estimateMonthlyPayment(targetPrice);
  const currentDti = calculateCurrentDti(monthlyIncome, monthlyDebts, housingPayment);

  // Calculate Path Forward data
  const primaryBlocker = detectPrimaryBlocker(
    creditScore,
    creditPoints,
    dtiPoints,
    downPaymentPoints,
    monthlyIncome,
    monthlyDebts,
    targetPrice,
    saved,
    input.veteranStatus,
    income,
    input.firstTimeBuyer
  );

  const sweetSpot = calculateSweetSpot(
    monthlyIncome,
    monthlyDebts,
    saved,
    targetPrice,
    input
  );

  const pathToGoal = calculatePathToGoal(
    monthlyIncome,
    monthlyDebts,
    saved,
    targetPrice,
    sweetSpot,
    total
  );

  return {
    total,
    status,
    timeline,
    color,
    breakdown: {
      credit: creditPoints,
      dti: dtiPoints,
      downPayment: downPaymentPoints,
      employment: employmentPoints,
      reserves: reservesPoints,
      bonus: bonusPoints,
      penalty: penaltyPoints,
    },
    programs,
    programDetails,
    gaps,
    recommendations,
    // Path Forward data
    primaryBlocker,
    sweetSpot,
    pathToGoal,
    parsedValues: {
      creditScore,
      monthlyIncome,
      annualIncome: income,
      monthlyDebts,
      targetPrice,
      savedAmount: saved,
      currentDti,
    },
  };
}
