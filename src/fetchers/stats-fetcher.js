// @ts-check
import axios from "axios";
import * as dotenv from "dotenv";
import githubUsernameRegex from "github-username-regex";
import { calculateRank } from "../calculateRank.js";
import { retryer } from "../common/retryer.js";
import {
  CustomError,
  logger,
  MissingParamError,
  request,
  wrapTextMultiline,
} from "../common/utils.js";

dotenv.config();

// GraphQL queries.
const GRAPHQL_REPOS_FIELD = `
  repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}, after: $after) {
    totalCount
    nodes {
      name
      stargazers {
        totalCount
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
`;

const GRAPHQL_REPOS_QUERY = `
  query userInfo($login: String!, $after: String) {
    user(login: $login) {
      ${GRAPHQL_REPOS_FIELD}
    }
  }
`;

const GRAPHQL_STATS_QUERY = `
  query userInfo($login: String!, $after: String, $includeMergedPullRequests: Boolean!, $includeDiscussions: Boolean!, $includeDiscussionsAnswers: Boolean!, $includeAllTimeCommits: Boolean!) {
    user(login: $login) {
      name
      login
      contributionsCollection {
        totalCommitContributions,
        totalPullRequestReviewContributions
      }
      contributionsCollection2025: contributionsCollection(from: "2025-01-01T00:00:00Z", to: "2025-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2024: contributionsCollection(from: "2024-01-01T00:00:00Z", to: "2024-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2023: contributionsCollection(from: "2023-01-01T00:00:00Z", to: "2023-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2022: contributionsCollection(from: "2022-01-01T00:00:00Z", to: "2022-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2021: contributionsCollection(from: "2021-01-01T00:00:00Z", to: "2021-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2020: contributionsCollection(from: "2020-01-01T00:00:00Z", to: "2020-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2019: contributionsCollection(from: "2019-01-01T00:00:00Z", to: "2019-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2018: contributionsCollection(from: "2018-01-01T00:00:00Z", to: "2018-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2017: contributionsCollection(from: "2017-01-01T00:00:00Z", to: "2017-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2016: contributionsCollection(from: "2016-01-01T00:00:00Z", to: "2016-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2015: contributionsCollection(from: "2015-01-01T00:00:00Z", to: "2015-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2014: contributionsCollection(from: "2014-01-01T00:00:00Z", to: "2014-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2013: contributionsCollection(from: "2013-01-01T00:00:00Z", to: "2013-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2012: contributionsCollection(from: "2012-01-01T00:00:00Z", to: "2012-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2011: contributionsCollection(from: "2011-01-01T00:00:00Z", to: "2011-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2010: contributionsCollection(from: "2010-01-01T00:00:00Z", to: "2010-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2009: contributionsCollection(from: "2009-01-01T00:00:00Z", to: "2009-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      contributionsCollection2008: contributionsCollection(from: "2008-01-01T00:00:00Z", to: "2008-12-31T23:59:59Z") @include(if: $includeAllTimeCommits) {
        totalCommitContributions
      }
      repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
        totalCount
      }
      pullRequests(first: 1) {
        totalCount
      }
      mergedPullRequests: pullRequests(states: MERGED) @include(if: $includeMergedPullRequests) {
        totalCount
      }
      openIssues: issues(states: OPEN) {
        totalCount
      }
      closedIssues: issues(states: CLOSED) {
        totalCount
      }
      followers {
        totalCount
      }
      repositoryDiscussions @include(if: $includeDiscussions) {
        totalCount
      }
      repositoryDiscussionComments(onlyAnswers: true) @include(if: $includeDiscussionsAnswers) {
        totalCount
      }
      ${GRAPHQL_REPOS_FIELD}
    }
  }
`;

/**
 * @typedef {import('axios').AxiosResponse} AxiosResponse Axios response.
 */

/**
 * Stats fetcher object.
 *
 * @param {object} variables Fetcher variables.
 * @param {string} token GitHub token.
 * @returns {Promise<AxiosResponse>} Axios response.
 */
const fetcher = (variables, token) => {
  const query = variables.after ? GRAPHQL_REPOS_QUERY : GRAPHQL_STATS_QUERY;
  return request(
    {
      query,
      variables,
    },
    {
      Authorization: `bearer ${token}`,
    },
  );
};

