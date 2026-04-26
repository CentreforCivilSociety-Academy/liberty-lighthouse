// JSON-LD structured data helpers for Liberty Lighthouse

// 1. Organization schema for Centre for Civil Society
export function buildOrganizationSchema(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Centre for Civil Society',
    url: 'https://ccs.in',
    logo: new URL('/favicon.svg', siteUrl).href,
  };
}

// 2. WebSite schema with SearchAction
export function buildWebSiteSchema(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Liberty Lighthouse',
    url: siteUrl,
    description: "A classical liberal resource for understanding India's policy landscape.",
    publisher: { '@type': 'Organization', name: 'Centre for Civil Society' },
    potentialAction: {
      '@type': 'SearchAction',
      target: new URL('/search/?q={search_term_string}', siteUrl).href,
      'query-input': 'required name=search_term_string',
    },
  };
}

// 3. FAQ page schema
export function buildFAQSchema(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

// 4. Video schema
export function buildVideoSchema(video: {
  title: string;
  description: string;
  youtubeId: string;
  duration?: string;
  uploadDate?: string;
}) {
  const isoDuration = video.duration ? convertToISO8601Duration(video.duration) : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description,
    thumbnailUrl: `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${video.youtubeId}`,
    uploadDate: video.uploadDate,
    ...(isoDuration && { duration: isoDuration }),
  };
}

// 5. DefinedTerm schema (for a single glossary term page)
export function buildDefinedTermSchema(term: {
  name: string;
  description: string;
  url: string;
  inDefinedTermSet: string;
  alternateName?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: term.name,
    description: term.description,
    url: term.url,
    inDefinedTermSet: term.inDefinedTermSet,
    ...(term.alternateName && term.alternateName.length > 0 && { alternateName: term.alternateName }),
  };
}

// 6. DefinedTermSet schema (for the glossary index page)
export function buildDefinedTermSetSchema(set: {
  name: string;
  description: string;
  url: string;
  hasDefinedTerm: Array<{ name: string; description: string; url: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: set.name,
    description: set.description,
    url: set.url,
    hasDefinedTerm: set.hasDefinedTerm.map((t) => ({
      '@type': 'DefinedTerm',
      name: t.name,
      description: t.description,
      url: t.url,
    })),
  };
}

// 7. Breadcrumb schema
export function buildBreadcrumbSchema(crumbs: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

// Helper: convert "M:SS" or "H:MM:SS" to ISO 8601 duration
function convertToISO8601Duration(duration: string): string {
  const parts = duration.split(':').map(Number);
  if (parts.length === 2) {
    return `PT${parts[0]}M${parts[1]}S`;
  }
  if (parts.length === 3) {
    return `PT${parts[0]}H${parts[1]}M${parts[2]}S`;
  }
  return `PT${duration}S`;
}
