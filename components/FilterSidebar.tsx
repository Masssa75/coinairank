'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, ChevronDown, Filter, Settings, Bell, User } from 'lucide-react';
import { cleanupDeprecatedFilters } from '@/lib/cleanupLocalStorage';

interface FilterState {
  tokenType: 'all' | 'meme' | 'utility'
  networks: string[]
  includeImposters?: boolean  // true = show imposters, false = hide imposters
  includeUnverified?: boolean  // true = show unverified, false = hide unverified
  minWebsiteScore?: number
  minAge?: number  // Minimum age in years
  maxAge?: number  // Maximum age in years
}

interface FilterSidebarProps {
  onFiltersChange: (filters: FilterState) => void;
  onSidebarToggle?: (isCollapsed: boolean) => void;
}

export default function FilterSidebar({ onFiltersChange, onSidebarToggle }: FilterSidebarProps) {
  // Load saved filter state from localStorage
  const getInitialFilterState = (): FilterState => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carProjectsFilters')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse saved filters:', e)
        }
      }
    }
    // Default state - include all available networks
    return {
      tokenType: 'all',
      networks: ['ethereum', 'solana', 'bsc', 'base', 'pulsechain', 'other'],
      includeImposters: false,  // Default: hide imposters
      includeUnverified: false,  // Default: hide unverified
      minWebsiteScore: 1,
      minAge: undefined,
      maxAge: undefined
    }
  }

  // Load saved section states from localStorage
  const getSectionStates = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carProjectsFilterSections')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse saved section states:', e)
        }
      }
    }
    // Default: all collapsed except token type
    return {
      tokenType: false,
      networks: true,
      safety: true,
      scores: true,
      age: true
    }
  }

  const sectionStates = getSectionStates()

  // Load sidebar collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carSidebarCollapsed')
      return saved === 'true'
    }
    return false
  })

  const [filters, setFilters] = useState<FilterState>(getInitialFilterState)
  const [isTokenTypeCollapsed, setIsTokenTypeCollapsed] = useState(sectionStates.tokenType)
  const [includeUtility, setIncludeUtility] = useState(() => {
    const initial = getInitialFilterState()
    return initial.tokenType === 'all' || initial.tokenType === 'utility'
  })
  const [includeMeme, setIncludeMeme] = useState(() => {
    const initial = getInitialFilterState()
    return initial.tokenType === 'all' || initial.tokenType === 'meme'
  })
  const [includeUnverified, setIncludeUnverified] = useState(() => {
    const initial = getInitialFilterState()
    return initial.includeUnverified !== undefined ? initial.includeUnverified : false
  })
  const [isNetworksCollapsed, setIsNetworksCollapsed] = useState(sectionStates.networks)
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>(() => {
    const initial = getInitialFilterState()
    return initial.networks || ['ethereum', 'solana', 'bsc', 'base', 'pulsechain', 'other']
  })
  const [isSafetyCollapsed, setIsSafetyCollapsed] = useState(sectionStates.safety || true)
  const [includeImposters, setIncludeImposters] = useState(() => {
    const initial = getInitialFilterState()
    return initial.includeImposters !== undefined ? initial.includeImposters : false
  })
  const [isScoresCollapsed, setIsScoresCollapsed] = useState(sectionStates.scores)
  const [minWebsiteScore, setMinWebsiteScore] = useState<number>(() => {
    const initial = getInitialFilterState()
    return initial.minWebsiteScore || 1
  })
  const [isAgeCollapsed, setIsAgeCollapsed] = useState(sectionStates.age || true)
  const [minAge, setMinAge] = useState<number | undefined>(() => {
    const initial = getInitialFilterState()
    return initial.minAge
  })
  const [maxAge, setMaxAge] = useState<number | undefined>(() => {
    const initial = getInitialFilterState()
    return initial.maxAge
  })

  // Run cleanup on mount to remove deprecated filter settings
  useEffect(() => {
    cleanupDeprecatedFilters();
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('carProjectsFilters', JSON.stringify(filters))
    }
    onFiltersChange(filters)
  }, [filters, onFiltersChange])

  // Save section states to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sectionStates = {
        tokenType: isTokenTypeCollapsed,
        networks: isNetworksCollapsed,
        safety: isSafetyCollapsed,
        scores: isScoresCollapsed,
        age: isAgeCollapsed
      }
      localStorage.setItem('carProjectsFilterSections', JSON.stringify(sectionStates))
    }
  }, [isTokenTypeCollapsed, isNetworksCollapsed, isSafetyCollapsed, isScoresCollapsed, isAgeCollapsed])

  // Save sidebar collapsed state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('carSidebarCollapsed', String(isSidebarCollapsed))
    }
    onSidebarToggle?.(isSidebarCollapsed)
  }, [isSidebarCollapsed, onSidebarToggle])

  // Reset all filters and collapse all sections
  const resetAllFilters = () => {
    const defaultState = {
      tokenType: 'all' as const,
      networks: ['ethereum', 'solana', 'bsc', 'base', 'pulsechain', 'other'],
      includeImposters: false,
      includeUnverified: false,
      minWebsiteScore: 1,
      minAge: undefined,
      maxAge: undefined
    }
    
    // Update all individual states
    setIncludeUtility(true)
    setIncludeMeme(true)
    setSelectedNetworks(['ethereum', 'solana', 'bsc', 'base', 'pulsechain', 'other'])
    setIncludeImposters(false)
    setIncludeUnverified(false)
    setMinWebsiteScore(1)
    setMinAge(undefined)
    setMaxAge(undefined)
    
    // Reset all sections to collapsed (except token type)
    setIsTokenTypeCollapsed(false)
    setIsNetworksCollapsed(true)
    setIsSafetyCollapsed(true)
    setIsScoresCollapsed(true)
    setIsAgeCollapsed(true)
    
    // Update main filter state
    setFilters(defaultState)
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kromProjectsFilters')
      localStorage.removeItem('kromProjectsFilterSections')
    }
  }

  // Update filters when includeImposters changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, includeImposters }))
  }, [includeImposters, setFilters])
  
  // Update filters when includeUnverified changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, includeUnverified }))
  }, [includeUnverified, setFilters])

  // Update filters when age filters change
  useEffect(() => {
    setFilters(prev => ({ ...prev, minAge, maxAge }))
  }, [minAge, maxAge, setFilters])

  const handleTokenTypeChange = (utilityChecked: boolean, memeChecked: boolean) => {
    let newType: FilterState['tokenType'] = 'all'
    
    if (utilityChecked && memeChecked) {
      newType = 'all'
    } else if (utilityChecked && !memeChecked) {
      newType = 'utility'
    } else if (!utilityChecked && memeChecked) {
      newType = 'meme'
    } else {
      // Neither selected, default to all - re-check both
      setIncludeUtility(true)
      setIncludeMeme(true)
      newType = 'all'
      return // Don't update filters since we're resetting
    }
    
    setFilters(prev => ({ ...prev, tokenType: newType }))
  }

  return (
    <div className="relative flex-shrink-0">
      {/* Sidebar Container */}
      <div className={`bg-[#111214] border-r border-[#2a2d31] h-full transition-all duration-300 ${isSidebarCollapsed ? 'w-[50px]' : 'w-[300px] overflow-y-auto scrollbar-hide'}`}>
      
      {isSidebarCollapsed ? (
        /* Collapsed State - Icon Stack */
        <div className="flex flex-col items-center py-4 gap-3">
          {/* Toggle/Expand Button */}
          <button
            onClick={() => {
              setIsSidebarCollapsed(false);
              onSidebarToggle?.(false);
            }}
            className="w-9 h-9 rounded-md bg-[#1a1c1f] border border-[#2a2d31] flex items-center justify-center hover:bg-[#252729] hover:border-[#00ff88] transition-all group"
            title="Expand Filters"
          >
            <ChevronRight className="w-5 h-5 text-[#666] group-hover:text-[#00ff88] transition-colors" />
          </button>
          
          {/* Filter Icon */}
          <button
            className="w-9 h-9 rounded-md bg-[#1a1c1f] border border-[#2a2d31] flex items-center justify-center hover:bg-[#252729] hover:border-[#00ff88] transition-all group"
            title="Filters"
          >
            <Filter className="w-5 h-5 text-[#666] group-hover:text-[#00ff88] transition-colors" />
          </button>
          
          {/* Settings Icon */}
          <button
            className="w-9 h-9 rounded-md bg-[#1a1c1f] border border-[#2a2d31] flex items-center justify-center hover:bg-[#252729] hover:border-[#00ff88] transition-all group"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-[#666] group-hover:text-[#00ff88] transition-colors" />
          </button>
          
          {/* Notifications Icon */}
          <button
            className="w-9 h-9 rounded-md bg-[#1a1c1f] border border-[#2a2d31] flex items-center justify-center hover:bg-[#252729] hover:border-[#00ff88] transition-all group relative"
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-[#666] group-hover:text-[#00ff88] transition-colors" />
            {/* Notification dot - optional */}
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#00ff88] rounded-full"></span>
          </button>
          
          {/* Account Icon */}
          <button
            className="w-9 h-9 rounded-md bg-[#1a1c1f] border border-[#2a2d31] flex items-center justify-center hover:bg-[#252729] hover:border-[#00ff88] transition-all group"
            title="Account"
          >
            <User className="w-5 h-5 text-[#666] group-hover:text-[#00ff88] transition-colors" />
          </button>
        </div>
      ) : (
        /* Expanded State - Original Content */
        <>
          {/* Filters Title */}
          <div className="px-5 py-5 border-b border-[#1a1c1f] flex justify-between items-center">
            <h2 className="text-sm uppercase tracking-[2px] text-[#666] font-semibold">FILTERS</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={resetAllFilters}
                className="text-xs text-[#666] hover:text-[#00ff88] transition-colors uppercase tracking-[1px] font-medium"
              >
                Reset
              </button>
              {/* Collapse Button */}
              <button
                onClick={() => {
                  setIsSidebarCollapsed(true);
                  onSidebarToggle?.(true);
                }}
                className="bg-[#1a1c1f] hover:bg-[#252729] rounded px-2 py-2 transition-all"
                title="Hide Filters"
              >
                <ChevronLeft className="w-4 h-4 text-[#666] hover:text-[#00ff88] transition-colors" />
              </button>
            </div>
          </div>

          {/* Token Type Filter */}
          <div className={`border-b border-[#1a1c1f] ${isTokenTypeCollapsed ? 'collapsed' : ''}`}>
        <div 
          className="px-5 py-5 cursor-pointer flex justify-between items-center bg-[#111214] hover:bg-[#1a1c1f] hover:pl-6 transition-all"
          onClick={() => setIsTokenTypeCollapsed(!isTokenTypeCollapsed)}
        >
          <h3 className={`text-[13px] uppercase tracking-[1px] font-semibold transition-colors ${!isTokenTypeCollapsed ? 'text-[#00ff88]' : 'text-[#888]'}`}>
            Token Type
          </h3>
          <ChevronDown className={`w-3 h-3 transition-all ${!isTokenTypeCollapsed ? 'text-[#00ff88]' : 'text-[#666]'} ${isTokenTypeCollapsed ? '-rotate-90' : ''}`} />
        </div>
        <div className={`bg-[#0a0b0d] overflow-hidden transition-all ${isTokenTypeCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100 p-5'}`}>
          <div className="flex flex-col gap-3">
            <label 
              className="flex items-center gap-2.5 cursor-pointer text-sm text-[#ccc] hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className={`w-5 h-5 border-2 rounded-[5px] transition-all flex items-center justify-center ${
                  includeUtility ? 'bg-[#00ff88] border-[#00ff88]' : 'border-[#333]'
                }`}
                onClick={() => {
                  const newUtilityState = !includeUtility
                  setIncludeUtility(newUtilityState)
                  handleTokenTypeChange(newUtilityState, includeMeme)
                }}
              >
                {includeUtility && <span className="text-black font-bold text-xs">✓</span>}
              </div>
              <span>Utility Tokens</span>
            </label>
            <label 
              className="flex items-center gap-2.5 cursor-pointer text-sm text-[#ccc] hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className={`w-5 h-5 border-2 rounded-[5px] transition-all flex items-center justify-center ${
                  includeMeme ? 'bg-[#00ff88] border-[#00ff88]' : 'border-[#333]'
                }`}
                onClick={() => {
                  const newMemeState = !includeMeme
                  setIncludeMeme(newMemeState)
                  handleTokenTypeChange(includeUtility, newMemeState)
                }}
              >
                {includeMeme && <span className="text-black font-bold text-xs">✓</span>}
              </div>
              <span>Meme Tokens</span>
            </label>
          </div>
        </div>
      </div>

          {/* Safety Filter */}
          <div className={`border-b border-[#1a1c1f] ${isSafetyCollapsed ? 'collapsed' : ''}`}>
        <div 
          className="px-5 py-5 cursor-pointer flex justify-between items-center bg-[#111214] hover:bg-[#1a1c1f] hover:pl-6 transition-all"
          onClick={() => setIsSafetyCollapsed(!isSafetyCollapsed)}
        >
          <h3 className={`text-[13px] uppercase tracking-[1px] font-semibold transition-colors ${!isSafetyCollapsed ? 'text-[#00ff88]' : 'text-[#888]'}`}>
            Safety
          </h3>
          <ChevronDown className={`w-3 h-3 transition-all ${!isSafetyCollapsed ? 'text-[#00ff88]' : 'text-[#666]'} ${isSafetyCollapsed ? '-rotate-90' : ''}`} />
        </div>
        <div className={`bg-[#0a0b0d] overflow-hidden transition-all ${isSafetyCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100 p-5'}`}>
          <div className="flex flex-col gap-3">
            <label 
              className="flex items-center gap-2.5 cursor-pointer text-sm text-[#ccc] hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className={`w-5 h-5 border-2 rounded-[5px] transition-all flex items-center justify-center ${
                  includeImposters ? 'bg-[#00ff88] border-[#00ff88]' : 'border-[#333]'
                }`}
                onClick={() => {
                  setIncludeImposters(!includeImposters)
                }}
              >
                {includeImposters && <span className="text-black font-bold text-xs">✓</span>}
              </div>
              <span>Include Imposters</span>
            </label>
            <div className="text-xs text-[#666] mt-1">
              When checked, shows tokens marked as having inauthentic websites
            </div>
            
            {/* Include Unverified Tokens */}
            <label 
              className="flex items-center gap-2.5 cursor-pointer text-sm text-[#ccc] hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className={`w-5 h-5 border-2 rounded-[5px] transition-all flex items-center justify-center ${
                  includeUnverified ? 'bg-[#00ff88] border-[#00ff88]' : 'border-[#333]'
                }`}
                onClick={() => {
                  setIncludeUnverified(!includeUnverified)
                }}
              >
                {includeUnverified && <span className="text-black font-bold text-xs">✓</span>}
              </div>
              <span>Include Unverified</span>
            </label>
            <div className="text-xs text-[#666] mt-1">
              When checked, also shows tokens whose contract is not found on their website
            </div>
          </div>
        </div>
      </div>

          {/* Networks Filter */}
          <div className={`border-b border-[#1a1c1f] ${isNetworksCollapsed ? 'collapsed' : ''}`}>
        <div 
          className="px-5 py-5 cursor-pointer flex justify-between items-center bg-[#111214] hover:bg-[#1a1c1f] hover:pl-6 transition-all"
          onClick={() => setIsNetworksCollapsed(!isNetworksCollapsed)}
        >
          <h3 className={`text-[13px] uppercase tracking-[1px] font-semibold transition-colors ${!isNetworksCollapsed ? 'text-[#00ff88]' : 'text-[#888]'}`}>
            Networks
          </h3>
          <ChevronDown className={`w-3 h-3 transition-all ${!isNetworksCollapsed ? 'text-[#00ff88]' : 'text-[#666]'} ${isNetworksCollapsed ? '-rotate-90' : ''}`} />
        </div>
        <div className={`bg-[#0a0b0d] overflow-hidden transition-all ${isNetworksCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100 p-5'}`}>
          <div className="flex flex-col gap-3">
            {[
              { id: 'ethereum', label: 'Ethereum', color: '#627eea' },
              { id: 'solana', label: 'Solana', color: '#00ffa3' },
              { id: 'bsc', label: 'BSC', color: '#ffcc00' },
              { id: 'base', label: 'Base', color: '#0052ff' },
              { id: 'pulsechain', label: 'PulseChain', color: '#ff00ff' },
              { id: 'other', label: 'Other', color: '#888888' }
            ].map(network => (
              <label 
                key={network.id}
                className="flex items-center gap-2.5 cursor-pointer text-sm text-[#ccc] hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  className={`w-5 h-5 border-2 rounded-[5px] transition-all flex items-center justify-center ${
                    selectedNetworks.includes(network.id) ? 'bg-[#00ff88] border-[#00ff88]' : 'border-[#333]'
                  }`}
                  onClick={() => {
                    const newNetworks = selectedNetworks.includes(network.id)
                      ? selectedNetworks.filter(n => n !== network.id)
                      : [...selectedNetworks, network.id]
                    
                    // Don't allow empty selection
                    if (newNetworks.length === 0) return
                    
                    setSelectedNetworks(newNetworks)
                    setFilters(prev => ({ ...prev, networks: newNetworks }))
                  }}
                >
                  {selectedNetworks.includes(network.id) && <span className="text-black font-bold text-xs">✓</span>}
                </div>
                <span style={{ color: selectedNetworks.includes(network.id) ? network.color : '#ccc' }}>
                  {network.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

          {/* Analysis Scores Filter */}
          <div className={`border-b border-[#1a1c1f] ${isScoresCollapsed ? 'collapsed' : ''}`}>
        <div 
          className="px-5 py-5 cursor-pointer flex justify-between items-center bg-[#111214] hover:bg-[#1a1c1f] hover:pl-6 transition-all"
          onClick={() => setIsScoresCollapsed(!isScoresCollapsed)}
        >
          <h3 className={`text-[13px] uppercase tracking-[1px] font-semibold transition-colors ${!isScoresCollapsed ? 'text-[#00ff88]' : 'text-[#888]'}`}>
            Website Score
          </h3>
          <ChevronDown className={`w-3 h-3 transition-all ${!isScoresCollapsed ? 'text-[#00ff88]' : 'text-[#666]'} ${isScoresCollapsed ? '-rotate-90' : ''}`} />
        </div>
        <div className={`bg-[#0a0b0d] overflow-hidden transition-all ${isScoresCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100 p-5'}`}>
          <div className="space-y-5">
            {/* Website Analysis Score */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs uppercase tracking-wider text-[#666]">Min Website Score</label>
                <span className="text-sm font-semibold text-white">{minWebsiteScore}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={minWebsiteScore}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  setMinWebsiteScore(value)
                  setFilters(prev => ({ ...prev, minWebsiteScore: value }))
                }}
                className="w-full h-2 bg-[#1a1c1f] rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #00ff88 0%, #00ff88 ${((minWebsiteScore - 1) / 9) * 100}%, #1a1c1f ${((minWebsiteScore - 1) / 9) * 100}%, #1a1c1f 100%)`
                }}
              />
              <div className="flex justify-between text-[10px] text-[#666] mt-1">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          </div>
        </div>
          </div>

          {/* Age Filter */}
          <div className={`border-b border-[#1a1c1f] ${isAgeCollapsed ? 'collapsed' : ''}`}>
            <div
              className="px-5 py-5 cursor-pointer flex justify-between items-center bg-[#111214] hover:bg-[#1a1c1f] hover:pl-6 transition-all"
              onClick={() => setIsAgeCollapsed(!isAgeCollapsed)}
            >
              <h3 className={`text-[13px] uppercase tracking-[1px] font-semibold transition-colors ${!isAgeCollapsed ? 'text-[#00ff88]' : 'text-[#888]'}`}>
                Project Age
              </h3>
              <ChevronDown className={`w-3 h-3 transition-all ${!isAgeCollapsed ? 'text-[#00ff88]' : 'text-[#666]'} ${isAgeCollapsed ? '-rotate-90' : ''}`} />
            </div>
            <div className={`bg-[#0a0b0d] overflow-hidden transition-all ${isAgeCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100 p-5'}`}>
              <div className="flex flex-col gap-4">
                {/* Min Age */}
                <div>
                  <label className="text-xs text-[#888] mb-2 block">
                    Minimum Age (years): <span className="text-white">{minAge ? minAge : 'Any'}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={minAge || 0}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      setMinAge(value > 0 ? value : undefined)
                    }}
                    className="w-full h-2 bg-[#1a1c1f] rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: minAge ? `linear-gradient(to right, #00ff88 0%, #00ff88 ${(minAge / 10) * 100}%, #1a1c1f ${(minAge / 10) * 100}%, #1a1c1f 100%)` : '#1a1c1f'
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-[#666] mt-1">
                    <span>0</span>
                    <span>5</span>
                    <span>10+</span>
                  </div>
                </div>
                {/* Max Age */}
                <div>
                  <label className="text-xs text-[#888] mb-2 block">
                    Maximum Age (years): <span className="text-white">{maxAge ? maxAge : 'Any'}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={maxAge || 10}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      setMaxAge(value < 10 ? value : undefined)
                    }}
                    className="w-full h-2 bg-[#1a1c1f] rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: maxAge ? `linear-gradient(to right, #00ff88 0%, #00ff88 ${(maxAge / 10) * 100}%, #1a1c1f ${(maxAge / 10) * 100}%, #1a1c1f 100%)` : '#1a1c1f'
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-[#666] mt-1">
                    <span>0</span>
                    <span>5</span>
                    <span>10+</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  )
}