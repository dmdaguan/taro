import { shallowEqual } from '@tarojs/utils'

import { getStore } from '../utils/store'
import { mergeObjects, isObject } from '../utils'

function isEqual (a, b) {
  const typeA = typeof a
  const typeB = typeof b
  if (typeA !== typeB) {
    return false
  }
  if (typeA === 'object') {
    return shallowEqual(a, b)
  }
  return a === b
}

function wrapPropsWithDispatch (mapDispatchToProps, dispatch) {
  if (typeof mapDispatchToProps === 'function') {
    return mapDispatchToProps(dispatch)
  }

  if (isObject(mapDispatchToProps)) {
    return Object.keys(mapDispatchToProps)
      .reduce((props, key) => {
        const actionCreator = mapDispatchToProps[key]
        if (typeof actionCreator === 'function') {
          props[key] = (...args) => dispatch(actionCreator(...args))
        }
        return props
      }, {})
  }

  return {}
}

export default function connect (mapStateToProps, mapDispatchToProps) {
  const store = getStore()
  const dispatch = store.dispatch
  const initMapDispatch = wrapPropsWithDispatch(mapDispatchToProps, dispatch)
  initMapDispatch.dispatch = dispatch

  const stateListener = function () {
    let isChanged = false
    const newMapState = mapStateToProps(store.getState(), this.props)
    const prevProps = Object.assign({}, this.props)
    Object.keys(newMapState).forEach(key => {
      let val = newMapState[key]
      if (isObject(val) && isObject(initMapDispatch[key])) {
        val = mergeObjects(val, initMapDispatch[key])
      }
      if (!isEqual(this.props[key], val)) {
        this.props[key] = val
        isChanged = true
      }
    })
    if (isChanged) {
      this.prevProps = prevProps
      this._unsafeCallUpdate = true
      this.setState({}, () => {
        delete this._unsafeCallUpdate
      })
    }
  }

  return function connectComponent (Component) {
    // 将从redux而来的props从配置中剔除
    const mapState = mapStateToProps(store.getState(), Component.defaultProps || {})
    Component.properties && mapState && Object.keys(mapState).forEach(function (key) {
      delete Component.properties[key]
    })

    let unSubscribe = null
    return class Connect extends Component {
      constructor (props) {
        super(Object.assign(...arguments, mergeObjects(mapStateToProps(store.getState(), props), initMapDispatch)))
        Object.keys(initMapDispatch).forEach(key => {
          this[`__event_${key}`] = initMapDispatch[key]
        })
      }

      componentWillMount () {
        const store = getStore()
        Object.assign(this.props, mergeObjects(mapStateToProps(store.getState(), this.props), initMapDispatch))
        unSubscribe = store.subscribe(stateListener.bind(this))
        if (super.componentWillMount) {
          super.componentWillMount()
        }
      }

      componentWillUnmount () {
        if (super.componentWillUnmount) {
          super.componentWillUnmount()
        }
        if (unSubscribe) {
          unSubscribe()
        }
        unSubscribe = null
      }
    }
  }
}
