import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project } from '../types/domain';
import { api } from '../services/api';
import { WorkspaceContext } from '../hooks/workspaceContext';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<string | null>(() =>
    localStorage.getItem('xaiflow.project'),
  );
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['projects'], queryFn: () => api<Project[]>('/projects') });
  const selectProject = (id: string | null) => {
    setProjectId(id);
    if (id) localStorage.setItem('xaiflow.project', id);
    else localStorage.removeItem('xaiflow.project');
  };
  const validId =
    query.data && projectId && !query.data.some((project) => project.id === projectId)
      ? null
      : projectId;
  return (
    <WorkspaceContext.Provider
      value={{
        projectId: validId,
        selectProject,
        projects: query.data ?? [],
        loading: query.isLoading,
        error: query.error,
        refresh: () => {
          void client.invalidateQueries();
        },
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
