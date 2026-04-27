# Quick Git Commands Reference

## 🚀 Push Your Code to GitHub (Quick Version)

### First Time Setup
```bash
# 1. Initialize git (if not done)
git init

# 2. Add all files
git add .

# 3. Commit with message
git commit -m "Initial commit: Add time columns, pause button, optimize worker sync"

# 4. Add GitHub remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# 5. Push to GitHub
git branch -M main
git push -u origin main
```

### Regular Updates (After First Setup)
```bash
# 1. Check what changed
git status

# 2. Add all changes
git add .

# 3. Commit with descriptive message
git commit -m "Your change description"

# 4. Push to GitHub
git push
```

## 📋 What's Been Changed

### ✅ Completed
- [x] Added time column to Campaigns page
- [x] Added time column to Prospect Extractor page  
- [x] Added pause/resume button for campaigns
- [x] Changed worker sync from 15 min to 1 min
- [x] Updated .gitignore to exclude unnecessary files
- [x] Fixed duplicate formatTime function error

### 📁 Files Modified
```
src/pages/Campaigns.jsx          (time column + pause button)
src/pages/LeadExtractor.jsx      (time column)
backend/worker.py                (1 minute sync)
.gitignore                       (comprehensive exclusions)
```

### 📄 Files Created
```
GITHUB_PUSH_GUIDE.md            (detailed Git guide)
RECENT_CHANGES.md               (change summary)
QUICK_GIT_COMMANDS.md           (this file)
```

## 🔑 GitHub Personal Access Token

You'll need this instead of your password:

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it: "LinkedPilot Development"
4. Select scope: ✅ `repo` (full control)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)
7. Use this token as your password when pushing

## 🎯 Common Commands

### View Changes
```bash
git status              # See what files changed
git diff                # See exact changes
git log --oneline       # View commit history
```

### Undo Changes
```bash
git checkout -- file.js    # Discard changes to a file
git reset HEAD file.js     # Unstage a file
git reset --soft HEAD~1    # Undo last commit (keep changes)
```

### Branches
```bash
git branch                    # List branches
git checkout -b feature-name  # Create new branch
git checkout main             # Switch to main branch
git merge feature-name        # Merge branch into current
```

### Sync with GitHub
```bash
git pull origin main    # Get latest changes
git push origin main    # Push your changes
```

## ⚠️ Important Notes

1. **Never commit .env files** - Already excluded in .gitignore ✅
2. **Use meaningful commit messages** - Describe what and why
3. **Pull before push** - Avoid conflicts
4. **Test locally first** - Make sure everything works

## 🐛 Troubleshooting

### Error: "fatal: not a git repository"
```bash
git init
```

### Error: "failed to push some refs"
```bash
git pull origin main --rebase
git push
```

### Error: "Permission denied"
- Make sure you're using a Personal Access Token, not your password
- Check the token has `repo` scope

### Error: "Large files"
```bash
# For files > 100MB, use Git LFS
git lfs install
git lfs track "*.large-extension"
```

## 📊 Current Project Status

### Features Working
- ✅ Campaign management with pause/resume
- ✅ Time display on all tables
- ✅ Worker syncing every 1 minute
- ✅ Lead extraction and enrichment
- ✅ Message tracking and analytics

### Ready to Push
All changes are ready to be committed and pushed to GitHub!

## 🎨 Commit Message Examples

Good commit messages:
```bash
git commit -m "Add pause/resume button to campaigns"
git commit -m "Optimize worker sync interval to 1 minute"
git commit -m "Add time column to campaigns and extractor tables"
git commit -m "Update gitignore to exclude build artifacts"
```

Bad commit messages:
```bash
git commit -m "fix"
git commit -m "update"
git commit -m "changes"
git commit -m "asdf"
```

## 🔄 Typical Workflow

```bash
# Morning: Start work
git pull origin main

# During work: Make changes
# ... edit files ...

# Check what changed
git status
git diff

# Stage and commit
git add .
git commit -m "Descriptive message about changes"

# End of day: Push to GitHub
git push origin main
```

## 📞 Need More Help?

- **Detailed guide**: See `GITHUB_PUSH_GUIDE.md`
- **Recent changes**: See `RECENT_CHANGES.md`
- **GitHub docs**: https://docs.github.com/en/get-started

---

**Ready to push?** Run these commands:

```bash
git add .
git commit -m "Add time columns, pause/resume button, optimize worker sync to 1 min"
git push
```

If this is your first push, see `GITHUB_PUSH_GUIDE.md` for complete setup instructions.
