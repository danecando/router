import type { StartSsrGlobal } from '@tanstack/start-client-core'

window.$_TSR = {
  c: () => {
    document.querySelectorAll('.tsr-once').forEach((el) => {
      el.remove()
    })
  },
  v: {},
} satisfies StartSsrGlobal
