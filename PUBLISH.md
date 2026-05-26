# Publishing SDKs to npm

Flow for publishing `@trib3/anchor-escrow-sdk` and `@trib3/anchor-amm-sdk` to the npm registry.

## Checklist (TL;DR)

- [ ] Logged in: `pnpm whoami` returns your user, in `@trib3` org
- [ ] READMEs exist in both `sdk/` dirs
- [ ] Version bumped in `package.json`
- [ ] `pnpm --filter <pkg> publish --dry-run --no-git-checks` shows expected files only
- [ ] Smoke-tested via `--tag next` install (optional but advised)
- [ ] `pnpm --filter <pkg> publish` succeeds
- [ ] Git tag pushed
- [ ] `pnpm view <pkg>` confirms publish

## Packages

| Package | Path | Current version |
|---|---|---|
| `@trib3/anchor-escrow-sdk` | [anchor-escrow/sdk/](anchor-escrow/sdk/) | 0.1.0 |
| `@trib3/anchor-amm-sdk` | [anchor-amm/sdk/](anchor-amm/sdk/) | 0.1.0 |

Both are scoped under `@trib3` and configured for public access (`publishConfig.access: "public"`).
Both build with `tsup` to dual ESM + CJS with `.d.ts` types.

## One-time setup

### 1. npm account + scope

- Create npm account: https://www.npmjs.com/signup
- Enable 2FA via web UI (required for publishing scoped public packages): https://www.npmjs.com/settings/~/profile
- Create / claim the `@trib3` org on npm: https://www.npmjs.com/org/create
  - Free plan is fine for public packages
- Add yourself (and any co-maintainers) to the org

### 2. Local login

```bash
pnpm login
# or, for granular access tokens:
pnpm login --auth-type=web
```

Verify:

```bash
pnpm whoami
# org membership: check https://www.npmjs.com/settings/<user>/orgs
```

### 3. Verify package metadata

Both `package.json` files should already have:

- `"name": "@trib3/<name>"`
- `"publishConfig": { "access": "public" }` (mandatory for first publish of scoped pkg)
- `"files": ["dist", "src", "README.md"]`
- `"main"`, `"module"`, `"types"`, `"exports"` pointing into `dist/`

### 4. Add SDK READMEs (missing today)

Both packages list `README.md` in `files` but neither exists. npm publish will succeed but the package page will be blank. Add minimal READMEs at:

- [anchor-escrow/sdk/README.md](anchor-escrow/sdk/README.md)
- [anchor-amm/sdk/README.md](anchor-amm/sdk/README.md)

Minimum content: install command, one usage snippet, link back to repo.

### 5. Add `repository`, `homepage`, `bugs` fields (recommended)

Improves npm page + GitHub linkback. Add to each `package.json`:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/<owner>/Turbin3-Q2-2026.git",
  "directory": "anchor-escrow/sdk"
},
"homepage": "https://github.com/<owner>/Turbin3-Q2-2026/tree/main/anchor-escrow/sdk#readme",
"bugs": "https://github.com/<owner>/Turbin3-Q2-2026/issues"
```

## Pre-publish checklist (every release)

Run from repo root.

```bash
# 1. clean install
pnpm install --frozen-lockfile

# 2. build both SDKs
pnpm --filter @trib3/anchor-escrow-sdk build
pnpm --filter @trib3/anchor-amm-sdk build

# 3. inspect dist
ls anchor-escrow/sdk/dist
ls anchor-amm/sdk/dist
# expect: index.cjs, index.cjs.map, index.d.cts, index.d.ts, index.js, index.js.map

# 4. dry-run — see exact tarball contents + size
#    full publish simulation (runs prepublishOnly + checks auth, no upload):
pnpm --filter @trib3/anchor-escrow-sdk publish --dry-run --no-git-checks
pnpm --filter @trib3/anchor-amm-sdk publish --dry-run --no-git-checks

# alternative: pack to tarball + inspect
pnpm --filter @trib3/anchor-escrow-sdk pack
tar tzf anchor-escrow/sdk/trib3-anchor-escrow-sdk-*.tgz
rm anchor-escrow/sdk/trib3-anchor-escrow-sdk-*.tgz
```

Check the dry-run output for:
- No source-only or secret files leaked (`.env`, `id.json`, `vanity.json`, test fixtures)
- `dist/` present
- README present
- Reasonable size (SDKs should be small, <100 KB unpacked)

## Versioning

Use semver. Bump version before publish.

```bash
# per package (run from pkg dir)
cd anchor-escrow/sdk && pnpm version patch && cd -      # 0.1.0 -> 0.1.1
cd anchor-escrow/sdk && pnpm version minor && cd -      # 0.1.0 -> 0.2.0
cd anchor-escrow/sdk && pnpm version major && cd -      # 0.1.0 -> 1.0.0

