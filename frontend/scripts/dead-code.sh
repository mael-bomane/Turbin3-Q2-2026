#!/usr/bin/env bash
# Dead code finder. Scans src/ for exported symbols with no references
# elsewhere and writes DEADCODE.md at project root.
#
# Heuristic: an export is "dead" when no other source file references its
# name (named exports) or imports its module path (default exports).
# False positives possible for: dynamic imports with computed paths,
# symbols only referenced from non-src/ code, framework-magic registrations.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/DEADCODE.md"

command -v rg >/dev/null || { echo "ripgrep (rg) required" >&2; exit 1; }

# Detect layout: prefer src/ if present, else scan project root and prune
# non-source directories (Next.js without-src layout).
PRUNE_DIRS=()
if [[ -d "$ROOT/src" ]]; then
    SRC="$ROOT/src"
else
    SRC="$ROOT"
    PRUNE_DIRS=(node_modules .next .turbo .git dist build out coverage public scripts)
fi

# rg globs to skip pruned dirs (rg honors .gitignore already, but be explicit).
PRUNE_GLOBS=()
for d in "${PRUNE_DIRS[@]}"; do
    PRUNE_GLOBS+=( --glob "!${d}/**" )
done

# Label used in report prose / category headers.
if [[ "$SRC" == "$ROOT" ]]; then
    SRC_LABEL="project root"
    SRC_PREFIX=""
else
    SRC_LABEL="\`${SRC#$ROOT/}/\`"
    SRC_PREFIX="${SRC#$ROOT/}/"
fi

# Next.js convention basenames are auto-discovered by the framework; never
# imported by name, so skip them as export sources.
CONVENTION_RE='^(page|layout|route|middleware|loading|error|not-found|default|template|global-error|opengraph-image|twitter-image|icon|apple-icon|favicon|robots|sitemap|manifest|instrumentation|instrumentation-client)\.(ts|tsx|js|jsx)$'

is_convention() {
    [[ "$(basename "$1")" =~ $CONVENTION_RE ]]
}

# Module specifier suffix used in `from '@/...'` or relative imports.
# Strips src/ prefix, .ts/.tsx extension, and trailing /index.
mod_suffix() {
    local rel="${1#$SRC/}"
    rel="${rel%.tsx}"
    rel="${rel%.ts}"
    rel="${rel%/index}"
    printf '%s' "$rel"
}

# Top-level category for grouping (components, hooks, lib, types, app, ...).
category_of() {
    local rel="${1#$SRC/}"
    printf '%s' "${rel%%/*}"
}

# Extract exported symbols from a file. Output lines: "kind:name"
# kind in {named, default}. Handles:
#   export (async )?function NAME
#   export (const|let|var) NAME
#   export (class|interface|type|enum) NAME
#   export { A, B as C, type D }
#   export * as NS from '...'
#   export default function NAME / class NAME / <anything>
extract_exports() {
    awk '
        # Strip block + line comments first via state machine
        BEGIN { blk=0 }
        {
            l=$0; out=""
            while (length(l) > 0) {
                if (blk) {
                    p = index(l, "*/")
                    if (p) { l = substr(l, p+2); blk=0 } else { l=""; break }
                } else {
                    p = index(l, "/*")
                    if (!p) { out = out l; l="" }
                    else { out = out substr(l, 1, p-1); l = substr(l, p+2); blk=1 }
                }
            }
            sub(/\/\/.*$/, "", out)
            lines[NR] = out
        }
        END {
            buf = ""
            for (i=1; i<=NR; i++) {
                line = lines[i]
                if (buf == "") {
                    if (line ~ /^[[:space:]]*export[[:space:]]/) buf = line; else continue
                } else {
                    buf = buf " " line
                }
                # Wait until braces in buf are balanced before emitting
                o=0; c=0
                for (k=1; k<=length(buf); k++) {
                    ch = substr(buf,k,1)
                    if (ch=="{") o++
                    else if (ch=="}") c++
                }
                if (o == c) { emit(buf); buf="" }
            }
            if (buf != "") emit(buf)
        }
        function emit(b,    m, inner, n, parts, j, item, mm) {
            if (match(b, /^[[:space:]]*export[[:space:]]+default[[:space:]]+(async[[:space:]]+)?function[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*)/, m)) {
                print "default:" m[2]; return
            }
            if (match(b, /^[[:space:]]*export[[:space:]]+default[[:space:]]+class[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*)/, m)) {
                print "default:" m[1]; return
            }
            if (match(b, /^[[:space:]]*export[[:space:]]+default[[:space:]]/)) {
                print "default:_DEFAULT_"; return
            }
            if (match(b, /^[[:space:]]*export[[:space:]]+(async[[:space:]]+)?function[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*)/, m)) {
                print "named:" m[2]; return
            }
            if (match(b, /^[[:space:]]*export[[:space:]]+(const|let|var)[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*)/, m)) {
                print "named:" m[2]; return
            }
            if (match(b, /^[[:space:]]*export[[:space:]]+(class|interface|type|enum)[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*)/, m)) {
                print "named:" m[2]; return
            }
            if (match(b, /^[[:space:]]*export[[:space:]]+(type[[:space:]]+)?\{([^}]*)\}/, m)) {
                inner = m[2]
                n = split(inner, parts, ",")
                for (j=1; j<=n; j++) {
                    item = parts[j]
                    gsub(/^[[:space:]]+|[[:space:]]+$/, "", item)
                    sub(/^type[[:space:]]+/, "", item)
                    if (item == "") continue
                    if (match(item, /[[:space:]][Aa]s[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*)/, mm)) print "named:" mm[1]
                    else if (match(item, /^([A-Za-z_$][A-Za-z0-9_$]*)/, mm)) print "named:" mm[1]
                }
                return
            }
            if (match(b, /^[[:space:]]*export[[:space:]]*\*[[:space:]]+as[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*)/, m)) {
                print "named:" m[1]; return
            }
        }
    ' "$1"
}

