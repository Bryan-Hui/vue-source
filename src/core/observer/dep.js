/* @flow */

import type Watcher from './watcher' // 导入 Watcher 类型，用于 Flow 类型检查
import { remove } from '../util/index' // 导入数组移除工具函数
import config from '../config' // 导入 Vue 全局配置对象

let uid = 0 // 全局唯一标识计数器，每个 Dep 实例分配一个唯一 id

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
// Dep（Dependency）类：Vue 响应式系统中的"依赖收集器"
// 每个响应式数据（对象属性或数组元素）对应一个 Dep 实例
// Dep 的作用是收集所有依赖该数据的 Watcher，并在数据变化时通知它们更新
export default class Dep {
  static target: ?Watcher; // 静态属性，当前正在计算的 Watcher（全局唯一，同一时间只能有一个 Watcher 在被求值）
  id: number; // 当前 Dep 实例的唯一标识
  subs: Array<Watcher>; // 订阅者数组，存放所有依赖该 Dep 的 Watcher 实例

  constructor () {
    this.id = uid++ // 每个 Dep 实例分配自增的唯一 id
    this.subs = [] // 初始化订阅者数组
  }

  addSub (sub: Watcher) {
    this.subs.push(sub) // 添加一个 Watcher 订阅者到 subs 数组中
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub) // 从 subs 数组中移除指定的 Watcher 订阅者
  }

  depend () {
    // 如果当前有正在计算的 Watcher（Dep.target 存在）
    if (Dep.target) {
      // 调用 Watcher 的 addDep 方法，让 Watcher 把当前 Dep 加入自己的依赖列表
      // 这是一个双向收集的过程：Watcher 记录依赖了哪些 Dep，Dep 也记录哪些 Watcher 订阅了自己
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice() // 先对订阅者数组做一份浅拷贝，避免遍历过程中数组变化导致问题
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // 非生产环境且非异步模式下，需要手动按 id 排序
      // 保证 Watcher 按正确的顺序触发（先父后子、先 computed 后 watch 等）
      subs.sort((a, b) => a.id - b.id)
    }
    // 遍历所有订阅者，依次调用它们的 update 方法触发更新
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null // 初始化静态属性 target 为 null，表示当前没有正在计算的 Watcher
const targetStack = [] // 目标栈，用于嵌套场景下保存 Watcher 上下文（比如组件嵌套渲染）

// pushTarget：将当前 Watcher 推入栈顶，并设置为 Dep.target
// 在 Watcher 开始求值前调用，用于标记"当前正在收集依赖的 Watcher 是谁"
export function pushTarget (target: ?Watcher) {
  targetStack.push(target) // 将目标 Watcher 压入栈中
  Dep.target = target // 将 Dep.target 指向当前 Watcher
}

// popTarget：将栈顶的 Watcher 弹出，并恢复上一个 Watcher 为 Dep.target
// 在 Watcher 求值完成后调用，用于恢复上下文
export function popTarget () {
  targetStack.pop() // 弹出栈顶的 Watcher
  Dep.target = targetStack[targetStack.length - 1] // 将 Dep.target 恢复为栈顶（即上一个 Watcher）
}
