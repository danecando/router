import invariant from 'tiny-invariant'

import type {
  AnyRouter,
  MakeRouteMatch,
  Manifest,
  RouteContextOptions,
} from '@tanstack/router-core'

declare global {
  interface Window {
    $_TSR?: StartSsrGlobal
  }
}

export interface StartSsrGlobal {
  r?: DehydratedRouter
  c: () => void
  v: Record<string, unknown>
}

export interface SsrMatch {
  i: MakeRouteMatch['id']
  b?: MakeRouteMatch['__beforeLoadContext']
  l?: MakeRouteMatch['loaderData']
  e?: MakeRouteMatch['error']
  u: MakeRouteMatch['updatedAt']
  s: MakeRouteMatch['status']
}
export interface DehydratedRouter {
  manifest: Manifest | undefined
  dehydratedData?: any
  matches: Array<SsrMatch>
}

export function hydrate(router: AnyRouter) {
  invariant(
    window.$_TSR?.r,
    'Expected to find dehydrated data on window.$_TSR.r, but we did not. Please file an issue!',
  )

  const { manifest, dehydratedData } = window.$_TSR.r

  router.ssr = {
    manifest,
  }

  router.clientSsr = {
    getStreamedValue: <T,>(key: string): T | undefined => {
      if (router.isServer) {
        return undefined
      }
      return window.$_TSR?.v[key] as T | undefined
    },
  }

  // Hydrate the router state
  const matches = router.matchRoutes(router.state.location)
  // kick off loading the route chunks
  const routeChunkPromise = Promise.all(
    matches.map((match) => {
      const route = router.looseRoutesById[match.routeId]!
      return router.loadRouteChunk(route)
    }),
  )
  // Right after hydration and before the first render, we need to rehydrate each match
  matches.forEach((match) => {
    const dehydratedMatch = window.$_TSR!.r!.matches.find(
      (d) => d.i === match.id,
    )

    if (dehydratedMatch) {
      match.status = dehydratedMatch.s
      match.updatedAt = dehydratedMatch.u
      match.__beforeLoadContext = dehydratedMatch.b
      match.loaderData = dehydratedMatch.l
      match.error = dehydratedMatch.e
    } else {
      match.status = 'success'
      match.updatedAt = Date.now()
    }

    return match
  })

  router.__store.setState((s) => {
    return {
      ...s,
      matches,
    }
  })

  // Allow the user to handle custom hydration data
  router.options.hydrate?.(dehydratedData)

  // now that all necessary data is hydrated:
  // 1) fully reconstruct the route context
  // 2) execute `head()` and `scripts()` for each match
  router.state.matches.forEach((match) => {
    const route = router.looseRoutesById[match.routeId]!

    const parentMatch = router.state.matches[match.index - 1]
    const parentContext = parentMatch?.context ?? router.options.context ?? {}

    // `context()` was already executed by `matchRoutes`, however route context was not yet fully reconstructed
    // so run it again and merge route context
    const contextFnContext: RouteContextOptions<any, any, any, any> = {
      deps: match.loaderDeps,
      params: match.params,
      context: parentContext,
      location: router.state.location,
      navigate: (opts: any) =>
        router.navigate({ ...opts, _fromLocation: router.state.location }),
      buildLocation: router.buildLocation,
      cause: match.cause,
      abortController: match.abortController,
      preload: false,
      matches,
    }
    match.__routeContext = route.options.context?.(contextFnContext) ?? {}

    match.context = {
      ...parentContext,
      ...match.__routeContext,
      ...match.__beforeLoadContext,
    }

    const assetContext = {
      matches: router.state.matches,
      match,
      params: match.params,
      loaderData: match.loaderData,
    }
    const headFnContent = route.options.head?.(assetContext)

    const scripts = route.options.scripts?.(assetContext)

    match.meta = headFnContent?.meta
    match.links = headFnContent?.links
    match.headScripts = headFnContent?.scripts
    match.scripts = scripts
  })

  return routeChunkPromise
}
