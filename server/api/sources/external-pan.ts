import type { H3Event } from "h3";
import { buildExternalPanSearchResult } from "~/server/services/search/externalPanSources.mjs";
import { createRateLimiter } from "~/server/utils/rateLimit";

// 移植自 unilei 上游：去掉了 aipan.me 域名白名单和敏感词审核依赖，类型内联
interface SearchBody {
  name: string;
}
interface TransformedResult {
  list: Array<{
    name: string;
    links: Array<{ service: string; link: string; pwd?: string }>;
  }>;
  code?: number;
  msg?: string;
}

const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 20 });

export default defineEventHandler(
  async (event: H3Event): Promise<TransformedResult> => {
    try {
      const clientIp = getRequestIP(event) || "unknown";

      if (rateLimiter.isLimited(clientIp)) {
        return {
          list: [],
          code: 429,
          msg: "Too many requests - please try again later",
        };
      }

      const body = await readBody<SearchBody>(event);
      const searchTerm = body?.name?.trim();

      if (!searchTerm) {
        return {
          list: [],
          code: 400,
          msg: "Search term is required",
        };
      }

      return await buildExternalPanSearchResult(searchTerm);
    } catch (error: any) {
      console.error("[ExternalPan] 搜索失败:", error);
      return {
        list: [],
        code: 500,
        msg: error?.message || "Internal server error",
      };
    }
  },
);
