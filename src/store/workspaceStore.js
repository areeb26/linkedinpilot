import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useWorkspaceStore = create(
  persist(
    (set, get) => ({
      workspaceId: null,
      workspaceName: null,
      workspaces: [],

      setWorkspace: (id, name) => set({ workspaceId: id, workspaceName: name }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      clearWorkspace: () => set({ workspaceId: null, workspaceName: null, workspaces: [] }),
    }),
    {
      name: 'linkedpilot-workspace',
    }
  )
)
