import { redirect } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side check for admin panel access
  if (process.env.ADMIN_PANEL_DISABLED === 'true') {
    redirect('/');
  }

  return <>{children}</>;
}