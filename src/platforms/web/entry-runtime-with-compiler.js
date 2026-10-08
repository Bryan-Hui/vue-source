/* @flow */ // Flow 类型注解标记

import config from 'core/config' // 导入全局配置对象
import { warn, cached } from 'core/util/index' // 导入警告函数和缓存函数
import { mark, measure } from 'core/util/perf' // 导入性能标记和测量工具

import Vue from './runtime/index' // 导入运行时版本的 Vue 构造函数
import { query } from './util/index' // 导入 DOM 查询工具函数
import { compileToFunctions } from './compiler/index' // 导入模板编译函数
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat' // 导入换行符解码兼容配置

const idToTemplate = cached(id => { // 创建缓存函数，根据 id 获取模板内容
  const el = query(id) // 通过 id 查询 DOM 元素
  return el && el.innerHTML // 返回元素的 innerHTML
})

const mount = Vue.prototype.$mount // 缓存原始的 $mount 方法
Vue.prototype.$mount = function ( // 重写 $mount 方法（带编译器版本）
  el?: string | Element, // 挂载的元素，可以是选择器字符串或 DOM 元素
  hydrating?: boolean // 是否为服务端渲染的 hydration 模式
): Component {
  el = el && query(el) // 将 el 转换为 DOM 元素

  /* istanbul ignore if */ // 代码覆盖率忽略标记
  if (el === document.body || el === document.documentElement) { // 禁止挂载到 body 或 html 标签上
    process.env.NODE_ENV !== 'production' && warn( // 开发环境下发出警告
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.` // 警告信息
    )
    return this // 返回实例本身，链式调用
  }

  const options = this.$options // 获取实例的配置选项
  // resolve template/el and convert to render function // 解析 template/el 并转换为 render 函数
  if (!options.render) { // 如果没有 render 函数，则需要编译模板
    let template = options.template // 获取 template 选项
    if (template) { // 如果存在 template 选项
      if (typeof template === 'string') { // 如果 template 是字符串
        if (template.charAt(0) === '#') { // 如果是 id 选择器（以 # 开头）
          template = idToTemplate(template) // 通过 id 获取模板内容
          /* istanbul ignore if */ // 代码覆盖率忽略标记
          if (process.env.NODE_ENV !== 'production' && !template) { // 开发环境下模板不存在时警告
            warn( // 发出警告
              `Template element not found or is empty: ${options.template}`, // 警告信息
              this // 当前实例作为上下文
            )
          }
        }
      } else if (template.nodeType) { // 如果 template 是 DOM 元素（有 nodeType 属性）
        template = template.innerHTML // 取元素的 innerHTML 作为模板
      } else { // template 类型不合法
        if (process.env.NODE_ENV !== 'production') { // 开发环境下发出警告
          warn('invalid template option:' + template, this) // 警告 template 无效
        }
        return this // 返回实例本身
      }
    } else if (el) { // 没有 template 但有 el，则使用 el 的 outerHTML 作为模板
      template = getOuterHTML(el) // 获取 el 的 outerHTML
    }
    if (template) { // 如果最终获取到了模板
      /* istanbul ignore if */ // 代码覆盖率忽略标记
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) { // 开发环境且开启性能追踪
        mark('compile') // 开始编译性能标记
      }

      const { render, staticRenderFns } = compileToFunctions(template, { // 编译模板为 render 函数
        outputSourceRange: process.env.NODE_ENV !== 'production', // 开发环境输出源码位置信息
        shouldDecodeNewlines, // 是否解码内容中的换行符（IE 兼容）
        shouldDecodeNewlinesForHref, // 是否解码 href 中的换行符（IE 兼容）
        delimiters: options.delimiters, // 插值表达式的分隔符
        comments: options.comments // 是否保留模板中的注释
      }, this) // 当前实例作为编译上下文
      options.render = render // 将编译得到的 render 函数挂载到 options 上
      options.staticRenderFns = staticRenderFns // 将静态渲染函数数组挂载到 options 上

      /* istanbul ignore if */ // 代码覆盖率忽略标记
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) { // 开发环境且开启性能追踪
        mark('compile end') // 结束编译性能标记
        measure(`vue ${this._name} compile`, 'compile', 'compile end') // 测量编译耗时
      }
    }
  }
  return mount.call(this, el, hydrating) // 调用原始的 $mount 方法进行挂载
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */ // 获取元素的 outerHTML，兼容 IE 中的 SVG 元素
function getOuterHTML (el: Element): string { // 定义获取 outerHTML 的工具函数
  if (el.outerHTML) { // 如果元素支持 outerHTML
    return el.outerHTML // 直接返回 outerHTML
  } else { // 不支持的情况（如 IE 中的 SVG 元素）
    const container = document.createElement('div') // 创建一个容器 div
    container.appendChild(el.cloneNode(true)) // 将元素克隆后放入容器
    return container.innerHTML // 返回容器的 innerHTML，等价于 outerHTML
  }
}

Vue.compile = compileToFunctions // 将编译函数挂载到 Vue 构造函数上，供外部使用

export default Vue // 导出带编译器的 Vue 构造函数