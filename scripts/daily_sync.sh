#!/usr/bin/env bash
# ==============================================================================
# ESSR_PA - Automated Repository Safety Check & Daily Sync
# ==============================================================================
# Usage:
#   ./scripts/daily_sync.sh                  # Interactive/automatic backup
#   ./scripts/daily_sync.sh -m "custom msg"  # Custom commit message
#   ./scripts/daily_sync.sh --dry-run        # Safety checks only (no commit/push)
#   ./scripts/daily_sync.sh --skip-verify    # Skip tsc and python compile checks
# ==============================================================================

set -eo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

MAX_FILE_SIZE_BYTES=$((25 * 1024 * 1024)) # 25 MB

log_info() { echo -e "${CYAN}ℹ [SYNC]${NC} $*"; }
log_ok() { echo -e "${GREEN}✓ [OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠ [WARN]${NC} $*"; }
log_fail() { echo -e "${RED}✗ [FAIL]${NC} $*"; exit 1; }

DRY_RUN=false
SKIP_VERIFY=false
CUSTOM_MSG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      CUSTOM_MSG="$2"
      shift 2
      ;;
    -n|--dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-verify)
      SKIP_VERIFY=true
      shift
      ;;
    -h|--help)
      echo -e "${BOLD}ESSR_PA Daily Sync & Safety Check${NC}"
      echo "Automates repository pre-flight safety checks, type checks, commits, and pushes."
      echo ""
      echo "Options:"
      echo "  -m, --message <msg>   Specify a custom commit message"
      echo "  -n, --dry-run         Run all fail-safes and audits without modifying git"
      echo "      --skip-verify     Skip frontend 'tsc' and backend 'py_compile' gates"
      echo "  -h, --help            Show this help dialog"
      exit 0
      ;;
    *)
      log_fail "Unknown argument: $1 (run with --help for usage)"
      ;;
  esac
done

echo -e "\n${BOLD}${PURPLE}======================================================${NC}"
echo -e "${BOLD}${PURPLE}   ESSR_PA Repository Safety & Pre-Sync Verification  ${NC}"
echo -e "${BOLD}${PURPLE}======================================================${NC}\n"

# ------------------------------------------------------------------------------
# 1. Check Ongoing Git Operations (Merge, Rebase, Cherry-Pick)
# ------------------------------------------------------------------------------
log_info "Step 1/6: Checking for active merge/rebase/conflict operations..."
GIT_DIR="$(git rev-parse --git-dir)"

if [[ -f "$GIT_DIR/MERGE_HEAD" ]]; then
  log_fail "A merge is currently in progress. Resolve or abort the merge before syncing."
fi
if [[ -d "$GIT_DIR/rebase-merge" || -d "$GIT_DIR/rebase-apply" ]]; then
  log_fail "A git rebase is currently in progress. Complete or abort the rebase before syncing."
fi
if [[ -f "$GIT_DIR/CHERRY_PICK_HEAD" ]]; then
  log_fail "A cherry-pick is currently in progress. Complete or abort it before syncing."
fi
log_ok "No active merge, rebase, or cherry-pick found."

# ------------------------------------------------------------------------------
# 2. Fetch Upstream & Check Divergence
# ------------------------------------------------------------------------------
log_info "Step 2/6: Fetching latest remote references from origin..."
git fetch origin main 2>/dev/null || log_warn "Could not fetch from origin (offline or no network). Proceeding with local state."

COUNTS=$(git rev-list --left-right --count HEAD...origin/main 2>/dev/null || echo "0 0")
LOCAL_AHEAD=$(echo "$COUNTS" | awk '{print $1}')
REMOTE_AHEAD=$(echo "$COUNTS" | awk '{print $2}')

if [[ "$REMOTE_AHEAD" -gt 0 ]]; then
  log_fail "Remote 'origin/main' is ahead by $REMOTE_AHEAD commit(s). Pull or rebase before syncing to prevent divergence."
fi
log_ok "Upstream aligned: Local ahead by $LOCAL_AHEAD, Remote ahead by $REMOTE_AHEAD."

# ------------------------------------------------------------------------------
# 3. Check for Changes
# ------------------------------------------------------------------------------
log_info "Step 3/6: Checking working directory for uncommitted changes..."
PORCELAIN_STATUS=$(git status --porcelain)

if [[ -z "$PORCELAIN_STATUS" ]]; then
  if [[ "$LOCAL_AHEAD" -gt 0 ]]; then
    log_info "Working directory is clean, but local branch is ahead by $LOCAL_AHEAD commit(s)."
    if [[ "$DRY_RUN" == false ]]; then
      log_info "Pushing existing commits to origin/main..."
      git push origin main
      log_ok "Successfully pushed pending commits to origin/main."
    else
      log_ok "DRY-RUN: Would run 'git push origin main'."
    fi
    exit 0
  fi
  log_ok "Working tree is completely clean and up to date. Nothing to commit."
  exit 0
fi

# ------------------------------------------------------------------------------
# 4. Fail-Safes: Sensitive Files & Asset Bloat Audit
# ------------------------------------------------------------------------------
log_info "Step 4/6: Scanning uncommitted files for secrets and large blobs..."

SENSITIVE_PATTERNS='(\.env|\.env\..*|.*secret.*|.*token.*|\.key$|\.pem$|id_rsa.*)'
BLOCKED_FILES=()
LARGE_FILES=()

