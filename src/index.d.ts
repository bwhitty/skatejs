// Type definitions for skatejs@5.0.0-beta.3
// Project: https://github.com/skatejs/skatejs
// TypeScript Version: 2.5

// UMD library
export as namespace skate

// Public API
export { prop, props, link, define, emit, withComponent, withProps, withRender, withUnique } from './ts-types/api'

// Public types ( Unfortunately TS doesn't has Opaque Types like Flow )
export { ComponentProps, PropOptions, Renderer, CustomElement } from './ts-types/types'
