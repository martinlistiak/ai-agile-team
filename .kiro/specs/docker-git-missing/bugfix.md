# Bugfix Requirements Document

## Introduction

The backend Docker container fails to execute any git operations (clone, fetch, reset, checkout, config) because the `git` binary is not installed in the `oven/bun:latest` base image. This causes the `GithubService` to crash when attempting to clone or update repositories, blocking the Developer Agent workflow entirely.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the backend container attempts to clone a GitHub repository via `GithubService.getRepoPath()` THEN the system fails with `/bin/sh: 1: git: not found` and throws "Failed to clone GitHub repository"

1.2 WHEN the backend container attempts to fetch/reset an already-cloned repository via `GithubService.getRepoPath()` THEN the system fails with `git: not found` because the git binary is missing from the container

1.3 WHEN the backend container attempts to create a branch via `GithubService.createBranch()` THEN the system fails with `git: not found` because the git binary is missing from the container

### Expected Behavior (Correct)

2.1 WHEN the backend container attempts to clone a GitHub repository via `GithubService.getRepoPath()` THEN the system SHALL successfully execute `git clone` and return the local repo path

2.2 WHEN the backend container attempts to fetch/reset an already-cloned repository via `GithubService.getRepoPath()` THEN the system SHALL successfully execute `git fetch` and `git reset` to update the local copy

2.3 WHEN the backend container attempts to create a branch via `GithubService.createBranch()` THEN the system SHALL successfully execute `git checkout -b` and return the repo directory

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the backend container starts up THEN the system SHALL CONTINUE TO run the NestJS application on port 3001

3.2 WHEN the backend container installs dependencies via `bun install` THEN the system SHALL CONTINUE TO install all npm packages correctly

3.3 WHEN the backend container builds the application via `bun run build` THEN the system SHALL CONTINUE TO produce a valid production build

3.4 WHEN the `GithubService` creates pull requests via the GitHub API THEN the system SHALL CONTINUE TO make HTTP requests to GitHub without requiring the local git binary
