/**
 * ============================================================
 * 手写 Promise —— 符合 Promise/A+ 规范
 * ============================================================
 *
 * Promise/A+ 核心规范：
 * 1. Promise 是一个具有 then 方法的对象/函数
 * 2. 三种状态：pending（等待）→ fulfilled（成功）/ rejected（失败），状态不可逆
 * 3. then 方法必须返回新的 Promise，支持链式调用
 * 4. 值穿透：如果 then 的参数不是函数，值会向下传递
 * 5. 错误处理：executor 或回调中抛错会被 catch 捕获
 * 6. 异步执行：回调必须在当前调用栈清空后才执行（微任务）
 * 7. thenable 处理：兼容其他库返回的类 Promise 对象
 */

const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

function isFunction(value) {
  return typeof value === 'function'
}

function isObject(value) {
  return value !== null && typeof value === 'object'
}

/**
 * 模拟微任务队列
 * 优先使用 queueMicrotask，降级用 setTimeout
 */
function runAsync(callback) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback)
  } else if (typeof process !== 'undefined' && process.nextTick) {
    process.nextTick(callback)
  } else {
    setTimeout(callback, 0)
  }
}

class MyPromise {
  /**
   * 构造函数接收一个执行器 executor(resolve, reject)
   * 执行器会立即同步执行
   */
  constructor(executor) {
    this.state = PENDING      // 初始状态
    this.value = undefined    // 成功时的值
    this.reason = undefined   // 失败时的原因
    this.onFulfilledCallbacks = []  // 成功回调队列（用于 pending 状态）
    this.onRejectedCallbacks = []   // 失败回调队列

    const resolve = (value) => {
      // 只有 pending 状态才能改变
      if (this.state === PENDING) {
        this.state = FULFILLED
        this.value = value
        // 依次执行等待中的成功回调
        this.onFulfilledCallbacks.forEach(fn => fn())
      }
    }

    const reject = (reason) => {
      if (this.state === PENDING) {
        this.state = REJECTED
        this.reason = reason
        // 依次执行等待中的失败回调
        this.onRejectedCallbacks.forEach(fn => fn())
      }
    }

    try {
      executor(resolve, reject)
    } catch (error) {
      // executor 执行出错，直接 reject
      reject(error)
    }
  }

