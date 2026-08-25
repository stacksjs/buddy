# Installation

Installing `buddy` is easy. Simply pull it in via your package manager of choice, or download the binary directly.

## Package Managers

Choose your package manager of choice:

::: code-group

```sh [npm]
npm install --save-dev @buddysh/buddy
# npm i -d @buddysh/buddy

# or, install globally via
npm i -g @buddysh/buddy
```

```sh [bun]
bun install --dev @buddysh/buddy
# bun add --dev @buddysh/buddy
# bun i -d @buddysh/buddy

# or, install globally via
bun add --global @buddysh/buddy
```

```sh [pnpm]
pnpm add --save-dev @buddysh/buddy
# pnpm i -d @buddysh/buddy

# or, install globally via
pnpm add --global @buddysh/buddy
```

```sh [yarn]
yarn add --dev @buddysh/buddy
# yarn i -d @buddysh/buddy

# or, install globally via
yarn global add @buddysh/buddy
```

```sh [brew]
brew install buddy # coming soon
```

```sh [pkgx]
pkgx buddy # coming soon
```

:::

::: tip Dependency File Support
Buddy automatically detects and updates pkgx dependency files (`deps.yaml`, `pkgx.yaml`) and Launchpad dependency files that use the same registry format. No additional configuration required!
:::

## Prerequisites

Buddy requires:

- **Bun** - The fast package manager and runtime
- **Node.js** 18+ (for compatibility)
- **Git** - For repository operations

### Install Bun

If you don't have Bun installed:

::: code-group

```sh [macOS/Linux]
curl -fsSL https://bun.sh/install | bash
```

```sh [Windows]
powershell -c "irm bun.sh/install.ps1 | iex"
```

```sh [npm]
npm install -g bun
```

:::

## Binaries

Choose the binary that matches your platform and architecture:

::: code-group

```sh [macOS (arm64)]
# Download the archive
curl -L https://github.com/stacksjs/buddy/releases/latest/download/buddy-darwin-arm64.zip -o buddy-darwin-arm64.zip

# Unpack it
unzip buddy-darwin-arm64.zip

# Make it executable
chmod +x buddy-darwin-arm64

# Move it to your PATH
mv buddy-darwin-arm64 /usr/local/bin/buddy
```

```sh [macOS (x64)]
# Download the archive
curl -L https://github.com/stacksjs/buddy/releases/latest/download/buddy-darwin-x64.zip -o buddy-darwin-x64.zip

# Unpack it
unzip buddy-darwin-x64.zip

# Make it executable
chmod +x buddy-darwin-x64

# Move it to your PATH
mv buddy-darwin-x64 /usr/local/bin/buddy
```

```sh [Linux (arm64)]
# Download the archive
curl -L https://github.com/stacksjs/buddy/releases/latest/download/buddy-linux-arm64.zip -o buddy-linux-arm64.zip

# Unpack it
unzip buddy-linux-arm64.zip

# Make it executable
chmod +x buddy-linux-arm64

# Move it to your PATH
mv buddy-linux-arm64 /usr/local/bin/buddy
```

```sh [Linux (x64)]
# Download the archive
curl -L https://github.com/stacksjs/buddy/releases/latest/download/buddy-linux-x64.zip -o buddy-linux-x64.zip

# Unpack it
unzip buddy-linux-x64.zip

# Make it executable
chmod +x buddy-linux-x64

# Move it to your PATH
mv buddy-linux-x64 /usr/local/bin/buddy
```

```sh [Windows (x64)]
# Download the archive
curl -L https://github.com/stacksjs/buddy/releases/latest/download/buddy-windows-x64.zip -o buddy-windows-x64.zip

# Unpack it
tar -xf buddy-windows-x64.zip

# Move it to your PATH (adjust the path as needed)
move buddy-windows-x64.exe C:\Windows\System32\buddy.exe
```

:::

