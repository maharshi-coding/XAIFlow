import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { Empty, Loading } from './components/ui';

const Overview = lazy(() => import('./pages/Overview'));
const Projects = lazy(() => import('./pages/Projects'));
const Datasets = lazy(() => import('./pages/Datasets'));
const Pipelines = lazy(() => import('./pages/Pipelines'));
const Experiments = lazy(() => import('./pages/Experiments'));
const ExperimentDetail = lazy(() => import('./pages/ExperimentDetail'));
const Explainability = lazy(() => import('./pages/Explainability'));
const Models = lazy(() => import('./pages/Models'));
const Deployments = lazy(() => import('./pages/Deployments'));
const Monitoring = lazy(() => import('./pages/Monitoring'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Backups = lazy(() => import('./pages/Backups'));
const Settings = lazy(() => import('./pages/Settings'));
const ModelDetail = lazy(() =>
  import('./pages/Models').then((module) => ({ default: module.ModelDetail })),
);

export default function App() {
  return (
    <Suspense fallback={<Loading label="Opening workspace" />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="projects" element={<Projects />} />
          <Route path="datasets" element={<Datasets />} />
          <Route path="pipelines" element={<Pipelines />} />
          <Route path="experiments" element={<Experiments />} />
          <Route path="experiments/:id" element={<ExperimentDetail />} />
          <Route path="explainability" element={<Explainability />} />
          <Route path="models" element={<Models />} />
          <Route path="models/:id" element={<ModelDetail />} />
          <Route path="deployments" element={<Deployments />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="backups" element={<Backups />} />
          <Route path="settings" element={<Settings />} />
          <Route
            path="*"
            element={
              <Empty
                title="Page not found"
                description="Choose a workspace section from the navigation."
              />
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
