import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Create a hash of the password for comparison
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // Get the admin password from environment variable
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable not set');
      return NextResponse.json({ success: false, error: 'Admin panel not configured' }, { status: 500 });
    }
    
    // Check if password matches
    if (password === adminPassword) {
      // Create a simple auth token (hash of password + secret)
      const token = hashPassword(password + (process.env.ADMIN_SECRET || 'default-secret'));
      
      // Set cookie with auth token
      const response = NextResponse.json({ success: true });
      response.cookies.set('admin_auth', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/'
      });
      
      return response;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Check if user is authenticated
  const authCookie = request.cookies.get('admin_auth');
  
  if (!authCookie) {
    return NextResponse.json({ authenticated: false });
  }
  
  // Verify the token
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ authenticated: false });
  }
  
  const expectedToken = hashPassword(adminPassword + (process.env.ADMIN_SECRET || 'default-secret'));
  const isAuthenticated = authCookie.value === expectedToken;
  
  return NextResponse.json({ authenticated: isAuthenticated });
}

export async function DELETE() {
  // Logout - clear the auth cookie
  const response = NextResponse.json({ success: true });
  response.cookies.delete('admin_auth');
  return response;
}