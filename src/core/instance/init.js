/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0  // 实例或组件的唯一id

export function initMixin(Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {  // 初始化实例或组件，参数是options
    // debugger
    const vm: Component = this  // 保存当前实例
    // a uid
    vm._uid = uid++  // 给实例分配唯一id，自增

    let startTag, endTag  // 性能追踪的开始和结束标记
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {  // 非生产环境且开启性能追踪时
      startTag = `vue-perf-start:${vm._uid}`  // 生成唯一的开始标记，格式为 vue-perf-start:uid
      endTag = `vue-perf-end:${vm._uid}`  // 生成唯一的结束标记，格式为 vue-perf-end:uid
      mark(startTag)  // 在性能追踪中标记开始时间点
    }

    // a flag to avoid this being observed
    vm._isVue = true  // 标记这是Vue实例，避免被响应式系统观察
    // merge options
    console.log('initMixin ',options)
    if (options && options._isComponent) {  // 是组件（内部组件实例化）
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)  // 优化：内部组件使用更快的初始化方式
    } else {  // 不是组件（根实例 new Vue() 或手动调用 new SubVue()）
      vm.$options = mergeOptions(  // 合并构造函数选项和传入选项，结果挂到 vm.$options
        resolveConstructorOptions(vm.constructor),  // 获取构造函数最新的options（父类可能有全局更新）
        options || {},  // 传入的选项
        vm  // 当前实例，作为merge的上下文
      )

      console.log('vm.$options == ', vm.$options)
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {  // 非生产环境
      initProxy(vm)  // 用Proxy包裹vm，用于开发环境的属性访问警告
    } else {
      vm._renderProxy = vm  // 生产环境直接用vm本身
    }
    // expose real self
    vm._self = vm  // 保存真实的自身引用（避免被Proxy包裹导致的问题）
    initLifecycle(vm)  // 初始化生命周期关系（$parent, $children, $root等）
    initEvents(vm)  // 初始化事件系统（父组件传递的事件监听）
    initRender(vm)  // 初始化渲染相关（$createElement, _c等渲染函数）
    callHook(vm, 'beforeCreate')  // 调用 beforeCreate 生命周期钩子
    initInjections(vm)  // 解析注入（inject），在 data/props 之前初始化
    initState(vm)  // 初始化状态（props, methods, data, computed, watch）
    initProvide(vm)  // 解析提供（provide），在 data/props 之后初始化
    callHook(vm, 'created')  // 调用 created 生命周期钩子

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {  // 非生产环境且开启性能追踪时
      vm._name = formatComponentName(vm, false)  // 获取组件名称用于性能标识
      mark(endTag)  // 标记结束时间点
      measure(`vue ${vm._name} init`, startTag, endTag)  // 计算初始化耗时
    }

    if (vm.$options.el) {  // 如果有el选项，自动挂载
      vm.$mount(vm.$options.el)  // 调用挂载方法，编译模板并渲染DOM
    }
  }
}

//初始化内部组件
export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)  // 以构造函数options为原型创建opts，比动态合并快
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode  // 父vnode，即组件标签对应的vnode
  opts.parent = options.parent  // 父组件实例
  opts._parentVnode = parentVnode  // 保存父vnode引用

  const vnodeComponentOptions = parentVnode.componentOptions  // 从父vnode中取出组件选项
  opts.propsData = vnodeComponentOptions.propsData  // 父组件传入的props数据
  opts._parentListeners = vnodeComponentOptions.listeners  // 父组件绑定的事件监听器
  opts._renderChildren = vnodeComponentOptions.children  // 插槽内容（默认插槽的children）
  opts._componentTag = vnodeComponentOptions.tag  // 组件标签名

  if (options.render) {  // 如果有传入的render函数（函数式组件等情况）
    opts.render = options.render  // 直接使用传入的render
    opts.staticRenderFns = options.staticRenderFns  // 以及静态渲染函数数组
  }
}

