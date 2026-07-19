import { Repository, RepositoryType } from '@/lib/types';
import { FdroidRepository } from './FdroidRepository';
import { IzzyRepository } from './IzzyRepository';
import { GitHubRepository, GitHubRepoConfig } from './GitHubRepository';
import { RepositoryAdapter } from './Repository';

export type { GitHubRepoConfig };

export function createAdapter(repository: Repository, githubConfig?: GitHubRepoConfig): RepositoryAdapter {
  switch (repository.type) {
    case 'fdroid':
      return new FdroidRepository(repository);
    case 'izzy':
      return new IzzyRepository(repository);
    case 'github':
      if (!githubConfig) {
        throw new Error(`GitHub repository ${repository.id} requires a githubConfig`);
      }
      return new GitHubRepository(repository, githubConfig);
    default:
      throw new Error(`Unsupported repository type: ${repository.type}`);
  }
}

export function defaultRepositories(): Repository[] {
  return [
    {
      id: 'fdroid-official',
      name: 'F-Droid Official',
      type: 'fdroid',
      url: 'https://f-droid.org/repo/index-v1.json',
      enabled: false,
      priority: 10,
    },
    {
      id: 'izzyondroid',
      name: 'IzzyOnDroid',
      type: 'izzy',
      url: 'https://apt.izzysoft.de/fdroid/repo/index-v1.json',
      enabled: true,
      priority: 20,
    },
  ];
}

export const WELL_KNOWN_GITHUB_REPOS: Record<string, GitHubRepoConfig> = {};

export function addWellKnownGitHubRepo(typeKey: string): Repository | null {
  return null;
}
