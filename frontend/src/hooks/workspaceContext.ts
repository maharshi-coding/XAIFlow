import { createContext } from 'react';
import type { Project } from '../types/domain';

export interface WorkspaceValue {
  projectId: string | null;
  selectProject: (id: string | null) => void;
  projects: Project[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}
export const WorkspaceContext = createContext<WorkspaceValue | null>(null);
