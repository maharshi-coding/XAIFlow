# UI refresh

The entire XAIFlow interface uses a shared scientific dashboard design: graphite navigation, paper background, white cards, restrained teal actions, readable typography, and consistent spacing. Existing datasets, pipelines, experiments, serving, monitoring, and recovery remain connected to the real backend.

## Applied source

The requested [UI/UX Pro Max repository](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) is cloned beside the app as `../ui-ux-pro-max-skill`, at commit `477bcb28c9812b385cb51a4605ddf30d7b2266e2`. Its skill and local search guidance were applied to this existing React application. It is a local reference; no global skill installation is required to run XAIFlow.

The dashboard style and IBM Plex Sans / JetBrains Mono pairing informed the refresh. Generated marketing-page layout recommendations were adapted to an operational ML workspace. The [design-system specification](../design-system/xaiflow/MASTER.md) records the rationale; the stylesheet contains the implemented tokens. Fonts are bundled locally for offline use.

## Delivered changes

- Navigation groups Workspace, Models, and Operations, retains project context, and becomes a keyboard-accessible drawer on smaller screens.
- Overview presents actual metrics, recent experiments and deployments, model results, and an illustrative four-stage workflow.
- Shared cards, controls, tables, forms, empty/loading/error states, charts, and status badges provide a consistent hierarchy throughout all pages.
- Dataset views emphasize shape, target, exact-value tooltips, preview/statistics toggles, and readable distributions. Projects identify the selected workspace.
- The pipeline editor provides collapsible stage and settings panels, a Fit workflow action, a native stage picker, richer stage summaries, button/select connection alternatives, stage progress, elapsed time, and timestamped logs.
- Experiment, comparison, explanation, registry, deployment, monitoring, and alert screens inherit the shared typography, layout, and chart treatment.
- Backups expose actual archive totals and readable restore counts with direct navigation into the recovered project. Settings organize actual backend execution capabilities and runtime diagnostics.
- Modal focus remains stable while editing forms. Closed navigation is inert; Escape, focus containment, focus restoration, visible focus, pressed states, and reduced-motion treatment improve keyboard use.

## Validation

Verified on 2026-10-06 against the live local application on port 5173 and its PostgreSQL-backed API on port 8001.

| Check | Result |
| --- | --- |
| Frontend tests | 41 passed across 18 files |
| ESLint | Passed without warnings |
| Prettier check | Passed |
| TypeScript + production Vite build | Passed |
| Responsive routes | 56 checks: 14 screens at 375, 768, 1024, and 1440px |
| Document overflow / page load errors | None in the recorded route checks |
| Browser console errors | None during final verification |
| Live pipeline | All 9 stages completed; random forest + SHAP + registration; accuracy 76.3% |
| Live serving | Dataset sample returned class 1 with 62.4% confidence and a real LIME explanation |

[Recorded layout measurements](ui-layout-checks.json) contain the route, heading, viewport width, document width, and rendered error messages. The browser checks covered Overview, Projects, Datasets, Pipelines, Experiments, Explainability, Model registry, Deployments, Monitoring, Alerts, Backups, Settings, experiment detail, and model detail.

Keyboard checks verified drawer focus containment, Escape, restoration and inert closed content; modal focus while forms change; actual React Flow Enter/Escape selection; library and settings focus restoration; the stage picker; and labels that follow edited stage names. Mobile settings and local table scrolling were reviewed in the live browser. Charts display data immediately and CSS respects reduced motion. Confusion matrix counts retain dark text throughout the heat scale.

The live smoke run is `7afa0a9d-a8f7-4e8b-8cac-e0721dd5c0ee`; serving request is `f9268155-a572-4aa7-b6ce-d612333f60ab`. Both used the included synthetic churn demonstration. This refresh does not change backend APIs, DAG serialization, training, inference, or backup formats. The prior backend verification remains documented in [testing.md](testing.md).

## Previews

![Refreshed overview](screenshots/ui-overview.jpg)

- [Phone overview](screenshots/ui-mobile.jpg)
- [Completed visual workflow](screenshots/ui-pipeline.jpg)
- [Live prediction console](screenshots/ui-prediction.jpg)
