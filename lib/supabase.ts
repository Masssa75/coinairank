import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://smxnzdwuvcoasitsxytk.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNteG56ZHd1dmNvYXNpdHN4eXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MTg5NTAsImV4cCI6MjA3MjI5NDk1MH0.ElsFkC97ZUpUUHp26Lj49OgdAfHnbyrYbmlFvFFCN9g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);