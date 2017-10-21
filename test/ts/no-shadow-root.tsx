import { withComponent, define, Renderer } from 'skatejs'

const withCustomRendererAsString = () =>
  class<P> extends HTMLElement implements Renderer<P, string> {
    rendererCallback(shadowRoot: HTMLElement, renderCallback: () => string): void {
      // erease content && re-render
      shadowRoot.innerHTML = renderCallback()
    }
  }
export const Component = withComponent(withCustomRendererAsString())

export class Shadowless<P = object> extends Component<P> {
  get renderRoot() {
    return this
  }
}
export class MyComponent extends Component {
  static readonly is = 'my-cmp'
  get renderRoot() {
    return this
  }
  renderCallback() {
    return `
      <div>
        <h1>Hello World</h1>
      </div>
    `
  }
}
define(MyComponent)

export class NoShadowCmp extends Shadowless {
  static readonly is = 'my-noshadow-cmp'
  renderCallback() {
    return `
      <div>
        <h1>Hello World</h1>
      </div>
    `
  }
}
define(NoShadowCmp)
