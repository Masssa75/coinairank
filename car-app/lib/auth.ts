// Simple admin detection for signal feedback feature
// In production, this should be replaced with proper authentication

export function isAdmin(): boolean {
  // Check if we're in browser
  if (typeof window === 'undefined') return false;
  
  // Admin check based on localStorage flag or specific URL parameter
  // You can set this in console: localStorage.setItem('isAdmin', 'true')
  const localStorageAdmin = localStorage.getItem('isAdmin') === 'true';
  const urlAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
  
  return localStorageAdmin || urlAdmin;
}

// Helper to set admin status
export function setAdminStatus(status: boolean): void {
  if (typeof window !== 'undefined') {
    if (status) {
      localStorage.setItem('isAdmin', 'true');
    } else {
      localStorage.removeItem('isAdmin');
    }
  }
}