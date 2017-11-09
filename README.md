# task-queue

A JavaScript library for queueing up tasks, both synchronous and asynchronous.

## Install

```console
npm install task-queue
```

## Overview

You have some tasks to perform and you need to queue them up. Maybe because they all share
a resource so you can only have one running at a time. Doesn't matter why. You define a function
that will run your task, and register with a `Queue`. The registered tasks will executed one
at a time, in order, and notify you when they're done.

## Usage

```javascript
import {Queue} from 'task-queue'

const q = new Queue()

q.enqueue(() => {
  doSomeSynchronousWork()
})
  .then(() => {
    console.log('Synchronous task complete')
  })

q.enqueue(() => {
  return promiseToDoSomeWork()
}
  .then(() => {
    console.log('Asynchronous task complete')
  })
```

## In Depth

For our purposes, a task is some unit of work that has a definitive end point, though the
end point is not necessarily known in advance. This work could be completely synchronous, or
it could be asynchronous.

You create a new instance of a `Queue` and register your task with it by calling the
`enqueue` method. You pass in a function which will actually perform your task.
This function will be invoked by the queue once all previously registered tasks are completed.

If your task function is completely synchronous, then returning normally from the function will
indicate that your task is complete. Likewise, if an exception is thrown from your task function,
the task is considered to be complete.

If your task requires asynchronous work, then your task function should return a promise which
will settle when your task is complete. Whether your promise fulfills or rejects is immaterial, the
act of settling to either of those states causes the queue to consider the task complete.

The `enqueue` method also returns a promise of its own, which will settle based on your task
function. Specifically, it will fulfill once your task completes successfully (returns normally
or returns a promise which eventually fulfills), or will reject if your task fails (either the task
function throws an error, or it returns a promise that eventually rejects).

If your task function results in some value, the returned promise will fulfill with it. If your task
function fails for some error, the returned promise will reject with that reason.

The returned promise allows you to take action in response to the completion of your task, without
prolonging the task from the point of view of the queue. While you can always cram additional work
into your task function, the queue will not move on to the next task until that work is completed. If
there is follow on work that you want to do, but don't want to block subsequent tasks because of it,
then you should chain that work onto the returned promise instead of inside the task function.

You can optionally pass in an initial parameter which is called the *item*. This value will be
passed along as the only argument to the provided task function. This allows you to reuse the same
task function for different tasks, which can then be parameterized by the item.

Note that the item will be serialized and deserialized before being passed to the task function. If
an error occurs during this process, then the promise returned by the call to `enqueue` will reject.
For instance, objects with circular references will err during serialization.

## API

## `Queue::enqueue([item, ] taskFunction)`

```
Queue::enqueue<I, R>([item: I, ] taskFunction: (I) -> R | (I) -> Promise<R>): Promise<R>`
```

Registers the given `taskFunction` as a task in the queue.

### parameters

*   `item` -  An optional value which will be serialized and deserialized, then passed to your task
    function when it is called.
*   `taskFunction` - The actual task function which will be called
    when it reaches the front of the queue, with
    the provided item passed in as the sole argument (after being serialized and deserialized).

    It can return a value of any type, or return a promise for any type.
    The promise returned by `enqueue` will fulfill with the returned value,
    or adopt the state of the returned promise.

### returns

A promise for the value returned by `taskFunction`, or a promise which adopts the state of a promise
returned by the task function. If the task function throws an error, the returned promise will reject
with that error. Additionally, if an error occurs attempting to serialize the given `item`, the returned
promise will reject. It is not specified when this rejection will occur, it does not necessarily wait
for the task to reach the front of the queue.

## Promises

For all parameters specified as being "Promises", any *thennable* can be used and will be resolved to
a promise according to the [Promises/A+](https://promisesaplus.com/) specification. Returned promises
also follow the A+ spec, but the specific implementation is not guaranteed. If you need a promise of
particular implementation, you should use that implementation's utilities to convert it to a promise of
that type (e.g., [Bluebird.resolve](http://bluebirdjs.com/docs/api/promise.resolve.html))