# Globs to exclude from usage searches (populated below with dead barrels so
# their re-exports don't count as references to the source symbol).
EXCLUDE_GLOBS=()

# Is the named symbol `$2` referenced in any .ts/.tsx file under src/ other
# than the defining file `$1` (and any excluded files)?
named_used() {
    local file="$1" sym="$2"
    rg -lq --type-add 'tsx:*.tsx' -tts -ttsx \
        --glob "!${file#$ROOT/}" \
        "${PRUNE_GLOBS[@]}" \
        "${EXCLUDE_GLOBS[@]}" \
        "\\b${sym}\\b" "$SRC"
}

# Is the file `$1` imported anywhere (default or namespace import)?
# Matches `from '...<suffix>'` where suffix is the file's module specifier.
default_used() {
    local file="$1"
    local suffix
    suffix=$(mod_suffix "$file")
    [[ -z "$suffix" ]] && return 1
    local esc
    esc=$(printf '%s' "$suffix" | sed 's/[][\.^$*+?(){}|/]/\\&/g')
    rg -lq --type-add 'tsx:*.tsx' -tts -ttsx \
        --glob "!${file#$ROOT/}" \
        "${PRUNE_GLOBS[@]}" \
        "${EXCLUDE_GLOBS[@]}" \
        "from[[:space:]]+['\"][^'\"]*${esc}['\"]" "$SRC"
}

# Like default_used but with a custom extra-exclude list of files (used during
# the dead-barrel discovery pass).
imported_anywhere_excluding() {
    local file="$1"; shift
    local suffix esc
    suffix=$(mod_suffix "$file")
    [[ -z "$suffix" ]] && return 1
    esc=$(printf '%s' "$suffix" | sed 's/[][\.^$*+?(){}|/]/\\&/g')
    local globs=( --glob "!${file#$ROOT/}" )
    for f in "$@"; do globs+=( --glob "!${f#$ROOT/}" ); done
    rg -lq --type-add 'tsx:*.tsx' -tts -ttsx \
        "${globs[@]}" \
        "${PRUNE_GLOBS[@]}" \
        "from[[:space:]]+['\"][^'\"]*${esc}['\"]" "$SRC"
}

# Collect findings.
NAMED_DEAD=()
DEFAULT_DEAD=()
UNUSED_FILES=()
BARREL_DEAD=()

# Build find prune expression from PRUNE_DIRS (covers node_modules in src/ layout too).
FIND_PRUNE=( -path '*/node_modules/*' )
for d in "${PRUNE_DIRS[@]}"; do
    FIND_PRUNE+=( -o -path "*/$d/*" )
done
mapfile -t FILES < <(find "$SRC" -type f \( -name '*.ts' -o -name '*.tsx' \) -not \( "${FIND_PRUNE[@]}" \) | sort)

# --- Pass 1: discover dead barrels iteratively. A barrel is "dead" if no
# non-barrel-and-non-already-dead file imports it. Iterate until stable so
# barrels-of-barrels also get caught.
mapfile -t BARRELS < <(printf '%s\n' "${FILES[@]}" | grep -E '/index\.tsx?$' || true)
while true; do
    added=0
    for b in "${BARRELS[@]}"; do
        skip=0
        for d in "${BARREL_DEAD[@]}"; do [[ "$d" == "$b" ]] && { skip=1; break; }; done
        (( skip == 1 )) && continue
        if ! imported_anywhere_excluding "$b" "${BARREL_DEAD[@]}"; then
            BARREL_DEAD+=("$b")
            added=1
        fi
    done
    (( added == 0 )) && break
done

# Build EXCLUDE_GLOBS from dead barrels so their re-exports are ignored.
for d in "${BARREL_DEAD[@]}"; do
    EXCLUDE_GLOBS+=( --glob "!${d#$ROOT/}" )
