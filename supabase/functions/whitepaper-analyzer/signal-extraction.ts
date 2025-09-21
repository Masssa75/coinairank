// Signal extraction logic for whitepaper analysis

interface WhitepaperSignals {
  technical_innovations: Array<{
    claim: string;
    category: string;
    strength: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  performance_claims: Array<{
    claim: string;
    verifiable: boolean;
  }>;
  security_features: Array<{
    signal: string;
    strength: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  academic_rigor: Array<{
    signal: string;
    strength: 'VERY HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  red_flags: Array<{
    signal: string;
    source: string;
  }>;
  green_flags: Array<{
    signal: string;
    source: string;
    ratio?: number;
  }>;
}

interface Benchmarks {
  ALPHA: {
    min_technical_innovations: number;
    alt_innovations_with_proofs: number;
    min_math_proofs_pct: number;
    max_marketing_pct: number;
    min_security_analysis_pct: number;
  };
  SOLID: {
    min_technical_innovations: number;
    alt_innovations_with_proofs: number;
    min_math_proofs_pct: number;
    alt_math_proofs_pct: number;
    max_marketing_pct: number;
    min_security_analysis_pct: number;
  };
  BASIC: {
    min_technical_innovations: number;
    min_math_proofs_pct: number;
    max_marketing_pct: number;
    min_security_analysis_pct: number;
  };
}

export function extractWhitepaperSignals(analysis: any): WhitepaperSignals {
  const signals: WhitepaperSignals = {
    technical_innovations: [],
    performance_claims: [],
    security_features: [],
    academic_rigor: [],
    red_flags: [],
    green_flags: []
  };

  // 1. Extract technical innovations from key insights
  const technicalKeywords = ['protocol', 'algorithm', 'consensus', 'proof', 'commitment', 'cryptographic', 'mechanism', 'architecture'];
  const performanceKeywords = ['tps', 'throughput', 'finality', 'latency', 'transaction', 'speed', 'scalability'];

  for (const insight of analysis.key_insights || []) {
    const lowerInsight = insight.toLowerCase();

    // Check for technical innovations
    if (technicalKeywords.some(keyword => lowerInsight.includes(keyword))) {
      signals.technical_innovations.push({
        claim: insight,
        category: 'technical_innovation',
        strength: lowerInsight.includes('proves') || lowerInsight.includes('proof') ? 'HIGH' : 'MEDIUM'
      });
    }
    // Check for performance claims
    else if (performanceKeywords.some(keyword => lowerInsight.includes(keyword))) {
      signals.performance_claims.push({
        claim: insight,
        verifiable: lowerInsight.includes('mathematical proof') || lowerInsight.includes('proves')
      });
    }
  }

  // 2. Analyze content breakdown for academic rigor
  const breakdown = analysis.content_breakdown || {};
  const mathProofs = breakdown.mathematical_proofs || 0;
  const academicCitations = breakdown.academic_citations || 0;
  const marketing = breakdown.marketing_language || 0;
  const technical = breakdown.technical_architecture || 0;
  const security = breakdown.security_analysis || 0;

  // Academic rigor signals
  if (mathProofs > 20) {
    signals.academic_rigor.push({
      signal: `${mathProofs}% mathematical proofs`,
      strength: mathProofs > 30 ? 'VERY HIGH' : 'HIGH'
    });
  }

  if (academicCitations > 10) {
    signals.academic_rigor.push({
      signal: `${academicCitations}% academic citations`,
      strength: academicCitations > 20 ? 'HIGH' : 'MEDIUM'
    });
  }

  // Marketing vs substance ratio
  if (technical > 0) {
    const substanceRatio = technical / (marketing + 1);
    if (substanceRatio > 5) {
      signals.green_flags.push({
        signal: `Technical content (${technical}%) far exceeds marketing (${marketing}%)`,
        source: 'Content analysis',
        ratio: substanceRatio
      });
    } else if (substanceRatio < 1) {
      signals.red_flags.push({
        signal: `Marketing language (${marketing}%) exceeds technical content (${technical}%)`,
        source: 'Content analysis'
      });
    }
  }

  // 3. Character assessment
  const character = analysis.character_assessment || '';
  if (character.toLowerCase().includes('academic') || character.toLowerCase().includes('research')) {
    signals.green_flags.push({
      signal: 'Academic/research-oriented document',
      source: 'Character assessment'
    });
  } else if (character.toLowerCase().includes('marketing') || character.toLowerCase().includes('pitch')) {
    signals.red_flags.push({
      signal: 'Marketing-heavy document',
      source: 'Character assessment'
    });
  }

  // 4. Add explicit red and green flags
  for (const flag of analysis.red_flags || []) {
    signals.red_flags.push({
      signal: flag,
      source: 'AI analysis'
    });
  }

  for (const flag of analysis.green_flags || []) {
    signals.green_flags.push({
      signal: flag,
      source: 'AI analysis'
    });
  }

  // 5. Security analysis
  if (security > 10) {
    signals.security_features.push({
      signal: `${security}% dedicated to security analysis`,
      strength: security > 15 ? 'HIGH' : 'MEDIUM'
    });
  }

  return signals;
}

export function compareToWhitepaperBenchmarks(
  signals: WhitepaperSignals,
  contentBreakdown: any
): { tier: string; score: number; reasoning: string } {
  const benchmarks: Benchmarks = {
    ALPHA: {
      min_technical_innovations: 3,
      alt_innovations_with_proofs: 2,
      min_math_proofs_pct: 20,
      max_marketing_pct: 15,
      min_security_analysis_pct: 3
    },
    SOLID: {
      min_technical_innovations: 2,
      alt_innovations_with_proofs: 1,
      min_math_proofs_pct: 10,
      alt_math_proofs_pct: 15,
      max_marketing_pct: 25,
      min_security_analysis_pct: 1
    },
    BASIC: {
      min_technical_innovations: 1,
      min_math_proofs_pct: 5,
      max_marketing_pct: 40,
      min_security_analysis_pct: 0
    }
  };

  const techCount = signals.technical_innovations.length;
  const mathProofs = contentBreakdown.mathematical_proofs || 0;
  const marketing = contentBreakdown.marketing_language || 0;
  const security = contentBreakdown.security_analysis || 0;

  let tier = 'TRASH';
  let score = 0;
  let reasoning = '';

  // Check ALPHA tier
  const alpha = benchmarks.ALPHA;
  const alphaStandard = (
    techCount >= alpha.min_technical_innovations &&
    mathProofs >= alpha.min_math_proofs_pct &&
    marketing <= alpha.max_marketing_pct &&
    security >= alpha.min_security_analysis_pct
  );
  const alphaAlt = (
    techCount >= alpha.alt_innovations_with_proofs &&
    mathProofs >= alpha.min_math_proofs_pct &&
    marketing <= alpha.max_marketing_pct
  );

  if (alphaStandard || alphaAlt) {
    tier = 'ALPHA';
    score = 90 + Math.min(10, techCount * 2); // 90-100 range
    reasoning = `${techCount} technical innovations with ${mathProofs}% mathematical proofs`;
  } else {
    // Check SOLID tier
    const solid = benchmarks.SOLID;
    const solidStandard = (
      techCount >= solid.min_technical_innovations &&
      mathProofs >= solid.min_math_proofs_pct &&
      marketing <= solid.max_marketing_pct &&
      security >= solid.min_security_analysis_pct
    );
    const solidAlt = (
      techCount >= solid.alt_innovations_with_proofs &&
      mathProofs >= solid.alt_math_proofs_pct &&
      marketing <= solid.max_marketing_pct
    );

    if (solidStandard || solidAlt) {
      tier = 'SOLID';
      score = 70 + Math.min(19, techCount * 5 + mathProofs / 2); // 70-89 range
      reasoning = `${techCount} innovation(s) with ${mathProofs}% mathematical proofs`;
    } else {
      // Check BASIC tier
      const basic = benchmarks.BASIC;
      if (
        techCount >= basic.min_technical_innovations &&
        mathProofs >= basic.min_math_proofs_pct &&
        marketing <= basic.max_marketing_pct
      ) {
        tier = 'BASIC';
        score = 40 + Math.min(29, techCount * 10 + mathProofs); // 40-69 range
        reasoning = `${techCount} innovation(s) with limited formal analysis`;
      } else {
        // TRASH tier
        score = Math.max(0, 20 - marketing / 2); // 0-39 range
        reasoning = marketing > 30
          ? `Marketing-heavy (${marketing}%) with minimal technical substance`
          : `Insufficient technical innovations or rigor`;
      }
    }
  }

  return { tier, score: Math.round(score), reasoning };
}

export function generateWhitepaperSummary(
  signals: WhitepaperSignals,
  contentBreakdown: any
): string {
  const techCount = signals.technical_innovations.length;
  const greenCount = signals.green_flags.length;
  const redCount = signals.red_flags.length;

  const mathProofs = contentBreakdown.mathematical_proofs || 0;
  const technical = contentBreakdown.technical_architecture || 0;
  const marketing = contentBreakdown.marketing_language || 0;

  const substanceScore = (mathProofs * 2 + technical) - (marketing * 2);

  let strength = '';
  if (substanceScore > 50) {
    strength = 'HIGHLY SUBSTANTIVE';
  } else if (substanceScore > 20) {
    strength = 'SUBSTANTIVE';
  } else if (substanceScore > 0) {
    strength = 'MODERATELY SUBSTANTIVE';
  } else {
    strength = 'LOW SUBSTANCE';
  }

  return `${strength} - ${techCount} technical innovations, ${greenCount} green flags, ${redCount} red flags`;
}