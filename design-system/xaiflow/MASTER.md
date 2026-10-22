# XAIFlow design system

A readable scientific workspace for building, explaining, and operating tabular machine learning models.

## Source and adaptation

Applied the user-requested [UI/UX Pro Max repository](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), cloned beside XAIFlow at commit `477bcb28c9812b385cb51a4605ddf30d7b2266e2`.

The `machine learning analytics dashboard` system search returned the verified **Data-Dense Dashboard** style. A narrower `developer tool IDE dashboard` search supplied IBM Plex Sans / JetBrains Mono typography guidance. Generated landing-page compositions did not match this operational application after the required retry; the layout below is an explicitly adapted application design, rather than persisted unverified marketing output. An explicit `data dense dashboard --domain style` search confirmed the dashboard style. `accessible components --stack react` matched accessible test queries and component guidance. The application's existing teal identity is retained with stronger contrast.

## Visual direction

- Graphite navigation, paper background, white cards, restrained teal actions.
- Task groups: Workspace, Models, Operations. Project context always visible.
- Strong title hierarchy and useful data density; no decorative fake metrics or activity.
- Locally bundled IBM Plex Sans for interface text, JetBrains Mono for identifiers/code/data.
- Body 15px, supporting 13–14px, metadata 12px; dense stage text may use 11px.
- Shared component tokens and consistent 12–16px corners. Subtle elevation rather than heavy effects.

## Core palette

| Role | Value |
| --- | --- |
| Background | `#F4F6F8` |
| Card | `#FFFFFF` |
| Text | `#182735` |
| Secondary text | `#526273` |
| Sidebar | `#111A24` |
| Primary / teal | `#087F75` |
| Subtle teal | `#E9F5F1` |
| Border | `#DDE5E9` |

The stylesheet is the implementation source of truth for semantic color, chart, focus, spacing, and motion tokens. Preserve readable semantic error/success/warning colors. Teal and warning colors are accompanied by text/status labels.

## Interaction and accessibility

Use 40–44px controls, visible focus, labeled icon actions, pressed states for independent view toggles, and semantic native form controls. Main content has a skip link. Mobile navigation supports Escape, focus containment, focus restoration, and inert closed content. Modal focus remains stable while editing forms. Respect reduced motion. Keep long tables horizontally scrollable inside their own containers, never at document level. Charts use larger tick labels, legends, tooltips, and accessible data tables when available. Dragging has click/select/button alternatives.

## Layout

The sidebar collapses to a drawer at 1024px. Test 375, 768, 1024, and 1440px widths. Data cards and forms stack progressively. The visual editor has independently collapsible library/settings panels so the canvas remains usable on narrow screens. Small screens retain readable type and control hit areas.

## Page treatment

Overview combines real summary metrics, an illustrative four-stage workflow, recent experiments, deployment state, and model results. Resource pages share header/control/card patterns. Dataset pages emphasize file identity, selected target, exact-value tooltips, and sampled distribution labels. Experiment and model views retain metrics/lineage/artifacts with readable figures. Explainability uses consistent local/global attribution colors. Deployment and monitoring retain actual traffic and drift values. Backups show readable recovery counts and a direct route into the restored project. Settings expose real backend capabilities and runtime diagnostics.
