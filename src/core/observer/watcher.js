/* @flow */

import {
  warn,           // 警告工具函数
  remove,         // 数组移除工具函数
  isObject,       // 判断是否是对象
  parsePath,      // 解析点路径字符串（如 "a.b.c"）为取值函数
  _Set as Set,    // Set 数据结构
  handleError,    // 错误处理函数
  noop            // 空函数
} from '../util/index'

import { traverse } from './traverse'       // 深度遍历对象，触发所有属性的 getter
import { queueWatcher } from './scheduler'  // 将 watcher 加入更新队列，异步批量更新
import Dep, { pushTarget, popTarget } from './dep'  // 导入 Dep 类和 target 操作函数

import type { SimpleSet } from '../util/index'  // Flow 类型导入

let uid = 0  // 全局唯一 id 计数器，每个 Watcher 实例分配一个

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// Watcher 类：Vue 响应式系统中的"订阅者/观察者"
// 每个 Watcher 监听一个表达式（字符串或函数），当表达式依赖的数据变化时触发回调
// 应用场景：渲染 Watcher、computed Watcher、用户 $watch Watcher
export default class Watcher {
  vm: Component;            // 所属的 Vue 实例
  expression: string;       // 被监听的表达式（开发环境用于调试显示）
  cb: Function;             // 值变化时触发的回调函数
  id: number;               // 当前 Watcher 实例的唯一 id
  deep: boolean;            // 是否深度监听（递归遍历对象所有属性）
  user: boolean;            // 是否是用户定义的 watcher（$watch 创建的）
  lazy: boolean;            // 是否惰性求值（computed watcher 用）
  sync: boolean;            // 是否同步更新（不进队列，立即执行）
  dirty: boolean;           // 标记值是否已过期（lazy watcher 用）
  active: boolean;          // 当前 watcher 是否处于激活状态
  deps: Array<Dep>;         // 上一轮收集的依赖 Dep 列表
  newDeps: Array<Dep>;      // 当前正在收集的依赖 Dep 列表
  depIds: SimpleSet;        // 上一轮依赖的 id 集合（去重用）
  newDepIds: SimpleSet;     // 当前依赖的 id 集合（去重用）
  before: ?Function;        // 更新前的钩子函数（如 beforeUpdate）
  getter: Function;         // 求值函数，执行后触发依赖收集
  value: any;               // 缓存的当前值

