export function isAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check if admin-auth cookie exists and is set to 'true'
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'admin-auth' && value === 'true') {
      return true;
    }
  }
  return false;
}