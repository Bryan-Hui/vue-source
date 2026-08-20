/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'

/**
 * 初始化 Vue.extend
 * 作用：给 Vue 添加创建子类的能力，实现基于原型的类继承。
 */
export function initExtend(Vue: GlobalAPI) {
  // Vue 根构造函数的 cid 为 0；子类 cid 从 1 开始自增
  Vue.cid = 0
  let cid = 1

  /**
   * Vue.extend(extendOptions)
   * 基于当前类（Super）创建并返回子类构造函数 Sub。
   */
  Vue.extend = function (extendOptions: Object): Function {
    console.log('extend 🐲')
    extendOptions = extendOptions || {}
    const Super = this        // 当前父类：Vue 或其子类
    const SuperId = Super.cid // 父类唯一标识

    /**
     * 注意：缓存构造函数。
     * 同一个父类 + 同一套 extendOptions 只会创建一次子类，避免重复构造。
     */
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production' && name) {
      validateComponentName(name) // 非生产环境校验组件名合法性
    }

    // 定义子类构造函数：实例化时仍然走 _init 初始化流程
    const Sub = function VueComponent(options) {
      this._init(options)
    }

    // 原型继承
    // 注意：Object.create 创建新原型后，必须手动修正 constructor 指向 Sub
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub

    Sub.cid = cid++

    // 合并父类选项与传入的 extendOptions，得到子类完整配置
    Sub.options = mergeOptions(Super.options, extendOptions)
    Sub['super'] = Super

    /**
     * 性能优化：提前在子类原型上定义 props / computed 的代理 getter，
     * 避免每个实例创建时都去执行 Object.defineProperty。
     */
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // 让子类也拥有 extend、mixin、use 能力，支持链式继承
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // 复制 component / directive / filter 注册方法，子类可维护私有资源
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })

    // 如果有组件名，在自身 components 中注册，支持模板里递归调用自己
    if (name) {
      Sub.options.components[name] = Sub
    }

    /**
     * 保留三类选项引用：
     * - superOptions：父类原始选项，用于判断父类选项是否被热更新
     * - extendOptions：本次 extend 传入的选项
     * - sealedOptions：extend 时刻的冻结快照，作为选项是否被篡改的基准
     */
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // 缓存并返回子类
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

/**
 * 为每个 prop 在子类原型上设置代理：
 * this[key] => this._props[key]
 */
function initProps(Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

/**
 * 为每个 computed 在子类原型上定义计算属性。
 */
function initComputed(Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
