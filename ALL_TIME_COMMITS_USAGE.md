# All-Time Commits Parameter

## New Query Parameter: `include_all_time_commits`

I've added a new optional query parameter `include_all_time_commits` that allows you to fetch commits from multiple years (2015-2025) using the GraphQL API, which includes private repository commits.

## Usage Options

### Option 1: Current Year Only (Default - Fastest)
```
https://github-readme-stats-johnraivenolazo.vercel.app/api?username=johnraivenolazo&count_private=true&title_color=00ff6a&text_color=00ff6a&icon_color=00ff6a&bg_color=000000&border_color=00ff6a&border_radius=8&hide=contribs
```
- Shows commits from current year only
- Includes private repositories
- Fastest API response

### Option 2: All-Time Commits (GraphQL - Includes Private Repos)
```
https://github-readme-stats-johnraivenolazo.vercel.app/api?username=johnraivenolazo&include_all_time_commits=true&count_private=true&title_color=00ff6a&text_color=00ff6a&icon_color=00ff6a&bg_color=000000&border_color=00ff6a&border_radius=8&hide=contribs
```
- Shows commits from 2008-2025 (ALL years since GitHub started)
- **Includes private repositories**
- Slower but most comprehensive
- Better than `include_all_commits=true` for private repos

### Option 3: All-Time Commits (Search API - Public Only)
```
https://github-readme-stats-johnraivenolazo.vercel.app/api?username=johnraivenolazo&include_all_commits=true&count_private=true&title_color=00ff6a&text_color=00ff6a&icon_color=00ff6a&bg_color=000000&border_color=00ff6a&border_radius=8&hide=contribs
```
- Uses GitHub Search API
- **Does NOT include private repositories** (API limitation)
- May show higher numbers for public commits

## Recommendation

Use **Option 2** with `include_all_time_commits=true` for the most accurate all-time commit count that includes your private repositories.

## Technical Details

The `include_all_time_commits=true` parameter:
- Queries GitHub's GraphQL API for contribution data from 2008-2025 (all years since GitHub started)
- Includes commits from private repositories (requires proper token permissions)
- Sums up commits from all years to give a TRUE all-time total
- Uses conditional GraphQL fields (`@include(if: $includeAllTimeCommits)`) to only fetch when needed
- Falls back gracefully if any year's data is missing

## Performance Impact

- **Without parameter**: 1 GraphQL query (current year only)
- **With `include_all_time_commits=true`**: 1 GraphQL query (with 18 additional year fields)
- **With `include_all_commits=true`**: 1 GraphQL query + 1 REST API call (Search API)

The new parameter is more efficient than the old `include_all_commits` method while providing better private repository support.
