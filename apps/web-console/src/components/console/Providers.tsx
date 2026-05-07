'use client'

import type { ReactNode } from 'react'
import { Toaster } from '@dpp/ui'
import { CommandPaletteProvider } from './CommandPalette'

/**
 * Console-wide client providers. Mounts the command palette (⌘K) +
 * toast notification system on every console page. Anything that needs
 * `toast()` or `useCommandPalette()` lives below this provider.
 */
export function ConsoleProviders({ children }: { children: ReactNode }) {
  return (
    <Toaster>
      <CommandPaletteProvider>{children}</CommandPaletteProvider>
    </Toaster>
  )
}
