// Cleanup function to remove deprecated filters and migrate to new naming
export function cleanupDeprecatedFilters() {
  if (typeof window === 'undefined') return;
  
  try {
    // Clean up main filters
    const savedFilters = localStorage.getItem('carProjectsFilters');
    if (savedFilters) {
      const filters = JSON.parse(savedFilters);
      let changed = false;
      
      // Remove deprecated excludeRugs
      if ('excludeRugs' in filters) {
        delete filters.excludeRugs;
        changed = true;
      }
      
      // Migrate excludeImposters to includeImposters (invert the logic)
      if ('excludeImposters' in filters) {
        filters.includeImposters = !filters.excludeImposters;
        delete filters.excludeImposters;
        changed = true;
      }
      
      // Migrate excludeUnverified to includeUnverified (invert the logic)
      if ('excludeUnverified' in filters) {
        filters.includeUnverified = !filters.excludeUnverified;
        delete filters.excludeUnverified;
        changed = true;
      }
      
      if (changed) {
        localStorage.setItem('carProjectsFilters', JSON.stringify(filters));
        console.log('Migrated filter settings to new format');
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