  constructor (
    vm: Component,          // Vue 实例
    expOrFn: string | Function,  // 要监听的表达式或函数
    cb: Function,           // 变化回调
    options?: ?Object,      // 配置选项
    isRenderWatcher?: boolean    // 是否是渲染 watcher
  ) {
    this.vm = vm  // 保存 Vue 实例引用
    if (isRenderWatcher) {
      vm._watcher = this  // 如果是渲染 watcher，挂载到 vm._watcher 上
    }
    vm._watchers.push(this)  // 将当前 watcher 加入实例的 watchers 列表
    // options
    if (options) {  // 从 options 中解构配置
      this.deep = !!options.deep       // 是否深度监听
      this.user = !!options.user       // 是否用户 watcher
      this.lazy = !!options.lazy       // 是否惰性求值（computed）
      this.sync = !!options.sync       // 是否同步更新
      this.before = options.before     // 更新前钩子
    } else {
      this.deep = this.user = this.lazy = this.sync = false  // 默认全为 false
    }
    this.cb = cb  // 保存回调函数
    this.id = ++uid  // 分配唯一 id，用于批量更新时排序
    this.active = true  // 默认为激活状态
    this.dirty = this.lazy  // lazy watcher 初始 dirty 为 true（需要求值）
    this.deps = []       // 初始化旧依赖列表
    this.newDeps = []    // 初始化新依赖列表
    this.depIds = new Set()    // 初始化旧依赖 id 集合
    this.newDepIds = new Set() // 初始化新依赖 id 集合
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()  // 开发环境保存表达式字符串，用于调试
      : ''                  // 生产环境为空
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn  // 如果是函数，直接作为 getter
    } else {
      this.getter = parsePath(expOrFn)  // 如果是字符串路径，解析为取值函数
      if (!this.getter) {
        this.getter = noop  // 解析失败，用空函数
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy
      ? undefined    // lazy watcher（computed）不立即求值，值为 undefined
      : this.get()   // 非 lazy 的立即求值一次，同时收集依赖
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  // get 方法：执行 getter 求值，并重新收集依赖
  get () {
    pushTarget(this)  // 将当前 watcher 设为 Dep.target，标记"正在收集依赖的是我"
    let value
    const vm = this.vm
    try {
      value = this.getter.call(vm, vm)  // 执行 getter，访问响应式数据时会触发 getter → dep.depend()
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)  // 用户 watcher 报错走错误处理
      } else {
        throw e  // 非用户 watcher 直接抛出
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)  // 深度监听：递归遍历 value 的所有属性，触发所有 getter 以收集完整依赖
      }
      popTarget()  // 恢复 Dep.target 为上一个 watcher
      this.cleanupDeps()  // 清理本轮不再需要的旧依赖
    }
    return value  // 返回求值结果
  }

  /**
   * Add a dependency to this directive.
   */
  // addDep 方法：向当前 watcher 添加一个依赖 Dep（由 dep.depend() 调用到这里）
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {  // 本轮还没收集过这个 dep，去重
      this.newDepIds.add(id)        // 记录到新依赖 id 集合
      this.newDeps.push(dep)        // 记录到新依赖列表
      if (!this.depIds.has(id)) {   // 上一轮也没有这个 dep，才需要添加订阅
        dep.addSub(this)            // 双向收集：让 dep 也把当前 watcher 加入订阅列表
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  // cleanupDeps 方法：依赖清理，移除本轮不再需要的旧依赖
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {  // 遍历旧的依赖列表
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {  // 如果旧依赖在本轮没被重新收集到
        dep.removeSub(this)               // 从 dep 的订阅列表中移除当前 watcher
      }
    }
    // 交换新旧 depIds：把本轮新收集的设为"旧的"，清空新的容器以备下一轮
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    // 交换新旧 deps 数组
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0  // 清空新依赖数组
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  // update 方法：订阅者接口，当依赖变化时由 dep.notify() 调用
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true  // lazy watcher（computed）：只标记为脏，不立即求值
    } else if (this.sync) {
      this.run()  // 同步 watcher：立即执行
    } else {
      queueWatcher(this)  // 默认：加入异步更新队列，批量处理
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  // run 方法：调度器执行的任务，真正执行更新逻辑
  run () {
    if (this.active) {  // 只有激活状态的 watcher 才执行
      const value = this.get()  // 重新求值（同时重新收集依赖）
      if (
        value !== this.value ||    // 值变了才触发回调
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||         // 值是对象/数组时，引用没变但内部可能变了，也触发
        this.deep                  // 深度监听时也触发
      ) {
        // set new value
        const oldValue = this.value    // 保存旧值
        this.value = value             // 更新为新值
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)  // 用户 watcher 的回调，包一层 try-catch
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)  // 非用户 watcher 直接调用回调
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // evaluate 方法：求值，仅给 lazy watcher（computed）用
  // 当访问 computed 属性时，如果 dirty 为 true 则调用此方法重新求值
  evaluate () {
    this.value = this.get()  // 求值并收集依赖
    this.dirty = false       // 标记为已更新，不再是脏的
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  // depend 方法：让当前正在收集依赖的 watcher 也依赖上当前 watcher 的所有 dep
  // 主要用于 computed：渲染 watcher 访问 computed 时，通过此方法让渲染 watcher
  // 也订阅到 computed 内部依赖的那些响应式数据上
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()  // 遍历当前 watcher 的所有 dep，让它们也收集当前的 Dep.target
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  // teardown 方法：销毁当前 watcher，从所有依赖的订阅列表中移除自己
  teardown () {
    if (this.active) {  // 只在激活状态才执行销毁
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)  // 从 vm 的 watchers 列表中移除
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)  // 遍历所有依赖 dep，从每个 dep 的订阅列表中移除自己
      }
      this.active = false  // 标记为非激活状态
    }
  }
}