import { ConsoleProviders } from '@/components/console/Providers'
import { ConsoleShell } from '@/components/console/Shell'
import { currentUser } from '@/lib/auth'

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  return (
    <ConsoleProviders>
      <ConsoleShell user={user}>{children}</ConsoleShell>
    </ConsoleProviders>
  )
}
