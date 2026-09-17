/* @flow */ // Flow 类型注解标记，表示该文件使用 Flow 进行静态类型检查

export default class VNode { // 导出 VNode 类，作为虚拟 DOM 节点的核心类
  tag: string | void; // 标签名，如 'div'、'span'；void 表示可能为 undefined，用于文本节点等
  data: VNodeData | void; // 节点数据，包含 class、style、attrs、props、事件等；void 表示可能为 undefined
  children: ?Array<VNode>; // 子节点数组，? 表示可能为 null 或 undefined
  text: string | void; // 文本节点的文本内容；void 表示可能为 undefined
  elm: Node | void; // 对应的真实 DOM 节点引用；void 表示可能为 undefined
  ns: string | void; // 命名空间，用于 SVG、MathML 等；void 表示可能为 undefined
  context: Component | void; // rendered in this component's scope // 渲染该节点的组件实例（作用域）
  key: string | number | void; // 节点的 key，用于 diff 算法中识别节点；void 表示可能为 undefined
  componentOptions: VNodeComponentOptions | void; // 组件 VNode 的配置选项，如 propsData、listeners 等
  componentInstance: Component | void; // component instance // 组件实例，组件 VNode 挂载后指向组件 vm 实例
  parent: VNode | void; // component placeholder node // 父节点，指向组件的占位符 VNode

  // strictly internal // 严格内部使用的属性
  raw: boolean; // contains raw HTML? (server only) // 是否包含原始 HTML，仅服务端渲染使用
  isStatic: boolean; // hoisted static node // 是否为静态节点，用于编译优化（静态提升）
  isRootInsert: boolean; // necessary for enter transition check // 是否作为根节点插入，用于进入过渡动画检查
  isComment: boolean; // empty comment placeholder? // 是否为注释节点（空注释占位符）
  isCloned: boolean; // is a cloned node? // 是否为克隆节点
  isOnce: boolean; // is a v-once node? // 是否为 v-once 节点，只渲染一次
  asyncFactory: Function | void; // async component factory function // 异步组件的工厂函数
  asyncMeta: Object | void; // 异步组件的元数据，存储异步加载相关信息
  isAsyncPlaceholder: boolean; // 是否为异步组件的占位符节点
  ssrContext: Object | void; // 服务端渲染上下文
  fnContext: Component | void; // real context vm for functional nodes // 函数式组件的真实上下文 vm
  fnOptions: ?ComponentOptions; // for SSR caching // 函数式组件的选项，用于 SSR 缓存
  devtoolsMeta: ?Object; // used to store functional render context for devtools // devtools 使用的函数式渲染上下文元数据
  fnScopeId: ?string; // functional scope id support // 函数式组件的作用域 id，用于样式 scoped

  constructor ( // 构造函数，接收 8 个可选参数
    tag?: string, // 标签名，可选
    data?: VNodeData, // 节点数据，可选
    children?: ?Array<VNode>, // 子节点数组，可选，可能为 null
    text?: string, // 文本内容，可选
    elm?: Node, // 真实 DOM 节点，可选
    context?: Component, // 组件上下文，可选
    componentOptions?: VNodeComponentOptions, // 组件选项，可选
    asyncFactory?: Function // 异步组件工厂函数，可选
  ) {
    this.tag = tag // 初始化标签名
    this.data = data // 初始化节点数据
    this.children = children // 初始化子节点数组
    this.text = text // 初始化文本内容
    this.elm = elm // 初始化真实 DOM 引用
    this.ns = undefined // 命名空间初始化为 undefined，后续可能在创建 DOM 时设置
    this.context = context // 初始化组件上下文
    this.fnContext = undefined // 函数式组件上下文初始化为 undefined
    this.fnOptions = undefined // 函数式组件选项初始化为 undefined
    this.fnScopeId = undefined // 函数式组件作用域 id 初始化为 undefined
    this.key = data && data.key // 从 data 中提取 key，data 存在时才取值
    this.componentOptions = componentOptions // 初始化组件选项
    this.componentInstance = undefined // 组件实例初始化为 undefined，挂载后才赋值
    this.parent = undefined // 父节点初始化为 undefined
    this.raw = false // raw 默认 false，不含原始 HTML
    this.isStatic = false // 默认不是静态节点
    this.isRootInsert = true // 默认为根插入
    this.isComment = false // 默认不是注释节点
    this.isCloned = false // 默认不是克隆节点
    this.isOnce = false // 默认不是 v-once 节点
    this.asyncFactory = asyncFactory // 初始化异步组件工厂函数
    this.asyncMeta = undefined // 异步元数据初始化为 undefined
    this.isAsyncPlaceholder = false // 默认不是异步占位符节点
  }

  // DEPRECATED: alias for componentInstance for backwards compat. // 已废弃：为兼容旧版本保留的 componentInstance 别名
  /* istanbul ignore next */ // 测试覆盖率忽略标记
  get child (): Component | void { // getter 属性，返回组件实例
    return this.componentInstance // 返回 componentInstance，即组件的 vm 实例
  }
}

export const createEmptyVNode = (text: string = '') => { // 创建空 VNode（注释节点）的工厂函数，默认文本为空字符串
  const node = new VNode() // 创建一个空的 VNode 实例
  node.text = text // 设置文本内容
  node.isComment = true // 标记为注释节点
  return node // 返回创建的空 VNode
}

export function createTextVNode (val: string | number) { // 创建文本 VNode 的工厂函数，接收字符串或数字
  return new VNode(undefined, undefined, undefined, String(val)) // 创建无标签、无数据、无子节点、有文本的 VNode，即纯文本节点
}

// optimized shallow clone // 优化的浅克隆
// used for static nodes and slot nodes because they may be reused across // 用于静态节点和插槽节点，因为它们可能在多次渲染中被复用
// multiple renders, cloning them avoids errors when DOM manipulations rely // 克隆可以避免当 DOM 操作依赖其 elm 引用时出错
// on their elm reference.
export function cloneVNode (vnode: VNode): VNode { // 克隆 VNode 的函数，接收原 vnode，返回新的克隆 vnode
  const cloned = new VNode( // 创建新的 VNode 实例，传入原节点的核心属性
    vnode.tag, // 复制标签名
    vnode.data, // 复制节点数据（浅拷贝引用）
    // #7975 // issue 编号
    // clone children array to avoid mutating original in case of cloning // 克隆子节点数组，避免克隆子节点时修改原数组
    // a child.
    vnode.children && vnode.children.slice(), // 子节点数组用 slice 浅拷贝，子 VNode 对象本身仍共享引用
    vnode.text, // 复制文本内容
    vnode.elm, // 复制真实 DOM 引用
    vnode.context, // 复制组件上下文
    vnode.componentOptions, // 复制组件选项
    vnode.asyncFactory // 复制异步组件工厂函数
  )
  cloned.ns = vnode.ns // 复制命名空间
  cloned.isStatic = vnode.isStatic // 复制静态节点标记
  cloned.key = vnode.key // 复制 key
  cloned.isComment = vnode.isComment // 复制注释节点标记
  cloned.fnContext = vnode.fnContext // 复制函数式组件上下文
  cloned.fnOptions = vnode.fnOptions // 复制函数式组件选项
  cloned.fnScopeId = vnode.fnScopeId // 复制函数式组件作用域 id
  cloned.asyncMeta = vnode.asyncMeta // 复制异步元数据
  cloned.isCloned = true // 标记为克隆节点
  return cloned // 返回克隆后的 VNode
}