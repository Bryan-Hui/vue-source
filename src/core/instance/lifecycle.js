/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import { mark, measure } from '../util/perf'
import { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'

import {
  warn,
  noop,
  remove,
  emptyObject,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'

export let activeInstance: any = null  // 当前正在更新的组件实例，用于父子组件更新时的上下文
export let isUpdatingChildComponent: boolean = false  // 标记是否正在更新子组件，用于某些判断逻辑

export function setActiveInstance(vm: Component) {
  const prevActiveInstance = activeInstance  // 保存上一个活动实例
  activeInstance = vm  // 将当前实例设为活动实例
  return () => {  // 返回恢复函数，调用后还原上一个活动实例
    activeInstance = prevActiveInstance
  }
}

export function initLifecycle (vm: Component) {
  const options = vm.$options  // 取出合并后的选项

  // locate first non-abstract parent
  let parent = options.parent  // 父组件实例（由 initInternalComponent 或手动传入）
  if (parent && !options.abstract) {  // 如果有父组件且当前组件不是抽象组件
    while (parent.$options.abstract && parent.$parent) {  // 向上查找第一个非抽象父组件
      parent = parent.$parent
    }
    parent.$children.push(vm)  // 把当前实例加入父组件的 $children 数组
  }

  vm.$parent = parent  // 设置当前实例的父组件引用
  vm.$root = parent ? parent.$root : vm  // 设置根实例引用，有父则取父的$root，没有则自己就是根

  vm.$children = []  // 子组件数组，初始为空
  vm.$refs = {}  // ref 引用集合，初始为空对象

  vm._watcher = null  // 渲染 watcher，初始为 null
  vm._inactive = null  // keep-alive 中是否处于非激活状态，初始为 null
  vm._directInactive = false  // 是否直接被 deactivate，初始为 false
  vm._isMounted = false  // 是否已挂载，初始为 false
  vm._isDestroyed = false  // 是否已销毁，初始为 false
  vm._isBeingDestroyed = false  // 是否正在销毁中，初始为 false
}

export function lifecycleMixin (Vue: Class<Component>) {
  //更新vue实例的虚拟dom和实际dom
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {  // _update 负责将 vnode 转为真实 DOM
    const vm: Component = this  // 当前组件实例
    const prevEl = vm.$el  // 旧的真实 DOM 元素
    const prevVnode = vm._vnode  // 旧的 vnode（组件自身的渲染 vnode）
    const restoreActiveInstance = setActiveInstance(vm)  // 设置当前实例为活动实例，拿到恢复函数
    vm._vnode = vnode  // 更新组件自身 vnode 为新 vnode

    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    if (!prevVnode) {  // 没有旧 vnode，说明是首次渲染
      // initial render
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)  // 首次挂载，将 vnode 转为真实 DOM 并替换 $el
    } else {  // 有旧 vnode，说明是更新
      // updates
      vm.$el = vm.__patch__(prevVnode, vnode)  // diff 新旧 vnode，更新真实 DOM
    }
    restoreActiveInstance()  // 恢复上一个活动实例

    // update __vue__ reference
    if (prevEl) {  // 如果有旧 DOM
      prevEl.__vue__ = null  // 清除旧 DOM 上的 __vue__ 引用
    }
    if (vm.$el) {  // 如果有新 DOM
      vm.$el.__vue__ = vm  // 在新 DOM 上挂载 __vue__ 指向当前实例
    }

    // if parent is an HOC, update its $el as well
    if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {  // 如果父组件是高阶组件（HOC），当前组件的占位 vnode 就是父组件的渲染 vnode
      vm.$parent.$el = vm.$el  // 同步更新父组件的 $el 引用
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  Vue.prototype.$forceUpdate = function () {  // 强制更新实例
    const vm: Component = this  // 当前实例
    if (vm._watcher) {  // 如果有渲染 watcher
      vm._watcher.update()  // 手动触发 watcher 更新
    }
  }

  Vue.prototype.$destroy = function () {  // 销毁实例
    const vm: Component = this  // 当前实例
    if (vm._isBeingDestroyed) {  // 如果已经在销毁中，直接返回，防止重复销毁
      return
    }
    callHook(vm, 'beforeDestroy')  // 调用 beforeDestroy 钩子
    vm._isBeingDestroyed = true  // 标记为正在销毁中

    // remove self from parent
    const parent = vm.$parent  // 父组件实例
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {  // 父存在、父未销毁、自身非抽象
      remove(parent.$children, vm)  // 从父组件的 $children 中移除自己
    }

    // teardown watchers
    if (vm._watcher) {  // 如果有渲染 watcher
      vm._watcher.teardown()  // 销毁渲染 watcher
    }
    let i = vm._watchers.length  // 用户 watcher 的数量
    while (i--) {  // 倒序遍历所有用户 watcher
      vm._watchers[i].teardown()  // 逐个销毁
    }

    // remove reference from data ob
    // frozen object may not have observer.
    if (vm._data.__ob__) {  // 如果 data 有 Observer（冻结对象可能没有）
      vm._data.__ob__.vmCount--  // 减少 vm 计数
    }

    // call the last hook...
    vm._isDestroyed = true  // 标记为已销毁

    // invoke destroy hooks on current rendered tree
    vm.__patch__(vm._vnode, null)  // 用 null 替换旧 vnode，触发整棵子树的销毁流程

    // fire destroyed hook
    callHook(vm, 'destroyed')  // 调用 destroyed 钩子

    // turn off all instance listeners.
    vm.$off()  // 移除所有事件监听

    // remove __vue__ reference
    if (vm.$el) {  // 如果有 DOM 元素
      vm.$el.__vue__ = null  // 清除 DOM 上的 __vue__ 引用
    }

    // release circular reference (#6759)
    if (vm.$vnode) {  // 如果有占位 vnode
      vm.$vnode.parent = null  // 断开父 vnode 引用，解决循环引用内存泄漏
    }
  }
}

export function mountComponent (  // 挂载组件：创建渲染 watcher，执行首次渲染
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el  // 挂载的目标 DOM 元素
  if (!vm.$options.render) {  // 如果没有 render 函数
    vm.$options.render = createEmptyVNode  // 设置一个空 vnode 作为默认 render
    if (process.env.NODE_ENV !== 'production') {  // 非生产环境下给出警告
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||  // 有 template 但不是 #id 形式，或有 el
        vm.$options.el || el) {
        warn(  // 提示使用了 runtime-only 版本，没有模板编译器
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {  // 其他情况：没有模板或 render
        warn(  // 提示组件挂载失败，没有 template 或 render
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  callHook(vm, 'beforeMount')  // 调用 beforeMount 钩子

  let updateComponent  // 更新组件的函数，由 watcher 调用
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {  // 非生产环境且开启性能追踪
    updateComponent = () => {  // 带性能统计的更新函数
      const name = vm._name  // 组件名
      const id = vm._uid  // 组件 uid
      const startTag = `vue-perf-start:${id}`  // 性能开始标记
      const endTag = `vue-perf-end:${id}`  // 性能结束标记

      mark(startTag)  // 标记 render 开始
      const vnode = vm._render()  // 执行渲染，生成 vnode
      mark(endTag)  // 标记 render 结束
      measure(`vue ${name} render`, startTag, endTag)  // 计算 render 耗时

      mark(startTag)  // 标记 patch 开始
      vm._update(vnode, hydrating)  // 执行更新，将 vnode 转为 DOM
      mark(endTag)  // 标记 patch 结束
      measure(`vue ${name} patch`, startTag, endTag)  // 计算 patch 耗时
    }
  } else {  // 生产环境，不带性能统计
    updateComponent = () => {  // 普通更新函数
      vm._update(vm._render(), hydrating)  // 先 render 再 update
    }
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  new Watcher(vm, updateComponent, noop, {  // 创建渲染 watcher，监听数据变化自动更新
    before () {  // 更新前回调
      if (vm._isMounted && !vm._isDestroyed) {  // 已挂载且未销毁时
        callHook(vm, 'beforeUpdate')  // 调用 beforeUpdate 钩子
      }
    }
  }, true /* isRenderWatcher */)  // 标记这是渲染 watcher
  hydrating = false  // 水合只在首次挂载时生效，之后置为 false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {  // $vnode 为 null 表示是手动 new Vue() 挂载的根实例（不是子组件）
    vm._isMounted = true  // 标记为已挂载
    callHook(vm, 'mounted')  // 调用 mounted 钩子
  }
  return vm  // 返回实例
}

export function updateChildComponent (  // 更新子组件：父组件更新时，同步 props、事件、插槽等到子组件
  vm: Component,
  propsData: ?Object,
  listeners: ?Object,
  parentVnode: MountedComponentVNode,
  renderChildren: ?Array<VNode>
) {
  if (process.env.NODE_ENV !== 'production') {  // 非生产环境
    isUpdatingChildComponent = true  // 标记正在更新子组件
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren.

  // check if there are dynamic scopedSlots (hand-written or compiled but with
  // dynamic slot names). Static scoped slots compiled from template has the
  // "$stable" marker.
  const hasDynamicScopedSlot = !!(  // 是否有动态作用域插槽
    (parentVnode.data.scopedSlots && !parentVnode.data.scopedSlots.$stable) ||  // 父 vnode 的 scopedSlots 不稳定
    (vm.$scopedSlots !== emptyObject && !vm.$scopedSlots.$stable)  // 子实例上的 scopedSlots 不稳定
  )

  // Any static slot children from the parent may have changed during parent's
  // update. Dynamic scoped slots may also have changed. In such cases, a forced
  // update is necessary to ensure correctness.
  const needsForceUpdate = !!(  // 是否需要强制更新
    renderChildren ||               // 有新的静态插槽内容
    vm.$options._renderChildren ||  // 有旧的静态插槽内容
    hasDynamicScopedSlot            // 有动态作用域插槽
  )

  vm.$options._parentVnode = parentVnode  // 更新子组件的父 vnode 引用
  vm.$vnode = parentVnode  // 更新占位 vnode（组件标签对应的 vnode），不触发重渲染

  if (vm._vnode) { // update child tree's parent
    vm._vnode.parent = parentVnode  // 如果子组件已经有渲染 vnode，更新其 parent 指向新的占位 vnode
  }
  vm.$options._renderChildren = renderChildren  // 更新插槽内容

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  vm.$attrs = parentVnode.data.attrs || emptyObject  // 更新 $attrs（透传的属性），是响应式的
  vm.$listeners = listeners || emptyObject  // 更新 $listeners（透传的事件），是响应式的

  // update props
  if (propsData && vm.$options.props) {  // 如果有 props 数据且组件声明了 props
    toggleObserving(false)  // 关闭响应式观察，避免 props 赋值时触发不必要的依赖收集
    const props = vm._props  // 组件内部的 props 对象
    const propKeys = vm.$options._propKeys || []  // props 的 key 列表
    for (let i = 0; i < propKeys.length; i++) {  // 遍历所有 prop
      const key = propKeys[i]  // 当前 prop 的 key
      const propOptions: any = vm.$options.props // wtf flow?
      props[key] = validateProp(key, propOptions, propsData, vm)  // 校验并设置 prop 值
    }
    toggleObserving(true)  // 重新开启响应式观察
    // keep a copy of raw propsData
    vm.$options.propsData = propsData  // 保存原始 propsData 副本
  }

  // update listeners
  listeners = listeners || emptyObject  // 新的事件监听对象
  const oldListeners = vm.$options._parentListeners  // 旧的事件监听
  vm.$options._parentListeners = listeners  // 更新为新的事件监听
  updateComponentListeners(vm, listeners, oldListeners)  // 更新组件的事件绑定（添加新的、移除旧的）

  // resolve slots + force update if has children
  if (needsForceUpdate) {  // 如果需要强制更新（插槽变化）
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)  // 重新解析插槽
    vm.$forceUpdate()  // 强制组件更新
  }

  if (process.env.NODE_ENV !== 'production') {  // 非生产环境
    isUpdatingChildComponent = false  // 标记子组件更新结束
  }
}

function isInInactiveTree (vm) {  // 判断组件是否处于非激活的 keep-alive 树中
  while (vm && (vm = vm.$parent)) {  // 向上遍历所有父组件
    if (vm._inactive) return true  // 只要有一个父组件是非激活的，就返回 true
  }
  return false  // 所有祖先都激活，返回 false
}

export function activateChildComponent (vm: Component, direct?: boolean) {  // 激活 keep-alive 中的组件
  if (direct) {  // 如果是直接激活（最外层调用）
    vm._directInactive = false  // 清除直接非激活标记
    if (isInInactiveTree(vm)) {  // 如果在非激活树中
      return  // 不激活，直接返回
    }
  } else if (vm._directInactive) {  // 非直接激活但组件被标记为直接非激活
    return  // 不激活，直接返回
  }
  if (vm._inactive || vm._inactive === null) {  // 如果当前是非激活状态或初始状态
    vm._inactive = false  // 标记为已激活
    for (let i = 0; i < vm.$children.length; i++) {  // 遍历所有子组件
      activateChildComponent(vm.$children[i])  // 递归激活子组件
    }
    callHook(vm, 'activated')  // 调用 activated 钩子
  }
}

export function deactivateChildComponent (vm: Component, direct?: boolean) {  // 停用 keep-alive 中的组件
  if (direct) {  // 如果是直接停用（最外层调用）
    vm._directInactive = true  // 标记为直接非激活
    if (isInInactiveTree(vm)) {  // 如果已经在非激活树中
      return  // 不重复停用，直接返回
    }
  }
  if (!vm._inactive) {  // 如果当前是激活状态
    vm._inactive = true  // 标记为非激活
    for (let i = 0; i < vm.$children.length; i++) {  // 遍历所有子组件
      deactivateChildComponent(vm.$children[i])  // 递归停用子组件
    }
    callHook(vm, 'deactivated')  // 调用 deactivated 钩子
  }
}

export function callHook (vm: Component, hook: string) {  // 调用生命周期钩子函数
  // #7573 disable dep collection when invoking lifecycle hooks
  pushTarget()  // 压入 undefined target，防止钩子执行时收集依赖
  const handlers = vm.$options[hook]  // 从选项中取出对应钩子的处理函数数组
  console.log('callHook ',vm.$options,hook,handlers)
  const info = `${hook} hook`  // 错误信息描述
  if (handlers) {  // 如果有钩子函数
    for (let i = 0, j = handlers.length; i < j; i++) {  // 遍历所有钩子
      invokeWithErrorHandling(handlers[i], vm, null, vm, info)  // 带错误处理地执行钩子
    }
  }
  if (vm._hasHookEvent) {  // 如果有 hook 事件监听（通过 @hook:xxx 方式绑定）
    vm.$emit('hook:' + hook)  // 触发对应钩子事件
  }
  popTarget()  // 恢复之前的 target
}