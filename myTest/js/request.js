/**
 * 简易 Request 封装（基于 fetch）
 * 支持：拦截器、超时、基础错误处理
 */

class Request {
  constructor(config = {}) {
    this.baseURL = config.baseURL || ''
    this.timeout = config.timeout || 10000
    this.headers = config.headers || {}

    // 拦截器
    this.interceptors = {
      request: [],
      response: []
    }
  }

  // 添加请求拦截器
  useRequestInterceptor(fulfilled, rejected) {
    this.interceptors.request.push({ fulfilled, rejected })
  }

  // 添加响应拦截器
  useResponseInterceptor(fulfilled, rejected) {
    this.interceptors.response.push({ fulfilled, rejected })
  }

  // 核心请求方法
  async request(config) {
    // 合并配置
    let finalConfig = {
      ...config,
      url: this.baseURL + config.url,
      headers: { ...this.headers, ...config.headers }
    }

    // 执行请求拦截器
    for (const interceptor of this.interceptors.request) {
      try {
        finalConfig = await interceptor.fulfilled(finalConfig)
      } catch (error) {
        if (interceptor.rejected) {
          interceptor.rejected(error)
        }
        throw error
      }
    }

    // 超时封装
    const fetchPromise = fetch(finalConfig.url, {
      method: finalConfig.method || 'GET',
      headers: finalConfig.headers,
      body: finalConfig.body ? JSON.stringify(finalConfig.body) : undefined
    })

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), this.timeout)
    })

    try {
      let response = await Promise.race([fetchPromise, timeoutPromise])

      // 执行响应拦截器
      for (const interceptor of this.interceptors.response) {
        try {
          response = await interceptor.fulfilled(response)
        } catch (error) {
          if (interceptor.rejected) {
            interceptor.rejected(error)
          }
          throw error
        }
      }

      // 自动解析 JSON
      if (response.headers.get('content-type')?.includes('application/json')) {
        return await response.json()
      }
      return await response.text()
    } catch (error) {
      throw error
    }
  }

  get(url, config = {}) {
    return this.request({ ...config, url, method: 'GET' })
  }

  post(url, body, config = {}) {
    return this.request({ ...config, url, method: 'POST', body })
  }

  put(url, body, config = {}) {
    return this.request({ ...config, url, method: 'PUT', body })
  }

  delete(url, config = {}) {
    return this.request({ ...config, url, method: 'DELETE' })
  }
}

// ============ 使用示例 ============

const http = new Request({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器：添加 token
http.useRequestInterceptor(
  (config) => {
    console.log('[Request]', config.url)
    config.headers['Authorization'] = 'Bearer token123'
    return config
  },
  (error) => {
    console.error('[Request Error]', error)
    throw error
  }
)

// 响应拦截器：统一错误处理
http.useResponseInterceptor(
  (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response
  },
  (error) => {
    console.error('[Response Error]', error.message)
    throw error
  }
)

// 发起请求
http.get('/posts/1')
  .then(data => console.log('Success:', data))
  .catch(err => console.log('Catch:', err.message))

http.post('/posts', { title: 'foo', body: 'bar', userId: 1 })
  .then(data => console.log('Created:', data))
  .catch(err => console.log('Catch:', err.message))

// 导出
// module.exports = Request
// export default Request
