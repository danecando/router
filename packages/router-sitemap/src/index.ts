import type { RegisteredRouter, RoutePaths } from '@tanstack/router-core'

export interface SitemapRouteConfig {
  /**
   * The lastmod date for the URL
   */
  lastmod?: string | Date

  /**
   * The changefreq for the URL
   */
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'

  /**
   * The priority for the URL (0.0 to 1.0)
   */
  priority?: number

  /**
   * If false, this route will be excluded from the sitemap
   * @default true
   */
  include?: boolean

  /**
   * The path to the route
   */
  path?: string
}

export interface GenerateSitemapOptions<
  TRouter extends RegisteredRouter = RegisteredRouter,
> {
  /**
   * The base URL of the site (e.g., 'https://example.com')
   */
  baseUrl: string

  /**
   * Route specific configurations
   * Keys are route paths that will be inferred from the router
   */
  routes?: Partial<
    Record<
      RoutePaths<TRouter['routeTree']>,
      | SitemapRouteConfig
      | Array<SitemapRouteConfig>
      | (() =>
          | SitemapRouteConfig
          | Array<SitemapRouteConfig>
          | Promise<SitemapRouteConfig>
          | Promise<Array<SitemapRouteConfig>>)
    >
  >
}

/**
 * Generate a sitemap XML string from a router instance
 */
export async function generateSitemap<
  TRouter extends RegisteredRouter = RegisteredRouter,
>(options: GenerateSitemapOptions<TRouter>): Promise<string> {
  const { baseUrl, routes } = options

  // Implementation to be added
  return Promise.resolve('')
}
