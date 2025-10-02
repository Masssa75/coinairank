'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface RankSearchInputProps {
  onSearch: (query: string) => void
  placeholder?: string
}

export default function RankSearchInput({ onSearch, placeholder = "Search symbol or name..." }: RankSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleInputChange = (value: string) => {
    setQuery(value)

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for debounced search
    timeoutRef.current = setTimeout(() => {
      onSearch(value)
    }, 300)
  }

  const handleClear = () => {
    setQuery('')
    onSearch('')
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        aria-label="Search"
      >
        <Search className="w-5 h-5 text-gray-600" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
      <Search className="w-5 h-5 text-gray-600 flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-500 w-[200px]"
      />
      <button
        onClick={handleClear}
        className="p-0.5 rounded hover:bg-gray-200 transition-colors"
        aria-label="Clear search"
      >
        <X className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  )
}