  /**
   * then 方法 —— Promise 的核心
   * @param {Function} onFulfilled - 成功回调
   * @param {Function} onRejected  - 失败回调
   * @returns {MyPromise} 新的 Promise，支持链式调用
   *
   * 规范要点：
   * 1. 如果 onFulfilled/onRejected 不是函数，要实现值穿透
   * 2. 回调必须异步执行
   * 3. 必须返回新的 Promise
   * 4. 要处理 then 中返回的 Promise（解决循环引用、thenable 等）
   */
  then(onFulfilled, onRejected) {
    // 值穿透：如果没传回调，默认把值往下传 / 把错误往下抛
    onFulfilled = isFunction(onFulfilled) ? onFulfilled : value => value
    onRejected = isFunction(onRejected) ? onRejected : reason => { throw reason }

    const promise2 = new MyPromise((resolve, reject) => {
      const handleFulfilled = () => {
        runAsync(() => {
          try {
            const x = onFulfilled(this.value)
            // 核心：处理 then 回调的返回值 x
            resolvePromise(promise2, x, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      }

      const handleRejected = () => {
        runAsync(() => {
          try {
            const x = onRejected(this.reason)
            resolvePromise(promise2, x, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      }

      if (this.state === FULFILLED) {
        handleFulfilled()
      } else if (this.state === REJECTED) {
        handleRejected()
      } else {
        // pending 状态：先把回调存起来，等 resolve/reject 时执行
        this.onFulfilledCallbacks.push(handleFulfilled)
        this.onRejectedCallbacks.push(handleRejected)
      }
    })

    return promise2
  }

  /**
   * catch 只是 then(null, onRejected) 的语法糖
   */
  catch(onRejected) {
    return this.then(null, onRejected)
  }

  /**
   * finally —— 无论成功失败都会执行
   * 注意：finally 不改变值，但会等待其中的 Promise
   */
  finally(onFinally) {
    return this.then(
      value => MyPromise.resolve(onFinally()).then(() => value),
      reason => MyPromise.resolve(onFinally()).then(() => { throw reason })
    )
  }

  // ==================== 静态方法 ====================

  /**
   * MyPromise.resolve(value)
   * 如果 value 是 Promise，原样返回；否则包装成 resolved 的 Promise
   */
  static resolve(value) {
    if (value instanceof MyPromise) {
      return value
    }
    return new MyPromise(resolve => resolve(value))
  }

  /**
   * MyPromise.reject(reason)
   * 返回一个 rejected 的 Promise
   */
  static reject(reason) {
    return new MyPromise((_, reject) => reject(reason))
  }

  /**
   * MyPromise.all(promises)
   * 所有 Promise 都成功才成功，返回结果数组；任一失败则失败
   */
  static all(promises) {
    return new MyPromise((resolve, reject) => {
      if (!Array.isArray(promises)) {
        reject(new TypeError('MyPromise.all expects an array'))
        return
      }

      const results = new Array(promises.length)
      let completedCount = 0

      if (promises.length === 0) {
        resolve(results)
        return
      }

      promises.forEach((promise, index) => {
        MyPromise.resolve(promise).then(
          value => {
            results[index] = value
            completedCount++
            if (completedCount === promises.length) {
              resolve(results)
            }
          },
          reason => reject(reason)  // 任一失败，整体失败
        )
      })
    })
  }

  /**
   * MyPromise.race(promises)
   * 哪个 Promise 先完成，就采用哪个的结果
   */
  static race(promises) {
    return new MyPromise((resolve, reject) => {
      if (!Array.isArray(promises)) {
        reject(new TypeError('MyPromise.race expects an array'))
        return
      }
      promises.forEach(promise => {
        MyPromise.resolve(promise).then(resolve, reject)
      })
    })
  }

  /**
   * MyPromise.allSettled(promises)
   * 等待所有 Promise 完成，无论成功失败
   * 返回 [{ status: 'fulfilled', value }, { status: 'rejected', reason }]
   */
  static allSettled(promises) {
    return new MyPromise((resolve) => {
      if (!Array.isArray(promises)) {
        resolve([])
        return
      }

      const results = new Array(promises.length)
      let completedCount = 0

      if (promises.length === 0) {
        resolve(results)
        return
      }

      promises.forEach((promise, index) => {
        MyPromise.resolve(promise).then(
          value => {
            results[index] = { status: 'fulfilled', value }
            completedCount++
            if (completedCount === promises.length) resolve(results)
          },
          reason => {
            results[index] = { status: 'rejected', reason }
            completedCount++
            if (completedCount === promises.length) resolve(results)
          }
        )
      })
    })
  }
}

/**
 * ============================================================
 * Promise 解决过程 [[Resolve]](promise2, x)
 * ============================================================
 * 这是 Promise/A+ 规范最核心也最复杂的部分，处理 then 回调的返回值 x：
 *
 * 1. 如果 promise2 === x，抛 TypeError（循环引用）
 * 2. 如果 x 是 Promise，采用它的状态
 * 3. 如果 x 是对象或函数（thenable），尝试调用 x.then
 * 4. 否则，用 x 直接 resolve
 */
function resolvePromise(promise2, x, resolve, reject) {
  // 2.3.1 循环引用检测
  if (promise2 === x) {
    reject(new TypeError('Chaining cycle detected for promise'))
    return
  }

  // 2.3.2 x 是 MyPromise 实例
  if (x instanceof MyPromise) {
    x.then(resolve, reject)
    return
  }

  // 2.3.3 x 是对象或函数，可能是 thenable
  if (isObject(x) || isFunction(x)) {
    let called = false  // 防止多次调用

    try {
      const then = x.then

      // 2.3.3.3 如果 then 是函数，当作 Promise 处理
      if (isFunction(then)) {
        then.call(
          x,
          y => {
            if (called) return
            called = true
            resolvePromise(promise2, y, resolve, reject)  // 递归解析
          },
          r => {
            if (called) return
            called = true
            reject(r)
          }
        )
      } else {
        // 2.3.3.4 then 不是函数，直接 resolve x
        resolve(x)
      }
    } catch (error) {
      // 2.3.3.2 取 x.then 时抛错
      if (called) return
      called = true
      reject(error)
    }
  } else {
    // 2.3.4 x 是普通值，直接 resolve
    resolve(x)
  }
}


// ========================= 使用示例 =========================

console.log('========== 示例 1：基础用法 ==========')
const p1 = new MyPromise((resolve, reject) => {
  setTimeout(() => resolve('Hello MyPromise!'), 100)
})
p1.then(value => {
  console.log('p1 resolved:', value)
  return value + ' -> then1'
}).then(value => {
  console.log('链式调用:', value)
})


console.log('========== 示例 2：错误捕获 ==========')
const p2 = new MyPromise((resolve, reject) => {
  reject('Something went wrong')
})
p2.catch(err => {
  console.log('Caught:', err)
  return 'Recovered'
}).then(value => {
  console.log('After catch:', value)
})


console.log('========== 示例 3：值穿透 ==========')
MyPromise.resolve(100)
  .then()           // 没传回调，值 100 穿透
  .then(value => {
    console.log('值穿透结果:', value)  // 100
  })


console.log('========== 示例 4：异步链式 & 返回 Promise ==========')
MyPromise.resolve('start')
  .then(value => {
    console.log(value)
    // 返回新的 Promise
    return new MyPromise(resolve => {
      setTimeout(() => resolve('async value'), 100)
    })
  })
  .then(value => {
    console.log('收到异步值:', value)
  })


console.log('========== 示例 5：Promise.all ==========')
const pA = new MyPromise(resolve => setTimeout(() => resolve('A'), 100))
const pB = new MyPromise(resolve => setTimeout(() => resolve('B'), 50))
const pC = MyPromise.resolve('C')  // 同步

MyPromise.all([pA, pB, pC]).then(results => {
  console.log('all results:', results)  // ['A', 'B', 'C']
})


console.log('========== 示例 6：Promise.race ==========')
MyPromise.race([
  new MyPromise(resolve => setTimeout(() => resolve('slow'), 200)),
  new MyPromise(resolve => setTimeout(() => resolve('fast'), 50))
]).then(winner => {
  console.log('race winner:', winner)  // 'fast'
})


console.log('========== 示例 7：finally ==========')
MyPromise.resolve('done')
  .finally(() => {
    console.log('finally 执行了！')
  })
  .then(value => {
    console.log('finally 后的值:', value)  // 'done'
  })


console.log('========== 示例 8：thenable 兼容 ==========')
// 模拟其他库返回的类 Promise 对象
const thenable = {
  then(resolve, reject) {
    resolve(42)
  }
}
MyPromise.resolve(thenable).then(value => {
  console.log('thenable 结果:', value)  // 42
})


// 导出（根据环境选择）
// module.exports = MyPromise
// export default MyPromise