done

scanned=0
for file in "${FILES[@]}"; do
    is_convention "$file" && continue
    scanned=$((scanned+1))
    has_export=0
    has_dead_default=0
    file_named_count=0
    file_dead_named_count=0

    while IFS= read -r entry; do
        [[ -z "$entry" ]] && continue
        kind="${entry%%:*}"
        name="${entry#*:}"
        has_export=1
        if [[ "$kind" == "named" ]]; then
            file_named_count=$((file_named_count+1))
            if ! named_used "$file" "$name"; then
                NAMED_DEAD+=("$file|$name")
                file_dead_named_count=$((file_dead_named_count+1))
            fi
        else
            if ! default_used "$file"; then
                if [[ "$name" == "_DEFAULT_" ]]; then
                    DEFAULT_DEAD+=("$file|<default>")
                else
                    DEFAULT_DEAD+=("$file|$name (default)")
                fi
                has_dead_default=1
            fi
        fi
    done < <(extract_exports "$file")

    # Whole-file dead: had exports, all named exports dead, default (if any) dead.
    if (( has_export == 1 )); then
        # File has only default exports? has_dead_default tracks default deadness
        # File has named exports — all dead?
        if (( file_named_count > 0 && file_named_count == file_dead_named_count )); then
            # If there's also a default and it's not dead, file isn't fully dead.
            UNUSED_FILES+=("$file")
        elif (( file_named_count == 0 && has_dead_default == 1 )); then
            UNUSED_FILES+=("$file")
        fi
    fi

done

# BARREL_DEAD already populated in pass 1.

# ------- Render report -------
{
    printf '# Dead Code Report\n\n'
    printf 'Generated: %s  \n' "$(date -u +'%Y-%m-%d %H:%M:%S UTC')"
    printf 'Scanned: %d source files under %s\n\n' "$scanned" "$SRC_LABEL"

    printf '> Heuristic: an export is flagged when no other `.ts`/`.tsx` file under %s references its name (named export) or imports its module path (default export). Next.js convention files (`page`, `layout`, `route`, `middleware`, `loading`, `error`, `not-found`, etc.) are excluded as export sources but still scanned for usage.\n\n' "$SRC_LABEL"
    printf '> Possible false positives: dynamic imports with computed paths, symbols consumed only from outside %s (scripts, generated code), framework-magic registrations.\n\n' "$SRC_LABEL"

    # Group dead named exports by top-level category
    declare -A BUCKET=()
    if (( ${#NAMED_DEAD[@]} > 0 )); then
        for entry in "${NAMED_DEAD[@]}"; do
            [[ -z "$entry" ]] && continue
            f="${entry%%|*}"; sym="${entry#*|}"
            cat="$(category_of "$f")"
            rel="${f#$ROOT/}"
            BUCKET["$cat"]+="- \`$sym\` — [$rel]($rel)"$'\n'
        done
    fi

    if (( ${#BUCKET[@]} > 0 )); then
        printf '## Unused named exports\n\n'
        for cat in $(printf '%s\n' "${!BUCKET[@]}" | sort); do
            printf '### `%s%s/`\n\n' "$SRC_PREFIX" "$cat"
            printf '%s\n' "${BUCKET[$cat]}"
        done
    fi

    if (( ${#DEFAULT_DEAD[@]} > 0 )); then
        printf '## Unused default exports\n\n'
        for entry in "${DEFAULT_DEAD[@]}"; do
            f="${entry%%|*}"; sym="${entry#*|}"
            rel="${f#$ROOT/}"
            printf '%s\n' "- $sym — [$rel]($rel)"
        done
        printf '\n'
    fi

    if (( ${#UNUSED_FILES[@]} > 0 )); then
        printf '## Fully dead files (every export unused)\n\n'
        printf '%s\n' "${UNUSED_FILES[@]}" | sort -u | while read -r f; do
            rel="${f#$ROOT/}"
            printf '%s\n' "- [$rel]($rel)"
        done
        printf '\n'
    fi

    if (( ${#BARREL_DEAD[@]} > 0 )); then
        printf '## Barrel files with no consumers\n\n'
        printf 'These `index.ts(x)` modules are not imported anywhere — their re-exports are orphaned.\n\n'
        for f in "${BARREL_DEAD[@]}"; do
            rel="${f#$ROOT/}"
            printf '%s\n' "- [$rel]($rel)"
        done
        printf '\n'
    fi

    total=$(( ${#NAMED_DEAD[@]} + ${#DEFAULT_DEAD[@]} ))
    printf '%s\n\n**Total dead exports: %d** (across %d fully-dead files, %d orphan barrels).\n' \
        '---' "$total" "${#UNUSED_FILES[@]}" "${#BARREL_DEAD[@]}"
} > "$OUT"

printf 'Wrote %s\n' "$OUT"
