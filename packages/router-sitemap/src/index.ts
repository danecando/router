import { SitemapStream, streamToPromise } from 'sitemap'

import type { RegisteredRouter, RoutePaths } from '@tanstack/router-core'

/** Splits a path on `/` segments to detect if any segment is `$something`. */
type SplitPath<TSegment extends string> =
  TSegment extends `${infer Segment}/${infer Rest}`
    ? Segment | SplitPath<Rest>
    : TSegment

/** If any segment starts with `$`, treat it as a param name. */
type ExtractParams<TSegment extends string> = {
  [K in SplitPath<TSegment> as K extends `$${infer Param}`
    ? Param
    : never]: string
}

/** Check if a route string has any `$` segments. */
type RouteIsDynamic<TRoute extends string> =
  keyof ExtractParams<TRoute> extends never ? false : true

/** Optional fields that any sitemap entry can have. */
export type CommonSitemapFields = {
  lastModified?: string | Date
  changeFrequency?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never'
  priority?: number
}

/**
 * A "static" route has no $params => it's either a single object
 * or a function returning that object (sync or async). The function
 * receives the route string (e.g. "/home").
 */
type StaticRouteEntry = CommonSitemapFields
export type StaticRouteValue =
  | StaticRouteEntry
  | (() => StaticRouteEntry | Promise<StaticRouteEntry>)

/**
 * A "dynamic" route has $params => it's either an array of objects
 * (each with a `path` field) or a function returning that array. The
 * function receives the route string (e.g. "/posts/$postId").
 */
export type DynamicRouteEntry = CommonSitemapFields & { path: string }
export type DynamicRouteValue =
  | Array<DynamicRouteEntry>
  | (() => Array<DynamicRouteEntry> | Promise<Array<DynamicRouteEntry>>)

/**
 * Pick which shape to use based on whether `TRoute` is dynamic or static.
 */
type RouteValue<TRoute extends string> =
  RouteIsDynamic<TRoute> extends true ? DynamicRouteValue : StaticRouteValue

/**
 * Generic sitemap definition. The user passes in their
 * union of route strings as `T`. For each route in `T`,
 * the value is optional (meaning you can skip it).
 */
export type Sitemap<TRouter extends RegisteredRouter = RegisteredRouter> = {
  /** The base URL of your site */
  siteUrl: string
  defaultChangeFreq?: CommonSitemapFields['changeFrequency']
  defaultPriority?: CommonSitemapFields['priority']
  /** An object with keys = route strings, values = route config. */
  routes: {
    [TRoute in RoutePaths<TRouter['routeTree']>]?: RouteValue<TRoute>
  }
}

/**
 * Internal type for final sitemap entries
 */
type FinalSitemapEntry = {
  url: string
  lastmod?: string
  changefreq?: CommonSitemapFields['changeFrequency']
  priority?: number
}

/**
 * Generate a sitemap XML string from a router instance
 */
export async function generateSitemap<
  TRouter extends RegisteredRouter = RegisteredRouter,
>(sitemap: Sitemap<TRouter>): Promise<string> {
  const finalEntries: Array<FinalSitemapEntry> = []

  const {
    siteUrl,
    routes,
    defaultPriority = 0.5,
    defaultChangeFreq = 'weekly',
  } = sitemap

  const createEntry = (path: string, entry: CommonSitemapFields) => {
    return {
      url: `${siteUrl}${path}`,
      lastmod:
        entry.lastModified instanceof Date
          ? entry.lastModified.toISOString()
          : entry.lastModified,
      changefreq: entry.changeFrequency || defaultChangeFreq,
      priority: entry.priority || defaultPriority,
    }
  }

  for (const route in routes) {
    const routeValue = routes[route as keyof typeof routes]

    if (typeof routeValue === 'function') {
      const resolvedValue = await routeValue()
      if (Array.isArray(resolvedValue)) {
        finalEntries.push(
          ...resolvedValue.map((entry) => createEntry(entry.path, entry)),
        )
      } else {
        finalEntries.push(createEntry(route, resolvedValue))
      }
    } else if (Array.isArray(routeValue)) {
      finalEntries.push(
        ...routeValue.map((entry) => createEntry(entry.path, entry)),
      )
    } else if (routeValue) {
      finalEntries.push(createEntry(route, routeValue))
    }
  }

  // Create sitemap stream
  const sitemapStream = new SitemapStream({ hostname: siteUrl })

  try {
    // Write all links to the sitemap stream
    finalEntries.forEach((entry) => {
      sitemapStream.write(entry)
    })

    // End the stream and convert to string
    sitemapStream.end()

    const xmlBuffer = await streamToPromise(sitemapStream)
    return xmlBuffer.toString()
  } catch (error) {
    throw new Error(`Error generating sitemap: ${error}`)
  }
}
