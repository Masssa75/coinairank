interface TechnicalInnovation {
  innovation: string;
  has_math_proofs: boolean;
  reasoning: string;
}

interface WhitepaperSignals {
  technical_innovations: {
    count: number;
    innovations: TechnicalInnovation[];
    with_proofs_count: number;
  };
  academic_rigor: {
    math_proofs_pct: number;
    security_analysis_pct: number;
    reasoning: string;
  };
  positive_indicators: Array<{
    indicator: string;
    reasoning: string;
  }>;
  red_flags: Array<{
    flag: string;
    severity: 'high' | 'medium' | 'low';
    reasoning: string;
  }>;
  marketing_content_pct: number;
  tier: string;
  score: number;
}

export function extractWhitepaperSignals(content: string, benchmarks: any[]): WhitepaperSignals {
  const contentLower = content.toLowerCase();
  const contentLines = content.split('\n');
  const totalLines = contentLines.length;

  // Technical Innovations
  const innovations: TechnicalInnovation[] = [];
  const innovationPatterns = [
    { pattern: /novel\s+(consensus|algorithm|mechanism|protocol|architecture|approach)/gi, hasProof: false },
    { pattern: /proprietary\s+(technology|algorithm|system|method|protocol)/gi, hasProof: false },
    { pattern: /breakthrough\s+in\s+\w+/gi, hasProof: false },
    { pattern: /first\s+(decentralized|blockchain|crypto)\s+\w+\s+to\s+\w+/gi, hasProof: false },
    { pattern: /patent.?(pending|filed|granted)/gi, hasProof: false },
    { pattern: /zero.?knowledge\s+proof/gi, hasProof: true },
    { pattern: /homomorphic\s+encryption/gi, hasProof: true },
    { pattern: /quantum.?resistant/gi, hasProof: false },
    { pattern: /cross.?chain\s+(atomic|swap|bridge|interoperability)/gi, hasProof: false },
    { pattern: /layer.?[23]\s+(scaling|solution|protocol)/gi, hasProof: false },
  ];

  for (const { pattern, hasProof } of innovationPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Check if there's mathematical proof nearby
        const matchIndex = content.indexOf(match);
        const contextStart = Math.max(0, matchIndex - 500);
        const contextEnd = Math.min(content.length, matchIndex + 500);
        const context = content.substring(contextStart, contextEnd);

        const hasMathNearby = /theorem|proof|lemma|equation|formula|∀|∃|∈|⊆|→|≤|≥|∑|∏|∫/.test(context);

        innovations.push({
          innovation: match,
          has_math_proofs: hasProof || hasMathNearby,
          reasoning: `Found technical innovation: "${match}"${hasMathNearby ? ' with mathematical backing' : ''}`
        });
      }
    }
  }

  // Academic Rigor
  const mathLines = contentLines.filter(line =>
    /theorem|proof|lemma|corollary|proposition|equation|formula|∀|∃|∈|⊆|→|≤|≥|∑|∏|∫|\$.*\$|\\\[.*\\\]/.test(line)
  ).length;

  const securityLines = contentLines.filter(line =>
    /security\s+(analysis|model|proof|assumption|guarantee)|threat\s+model|attack\s+(vector|surface)|vulnerability|exploit|cryptographic\s+proof/.test(line.toLowerCase())
  ).length;

  const mathProofsPct = Math.round((mathLines / totalLines) * 100);
  const securityAnalysisPct = Math.round((securityLines / totalLines) * 100);

  // Positive Indicators
  const positiveIndicators: Array<{ indicator: string; reasoning: string }> = [];

  const positivePatterns = [
    { pattern: /peer.?reviewed/gi, indicator: 'Peer-reviewed research' },
    { pattern: /audit(ed)?\s+by\s+\w+/gi, indicator: 'Third-party audit' },
    { pattern: /open.?source/gi, indicator: 'Open source commitment' },
    { pattern: /test.?net\s+(live|launched|available)/gi, indicator: 'Testnet available' },
    { pattern: /main.?net\s+(live|launched|available)/gi, indicator: 'Mainnet live' },
    { pattern: /github\.com\/[\w-]+\/[\w-]+/gi, indicator: 'GitHub repository' },
    { pattern: /formal\s+verification/gi, indicator: 'Formal verification' },
    { pattern: /bug\s+bounty/gi, indicator: 'Bug bounty program' },
  ];

  for (const { pattern, indicator } of positivePatterns) {
    if (pattern.test(content)) {
      const matches = content.match(pattern);
      positiveIndicators.push({
        indicator: indicator,
        reasoning: `Found: ${matches?.[0] || indicator}`
      });
    }
  }

  // Red Flags
  const redFlags: Array<{ flag: string; severity: 'high' | 'medium' | 'low'; reasoning: string }> = [];

  const redFlagPatterns = [
    { pattern: /guaranteed\s+(returns?|profit|income|yield)/gi, severity: 'high' as const, flag: 'Guaranteed returns claim' },
    { pattern: /no\s+risk/gi, severity: 'high' as const, flag: 'No risk claim' },
    { pattern: /get\s+rich\s+quick/gi, severity: 'high' as const, flag: 'Get rich quick scheme' },
    { pattern: /anonymous\s+team/gi, severity: 'medium' as const, flag: 'Anonymous team' },
    { pattern: /to\s+the\s+moon/gi, severity: 'low' as const, flag: 'Excessive hype language' },
    { pattern: /revolutionary|disrupt\s+everything|change\s+the\s+world/gi, severity: 'low' as const, flag: 'Overpromising language' },
    { pattern: /pyramid|ponzi/gi, severity: 'high' as const, flag: 'Pyramid/Ponzi structure' },
    { pattern: /multi.?level\s+marketing|mlm/gi, severity: 'high' as const, flag: 'MLM structure' },
  ];

  for (const { pattern, severity, flag } of redFlagPatterns) {
    if (pattern.test(contentLower)) {
      const matches = content.match(pattern);
      redFlags.push({
        flag: flag,
        severity: severity,
        reasoning: `Detected: ${matches?.[0] || flag}`
      });
    }
  }

  // Marketing Content
  const marketingLines = contentLines.filter(line =>
    /buy\s+now|don't\s+miss|limited\s+time|exclusive\s+offer|huge\s+potential|massive\s+gains|100x|1000x|moon|lambo|guaranteed|profit|rich/.test(line.toLowerCase())
  ).length;

  const marketingContentPct = Math.round((marketingLines / totalLines) * 100);

  // Determine tier based on benchmarks (if provided)
  let tier = 'BASIC';
  let score = 50;

  if (benchmarks && benchmarks.length > 0) {
    // Find matching tier based on signals
    for (const benchmark of benchmarks) {
      let meetsRequirements = false;

      if (benchmark.tier === 1) { // ALPHA
        meetsRequirements = (
          innovations.length >= (benchmark.min_technical_innovations || 3) ||
          innovations.filter(i => i.has_math_proofs).length >= (benchmark.alt_innovations_with_proofs || 2)
        ) && mathProofsPct >= (benchmark.min_math_proofs_pct || 20) &&
        marketingContentPct <= (benchmark.max_marketing_pct || 15) &&
        securityAnalysisPct >= (benchmark.min_security_analysis_pct || 3);
      } else if (benchmark.tier === 2) { // SOLID
        meetsRequirements = (
          innovations.length >= (benchmark.min_technical_innovations || 2) ||
          innovations.filter(i => i.has_math_proofs).length >= (benchmark.alt_innovations_with_proofs || 1)
        ) && (mathProofsPct >= (benchmark.min_math_proofs_pct || 10) ||
              (mathProofsPct >= (benchmark.alt_math_proofs_pct || 15) && securityAnalysisPct >= 2)) &&
        marketingContentPct <= (benchmark.max_marketing_pct || 25) &&
        securityAnalysisPct >= (benchmark.min_security_analysis_pct || 1);
      } else if (benchmark.tier === 3) { // BASIC
        meetsRequirements =
          innovations.length >= (benchmark.min_technical_innovations || 1) &&
          mathProofsPct >= (benchmark.min_math_proofs_pct || 5) &&
          marketingContentPct <= (benchmark.max_marketing_pct || 40);
      }

      if (meetsRequirements) {
        tier = benchmark.tier_name || ['', 'ALPHA', 'SOLID', 'BASIC', 'TRASH'][benchmark.tier];
        score = benchmark.tier === 1 ? 90 : benchmark.tier === 2 ? 75 : benchmark.tier === 3 ? 55 : 30;
        break;
      }
    }

    // Default to TRASH if no tier requirements met
    if (tier === 'BASIC' && benchmarks.some(b => b.tier === 4)) {
      const trashBenchmark = benchmarks.find(b => b.tier === 4);
      if (trashBenchmark) {
        tier = 'TRASH';
        score = 30;
      }
    }
  }

  return {
    technical_innovations: {
      count: innovations.length,
      innovations: innovations,
      with_proofs_count: innovations.filter(i => i.has_math_proofs).length
    },
    academic_rigor: {
      math_proofs_pct: mathProofsPct,
      security_analysis_pct: securityAnalysisPct,
      reasoning: `${mathProofsPct}% mathematical content, ${securityAnalysisPct}% security analysis`
    },
    positive_indicators: positiveIndicators,
    red_flags: redFlags,
    marketing_content_pct: marketingContentPct,
    tier: tier,
    score: score
  };
}