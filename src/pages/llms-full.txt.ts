import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const [topics, faqs, videos] = await Promise.all([
    getCollection('topics'),
    getCollection('faqs', ({ data }) => !data.draft),
    getCollection('videos', ({ data }) => !data.draft),
  ]);

  const sortedTopics = topics.sort((a, b) => a.data.order - b.data.order);

  const lines: string[] = [
    '# Liberty Lighthouse — Full Content',
    '',
    '> All content from Liberty Lighthouse, a classical liberal resource for understanding India\'s policy landscape.',
    '',
  ];

  for (const topic of sortedTopics) {
    lines.push(`## ${topic.data.title}`, '');

    // FAQs for this topic
    const topicFaqs = faqs
      .filter((f) => f.data.topic === topic.data.slug)
      .sort((a, b) => a.data.order - b.data.order);

    if (topicFaqs.length > 0) {
      lines.push('### FAQs', '');
      for (const faq of topicFaqs) {
        lines.push(`#### ${faq.data.question}`, '');
        if (faq.body && faq.body.trim()) {
          lines.push(faq.body.trim(), '');
        }
      }
    }

    // Videos for this topic
    const topicVideos = videos
      .filter((v) => v.data.topic === topic.data.slug)
      .sort((a, b) => a.data.order - b.data.order);

    if (topicVideos.length > 0) {
      lines.push('### Videos', '');
      for (const video of topicVideos) {
        lines.push(`#### ${video.data.title}`, '');
        if (video.data.duration) {
          lines.push(`Duration: ${video.data.duration}`, '');
        }
        if (video.data.description) {
          lines.push(video.data.description, '');
        }
      }
    }

    // Guided Syllabus
    if (topic.data.guidedSyllabus && topic.data.guidedSyllabus.trim()) {
      lines.push('### Guided Syllabus', '');
      lines.push(topic.data.guidedSyllabus.trim(), '');
    }
  }

  const markdown = lines.join('\n');

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
