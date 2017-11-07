import Promise from 'bluebird'

export class Queue {
  constructor () {
    this._tail = Promise.resolve()
  }

  _serializeItem (item) {
    return JSON.stringify(item)
  }

  _deserializeItem (serializedItem) {
    return serializedItem === undefined ? undefined : JSON.parse(serializedItem)
  }

  _getServiceApi (serializedItem) {
    let deserializedItem
    try {
      deserializedItem = this._deserializeItem(serializedItem)
    } catch (e) {
      throw new Error(`Item could not be deserialized: ${e.message}`)
    }
    return {
      item: deserializedItem
    }
  }

  /**
   * Call to queue up your service. Pass in your service as a callback function, it
   * will be called when it reaches the front of the queue. Your service will
   * *block* the queue until it returns, _or_ if it returns a promise (any _thennable_)
   * it will block the queue until the promise settles. Note that it doesn't matter if
   * the returned promise fulfills or rejects; in either case the service is dequeued.
   *
   * Your service function will be invoked with one argument, the _service invocation object_.
   * The optional first argument to `enqueue` will be passed along in the `item` property of
   * the SIO. Specifically, the given item is _serialized_ when added to the queue,
   * then _deserialized_ into the `item` property. If no `item` argument is passed in to
   * `enqueue`, then the `item` property of the SIO will be `undefined`.
   *
   * The `item` allows you to reuse the same service function for multiple queue entries
   * and allow it to have custom behavior based on the item.
   *
   * This function returns a Promise which will settle after your service
   * completes (specifically, it includes your service as a handler in the chain): if your
   * service throws an error, the returned promise will reject with that error; if your
   * service returns normally (anyhting other than a _thennable_), the promise will fulfill
   * with the returned value; if your service returns a thennable, the returned promise will
   * adopt its state.
   *
   * However, if there is an error serializing (or deserializing) your item, the returned promise
   * will reject and your service will not run.
   *
   * @param  {[serializable]} item  An optional item that will be passed to the given
   *                                `service` function when it is invoked, as the value
   *                                of the `item` property of the service interface
   *                                object.
   *
   *                                Note that this item will be serialized with
   *                                `JSON.stringify`, and then deserialized with
   *                                `JSON.parse` before being passed in SIO.
   *                                This ensures that you aren't relying on anything
   *                                that could not, for instance, be persisted to
   *                                a database. If an error occurs serializing or
   *                                deserializing your item, the returned promise will
   *                                be rejected and your service will not be queued
   *                                (or will be dequeued if already added).
   *
   * @return {[promise]}  A promise that will settle after your service completes,
   *                      based on your service function (as described in the main description).
   */
  enqueue (...args) {
    const callerPromise = new Promise((resolve, reject) => {
      let item, service
      switch (args.length) {
        case 1:
          [service] = args
          break

        case 2:
          [item, service] = args
          break

        default:
          reject(new Error('Illegal invocation, takes one or two arguments'))
          return
      }
      let serializedItem
      try {
        serializedItem = this._serializeItem(item)
      } catch (e) {
        reject(new Error(`Item is not serializable: ${e.message}`))
        return
      }
      this._tail = this._tail.then(() => {
        let serviceApi
        try {
          serviceApi = this._getServiceApi(serializedItem)
        } catch (e) {
          reject(e)
          return
        }
        return Promise.method(service)(serviceApi)
          .then(resolve, reject)
          .finally(() => {})
      })
    })
    return callerPromise
  }
}
