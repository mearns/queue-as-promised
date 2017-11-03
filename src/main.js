import Promise from 'bluebird'

export class Queue {
  constructor () {
    this._tail = Promise.resolve()
  }

  /**
   * Call to queue up your service. A promise is returned which will fulfill when
   * your service reaches the head of the queue. Specifically, it will fulfill with
   * an object which includes them given `item` in the `.item` property, and a
   * `.done()` method which you should call when your service is complete and can
   * be dequeued.
   *
   * You can optionally pass a thenable into `.done()`, and we will dequeue your
   * service once the given promise settles. Note that we don't care if your promise
   * fulfills or rejects, we're going to dequeue it anyway.
   *
   * @param  {serializable} item  An optional item that will be passed along in the
   *                              fulfillment value of the returned promise, as the
   *                              value of the `.item` property. This is useful if
   *                              you want to use the same handler for the returned
   *                              promise for multiple calls to `enqueue`, and they
   *                              can inspect the item for specifics.
   *
   *                              Note that this item will be serialized with
   *                              `JSON.stringify`, and then deserialized with
   *                              `JSON.parse` before being passed in the fulfillment.
   *                              This ensures that you aren't relying on anything
   *                              that could not, for instance, be persisted to
   *                              a database. If an error occurs serializing or
   *                              deserializing your item, the returned promise will
   *                              be rejected and your service will not be queued
   *                              (or will be dequeued if already added).
   * @return {[type]}      [description]
   */
  enqueue (item) {
    return new Promise((resolveForCaller, rejectForCaller) => {      // eslint-disable-line promise/param-names
      let serializedItem
      try {
        serializedItem = JSON.stringify(item)
      } catch (e) {
        throw new Error(`Item is not serializable: ${e.message}`)
      }
      this._tail = this._tail.then(() => {
        let deserializedItem
        try {
          deserializedItem = JSON.parse(serializedItem)
        } catch (e) {
          rejectForCaller(new Error(`Item could not be deserialized: ${e.message}`))
          return
        }
        return new Promise((resolveForQueue) => {   // eslint-disable-line promise/param-names
          resolveForCaller({
            item: deserializedItem,
            done: (p) => {
              Promise.resolve(p)
                .finally(resolveForQueue)
            }
          })
        })
      })
    })
  }
}
