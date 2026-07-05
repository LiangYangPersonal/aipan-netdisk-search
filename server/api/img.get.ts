// 豆瓣图片代理：服务器带豆瓣自家 referer 抓图后转发，绕开豆瓣图床防盗链/反爬
// 仅允许豆瓣图床，避免变成开放代理
// 内存缓存 + 失败重试，抵御豆瓣对首屏突发的偶发限流

interface CacheEntry {
    buf: Buffer
    type: string
    exp: number
}

const cache = new Map<string, CacheEntry>()
const CACHE_MAX = 500
const CACHE_TTL = 7 * 24 * 3600 * 1000 // 7 天

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default defineEventHandler(async (event) => {
    const url = String(getQuery(event).url || '')

    if (!/^https?:\/\/[a-z0-9.]*doubanio\.com\//i.test(url)) {
        setResponseStatus(event, 400)
        return 'invalid url'
    }

    // 命中缓存直接返回
    const hit = cache.get(url)
    if (hit && hit.exp > Date.now()) {
        setResponseHeader(event, 'Content-Type', hit.type)
        setResponseHeader(event, 'Cache-Control', 'public, max-age=604800, s-maxage=604800')
        return hit.buf
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Referer': 'https://movie.douban.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
    }

    // 最多尝试 3 次，抵御豆瓣偶发限流/超时
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const buffer = await $fetch<ArrayBuffer>(url, {
                responseType: 'arrayBuffer',
                timeout: 8000,
                headers,
            })
            const buf = Buffer.from(buffer)
            const type = url.endsWith('.png') ? 'image/png' : 'image/jpeg'

            // 存缓存（超出上限先删最旧）
            if (cache.size >= CACHE_MAX) {
                const oldest = cache.keys().next().value
                if (oldest) cache.delete(oldest)
            }
            cache.set(url, { buf, type, exp: Date.now() + CACHE_TTL })

            setResponseHeader(event, 'Content-Type', type)
            setResponseHeader(event, 'Cache-Control', 'public, max-age=604800, s-maxage=604800')
            return buf
        } catch (error: any) {
            if (attempt === 2) {
                setResponseStatus(event, 502)
                return ''
            }
            await sleep(300 * (attempt + 1))
        }
    }
})
