export default defineNuxtConfig({
  compatibilityDate: '2026-07-28',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  modules: ['@vercel/analytics/nuxt'],
  app: {
    head: {
      title: 'Partnership Letter — Innovative Design at USC',
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover',
        },
        {
          name: 'theme-color',
          content: '#faf9f6',
        },
        {
          name: 'description',
          content: 'A partnership proposal from Innovative Design at USC.',
        },
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/png',
          href: '/images/innod-browser-favicon.png',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fraunces:opsz,wght,SOFT,WONK@9..144,400,80,1;9..144,500,80,1&display=swap',
        },
      ],
    },
  },
})
