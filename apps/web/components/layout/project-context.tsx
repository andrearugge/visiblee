'use client';

import { createContext, useContext } from 'react';

interface ProjectData {
  id: string;
  name: string;
  brandName: string;
}

const ProjectContext = createContext<ProjectData | null>(null);

export function ProjectProvider({
  children,
  project,
}: {
  children: React.ReactNode;
  project: ProjectData;
}) {
  return <ProjectContext.Provider value={project}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  return useContext(ProjectContext);
}
