import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { getCollection } from 'astro:content';
import {
  abs,
  markdownResponse,
  videoMdPath,
} from '../../../lib/markdown-export';
import { getVideosByTopic } from '../../../lib/collections';

export async function getStaticPaths() {
  const topics = await getCollection('topics');
  return topics.map((topic) => ({
    params: { topic: topic.data.slug },
    props: { topic },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { topic } = props as { topic: Awaited<ReturnType<typeof getCollection<'topics'>>>[number] };
  const videos = await getVideosByTopic(topic.data.slug);

  const fm = {
    type: 'video_index',
    topic: topic.data.slug,
    topic_title: topic.data.title,
    canonical_url: abs(`/topics/${topic.data.slug}/videos/`),
    markdown_url: abs(`/topics/${topic.data.slug}/videos.md`),
    video_count: videos.length,
  };

  const lines: string[] = [
    `# ${topic.data.title} — Videos`,
    '',
    `Curated video curriculum on ${topic.data.title.toLowerCase()} policy in India.`,
    '',
  ];
  if (videos.length === 0) {
    lines.push('_No videos available yet._', '');
  } else {
    for (const video of videos) {
      const meta: string[] = [];
      if (video.data.duration) meta.push(video.data.duration);
      if (video.data.speaker) meta.push(video.data.speaker);
      const suffix = meta.length ? ` — ${meta.join(' · ')}` : '';
      lines.push(`- [${video.data.title}](${abs(videoMdPath(video))})${suffix}`);
    }
    lines.push('');
  }

  return markdownResponse(matter.stringify(lines.join('\n').trimEnd() + '\n', fm));
};