// 解析构造函数的选项（options）
// 调用时机：实例化 Vue 或子组件时，通过 mergeOptions 合并选项前调用
// 调用方式：resolveConstructorOptions(vm.constructor)
// 参数 Ctor：vm.constructor，即实例的构造函数
//   - 根实例 new Vue() 时，Ctor === Vue
//   - 子组件实例化时，Ctor === SubVue（Vue.extend 创建的子类）
// 返回值：构造函数的 options 对象
//   - 根 Vue：直接返回 Vue.options
//   - 子类 SubVue：若父类 options 未变化则返回缓存的 SubVue.options，
//                  若父类 options 发生了变化（如全局注册了组件/指令），
//                  则重新合并 superOptions + extendOptions 后返回
// 相关概念：
//   Ctor.options    —— 当前构造函数最终的 options（可能被重新计算）
//   Ctor.super      —— 父类构造函数（Vue.extend 时设置），根 Vue 没有此属性
//   Ctor.superOptions —— 创建子类时父类的 options 快照（用于检测变化）
//   Ctor.extendOptions —— 创建子类时传入的扩展选项（如 { data, methods, ... }）
//   Ctor.sealedOptions —— 创建子类时 options 的密封快照（用于检测运行时的修改）
export function resolveConstructorOptions(Ctor: Class<Component>) {
  let options = Ctor.options  // 获取构造函数的options，根Vue的在initGlobalAPI中初始化，包含{components, directives, filters, _base}；子类的在Vue.extend中生成

  console.log('resolveConstructorOptions == ', options)

  if (Ctor.super) {  // 检查是否为子类（有super属性说明是通过Vue.extend创建的），根Vue的super为undefined，不会进入此分支
    const superOptions = resolveConstructorOptions(Ctor.super)  // 递归获取父类最新的options，父类可能也是子类，所以需要递归到根Vue

    const cachedSuperOptions = Ctor.superOptions  // 获取创建子类时缓存的父类options快照（Vue.extend时保存的）
    if (superOptions !== cachedSuperOptions) {  // 比较快照与最新值，判断父类options是否发生了变化（如通过Vue.component()全局注册了新组件）
      Ctor.superOptions = superOptions  // 更新缓存的父类options快照

      const modifiedOptions = resolveModifiedOptions(Ctor)  // 检测运行时是否有人直接修改了Ctor.options，找出latest与sealed的差异

      if (modifiedOptions) {  // 如果有运行时修改
        extend(Ctor.extendOptions, modifiedOptions)  // 将运行时修改合并到extendOptions中，确保下次重新合并不丢失
      }

      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)  // 重新合并父类最新options + 子类扩展options，生成新的options

      if (options.name) {  // 如果组件有name
        options.components[options.name] = Ctor  // 将自身注册到components中，使组件可以在自己的模板中递归调用自身
      }
    }
  }

  return options  // 返回构造函数最终的options
}

// 解析运行时被修改的选项
// 目的：检测构造函数 options 在 extend 之后是否被直接修改
// 原理：Ctor.sealedOptions 是 extend 时 options 的深拷贝快照，
//       通过比较 latest（当前 options）与 sealed（快照），
//       找出运行时新增或被覆盖的属性
// 例如：
//   const SubVue = Vue.extend({ ... })  // sealedOptions 保存了此时的 options
//   SubVue.options.components.MyComp = {...}  // 运行时直接修改
//   → resolveModifiedOptions 会返回 { components: { MyComp: {...} } }
// 返回：被修改的选项对象，如果没有修改则返回 undefined
function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified  // 存储被修改的选项，延迟创建
  const latest = Ctor.options           // 当前的options（可能已被运行时修改）
  const sealed = Ctor.sealedOptions     // extend时保存的密封快照

  for (const key in latest) {  // 遍历latest的所有属性，与sealed进行比较
    if (latest[key] !== sealed[key]) {  // 如果当前值和快照值不同（引用不同），说明该属性被修改过
      if (!modified) modified = {}  // 延迟创建modified对象，避免无修改时产生空对象
      modified[key] = latest[key]  // 保存被修改的属性
    }
  }
  return modified  // 返回被修改的选项对象，没有修改则返回undefined
}