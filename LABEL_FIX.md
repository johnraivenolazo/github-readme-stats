# Fix Applied: Remove "(2025)" from All-Time Commits Label

## What Was Fixed

The GitHub Stats card was showing "Total Commits (2025): 3k" even when using `include_all_time_commits=true`, which didn't make sense since it's showing ALL-TIME commits, not just 2025 commits.

## Changes Made

1. **API Layer (`api/index.js`)**: Added `include_all_time_commits` parameter to the options passed to `renderStatsCard`

2. **Stats Card (`src/cards/stats-card.js`)**: 
   - Added `include_all_time_commits` parameter
   - Updated commit label logic to check both `include_all_commits` OR `include_all_time_commits`
   - Updated accessibility label logic as well

3. **Type Definitions (`src/cards/types.d.ts`)**: Added `include_all_time_commits: boolean` to `StatCardOptions`

## Result

Now when you use `include_all_time_commits=true`, the card will show:
- ✅ **"Total Commits: 3k"** (without year)
- ❌ ~~"Total Commits (2025): 3k"~~ (old behavior)

## Usage

```
https://github-readme-stats-johnraivenolazo.vercel.app/api?username=johnraivenolazo&include_all_time_commits=true&count_private=true&title_color=00ff6a&text_color=00ff6a&icon_color=00ff6a&bg_color=000000&border_color=00ff6a&border_radius=8&hide=contribs
```

The label will now correctly show "Total Commits" without any year suffix since it represents all-time commits from 2008-2025.
