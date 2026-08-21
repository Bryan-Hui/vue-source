src/
├── core/                    # 核心代码（平台无关）
│   ├── observer/            # 响应式系统 ⭐
│   │   ├── index.js         # Observer 主类
│   │   ├── dep.js           # 依赖收集器
│   │   ├── watcher.js       # 观察者（更新触发器）
│   │   ├── array.js         # 数组响应式
│   │   └── scheduler.js     # 异步更新队列
│   ├── vdom/                # 虚拟 DOM ⭐
│   │   ├── patch.js         # Diff 算法核心
│   │   ├── create-element.js
│   │   └── vnode.js
│   ├── instance/            # Vue 实例 ⭐
│   │   ├── index.js         # Vue 构造函数
│   │   ├── init.js          # 初始化流程
│   │   ├── state.js         # 数据代理（$data, $props）
│   │   ├── render.js        # 渲染
│   │   └── lifecycle.js     # 生命周期
│   ├── components/          # 内置组件（keep-alive）
│   ├── global-api/          # 全局 API
│   └── util/                # 工具函数
├── platforms/               # 平台适配
│   ├── web/                 # Web 平台
│   │   ├── entry-runtime-with-compiler.js
│   │   ├── compiler/        # 模板编译
│   │   └── runtime/         # DOM 操作
│   └── weex/                # Weex（原生渲染）
├── compiler/                # 编译器
│   ├── parser/              # HTML 解析
│   ├── codegen/             # 代码生成
│   └── optimizer/           # 静态优化
├── server/                  # SSR
└── shared/                  # 共享工具