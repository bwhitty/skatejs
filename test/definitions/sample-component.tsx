import { h, FunctionalComponent as SFC, ComponentProps as PreactComponentProps } from 'preact'
import { props, withComponent, ComponentProps } from 'skatejs'

const Component = withComponent()

export type NumLiteral = 123 | 124 | 125
export type StrLiteral = 'one' | 'two' | 'three'
export type SkateType = { trucks: string; deck: string }
export interface CountUpProps {
  count?: number
  num?: number
  numLiteral?: NumLiteral
  str?: string
  strLiteral?: StrLiteral
  bool?: boolean
  arr?: string[]
  obj?: SkateType
}

export class CountUpComponent extends Component<CountUpProps> {
  static get is() {
    return 'x-countup'
  }
  static get props(): ComponentProps<CountUpComponent, CountUpProps> {
    return {
      count: {
        ...props.number,
        ...{
          attribute: true,
          default(elem: HTMLElement, data: Object) {
            return 7
          },
        },
      },
      num: props.number,
      numLiteral: props.number,
      str: props.string,
      strLiteral: props.string,
      bool: props.boolean,
      arr: props.array,
      obj: props.object,
    }
  }

  count: number

  click() {
    this.count += 1
  }

  renderCallback() {
    return (
      <div>
        <CounterOutput count={this.count} />
        <Button onClick={e => this.click()}>Count up</Button>
      </div>
    )
  }
}
customElements.define(CountUpComponent.is, CountUpComponent)

type SkateParkProps = { year: number; halfPipe: boolean }
class SkatePark extends Component<SkateParkProps> {
  static get is() {
    return 'my-skate-park'
  }
  static get props(): skate.ComponentProps<SkatePark, SkateParkProps> {
    return {
      year: props.number,
      halfPipe: props.boolean,
    }
  }
  renderCallback({ halfPipe, year }: SkateParkProps) {
    const halfPipeInfo = <span>{halfPipe ? 'has' : 'doesnt have'}</span>
    return (
      <div>
        <p>
          Skate park exists since {year} and it {halfPipe} Half-Pipe
        </p>
      </div>
    )
  }
}
customElements.define(SkatePark.is, SkatePark)

customElements.define(
  'x-app',
  class extends Component {
    renderCallback() {
      return (
        <div>
          <h1>app</h1>
          {h('x-countup', { count: 100, obj: { trucks: 'Independent', deck: 'ZERO' } })}
        </div>
      )
    }
  }
)

export type ElmProps = { str: string; arr: any[] }
class Elem extends Component<ElmProps> {
  static get props(): ComponentProps<Elem, ElmProps> {
    return {
      str: props.string,
      arr: props.array,
    }
  }

  str: string
  arr: string[]

  renderCallback() {
    return h('div', {}, 'testing')
  }
}

type ButtonProps = PreactComponentProps<any> & { onClick: (e: MouseEvent) => void }
const Button = ({ onClick, children }: ButtonProps) => <button onClick={onClick}>{children}</button>

type CounterOutputProps = PreactComponentProps<any> & { count: number }
const CounterOutput = (props: CounterOutputProps) => (
  <p>
    Count: <span>{props.count}</span>
  </p>
)
