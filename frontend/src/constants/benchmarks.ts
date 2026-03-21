export const BENCHMARKS = {
  dso:              { target: 40,   excellent: 30,   poor: 60   },  // days
  cei:              { target: 85,   excellent: 90,   poor: 75   },  // %
  recoveryRate:     { target: 70,   excellent: 85,   poor: 50   },  // %
  involuntaryChurn: { target: 2,    excellent: 1,    poor: 5    },  // %
  revenueAtRisk:    { target: 10,   excellent: 5,    poor: 20   },  // % of total
  emailOpenRate:    { target: 28,   excellent: 35,   poor: 20   },  // %
  emailCtr:         { target: 2.5,  excellent: 4,    poor: 1.5  },  // %
  planAcceptance:   { target: 30,   excellent: 45,   poor: 20   },  // %
  planCompletion:   { target: 80,   excellent: 90,   poor: 65   },  // %
};

/** Returns 'good' | 'ok' | 'poor' — for lower-is-better metrics pass lowerIsBetter=true */
export function getBenchmarkStatus(
  value: number,
  metric: keyof typeof BENCHMARKS,
  lowerIsBetter = false
): 'good' | 'ok' | 'poor' {
  const b = BENCHMARKS[metric];
  if (lowerIsBetter) {
    if (value <= b.excellent) return 'good';
    if (value <= b.target)    return 'ok';
    return 'poor';
  }
  if (value >= b.excellent) return 'good';
  if (value >= b.target)    return 'ok';
  return 'poor';
}
