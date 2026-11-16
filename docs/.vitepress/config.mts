import { defineConfig } from 'vitepress'
import { sections } from './sections'

export default defineConfig({
  title: 'Backend Atlas',
  description: 'A map of backend engineering concepts: short explanations, real-world situations and when each one matters.',
  lang: 'en-US',
  // GitHub Pages serves the site at https://<user>.github.io/backend-atlas/
  base: '/backend-atlas/',
  lastUpdated: true,

  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/backend-atlas/logo.svg' }]],

  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    lineNumbers: false
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: '80/20 Path', link: '/pareto' },
      { text: 'Concept Index', link: '/concepts' },
      { text: 'Start', link: '/communication/request-response' }
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: '80/20 Path', link: '/pareto' },
          { text: 'Concept Index', link: '/concepts' }
        ]
      },
      ...sections.map((section) => ({
        text: `${section.icon} ${section.text}`,
        collapsed: false,
        items: section.items
      }))
    ],

    outline: { level: 2, label: 'Concepts on this page' },

    search: { provider: 'local' },

    docFooter: { prev: 'Previous', next: 'Next' },

    footer: {
      message: 'Personal backend engineering reference built from my course notes.',
      copyright: 'Backend Atlas'
    }
  }
})
