# Develop on another computer

The repository contains the application source, dependency locks, migrations, tests, documentation, screenshots, and synthetic demonstration CSV. Install dependencies separately on each computer.

## Clone the repository

Sign in to GitHub as an account that has access to this private repository. With GitHub CLI installed:

```bash
gh auth login
gh repo clone maharshi-coding/XAIFlow
cd XAIFlow
```

Alternatively, use Git with your configured GitHub credentials:

```bash
git clone https://github.com/maharshi-coding/XAIFlow.git
cd XAIFlow
```

## Run the application

The [README](../README.md) has complete Docker and local setup instructions. Docker Compose is the cross-platform option; install Docker with Compose, copy `.env.example` to `.env`, set a local PostgreSQL password, and run `docker compose up --build`. The interface will be at `http://localhost:8080`. The container setup is supplied; see [testing](testing.md) for its verification status.

For local development on macOS/Linux, install Python 3.12 and Node.js 22, then from the repository root:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt -c backend/requirements.lock
cd frontend
npm ci
cd ..
bash scripts/dev.sh
```

The development interface will be at `http://localhost:5173`. For native Windows development, use WSL2 for the Bash-based local workflow or use Docker Compose. No external AI API key is needed.

## Make and synchronize changes

Before starting work on a computer, commit or otherwise preserve its local changes, then update the main branch:

```bash
git switch main
git pull --ff-only
git switch -c my-feature
```

After editing, run the checks listed in the README, inspect your changes, and commit only the intended files:

```bash
git status
git diff
git add path/to/changed-file
git commit -m "Describe the change"
git push -u origin my-feature
```

Open a pull request on GitHub when ready. To continue the same feature on another computer after its first push:

```bash
git fetch origin
git switch my-feature
git pull --ff-only
```

If Git reports that the branch does not exist locally, use `git switch --track origin/my-feature`. Push committed work before moving to the other computer so it can fetch those commits.

## Application data is separate from source code

Git does not synchronize running servers, installed dependencies, local databases, trained artifacts, or `.env` files. A new checkout starts with an empty application database. Use the included `data/demo_churn.csv` or run `python3 scripts/demo.py --run` against the running API to create and train the demo workflows.

To transfer an existing project and its trained models, export it from the app's **Backups** screen and restore it on the other installation. Signed recovery also requires the originating installation's backup signing key: preserve the configured `BACKUP_SIGNING_KEY` or the generated `.backup-signing-key` under its artifact storage root and configure the destination installation with the same key. Transfer that secret securely outside Git. Backup archives and secrets should remain outside the source repository.

When the API runs on a nondefault port, pass its base URL to the demo script, for example `python3 scripts/demo.py --base http://localhost:8001/api/v1 --run`.
