# CoinAIRank (CAR)

AI-powered cryptocurrency project quality ranking platform. Think CoinMarketCap but ranked by AI-analyzed quality scores instead of market cap.

## Current Status (September 2025)

### Core Features
- **Token Discovery**: Automated discovery via GeckoTerminal (every 5 min)
- **Website Analysis**: AI-powered quality scoring (Stage 1 complete, Stage 2 in development)
- **Whitepaper Analysis**: NEW - Deep content analysis with AI categorization
- **Price Tracking**: Real-time price and ATH tracking
- **Multi-tier Classification**: ALPHA (90+), SOLID (70-89), BASIC (40-69), TRASH (<40)

### Recent Updates
- ✅ Whitepaper analyzer edge function deployed
- ✅ AI-driven content breakdown analysis (not regex)
- ✅ Support for HTML and PDF whitepapers
- ✅ Kimi K2 integration for sharp, direct analysis
- ⚠️ Known issue: Large PDFs may timeout (60-second limit)

## Architecture

### Frontend (Next.js)
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Netlify

### Backend (Supabase)
- **Database**: PostgreSQL with RLS enabled
- **Edge Functions**: 7 core functions in Deno runtime
- **Real-time**: Subscriptions for live updates

### Edge Functions Pipeline
1. **gecko-token-discovery**: Fetches new tokens from GeckoTerminal
2. **website-discovery**: Finds websites for tokens
3. **project-ingestion**: Promotes quality tokens to main table
4. **website-analyzer**: AI website quality analysis (V3)
5. **whitepaper-analyzer**: NEW - Deep whitepaper content analysis
6. **x-analyzer**: Twitter/social sentiment analysis
7. **ultra-tracker**: Price and ATH tracking

## Database Schema

### Main Tables
- **crypto_projects_rated**: 46 fields for comprehensive token analysis
- **token_discovery**: 18 fields for discovery queue and tracking

### Recent Additions
- `whitepaper_content`: Stores parsed whitepaper text
- `whitepaper_analysis`: JSONB with AI analysis results
- `whitepaper_analyzed_at`: Timestamp of analysis

## Whitepaper Analysis

### Content Breakdown Categories
- Mathematical proofs/formulas
- Performance claims (TPS, throughput)
- Technical architecture
- Marketing language
- Academic citations
- Use cases/applications
- Security analysis
- Team credentials
- Comparisons to other projects
- Other (with explanation)

### Analysis Output
- **content_breakdown**: Percentage distribution across categories
- **character_assessment**: One-sentence document characterization
- **key_insights**: 2-3 most important technical/business insights
- **red_flags**: Concerning signs
- **green_flags**: Positive indicators
- **kimi_verdict**: One-sentence value assessment

## API Integration

### Required Services
- **Moonshot AI (Kimi K2)**: Primary AI analysis engine
- **ScraperAPI**: PDF extraction and web scraping
- **Browserless**: JavaScript-rendered site processing
- **GeckoTerminal**: Token discovery
- **DexScreener**: Price data enrichment

## Getting Started

### Prerequisites
```bash
# Node.js 18+ required
node --version

# Install dependencies
cd app/car-app
npm install
```

### Environment Variables
Create `.env.local` in `app/car-app/`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Development
```bash
# Start development server
npm run dev

# Open http://localhost:3000
```

### Deployment
```bash
# Deploy to Netlify (auto-deploys on push to main)
git push origin main

# Deploy edge functions to Supabase
cd app
supabase functions deploy
```

## Testing

### Whitepaper Analyzer
```python
# Test whitepaper analysis
cd scripts
python3 test_whitepaper_analyzer.py KTA

# Force refresh analysis
python3 test_whitepaper_analyzer.py KAS true
```

### Edge Functions
```bash
# Test locally
supabase functions serve whitepaper-analyzer

# View logs
supabase functions logs whitepaper-analyzer
```

## Known Issues

### PDF Processing
- Large PDFs (>10MB) may timeout due to 60-second edge function limit
- Workaround: Use ScraperAPI for PDF extraction
- Future solution: Implement async processing with queue

### Performance
- Kimi K2 model truncates at ~64K characters
- Solution: Pre-truncate content to 30K chars before sending

### Deployment
- GitHub webhook broken (manual deployment required)
- Last auto-deployment: September 6, 2025

## Roadmap

### Q4 2025
- [ ] Complete Stage 2 deep analysis implementation
- [ ] Add GitHub activity analysis
- [ ] Implement Twitter sentiment scoring
- [ ] Add documentation quality scoring
- [ ] Create async PDF processing queue
- [ ] Add caching layer for analysis results

### Future
- [ ] Community features (comments, ratings)
- [ ] Portfolio tracking
- [ ] Alert system for quality changes
- [ ] API for third-party integrations

## Contributing

This is a private project. For access or questions, contact the maintainers.

## License

Proprietary - All rights reserved
