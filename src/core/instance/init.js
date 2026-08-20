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
  Vue.prototype._init = function (options?: Object) {  //初始化实例或组件 参数是：options
    // console.log('initMixin')
    console.log('initMixin ', this, this instanceof Vue)
    // debugger
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) { // 是组件
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else { // 不是组件
      vm.$options = mergeOptions( //合并选项
        resolveConstructorOptions(vm.constructor),
        options || {}, // 传入的选项
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {  // 非生产环境
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

//初始化内部组件
export function initInternalComponent(vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/**
 * 解析构造函数的选项（options）
 *
 * 调用时机：实例化 Vue 或子组件时，通过 mergeOptions 合并选项前调用
 * 调用方式：resolveConstructorOptions(vm.constructor)
 * 参数 Ctor：vm.constructor，即实例的构造函数
 *   - 根实例 new Vue() 时，Ctor === Vue
 *   - 子组件实例化时，Ctor === SubVue（Vue.extend 创建的子类）
 *
 * 返回值：构造函数的 options 对象
 *   - 根 Vue：直接返回 Vue.options
 *   - 子类 SubVue：若父类 options 未变化则返回缓存的 SubVue.options，
 *                  若父类 options 发生了变化（如全局注册了组件/指令），
 *                  则重新合并 superOptions + extendOptions 后返回
 *
 * 相关概念：
 *   Ctor.options    —— 当前构造函数最终的 options（可能被重新计算）
 *   Ctor.super      —— 父类构造函数（Vue.extend 时设置），根 Vue 没有此属性
 *   Ctor.superOptions —— 创建子类时父类的 options 快照（用于检测变化）
 *   Ctor.extendOptions —— 创建子类时传入的扩展选项（如 { data, methods, ... }）
 *   Ctor.sealedOptions —— 创建子类时 options 的密封快照（用于检测运行时的修改）
 */
export function resolveConstructorOptions(Ctor: Class<Component>) {
  // 第 1 步：获取构造函数的 options
  // 对于根 Vue，Vue.options 在 initGlobalAPI 中初始化，
  //   包含 { components: {KeepAlive, Transition, TransitionGroup}, directives: {}, filters: {}, _base: Vue }
  // 对于子类 SubVue，SubVue.options 在 Vue.extend 中通过 mergeOptions 生成
  let options = Ctor.options

  // 第 2 步：检查是否为子类（有 super 属性说明是通过 Vue.extend 创建的）
  // Ctor.super 指向父类构造函数，根 Vue 的 Ctor.super === undefined，不会进入此分支
  console.log('resolveConstructorOptions 🦁', Ctor.super)
  if (Ctor.super) {
    // 第 3 步：递归获取父类最新的 options
    // 父类可能也是子类，所以需要递归到根 Vue
    const superOptions = resolveConstructorOptions(Ctor.super)

    // 第 4 步：获取创建子类时缓存的父类 options 快照
    // cachedSuperOptions 是 Vue.extend 时保存的父类 options 快照
    const cachedSuperOptions = Ctor.superOptions
    console.log('resolveConstructorOptions 🦖', Ctor, options, superOptions, cachedSuperOptions)
    // 第 5 步：比较快照与最新值，判断父类 options 是否发生了变化
    // 如果相同，说明父类 options 没变，直接返回缓存的 Ctor.options（不需要重新合并）
    // 如果不同，说明父类 options 发生了变化（例如通过 Vue.component() 全局注册了新组件）
    if (superOptions !== cachedSuperOptions) {
      // 第 6 步：更新缓存的父类 options 快照
      Ctor.superOptions = superOptions

      // 第 7 步：检测运行时是否有人直接修改了 Ctor.options
      // 例如有人直接给 Ctor.options.components 添加了新组件
      // 找出 latest 与 sealed 的差异（运行时新增/修改的属性）
      const modifiedOptions = resolveModifiedOptions(Ctor)

      // 第 8 步：将运行时修改合并到 extendOptions 中
      // 确保这些修改不会在下次重新合并时丢失
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }

      // 第 9 步：重新合并 superOptions + extendOptions 生成新的 options
      // 这次合并会覆盖旧的 Ctor.options，确保子类拿到最新的全局变更
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)

      // 第 10 步：如果组件有 name，将自身注册到 components 中
      // 这样组件可以在自己的模板中递归调用自身
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }

  return options
}

/**
 * 解析运行时被修改的选项
 *
 * 目的：检测构造函数 options 在 extend 之后是否被直接修改
 * 原理：Ctor.sealedOptions 是 extend 时 options 的深拷贝快照，
 *       通过比较 latest（当前 options）与 sealed（快照），
 *       找出运行时新增或被覆盖的属性
 *
 * 例如：
 *   const SubVue = Vue.extend({ ... })  // sealedOptions 保存了此时的 options
 *   SubVue.options.components.MyComp = {...}  // 运行时直接修改
 *   → resolveModifiedOptions 会返回 { components: { MyComp: {...} } }
 *
 * 返回：被修改的选项对象，如果没有修改则返回 undefined
 */
function resolveModifiedOptions(Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options           // 当前的 options（可能已被运行时修改）
  const sealed = Ctor.sealedOptions     // extend 时保存的密封快照

  // 遍历 latest 的所有属性，与 sealed 进行比较
  for (const key in latest) {
    // 如果当前值和快照值不同（引用不同），说明该属性被修改过
    if (latest[key] !== sealed[key]) {
      // 延迟创建 modified 对象，避免无修改时产生空对象
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
