// Cleanup function to remove deprecated excludeRugs filter from localStorage
export function cleanupDeprecatedFilters() {
  if (typeof window === 'undefined') return;
  
  try {
    // Clean up main filters
    const savedFilters = localStorage.getItem('carProjectsFilters');
    if (savedFilters) {
      const filters = JSON.parse(savedFilters);
      if ('excludeRugs' in filters) {
        delete filters.excludeRugs;
        localStorage.setItem('carProjectsFilters', JSON.stringify(filters));
        console.log('Cleaned up deprecated excludeRugs filter');
      }
    }
    
    // Clean up filter sections - rename 'rugs' to 'safety' if it exists
    const savedSections = localStorage.getItem('carProjectsFilterSections');
    if (savedSections) {
      const sections = JSON.parse(savedSections);
      if ('rugs' in sections) {
        sections.safety = sections.rugs;
        delete sections.rugs;
        localStorage.setItem('carProjectsFilterSections', JSON.stringify(sections));
        console.log('Updated filter sections from rugs to safety');
      }
    }
  } catch (e) {
    console.error('Error cleaning up localStorage:', e);
  }
}