# Read changed files line-by-line
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  FILE_PATH="${line:3}" # Strip status flag (e.g. " M ", "?? ")
  # Unquote if quoted
  FILE_PATH=$(echo "$FILE_PATH" | sed -e 's/^"//' -e 's/"$//')

  # Check sensitive naming
  if echo "$FILE_PATH" | grep -iE "$SENSITIVE_PATTERNS" >/dev/null 2>&1; then
    BLOCKED_FILES+=("$FILE_PATH")
  fi

  # Check file size (only if file exists on disk)
  if [[ -f "$FILE_PATH" ]]; then
    FILE_SIZE=$(stat -c%s "$FILE_PATH" 2>/dev/null || stat -f%z "$FILE_PATH" 2>/dev/null || echo 0)
    if [[ "$FILE_SIZE" -gt "$MAX_FILE_SIZE_BYTES" ]]; then
      SIZE_MB=$((FILE_SIZE / 1024 / 1024))
      LARGE_FILES+=("$FILE_PATH (${SIZE_MB}MB)")
    fi
  fi
done <<< "$PORCELAIN_STATUS"

if [[ ${#BLOCKED_FILES[@]} -gt 0 ]]; then
  echo -e "\n${RED}SECURITY GATE TRIGGERED: Sensitive file patterns detected:${NC}"
  for f in "${BLOCKED_FILES[@]}"; do
    echo -e "  - ${RED}$f${NC}"
  done
  log_fail "Sync aborted to prevent accidental secret leak. Add them to .gitignore or remove them."
fi

if [[ ${#LARGE_FILES[@]} -gt 0 ]]; then
  echo -e "\n${RED}STORAGE GATE TRIGGERED: Large files exceeding 25MB detected:${NC}"
  for f in "${LARGE_FILES[@]}"; do
    echo -e "  - ${RED}$f${NC}"
  done
  log_fail "Sync aborted to avoid bloat in git history. Place heavy assets in .gitignore or storage."
fi
log_ok "Fail-safes passed: 0 sensitive files, 0 files > 25MB."

# ------------------------------------------------------------------------------
# 5. Targeted Code Verification (Fast Inner-Loop Gates, NO full npm run build)
# ------------------------------------------------------------------------------
if [[ "$SKIP_VERIFY" == true ]]; then
  log_warn "Skipping TypeScript and Python code verification (--skip-verify enabled)."
else
  log_info "Step 5/6: Running fast verification gates..."

  # 5a. Frontend TypeScript Check (No heavy build)
  if [[ -d "frontend" ]]; then
    echo -ne "  → Checking Frontend TypeScript health (npx tsc --noEmit)... "
    if (cd frontend && npx tsc --noEmit >/dev/null 2>&1); then
      echo -e "${GREEN}PASSED${NC}"
    else
      echo -e "${RED}FAILED${NC}"
      log_fail "Frontend TypeScript check failed. Fix type errors before syncing or pass --skip-verify."
    fi
  fi

  # 5b. Backend Python Syntax & Compile Check
  if [[ -d "backend" ]]; then
    echo -ne "  → Checking Backend Python compilation (py_compile)... "
    if (cd backend && python3 -m py_compile main.py engines/*.py >/dev/null 2>&1); then
      echo -e "${GREEN}PASSED${NC}"
    else
      echo -e "${RED}FAILED${NC}"
      log_fail "Backend Python syntax error detected. Fix errors before syncing or pass --skip-verify."
    fi
  fi
fi

# ------------------------------------------------------------------------------
# 6. Commit & Push
# ------------------------------------------------------------------------------
log_info "Step 6/6: Preparing commit message and syncing..."

# Determine commit message
if [[ -n "$CUSTOM_MSG" ]]; then
  COMMIT_MSG="$CUSTOM_MSG"
else
  # Try to extract the latest Task headline from CHANGELOG.md [Unreleased]
  EXTRACTED_TITLE=$(grep -E '^- \*\*' CHANGELOG.md 2>/dev/null | head -n 1 | sed -E 's/^- \*\*([^(:]+).*/\1/' | xargs || true)
  if [[ -n "$EXTRACTED_TITLE" ]]; then
    COMMIT_MSG="chore(sync): $EXTRACTED_TITLE"
  else
    COMMIT_MSG="chore(sync): daily backup $(date +%Y-%m-%d)"
  fi
fi

echo -e "\n${BOLD}Files to be committed:${NC}"
git status -s

echo -e "\n${BOLD}Commit message:${NC} ${GREEN}$COMMIT_MSG${NC}\n"

if [[ "$DRY_RUN" == true ]]; then
  log_ok "DRY-RUN completed. No changes were staged, committed, or pushed."
  exit 0
fi

# Stage all files
git add -A

# Commit
git commit -m "$COMMIT_MSG"
log_ok "Local commit created successfully."

# Push
log_info "Pushing to origin/main..."
git push origin main
log_ok "Push to origin/main complete!"

echo -e "\n${BOLD}${GREEN}======================================================${NC}"
echo -e "${BOLD}${GREEN}   Daily Sync Completed Successfully!               ${NC}"
echo -e "${BOLD}${GREEN}======================================================${NC}\n"