# or pre-release
cd anchor-amm/sdk && pnpm version prerelease --preid=rc && cd -   # 0.1.0 -> 0.1.1-rc.0
```

`pnpm version` creates a git tag by default. If you want a single tag per release covering both pkgs, pass `--no-git-tag-version` and tag manually:

```bash
git tag -a sdk-v0.2.0 -m "SDKs 0.2.0"
git push origin sdk-v0.2.0
```

Rules of thumb while on `0.x`:
- Breaking change → minor bump
- Anything else → patch
- First stable API → `1.0.0`

Keep both SDKs in lockstep only if they ship related changes. Otherwise version independently.

## Publishing — Trusted Publishing via GitHub Actions

We publish from CI using **npm Trusted Publishing** (OIDC). No `NPM_TOKEN` secret, no 2FA OTP prompts, signed provenance attached to every release.

Each SDK has its **own** workflow + its **own** tag prefix so releases are independent:

| Package | Workflow | Tag prefix |
|---|---|---|
| `@trib3/anchor-escrow-sdk` | [.github/workflows/publish-escrow-sdk.yml](.github/workflows/publish-escrow-sdk.yml) | `escrow-sdk-v*` |
| `@trib3/anchor-amm-sdk` | [.github/workflows/publish-amm-sdk.yml](.github/workflows/publish-amm-sdk.yml) | `amm-sdk-v*` |

### One-time: configure trusted publisher on npm

Do this **once per package**, before the first publish. Both packages are brand-new, so npm allows pre-configuring the trusted publisher under the `@trib3` org.

For each package, on its npm settings page → **Publishing access** → **Add trusted publisher** → **GitHub Actions**:

| Field | escrow value | amm value |
|---|---|---|
| Organization or user | `mael-bomane` | `mael-bomane` |
| Repository | `Turbin3-Q2-2026` | `Turbin3-Q2-2026` |
| Workflow filename | `publish-escrow-sdk.yml` | `publish-amm-sdk.yml` |
| Environment name | *(blank)* | *(blank)* |

URLs (once the package exists or pre-configured via org `@trib3` settings):
- https://www.npmjs.com/package/@trib3/anchor-escrow-sdk/access
- https://www.npmjs.com/package/@trib3/anchor-amm-sdk/access

> npm requires npm CLI `>= 11.5.1` on the runner for trusted publishing. Each workflow runs `npm install -g npm@latest` to guarantee this.

### Triggering a publish

**Option A — tag-based (recommended for releases)**

```bash
# escrow only
cd anchor-escrow/sdk && pnpm version patch && cd -
git tag -a escrow-sdk-v0.1.1 -m "anchor-escrow-sdk 0.1.1"
git push origin main --follow-tags

# amm only
cd anchor-amm/sdk && pnpm version patch && cd -
git tag -a amm-sdk-v0.1.1 -m "anchor-amm-sdk 0.1.1"
git push origin main --follow-tags
```

`pnpm version` creates a git tag automatically. To use our prefixed tag scheme, either:
- pass `--no-git-tag-version` then tag manually (commands above), or
- accept the default `v0.1.1` tag and create the prefixed one as well

**Option B — manual dispatch (for pre-release / one-off)**

GitHub UI → Actions → pick "Publish anchor-escrow-sdk" or "Publish anchor-amm-sdk" → Run workflow → set dist-tag (`latest`, `next`, `rc`, etc.).

### Test publish first

For a pre-release smoke-test, dispatch the workflow with `tag: next`. Install + verify in a scratch project:

```bash
mkdir /tmp/sdk-smoke && cd /tmp/sdk-smoke
pnpm init
pnpm add @trib3/anchor-escrow-sdk@next @solana/kit
node -e "import('@trib3/anchor-escrow-sdk').then(m => console.log(Object.keys(m)))"
```

Promote to `latest`:

```bash
pnpm dist-tag add @trib3/anchor-escrow-sdk@0.1.1 latest
```

### Manual publish (escape hatch)

If CI is broken and you need to ship hot:

```bash
pnpm --filter @trib3/anchor-escrow-sdk publish --no-git-checks --otp=<6-digit-code>
# or
pnpm --filter @trib3/anchor-amm-sdk publish --no-git-checks --otp=<6-digit-code>
```

Requires you to be added as a publisher on the package on npm. Loses provenance attestation.

## Post-publish

```bash
pnpm view @trib3/anchor-escrow-sdk
pnpm view @trib3/anchor-amm-sdk
```

Check:
- Version, dist-tags, file list match expectations
- Page on npmjs.com renders README
- `pnpm add @trib3/anchor-escrow-sdk` works in a fresh project

Push the version-bump commit + tags to GitHub:

```bash
git push origin main --follow-tags
```

## Recovery

### Unpublish (only within 72 h of publish)

```bash
pnpm unpublish @trib3/anchor-escrow-sdk@0.1.0
```

After 72 h: deprecate instead.

### Deprecate a bad version

```bash
pnpm deprecate @trib3/anchor-escrow-sdk@0.1.0 "Broken build — use 0.1.1"
```

### Republish same version

Not allowed. Bump patch and republish.