::: tip
You can also find the `buddy` archives in GitHub [releases](https://github.com/stacksjs/buddy/releases). Every release publishes a `checksums.txt` alongside them, so you can verify a download before unpacking it:

```sh
curl -L https://github.com/stacksjs/buddy/releases/latest/download/checksums.txt -o checksums.txt
shasum -a 256 -c checksums.txt --ignore-missing
```

:::

## GitHub Setup

### For GitHub Actions (Recommended)

When using buddy in GitHub Actions, you don't need a personal token. Just configure proper workflow permissions:

```yaml
name: Dependency Updates
on:
  schedule:

    - cron: '0 2 * * 1'

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Read repository and write changes
      pull-requests: write # Create and update pull requests
      actions: write # Update workflow files (optional)

    steps:

      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bunx @buddysh/buddy update

        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # Built-in token
```

The `GITHUB_TOKEN` is automatically provided by GitHub Actions with the permissions you specify.

### For Local Development (Optional)

If you want to run buddy locally to create PRs, you'll need a personal access token:

#### Personal Access Token (Classic)

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` - Full repository access
   - `workflow` - Update GitHub Actions workflows (optional)
4. Set as environment variable:

```bash
export GITHUB_TOKEN=ghp*xxxxxxxxxxxxxxxxxxxx
```

#### Fine-grained Personal Access Token

1. Go to [GitHub Settings > Personal Access Tokens (fine-grained)](https://github.com/settings/personal-access-tokens/new)
2. Select repository access and grant permissions:
   - **Contents**: Read and Write
   - **Pull requests**: Write
   - **Metadata**: Read

## Verification

Verify your installation:

```bash
# Check version
buddy --version

# Test GitHub authentication
buddy scan --verbose

# Diagnose credentials, git state and analyzer tooling
buddy doctor
```

## IDE Integration

### VS Code

Install the Bun extension for better TypeScript support:

```bash
code --install-extension oven.bun-vscode
```

### Configuration Files

Buddy will automatically detect and use:

- `buddy.config.ts` (TypeScript)
- `buddy.config.js` (JavaScript)
- `buddy.config.json` (JSON)

## Docker Support

Run buddy in a container:

```dockerfile
FROM oven/bun:latest

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install

COPY . .
RUN bun install -g @buddysh/buddy

CMD ["buddy", "scan"]
```

## CI/CD Setup

### GitHub Actions

```yaml
name: Dependency Updates
on:
  schedule:

    - cron: '0 2 * * 1' # Weekly on Monday

jobs:
  update:
    runs-on: ubuntu-latest
    steps:

      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx @buddysh/buddy update

        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI

```yaml
dependency-updates:
  image: oven/bun:latest
  script:

    - bun install
    - bunx @buddysh/buddy update

  only:

    - schedules

  variables:
    GITLAB_TOKEN: $CI_JOB_TOKEN
```

## Troubleshooting

### Common Issues

**Bun not found:**
```bash
# Add Bun to PATH
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**GitHub token issues:**
```bash
# Test token permissions
gh auth status
# or
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user
```

**Package not found:**
```bash
# Clear package cache
bun pm cache rm
# Reinstall
bun install
```

## Getting Started

After installation, the fastest way to get started is with the interactive setup:

```bash
# Run interactive setup (recommended)
buddy setup
```

This comprehensive setup wizard will:

- **🔍 Detect your repository** automatically from git remote
- **🔑 Guide token setup** for Personal Access Tokens and repository secrets
- **🔧 Configure permissions** for GitHub Actions
- **⚙️ Choose workflow presets** optimized for your project type
- **📝 Generate configuration** files and settings
- **🔄 Create workflows** for automated dependency management
- **🎯 Provide next steps** with clear instructions

### Alternative: Manual Usage

If you prefer manual configuration, you can start with scanning:

```bash
# Scan for outdated dependencies
buddy scan

# Create dependency dashboard
buddy dashboard

# Update dependencies with pull requests
buddy update
```

## Next Steps

- **[Complete Setup Guide](/cli/setup)** - Detailed setup documentation
- **[Usage Examples](/usage)** - How to use buddy effectively
- **[Configuration](/config)** - Customize buddy behavior
- **[CLI Reference](/cli/)** - Complete command documentation
