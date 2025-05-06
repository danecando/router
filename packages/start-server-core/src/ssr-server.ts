import { default as warning } from 'tiny-warning'
import { createControlledPromise } from '@tanstack/router-core'
import { crossSerializeStream, getCrossReferenceHeader } from 'seroval'
import minifiedTsrBootStrapScript from './tsrScript?script-string'
import { serializeString } from './serializeString'
import type { DehydratedRouter, SsrMatch } from '@tanstack/start-client-core'
import type {
  AnyRouter,
  Manifest,
} from '@tanstack/router-core'

declare module '@tanstack/router-core' {
  interface ServerSsr {
    streamInternal: (path: Array<string>, value: unknown) => void
  }
}

export const GLOBAL_TSR = '$_TSR'
// TODO make seroval scopeId configurable, as this is not necessary for React, only for Solid so it does not clash with its SSR
const SCOPE_ID = 'tsr'

export function attachRouterServerSsrUtils(
  router: AnyRouter,
  manifest: Manifest | undefined,
) {
  router.ssr = {
    manifest,
  }
  const serializationRefs = new Map<unknown, number>()

  let initialScriptSent = false
  const getInitialScript = () => {
    if (initialScriptSent) {
      return ''
    }
    initialScriptSent = true
    return `${getCrossReferenceHeader(SCOPE_ID)};${minifiedTsrBootStrapScript}`
  }
  router.serverSsr = {
    injectedHtml: [],
    streamedKeys: new Set(),
    injectHtml: (getHtml) => {
      const promise = Promise.resolve().then(getHtml)
      router.serverSsr!.injectedHtml.push(promise)
      router.emit({
        type: 'onInjectedHtml',
        promise,
      })

      return promise.then(() => {})
    },
    injectScript: (getScript) => {
      return router.serverSsr!.injectHtml(async () => {
        const script = await getScript()
        return `<script class='tsr-once'>${getInitialScript()}${script};if (typeof $_TSR !== 'undefined') $_TSR.c()</script>`
      })
    },
    streamValue: (key, value) => {
      warning(
        !router.serverSsr!.streamedKeys.has(key),
        'Key has already been streamed: ' + key,
      )
      router.serverSsr!.streamedKeys.add(key)
      router.serverSsr!.streamInternal(['v', key], value)
    },
    streamInternal: (path: Array<string>, value: unknown) => {
      const p = createControlledPromise<string>()
      // TODO plugins
      crossSerializeStream(value, {
        refs: serializationRefs,
        onSerialize: (data, initial) => {
          let header = ''
          if (initial) {
            header = GLOBAL_TSR + path.map((x) => `["${serializeString(x)}"]`).join('') + '='
          }
          const serialized = initial ? header + data : data
          router.serverSsr!.injectScript(() => serialized)
        },
        scopeId: SCOPE_ID,
        onDone: () => p.resolve(''),
        onError: (err) => p.reject(err),
      })
      // make sure the stream is kept open until the promise is resolved
      router.serverSsr!.injectHtml(() => p)
    },
  }
}

export function dehydrateRouter(router: AnyRouter) {
  const matches: Array<SsrMatch> = router.state.matches
    .filter(
      (match) => match.error || match.__beforeLoadContext || match.loaderData,
    )
    .map((match) => ({
      i: match.id,
      b: match.__beforeLoadContext,
      l: match.loaderData,
      e: match.error,
      s: match.status,
      u: match.updatedAt,
    }))
  const dehydratedRouter: DehydratedRouter = {
    manifest: router.ssr!.manifest,
    matches,
  }
  if (router.options.dehydrate) {
    dehydratedRouter.dehydratedData = router.options.dehydrate()
  }
  router.serverSsr!.streamInternal(['r'], dehydratedRouter)
}
