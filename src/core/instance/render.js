/* @flow */ // Flow 类型注解标记，表示该文件使用 Flow 进行静态类型检查

import { // 从 util/index 中导入工具函数
  warn, // 警告函数，用于输出开发环境警告信息
  nextTick, // 在下一个 tick 执行回调，用于异步更新队列
  emptyObject, // 空对象常量，冻结的空对象，用作默认值避免不必要的响应式
  handleError, // 错误处理函数，统一捕获和处理组件中的错误
  defineReactive // 定义响应式属性的核心函数，给对象属性添加 getter/setter
} from '../util/index' // 从 util 目录导入

import { createElement } from '../vdom/create-element' // 导入创建 VNode 的核心函数，即 h 函数
import { installRenderHelpers } from './render-helpers/index' // 导入渲染辅助函数安装器，如 _v、_s、_l 等
import { resolveSlots } from './render-helpers/resolve-slots' // 导入解析插槽的函数
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots' // 导入规范化作用域插槽的函数
import VNode, { createEmptyVNode } from '../vdom/vnode' // 导入 VNode 类和创建空 VNode 的函数

import { isUpdatingChildComponent } from './lifecycle' // 导入生命周期模块中的标记，判断是否正在更新子组件

export function initRender (vm: Component) { // 初始化渲染相关属性和方法，在组件实例初始化时调用
  vm._vnode = null // the root of the child tree // 子组件树的根 VNode，即当前组件渲染产出的 VNode
  vm._staticTrees = null // v-once cached trees // v-once 指令缓存的静态 VNode 树数组
  const options = vm.$options // 缓存组件的合并选项对象，方便后续使用
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree // 父树中的占位符节点，同时赋值给 vm.$vnode 和局部变量 parentVnode
  const renderContext = parentVnode && parentVnode.context // 渲染上下文，即父组件实例，插槽内容在父组件作用域中编译
  vm.$slots = resolveSlots(options._renderChildren, renderContext) // 解析普通插槽，将子节点按 name 分类存入 $slots 对象
  vm.$scopedSlots = emptyObject // 作用域插槽初始化为空对象，后续在渲染时规范化
  // bind the createElement fn to this instance // 将 createElement 函数绑定到当前实例
  // so that we get proper render context inside it. // 这样在函数内部就能获取正确的渲染上下文
  // args order: tag, data, children, normalizationType, alwaysNormalize // 参数顺序：标签、数据、子节点、规范化类型、是否始终规范化
  // internal version is used by render functions compiled from templates // 内部版本供模板编译生成的渲染函数使用
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false) // 内部版 h 函数，false 表示不总是规范化子节点，模板编译优化用
  // normalization is always applied for the public version, used in // 公开版本始终应用规范化，用于用户手写的渲染函数
  // user-written render functions.
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true) // 公开版 h 函数，true 表示始终规范化子节点，用户手写 render 时用

  // $attrs & $listeners are exposed for easier HOC creation. // 暴露 $attrs 和 $listeners 以方便创建高阶组件
  // they need to be reactive so that HOCs using them are always updated // 它们需要是响应式的，这样使用它们的 HOC 才能始终更新
  const parentData = parentVnode && parentVnode.data // 从父占位 VNode 中获取节点数据对象（包含 attrs、props 等）

  /* istanbul ignore else */ // 测试覆盖率忽略标记，else 分支不做覆盖率统计
  if (process.env.NODE_ENV !== 'production') { // 非生产环境
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => { // 将 $attrs 定义为响应式属性，值为父组件传入的 attrs，开发环境下赋值时触发只读警告
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm) // 非子组件更新流程中修改 $attrs 时发出只读警告
    }, true) // 最后一个参数 true 表示 shallow，浅响应式，不深度观察
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => { // 将 $listeners 定义为响应式属性，值为父组件传入的事件监听器
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm) // 非子组件更新流程中修改 $listeners 时发出只读警告
    }, true) // 浅响应式
  } else { // 生产环境
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true) // 生产环境下定义响应式 $attrs，无 setter 警告，浅响应式
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true) // 生产环境下定义响应式 $listeners，无 setter 警告，浅响应式
  }
}

