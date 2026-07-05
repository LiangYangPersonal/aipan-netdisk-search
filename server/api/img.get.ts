// 豆瓣图片代理：服务器带豆瓣自家 referer 抓图后转发，绕开豆瓣图床防盗链/反爬
// 仅允许豆瓣图床，避免变成开放代理
export default defineEventHandler(async (event) => {
    const url = String(getQuery(event).url || '')

    if (!/^https?:\/\/[a-z0-9.]*doubanio\.com\//i.test(url)) {
        setResponseStatus(event, 400)
        return 'invalid url'
    }

    try {
        const buffer = await $fetch<ArrayBuffer>(url, {
            responseType: 'arrayBuffer',
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'Referer': 'https://movie.douban.com/',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
        })

        setResponseHeader(event, 'Content-Type', url.endsWith('.png') ? 'image/png' : 'image/jpeg')
        setResponseHeader(event, 'Cache-Control', 'public, max-age=604800, s-maxage=604800')
        return Buffer.from(buffer)
    } catch (error: any) {
        setResponseStatus(event, 502)
        return ''
    }
})
