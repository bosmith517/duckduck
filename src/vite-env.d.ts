/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SIGNALWIRE_PROJECT_ID: string
  readonly VITE_SIGNALWIRE_SPACE_URL: string
  readonly VITE_RELAY_SERVICE_URL: string
  readonly VITE_DAILY_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Type declarations for missing modules
declare module 'qs' {
  export function stringify(obj: any, options?: any): string
  export function parse(str: string, options?: any): any
}

declare module 'bootstrap' {
  export const Modal: any
  export const Tooltip: any
  export const Popover: any
  export const Dropdown: any
  export const Collapse: any
  export const Offcanvas: any
  export const Tab: any
}

declare module 'react-copy-to-clipboard' {
  import { Component } from 'react'
  
  interface CopyToClipboardProps {
    text: string
    onCopy?: (text: string, result: boolean) => void
    options?: {
      debug?: boolean
      message?: string
      format?: string
    }
    children: React.ReactElement
  }
  
  export class CopyToClipboard extends Component<CopyToClipboardProps> {}
  export = CopyToClipboard
}

declare module 'react-dom' {
  import React from 'react'
  
  export function render(element: React.ReactElement, container: Element | DocumentFragment): void
  export function unmountComponentAtNode(container: Element | DocumentFragment): boolean
  export function createPortal(children: React.ReactNode, container: Element): React.ReactPortal
  export function findDOMNode(component: React.Component<any, any> | Element): Element | null
  
  const ReactDOM: {
    render: typeof render
    unmountComponentAtNode: typeof unmountComponentAtNode
    createPortal: typeof createPortal
    findDOMNode: typeof findDOMNode
  }
  
  export default ReactDOM
}

declare module 'react-dom/client' {
  import React from 'react'
  
  export interface Root {
    render(children: React.ReactNode): void
    unmount(): void
  }
  
  export function createRoot(container: Element | DocumentFragment): Root
  export function hydrateRoot(container: Element | DocumentFragment, children: React.ReactNode): Root
}
