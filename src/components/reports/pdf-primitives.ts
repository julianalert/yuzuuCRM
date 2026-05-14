/**
 * pdf-primitives.ts
 *
 * @react-pdf/renderer 4.x ships TypeScript types written for older React
 * versions; its components are class-typed and React 19's stricter
 * JSX.ElementClass signature rejects them. We re-export the same modules
 * here cast as plain React component types so JSX usage type-checks
 * cleanly without spreading `// @ts-expect-error` across the renderer.
 *
 * Behaviour is unchanged — these are the same components at runtime; only
 * the TypeScript view of them is widened.
 */

import type { ComponentType, PropsWithChildren, ReactNode } from 'react'
import * as ReactPdf from '@react-pdf/renderer'

type AnyProps = Record<string, unknown> & PropsWithChildren<{ style?: unknown }>

interface DocumentLike extends AnyProps {
  title?: string
  author?: string
  subject?: string
  creator?: string
  producer?: string
  keywords?: string
  language?: string
}

interface PageLike extends AnyProps {
  size?: unknown
  orientation?: 'portrait' | 'landscape'
  wrap?: boolean
}

interface ViewLike extends AnyProps {
  wrap?: boolean
  fixed?: boolean
  break?: boolean
}

interface TextLike extends AnyProps {
  fixed?: boolean
  hyphenationCallback?: (word: string) => string[]
  children?: ReactNode
}

interface ImageLike extends AnyProps {
  src?: string | { uri: string }
  source?: string | { uri: string }
}

export const Document  = ReactPdf.Document  as unknown as ComponentType<DocumentLike>
export const Page      = ReactPdf.Page      as unknown as ComponentType<PageLike>
export const View      = ReactPdf.View      as unknown as ComponentType<ViewLike>
export const Text      = ReactPdf.Text      as unknown as ComponentType<TextLike>
export const Image     = ReactPdf.Image     as unknown as ComponentType<ImageLike>
export const StyleSheet = ReactPdf.StyleSheet
export const renderToBuffer = ReactPdf.renderToBuffer
