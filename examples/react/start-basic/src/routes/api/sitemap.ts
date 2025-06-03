import { createAPIFileRoute } from '@tanstack/react-start/api'
import { generateSitemap } from '@tanstack/router-sitemap'

export const APIRoute = createAPIFileRoute('/api/sitemap')({
  GET: async ({ request, params }) => {
    console.info(`Generating sitemap... @`, request.url)

    const sitemap = await generateSitemap({
      siteUrl: 'https://example.com',
      routes: {
        '/': {
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 1.0,
        },
        '/users': {
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        },
      },
    })

    return new Response(sitemap, {
      headers: { 'Content-Type': 'application/xml' },
    })
  },
})
