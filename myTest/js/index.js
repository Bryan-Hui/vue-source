function Vue(options) {
  console.log('vue == ', this, this instanceof Vue)
  this._init(options)
}

Vue.prototype._init = function (options) {
  console.log('init == ', this)
}

const vm = new Vue()
console.log(vm.constructor instanceof Vue)


function initExtend(Vue) {
  Vue.extend = function (extendOptions) {
    console.log('extend == ', this)
    // const Sub = function VueComponent (options) {
    //   this._init(options)
    // }
    // Sub.prototype = Object.create(this.prototype)
    // Sub.prototype.constructor = Sub
    // Sub.options = mergeOptions(
    //   this.options,
    //   extendOptions
    // )
  }
}

initExtend(Vue)

Vue.extend()


// function testFunc(){
//   console.log('testFunc ==',this)
// }

// testFunc()

// const arr = Array(5);
// console.log(arr.length)
// const result = arr.map((item, index) => {
//   console.log('11', index)
//   return index
// });

// console.log(result);  // [ <5 empty items> ]

// const arr = Array(5).fill(0)
// console.log('arr==', arr)

// const arr = [...Array(5)]
// console.log(arr)


// const arr = Array.from({ length: 10 }, () => [])
// console.log(arr)


// const obj1 = {
//   name: 'xx'
// }

// function f1(){

// }


const defData = {
  _data: {
    name: 'xx'
  }
}

defData.get = function () {
  console.log(this)
  return this._data
}

defData.get()
