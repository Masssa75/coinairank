import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HTML parser - same as website analyzer for large HTML
function parseHtmlContent(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    if (!doc) return ''

    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'noscript', 'svg', 'path',
      'nav', '.sidebar', '.navigation', '.nav-menu',
      'header', 'footer', '.header', '.footer',
      '.cookie', '#cookie'
    ]

    unwantedSelectors.forEach(selector => {
      const elements = doc.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    })

    // Find main content - whitepaper specific selectors
    const mainContent =
      doc.querySelector('.whitepaper') ||
      doc.querySelector('.whitepaper-content') ||
      doc.querySelector('main') ||
      doc.querySelector('article') ||
      doc.querySelector('.content') ||
      doc.querySelector('.paper') ||
      doc.querySelector('.document') ||
      doc.querySelector('[role="main"]') ||
      doc.body

    if (!mainContent) return ''

    // Extract text content
    const textContent = mainContent.textContent || ''

    // Clean up the text
    return textContent
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n')    // Remove excessive newlines
      .trim()
  } catch (error) {
    console.error('Error parsing HTML:', error)
    return ''
  }
}

// Extract text from PDF - simplified approach using external service
async function extractPdfText(pdfUrl: string): Promise<string> {
  try {
    // Use ScraperAPI to extract PDF text
    const scraperApiKey = Deno.env.get('SCRAPER_API_KEY')
    if (!scraperApiKey) {
      throw new Error('SCRAPER_API_KEY not configured')
    }

    // ScraperAPI can extract text from PDFs
    const scraperUrl = `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(pdfUrl)}&render=false`

    const response = await fetch(scraperUrl)
    if (!response.ok) {
      throw new Error(`ScraperAPI failed: ${response.status}`)
    }

    const text = await response.text()

    // Check if we got actual text or just binary data
    if (text.startsWith('%PDF')) {
      // Got raw PDF, not extracted text
      return '[PDF extraction requires additional processing - raw PDF returned]'
    }

    return text
  } catch (error) {
    console.error('PDF extraction error:', error)
    // Return placeholder for now
    return `[PDF content - This whitepaper is a PDF document. Full extraction pending. URL: ${pdfUrl}]`
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { symbol, whitepaper_url } = await req.json()

    if (!symbol || !whitepaper_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: symbol and whitepaper_url' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`Extracting whitepaper for ${symbol} from ${whitepaper_url}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the whitepaper
    const response = await fetch(whitepaper_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch whitepaper: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    let extractedText = ''
    let format = 'unknown'

    // Handle different content types
    if (contentType.includes('pdf')) {
      // Handle PDF - pass URL to extractor
      format = 'pdf'
      extractedText = await extractPdfText(whitepaper_url)

    } else if (contentType.includes('html')) {
      // Handle HTML
      format = 'html'
      const html = await response.text()
      extractedText = parseHtmlContent(html)

    } else {
      // Try to detect format from URL
      if (whitepaper_url.toLowerCase().endsWith('.pdf')) {
        format = 'pdf'
        extractedText = await extractPdfText(whitepaper_url)
      } else {
        // Assume HTML
        format = 'html'
        const html = await response.text()
        extractedText = parseHtmlContent(html)
      }
    }

    // Clean up extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')        // Remove excessive newlines
      .replace(/[^\x20-\x7E\n]/g, '')   // Remove non-printable characters
      .trim()

    // Calculate token estimate
    const estimatedTokens = Math.ceil(extractedText.length / 4)

    // Prepare data for storage
    const extractedWhitepaper = {
      url: whitepaper_url,
      format: format,
      content: extractedText.substring(0, 500000), // Limit to 500K chars
      total_characters: extractedText.length,
      estimated_tokens: estimatedTokens,
      extracted_at: new Date().toISOString()
    }

    // Store in database
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        extracted_whitepaper: extractedWhitepaper,
        whitepaper_extracted_at: new Date().toISOString(),
        whitepaper_extraction_error: null
      })
      .eq('symbol', symbol)

    if (updateError) {
      throw updateError
    }

    // Return summary
    return new Response(
      JSON.stringify({
        success: true,
        symbol,
        whitepaper_url,
        format,
        total_characters: extractedText.length,
        estimated_tokens: estimatedTokens,
        preview: extractedText.substring(0, 500) + '...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in whitepaper-extractor:', error)

    // Try to update error in database
    try {
      const { symbol } = await req.json()
      if (symbol) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        await supabase
          .from('crypto_projects_rated')
          .update({
            whitepaper_extraction_error: error.message,
            whitepaper_extracted_at: new Date().toISOString()
          })
          .eq('symbol', symbol)
      }
    } catch (e) {
      // Ignore error updating error status
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})