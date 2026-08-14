let a = 0

const p1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    a = 1

    // 等待内部 Promise 完成后再 resolve p1
    new Promise((resolve, reject) => {
      setTimeout(() => {
        a = 2
        resolve('p2')
      }, 500)
    }).then(() => {
      resolve('p1')
    })

  }, 1000)
})

Promise.all([p1]).then(res => {
  console.log(res)  // ['p1']
  console.log(a)    // 2
})
