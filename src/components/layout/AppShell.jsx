import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface-base)' }}
    >
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main
          className="flex-1 overflow-y-auto scrollbar-smooth"
          style={{ padding: 'var(--space-4)' }}
          id="main-content"
          tabIndex={-1}
        >
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
