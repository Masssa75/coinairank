import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DOMParser, Element } from 'https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HTML parser - simplified version without markdown conversion
function parseHtmlContent(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    if (!doc) return ''

    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'noscript', 'svg', 'path',
      'nav', '.sidebar', '.navigation', '.nav-menu',
      'aside', '.toc', 'header', 'footer'
    ]

    unwantedSelectors.forEach(selector => {
      const elements = doc.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    })

    // Find main content container
    const mainContent =
      doc.querySelector('main') ||
      doc.querySelector('article') ||
      doc.querySelector('.content') ||
      doc.querySelector('.markdown-body') ||
      doc.querySelector('[role="main"]') ||
      doc.querySelector('.docs-content') ||
      doc.querySelector('.documentation') ||
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
    return html.substring(0, 10000) // Fallback to raw HTML snippet
  }
}

// Extract navigation from various doc platforms
function extractNavigation(html: string, baseUrl: string): string[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  if (!doc) return []

  const links = new Set<string>()

  // Try different navigation selectors
  const navSelectors = [
    // GitBook
    '.sidebar-nav a, .nav-item a, .navigation-item a',
    // Docusaurus
    '.menu__link, .navbar__link',
    // MkDocs
    '.md-nav__link, .toctree-l1 a',
    // Generic
    'nav a, aside a, .sidebar a, .docs-nav a, .documentation-nav a',
    // Table of contents
    '.toc a, .table-of-contents a',
  ]

  for (const selector of navSelectors) {
    const navLinks = doc.querySelectorAll(selector)
    navLinks.forEach((link: any) => {
      const href = link.getAttribute('href')
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          // Convert relative URLs to absolute
          const absoluteUrl = new URL(href, baseUrl).href
          // Only include URLs from the same domain
          const baseDomain = new URL(baseUrl).hostname
          const linkDomain = new URL(absoluteUrl).hostname
          if (linkDomain === baseDomain) {
            links.add(absoluteUrl)
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    })
  }

  // If no navigation found, try to extract all internal links
  if (links.size === 0) {
    const allLinks = doc.querySelectorAll('a[href]')
    allLinks.forEach((link: any) => {
      const href = link.getAttribute('href')
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href
          const baseDomain = new URL(baseUrl).hostname
          const linkDomain = new URL(absoluteUrl).hostname
          if (linkDomain === baseDomain) {
            links.add(absoluteUrl)
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    })
  }

  return Array.from(links)
}

// Fetch a single page
async function fetchPage(url: string): Promise<{ content: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      return { content: '', error: `HTTP ${response.status}` }
    }

    const html = await response.text()
    const content = parseHtmlContent(html)
    return { content }
  } catch (error) {
    return { content: '', error: error.message }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { symbol, docs_url } = await req.json()

    if (!symbol || !docs_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: symbol and docs_url' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`Extracting docs for ${symbol} from ${docs_url}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Fetch the main docs page
    const mainPageResponse = await fetch(docs_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!mainPageResponse.ok) {
      throw new Error(`Failed to fetch docs: HTTP ${mainPageResponse.status}`)
    }

    const mainHtml = await mainPageResponse.text()

    // Step 2: Extract navigation links
    const navigationLinks = extractNavigation(mainHtml, docs_url)
    console.log(`Found ${navigationLinks.length} navigation links`)

    // Step 3: Fetch all pages (with concurrency limit)
    const allContent: { [url: string]: string } = {}
    const errors: string[] = []

    // Add main page content
    allContent[docs_url] = parseHtmlContent(mainHtml)

    // Fetch pages in batches of 5
    const batchSize = 5
    for (let i = 0; i < navigationLinks.length; i += batchSize) {
      const batch = navigationLinks.slice(i, i + batchSize)
      const batchPromises = batch.map(url => fetchPage(url))
      const results = await Promise.all(batchPromises)

      batch.forEach((url, index) => {
        if (results[index].content) {
          allContent[url] = results[index].content
        }
        if (results[index].error) {
          errors.push(`${url}: ${results[index].error}`)
        }
      })
    }

    // Step 4: Combine all content
    const combinedContent = Object.entries(allContent)
      .map(([url, content]) => {
        const pagePath = url.replace(docs_url, '') || '/'
        return `\n\n=== Page: ${pagePath} ===\n\n${content}`
      })
      .join('\n\n---\n\n')

    // Calculate token estimate (roughly 4 chars per token)
    const estimatedTokens = Math.ceil(combinedContent.length / 4)

    // Step 5: Store in database
    const extractedDocs = {
      pages_extracted: Object.keys(allContent).length,
      total_characters: combinedContent.length,
      estimated_tokens: estimatedTokens,
      extraction_errors: errors,
      content: combinedContent.substring(0, 500000), // Limit to 500K chars for JSONB
      docs_url: docs_url,
      extracted_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        extracted_docs: extractedDocs,
        docs_extracted_at: new Date().toISOString(),
        docs_extraction_error: errors.length > 0 ? errors.join('; ') : null
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
        docs_url,
        pages_extracted: Object.keys(allContent).length,
        total_characters: combinedContent.length,
        estimated_tokens: estimatedTokens,
        errors: errors.length > 0 ? errors : undefined,
        preview: combinedContent.substring(0, 500) + '...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in docs-extractor:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})