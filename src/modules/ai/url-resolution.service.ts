import { Injectable, Logger } from '@nestjs/common';
import { env } from '../../config/env';

export interface ResolvedUrl {
  url: string;
  resolved: boolean;
}

@Injectable()
export class UrlResolutionService {
  private readonly logger = new Logger(UrlResolutionService.name);

  /**
   * Resolve a real YouTube video URL by searching YouTube Data API v3
   * with the given title and description as the query.
   */
  async resolveYouTubeUrl(
    title: string,
    description: string,
  ): Promise<ResolvedUrl> {
    const apiKey = env.YOUTUBE_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'YOUTUBE_API_KEY not configured; skipping URL resolution',
      );
      return { url: '', resolved: false };
    }

    const query = encodeURIComponent(`${title} ${description}`.slice(0, 120));
    const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${apiKey}`;

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(
          `YouTube API returned ${response.status}: ${await response.text()}`,
        );
        return { url: '', resolved: false };
      }

      const data = (await response.json()) as {
        items?: Array<{ id?: { videoId?: string } }>;
      };

      const videoId = data.items?.[0]?.id?.videoId;
      if (videoId) {
        return {
          url: `https://www.youtube.com/watch?v=${videoId}`,
          resolved: true,
        };
      }

      this.logger.warn(`YouTube search returned no results for: "${title}"`);
      return { url: '', resolved: false };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`YouTube API call failed: ${msg}`);
      return { url: '', resolved: false };
    }
  }

  /**
   * Resolve a real article/course URL using Serper.dev Google Search API.
   */
  async resolveGoogleUrl(
    title: string,
    description: string,
  ): Promise<ResolvedUrl> {
    const apiKey = env.SERPER_API_KEY;

    if (!apiKey) {
      this.logger.warn(
        'SERPER_API_KEY not configured; skipping URL resolution',
      );
      return { url: '', resolved: false };
    }

    const query =
      `${title} ${description}`.slice(0, 120) + ' -site:youtube.com';

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 3 }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        this.logger.warn(
          `Serper API returned ${response.status}: ${await response.text()}`,
        );
        return { url: '', resolved: false };
      }

      const data = (await response.json()) as {
        organic?: Array<{ link?: string }>;
      };

      // Pick the first non-YouTube result
      const link = data.organic?.find(
        (r) => r.link && !r.link.includes('youtube.com'),
      )?.link;
      if (link) {
        return { url: link, resolved: true };
      }

      this.logger.warn(`Serper search returned no results for: "${title}"`);
      return { url: '', resolved: false };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Serper API call failed: ${msg}`);
      return { url: '', resolved: false };
    }
  }

  /**
   * Resolve URLs for an array of resource items in parallel.
   * For videos → YouTube API, for articles/courses → Google Custom Search.
   * Falls back to the AI-generated URL if resolution fails.
   * Non-video items that still have YouTube URLs are re-typed as 'video'.
   */
  async resolveAllUrls<
    T extends { title: string; description: string; url: string; type: string },
  >(items: T[]): Promise<T[]> {
    const resolved = await Promise.allSettled(
      items.map(async (item) => {
        let result: ResolvedUrl;

        if (item.type === 'video') {
          result = await this.resolveYouTubeUrl(item.title, item.description);
        } else {
          result = await this.resolveGoogleUrl(item.title, item.description);
        }

        if (result.resolved) {
          return { ...item, url: result.url };
        }

        // If a non-video item still has a YouTube URL, reclassify it as video
        if (item.type !== 'video' && item.url.includes('youtube.com')) {
          return { ...item, type: 'video' };
        }
        return item;
      }),
    );

    const withUrls = resolved.map((r, i) =>
      r.status === 'fulfilled' ? r.value : items[i],
    );

    // Verification pass: HEAD-check each URL and drop items with dead links
    const verified = await Promise.allSettled(
      withUrls.map(async (item) => {
        if (!item.url) return null; // no URL at all — drop
        const alive = await this.isUrlAlive(item.url);
        return alive ? item : null;
      }),
    );

    return verified
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter((item): item is NonNullable<typeof item> => item !== null) as T[];
  }

  /**
   * Quick HEAD check to verify a URL is reachable (2xx/3xx).
   * Returns false on timeout, network error, or 4xx/5xx.
   */
  private async isUrlAlive(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
        redirect: 'follow',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
