import { useEffect, useId, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle2, Inbox, LoaderCircle, X } from 'lucide-react';
import { title } from '../utils/format';

export function Button({
  children,
  variant = 'primary',
  className = '',
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      disabled={props.disabled || loading}
      className={`button button-${variant} ${className}`}
    >
      {loading ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
export function Badge({ status }: { status: string }) {
  const tone = [
    'completed',
    'success',
    'active',
    'production',
    'resolved',
    'ready',
    'stable',
    'approved',
  ].includes(status)
    ? 'green'
    : ['failed', 'error', 'critical', 'high'].includes(status)
      ? 'red'
      : ['running', 'queued', 'staging', 'acknowledged', 'medium', 'warning', 'open'].includes(
            status,
          )
        ? 'amber'
        : 'gray';
  return (
    <span className={`badge badge-${tone}`}>
      <span />
      {title(status)}
    </span>
  );
}
export function PageHeader({
  eyebrow,
  title: heading,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{heading}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  );
}
export function Card({
  children,
  className = '',
  title: heading,
  subtitle,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {heading && (
        <div className="card-heading">
          <div>
            <h2>{heading}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action && <div className="card-actions">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({
  title: heading,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={26} aria-hidden="true" />
      </div>
      <h3>{heading}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading({ label = 'Loading workspace data' }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-copy">
        <LoaderCircle size={20} className="spin" aria-hidden="true" />
        <span>{label}…</span>
      </div>
      <div className="loading-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
export function Notice({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null;
  return (
    <div
      className={`notice ${error ? 'notice-error' : 'notice-success'}`}
      role={error ? 'alert' : 'status'}
    >
      {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span>{error ?? success}</span>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <Card>
      <div className="error-state">
        <AlertCircle size={26} />
        <h3>Couldn’t load this view</h3>
        <p>{error.message}</p>
        {retry && (
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    </Card>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon,
  trend,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
  trend?: { label: string; tone?: 'up' | 'down' | 'flat' };
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        {icon && (
          <span className="metric-icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <strong className="metric-value">{value}</strong>
      {trend && <span className={`metric-trend trend-${trend.tone ?? 'flat'}`}>{trend.label}</span>}
      {detail && <small>{detail}</small>}
      <span className="metric-accent" aria-hidden="true" />
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({
  title: heading,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', listener);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', listener);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <div className="modal-heading">
          <h2 id={id}>{heading}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Code({ value }: { value: unknown }) {
  return <pre className="code">{JSON.stringify(value, null, 2)}</pre>;
}