/**
 * Fetch stats information for a given username.
 *
 * @param {object} variables Fetcher variables.
 * @param {string} variables.username Github username.
 * @param {boolean} variables.includeMergedPullRequests Include merged pull requests.
 * @param {boolean} variables.includeDiscussions Include discussions.
 * @param {boolean} variables.includeDiscussionsAnswers Include discussions answers.
 * @param {boolean} variables.includeAllTimeCommits Include all-time commits from multiple years.
 * @returns {Promise<AxiosResponse>} Axios response.
 *
 * @description This function supports multi-page fetching if the 'FETCH_MULTI_PAGE_STARS' environment variable is set to true.
 */
const statsFetcher = async ({
  username,
  includeMergedPullRequests,
  includeDiscussions,
  includeDiscussionsAnswers,
  includeAllTimeCommits,
}) => {
  let stats;
  let hasNextPage = true;
  let endCursor = null;
  while (hasNextPage) {
    const variables = {
      login: username,
      first: 100,
      after: endCursor,
      includeMergedPullRequests,
      includeDiscussions,
      includeDiscussionsAnswers,
      includeAllTimeCommits,
    };
    let res = await retryer(fetcher, variables);
    if (res.data.errors) {
      return res;
    }

    // Store stats data.
    const repoNodes = res.data.data.user.repositories.nodes;
    if (stats) {
      stats.data.data.user.repositories.nodes.push(...repoNodes);
    } else {
      stats = res;
    }

    // Disable multi page fetching on public Vercel instance due to rate limits.
    const repoNodesWithStars = repoNodes.filter(
      (node) => node.stargazers.totalCount !== 0,
    );
    hasNextPage =
      process.env.FETCH_MULTI_PAGE_STARS === "true" &&
      repoNodes.length === repoNodesWithStars.length &&
      res.data.data.user.repositories.pageInfo.hasNextPage;
    endCursor = res.data.data.user.repositories.pageInfo.endCursor;
  }

  return stats;
};

/**
 * Fetch all the commits for all the repositories of a given username.
 *
 * @param {string} username GitHub username.
 * @returns {Promise<number>} Total commits.
 *
 * @description Done like this because the GitHub API does not provide a way to fetch all the commits. See
 * #92#issuecomment-661026467 and #211 for more information.
 */
const totalCommitsFetcher = async (username) => {
  if (!githubUsernameRegex.test(username)) {
    logger.log("Invalid username provided.");
    throw new Error("Invalid username provided.");
  }

  // https://developer.github.com/v3/search/#search-commits
  const fetchTotalCommits = (variables, token) => {
    return axios({
      method: "get",
      url: `https://api.github.com/search/commits?q=author:${variables.login}`,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.github.cloak-preview",
        Authorization: `token ${token}`,
      },
    });
  };

  let res;
  try {
    res = await retryer(fetchTotalCommits, { login: username });
  } catch (err) {
    logger.log(err);
    throw new Error(err);
  }

  const totalCount = res.data.total_count;
  if (!totalCount || isNaN(totalCount)) {
    throw new CustomError(
      "Could not fetch total commits.",
      CustomError.GITHUB_REST_API_ERROR,
    );
  }
  return totalCount;
};

/**
 * @typedef {import("./types").StatsData} StatsData Stats data.
 */

/**
 * Fetch stats for a given username.
 *
 * @param {string} username GitHub username.
 * @param {boolean} include_all_commits Include all commits.
 * @param {string[]} exclude_repo Repositories to exclude.
 * @param {boolean} include_merged_pull_requests Include merged pull requests.
 * @param {boolean} include_discussions Include discussions.
 * @param {boolean} include_discussions_answers Include discussions answers.
 * @param {boolean} include_all_time_commits Include all-time commits from multiple years using GraphQL.
 * @returns {Promise<StatsData>} Stats data.
 */
