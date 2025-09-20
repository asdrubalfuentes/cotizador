# GitHub API Commands for Branch Management

This document contains the specific GitHub API commands needed to complete the branch management task.

## Prerequisites
- GitHub CLI (`gh`) installed and authenticated
- Admin or push access to the repository
- Understanding that these operations are irreversible

## Current State Summary
- **main branch**: Only contains LICENSE file (1 file, 1 commit)
- **master branch**: Contains complete application (54 files, 14 commits)

## Required Operations

### Option A: Using GitHub CLI

```bash
# 1. Delete the main branch
gh api repos/asdrubalfuentes/cotizador/git/refs/heads/main -X DELETE

# 2. Rename master branch to main  
gh api repos/asdrubalfuentes/cotizador/branches/master/rename \
  -f new_name=main \
  -X POST

# 3. Set main as default branch (if not already)
gh api repos/asdrubalfuentes/cotizador \
  -f default_branch=main \
  -X PATCH
```

### Option B: Using GitHub Web Interface

1. **Delete main branch:**
   - Go to https://github.com/asdrubalfuentes/cotizador/branches
   - Find the `main` branch in the list
   - Click the trash/delete icon next to `main` branch
   - Confirm deletion

2. **Rename master to main:**
   - Go to repository Settings: https://github.com/asdrubalfuentes/cotizador/settings
   - Scroll to "Default branch" section  
   - Click "Switch to another branch"
   - Type `main` as the new branch name
   - GitHub will offer to rename `master` to `main` - accept this
   - Confirm the operation

### Option C: Using cURL with GitHub API

```bash
# Set your GitHub token
GITHUB_TOKEN="your_personal_access_token"
REPO="asdrubalfuentes/cotizador"

# 1. Delete main branch
curl -X DELETE \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO/git/refs/heads/main"

# 2. Rename master branch to main
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO/branches/master/rename" \
  -d '{"new_name":"main"}'

# 3. Set main as default branch
curl -X PATCH \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO" \
  -d '{"default_branch":"main"}'
```

## Verification Steps

After completing the operations, verify the changes:

```bash
# Check branches
gh api repos/asdrubalfuentes/cotizador/branches

# Check default branch  
gh api repos/asdrubalfuentes/cotizador | jq '.default_branch'

# Verify main branch has the application content
gh api repos/asdrubalfuentes/cotizador/contents

# Check commit count on main
gh api repos/asdrubalfuentes/cotizador/commits | jq 'length'
```

## Expected Results

After successful completion:
- ✅ `main` branch deleted (old one with only LICENSE)
- ✅ `master` branch renamed to `main` (with full application) 
- ✅ New `main` branch is set as default
- ✅ New `main` branch contains 54 files and 14 commits
- ✅ Repository preserves all application code and history

## Rollback Plan (if needed)

If something goes wrong, you can:

1. Rename the current `main` back to `master`
2. Recreate `main` branch from the original commit (8272cbd)
3. Reset default branch as needed

```bash
# Emergency rollback commands
gh api repos/asdrubalfuentes/cotizador/branches/main/rename -f new_name=master -X POST
gh api repos/asdrubalfuentes/cotizador/git/refs -f ref=refs/heads/main -f sha=8272cbd4c7d509fee07e8c08010713d275038cfa -X POST
```

## Safety Notes

⚠️ **IMPORTANT WARNINGS:**
- This operation is irreversible without the rollback plan
- Make sure you want the `master` branch content (full app) to become `main`
- The original `main` branch (LICENSE only) will be permanently deleted
- All links, bookmarks, and references to the old `main` branch will break
- CI/CD should continue working as the workflow supports both branch names