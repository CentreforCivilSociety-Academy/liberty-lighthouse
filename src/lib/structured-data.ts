// JSON-LD structured data helpers for Liberty Lighthouse

// 1. Organization schema for Centre for Civil Society
export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Centre for Civil Society',
    url: 'https://ccs.in',
    logo: 'https://libertylighthouse.ccs.in/favicon.svg',
  };
}

// 2. WebSite schema with SearchAction
export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Liberty Lighthouse',
    url: 'https://libertylighthouse.ccs.in',
    description: "A classical liberal resource for understanding India's policy landscape.",
    publisher: { '@type': 'Organization', name: 'Centre for Civil Society' },
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://libertylighthouse.ccs.in/search/?q={search_term_string}',
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

// 5. Breadcrumb schema
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