const fetchStats = async (
  username,
  include_all_commits = false,
  exclude_repo = [],
  include_merged_pull_requests = false,
  include_discussions = false,
  include_discussions_answers = false,
  include_all_time_commits = false,
) => {
  if (!username) {
    throw new MissingParamError(["username"]);
  }

  const stats = {
    name: "",
    totalPRs: 0,
    totalPRsMerged: 0,
    mergedPRsPercentage: 0,
    totalReviews: 0,
    totalCommits: 0,
    totalIssues: 0,
    totalStars: 0,
    totalDiscussionsStarted: 0,
    totalDiscussionsAnswered: 0,
    contributedTo: 0,
    rank: { level: "C", percentile: 100 },
  };

  let res = await statsFetcher({
    username,
    includeMergedPullRequests: include_merged_pull_requests,
    includeDiscussions: include_discussions,
    includeDiscussionsAnswers: include_discussions_answers,
    includeAllTimeCommits: include_all_time_commits,
  });

  // Catch GraphQL errors.
  if (res.data.errors) {
    logger.error(res.data.errors);
    if (res.data.errors[0].type === "NOT_FOUND") {
      throw new CustomError(
        res.data.errors[0].message || "Could not fetch user.",
        CustomError.USER_NOT_FOUND,
      );
    }
    if (res.data.errors[0].message) {
      throw new CustomError(
        wrapTextMultiline(res.data.errors[0].message, 90, 1)[0],
        res.statusText,
      );
    }
    throw new CustomError(
      "Something went wrong while trying to retrieve the stats data using the GraphQL API.",
      CustomError.GRAPHQL_ERROR,
    );
  }

  const user = res.data.data.user;

  stats.name = user.name || user.login;

  // if include_all_commits, fetch all commits using the REST API.
  if (include_all_commits) {
    stats.totalCommits = await totalCommitsFetcher(username);
  } else if (include_all_time_commits) {
    // Sum up commits from ALL years since GitHub started (2008-2025)
    const currentYear =
      user.contributionsCollection.totalCommitContributions || 0;
    const year2025 =
      user.contributionsCollection2025?.totalCommitContributions || 0;
    const year2024 =
      user.contributionsCollection2024?.totalCommitContributions || 0;
    const year2023 =
      user.contributionsCollection2023?.totalCommitContributions || 0;
    const year2022 =
      user.contributionsCollection2022?.totalCommitContributions || 0;
    const year2021 =
      user.contributionsCollection2021?.totalCommitContributions || 0;
    const year2020 =
      user.contributionsCollection2020?.totalCommitContributions || 0;
    const year2019 =
      user.contributionsCollection2019?.totalCommitContributions || 0;
    const year2018 =
      user.contributionsCollection2018?.totalCommitContributions || 0;
    const year2017 =
      user.contributionsCollection2017?.totalCommitContributions || 0;
    const year2016 =
      user.contributionsCollection2016?.totalCommitContributions || 0;
    const year2015 =
      user.contributionsCollection2015?.totalCommitContributions || 0;
    const year2014 =
      user.contributionsCollection2014?.totalCommitContributions || 0;
    const year2013 =
      user.contributionsCollection2013?.totalCommitContributions || 0;
    const year2012 =
      user.contributionsCollection2012?.totalCommitContributions || 0;
    const year2011 =
      user.contributionsCollection2011?.totalCommitContributions || 0;
    const year2010 =
      user.contributionsCollection2010?.totalCommitContributions || 0;
    const year2009 =
      user.contributionsCollection2009?.totalCommitContributions || 0;
    const year2008 =
      user.contributionsCollection2008?.totalCommitContributions || 0;

    stats.totalCommits =
      currentYear +
      year2025 +
      year2024 +
      year2023 +
      year2022 +
      year2021 +
      year2020 +
      year2019 +
      year2018 +
      year2017 +
      year2016 +
      year2015 +
      year2014 +
      year2013 +
      year2012 +
      year2011 +
      year2010 +
      year2009 +
      year2008;
  } else {
    // Use only current year contributions (default behavior)
    stats.totalCommits = user.contributionsCollection.totalCommitContributions;
  }

  stats.totalPRs = user.pullRequests.totalCount;
  if (include_merged_pull_requests) {
    stats.totalPRsMerged = user.mergedPullRequests.totalCount;
    stats.mergedPRsPercentage =
      (user.mergedPullRequests.totalCount / user.pullRequests.totalCount) * 100;
  }
  stats.totalReviews =
    user.contributionsCollection.totalPullRequestReviewContributions;
  stats.totalIssues = user.openIssues.totalCount + user.closedIssues.totalCount;
  if (include_discussions) {
    stats.totalDiscussionsStarted = user.repositoryDiscussions.totalCount;
  }
  if (include_discussions_answers) {
    stats.totalDiscussionsAnswered =
      user.repositoryDiscussionComments.totalCount;
  }
  stats.contributedTo = user.repositoriesContributedTo.totalCount;

  // Retrieve stars while filtering out repositories to be hidden.
  let repoToHide = new Set(exclude_repo);

  stats.totalStars = user.repositories.nodes
    .filter((data) => {
      return !repoToHide.has(data.name);
    })
    .reduce((prev, curr) => {
      return prev + curr.stargazers.totalCount;
    }, 0);

  stats.rank = calculateRank({
    all_commits: include_all_commits,
    commits: stats.totalCommits,
    prs: stats.totalPRs,
    reviews: stats.totalReviews,
    issues: stats.totalIssues,
    repos: user.repositories.totalCount,
    stars: stats.totalStars,
    followers: user.followers.totalCount,
  });

  return stats;
};

export { fetchStats };
export default fetchStats;