export function renderMixin (Vue: Class<Component>) { // 渲染混入函数，向 Vue 原型上添加渲染相关方法
  // install runtime convenience helpers // 安装运行时便捷辅助函数
  installRenderHelpers(Vue.prototype) // 将 _v、_s、_l、_t 等渲染辅助函数挂载到 Vue 原型上

  Vue.prototype.$nextTick = function (fn: Function) { // 在 Vue 原型上添加 $nextTick 方法
    return nextTick(fn, this) // 调用全局 nextTick，并将 this 绑定为当前组件实例
  }

  Vue.prototype._render = function (): VNode { // 核心渲染方法，调用 render 函数生成 VNode 树
    const vm: Component = this // 缓存当前组件实例
    const { render, _parentVnode } = vm.$options // 从选项中解构出 render 函数和父占位 VNode

    if (_parentVnode) { // 如果存在父占位 VNode（即该组件是子组件）
      vm.$scopedSlots = normalizeScopedSlots( // 规范化作用域插槽
        _parentVnode.data.scopedSlots, // 父占位节点 data 中的作用域插槽
        vm.$slots // 当前组件的普通插槽（用于 fallback）
      )
    }

    // set parent vnode. this allows render functions to have access // 设置父 vnode，这样渲染函数可以访问占位节点上的数据
    // to the data on the placeholder node.
    vm.$vnode = _parentVnode // 将当前组件的 $vnode 指向父占位 VNode
    // render self // 渲染自身
    let vnode // 声明变量存储生成的 VNode
    try { // 尝试执行 render 函数
      vnode = render.call(vm._renderProxy, vm.$createElement) // 调用 render 函数，this 指向 _renderProxy（开发环境下的代理对象，用于警告未定义属性），参数是 $createElement 即 h 函数
    } catch (e) { // 捕获渲染错误
      handleError(e, vm, `render`) // 统一错误处理
      // return error render result, // 返回错误渲染结果
      // or previous vnode to prevent render error causing blank component // 或返回上一次的 vnode 以防渲染错误导致组件空白
      /* istanbul ignore next */ // 测试覆盖率忽略
      if (process.env.NODE_ENV !== 'production' && vm.$options.renderError) { // 非生产环境且定义了 renderError 钩子
        try { // 尝试调用 renderError
          vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e) // 调用 renderError 函数，传入错误对象 e
        } catch (e) { // renderError 也报错的情况
          handleError(e, vm, `renderError`) // 处理 renderError 的错误
          vnode = vm._vnode // 回退到上一次渲染的 VNode，避免空白
        }
      } else { // 生产环境或没有 renderError
        vnode = vm._vnode // 直接回退到上一次的 VNode
      }
    }
    // if the returned array contains only a single node, allow it // 如果返回数组且只有一个节点，允许并取出该节点
    if (Array.isArray(vnode) && vnode.length === 1) { // 判断是否是单元素数组
      vnode = vnode[0] // 取出数组中的第一个 VNode
    }
    // return empty vnode in case the render function errored out // 如果 render 函数最终返回的不是 VNode 实例，则返回空 VNode
    if (!(vnode instanceof VNode)) { // 检查是否为 VNode 实例
      if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) { // 非生产环境且返回了数组（多个根节点）
        warn( // 发出警告
          'Multiple root nodes returned from render function. Render function ' + // 渲染函数返回了多个根节点
          'should return a single root node.', // 渲染函数应该返回单个根节点
          vm
        )
      }
      vnode = createEmptyVNode() // 创建空注释节点作为兜底
    }
    // set parent // 设置父节点引用
    vnode.parent = _parentVnode // 将生成的 VNode 的 parent 指向父占位 VNode，建立组件树关系
    return vnode // 返回最终生成的 VNode
  }
}