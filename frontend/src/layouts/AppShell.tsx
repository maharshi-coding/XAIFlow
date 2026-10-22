import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Blocks,
  Box,
  ChevronDown,
  Database,
  FlaskConical,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Rocket,
  ScanEye,
  Settings2,
  ShieldCheck,
  X,
  Workflow,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useWorkspace } from '../hooks/useWorkspace';
import { ScrollProgress } from '../components/motion/ScrollProgress';
import { useGlobalReveal } from '../components/motion/useGlobalReveal';

const groups = [
  {
    label: 'Workspace',
    links: [
      { path: '/', label: 'Overview', icon: LayoutDashboard },
      { path: '/projects', label: 'Projects', icon: FolderOpen },
      { path: '/datasets', label: 'Datasets', icon: Database },
      { path: '/pipelines', label: 'Pipelines', icon: GitBranch },
    ],
  },
  {
    label: 'Models',
    links: [
      { path: '/experiments', label: 'Experiments', icon: FlaskConical },
      { path: '/explainability', label: 'Explainability', icon: ScanEye },
      { path: '/models', label: 'Model registry', icon: Box },
    ],
  },
  {
    label: 'Operations',
    links: [
      { path: '/deployments', label: 'Deployments', icon: Rocket },
      { path: '/monitoring', label: 'Monitoring', icon: Activity },
      { path: '/alerts', label: 'Alerts', icon: Bell },
      { path: '/backups', label: 'Backups', icon: ShieldCheck },
    ],
  },
];
const links = groups.flatMap((group) => group.links);

export function AppShell() {
  const { projectId, selectProject, projects } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1024px)').matches);
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useGlobalReveal(location.pathname);
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ status: string }>('/health'),
    retry: 1,
    refetchInterval: 30000,
  });
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1024px)');
    const update = () => {
      setNarrow(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    sidebar.current?.toggleAttribute('inert', narrow && !mobileOpen);
  }, [mobileOpen, narrow]);
  useEffect(() => {
    if (!mobileOpen || !narrow) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = menuButton.current;
    document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLElement>('a[href]')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab') return;
      const controls = sidebar.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled])',
      );
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      trigger?.focus();
    };
  }, [mobileOpen, narrow]);
  const section =
    links.find((link) =>
      link.path === '/' ? location.pathname === '/' : location.pathname.startsWith(link.path),
    )?.label ?? 'Settings';
  const projectName = projects.find((project) => project.id === projectId)?.name;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <ScrollProgress />
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          tabIndex={-1}
        />
      )}
      <aside
        id="workspace-navigation"
        ref={sidebar}
        className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}
        aria-hidden={narrow && !mobileOpen}
        role={narrow && mobileOpen ? 'dialog' : undefined}
        aria-modal={narrow && mobileOpen ? true : undefined}
        aria-label="Workspace navigation"
      >
        <div className="brand-row">
          <NavLink
            className="brand"
            to="/"
            aria-label="XAIFlow overview"
            onClick={() => setMobileOpen(false)}
          >
            <span className="brand-mark">
              <Blocks size={23} aria-hidden="true" />
            </span>
            <span>
              XAI<span className="brand-light">Flow</span>
              <small>DATA TO DECISIONS</small>
            </span>
          </NavLink>
          <button
            className="mobile-close icon-button"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="workspace-picker">
          <span className="nav-label">PROJECT CONTEXT</span>
          <label className="project-picker">
            <FolderOpen size={17} aria-hidden="true" />
            <select
              aria-label="Active project"
              value={projectId ?? ''}
              onChange={(event) => selectProject(event.target.value || null)}
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        </div>
        <nav aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.links.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <Settings2 size={19} aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
          <a className="nav-link" href="/docs" target="_blank" rel="noreferrer">
            <LifeBuoy size={19} aria-hidden="true" />
            <span>API reference</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <div className="sidebar-status">
            <Workflow size={19} aria-hidden="true" />
            <div>
              <strong>Local workspace</strong>
              <small>Training & serving on your machine</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuButton}
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
            <span>Workspace</span>
            <span className="slash" aria-hidden="true">
              /
            </span>
            <strong>{section}</strong>
            {projectName && (
              <>
                <span className="slash" aria-hidden="true">
                  /
                </span>
                <span className="breadcrumb-project" title={projectName}>
                  {projectName}
                </span>
              </>
            )}
          </div>
          <div className="topbar-right">
            <span className={`connection ${health.isSuccess ? 'connected' : ''}`} role="status">
              <i aria-hidden="true" />
              {health.isSuccess
                ? 'API connected'
                : health.isLoading
                  ? 'Connecting'
                  : 'API unavailable'}
            </span>
            <a href="/docs" target="_blank" rel="noreferrer" className="topbar-docs">
              API docs <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>XAIFlow · Explainability at every step</span>
          <span>Local execution environment</span>
        </footer>
      </div>
    </div>
  );
}
