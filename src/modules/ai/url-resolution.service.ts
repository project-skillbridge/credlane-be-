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

    const query = encodeURIComponent(`${title} ${description}`);
    const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=1&key=${apiKey}`;

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(5_000),
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

    const query = `${title} ${description}`;

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 3 }),
        signal: AbortSignal.timeout(5_000),
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
        (r) =>
          r.link && !/(?:youtube\.com|youtu\.be|m\.youtube\.com)/i.test(r.link),
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
   * Verify a URL is reachable via a HEAD request.
   * Only rejects URLs that are definitively dead (404, 410).
   * Many sites block HEAD requests (403, 405), so we give those the benefit of doubt.
   */
  private async verifyUrl(url: string): Promise<boolean> {
    // YouTube always returns 200 even for non-existent videos — use oEmbed instead
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      return this.verifyYouTubeUrl(url);
    }

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SkillBridge/1.0; +https://skillbridge.hng14.com)',
        },
      });
      // Only reject if definitively not found or gone
      if (response.status === 404 || response.status === 410) {
        return false;
      }
      return true;
    } catch {
      // Network error / timeout — give benefit of doubt
      return true;
    }
  }

  /**
   * Verify a YouTube video exists using the oEmbed endpoint.
   * Returns 404 for private, deleted, or non-existent videos.
   */
  private async verifyYouTubeUrl(url: string): Promise<boolean> {
    try {
      const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(oEmbedUrl, {
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return true; // Network error — give benefit of doubt
    }
  }

  /**
   * Resolve URLs for an array of resource items in parallel.
   * For videos → YouTube API, for articles/courses → Google Custom Search.
   * Resolved URLs are verified via HEAD (only 404/410 rejected).
   * Items that fail resolution entirely are dropped from the pool.
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
          const isValid = await this.verifyUrl(result.url);
          if (isValid) {
            return { ...item, url: result.url };
          }
          this.logger.warn(
            `HEAD check failed for resolved URL: "${result.url}" (item: "${item.title}")`,
          );
        }

        // Resolution failed or HEAD check failed — drop this item
        this.logger.warn(`Dropping item with no verified URL: "${item.title}"`);
        return { ...item, url: '' };
      }),
    );

    return resolved
      .map((r, i) => (r.status === 'fulfilled' ? r.value : items[i]))
      .filter((item) => !!item.url);
  }
}
