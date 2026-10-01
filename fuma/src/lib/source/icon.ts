import { icons } from 'lucide-react'
import { createElement } from 'react'

/** A datasource icon is either a lucide icon name or an image path. */
export const icon = (icon: any) => {
  if (!icon) return
  if (typeof icon !== 'string') return icon
  if (icon in icons) return createElement(icons[icon as keyof typeof icons])
  return createElement('img', { src: icon, className: 'w-5 h-5' })
}
