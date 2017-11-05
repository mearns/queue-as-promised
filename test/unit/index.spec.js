/* eslint-env mocha */

// Module under test
import {Queue} from '../../src/index'

// Support
import chai, {expect} from 'chai'
import chaiAsPromised from 'chai-as-promised'
import Promise from 'bluebird'
import R from 'ramda'

chai.use(chaiAsPromised)

describe('service-queue', () => {
  it('should execute services serially, in the order in which they are registered', () => {
    // given
    const queueUnderTest = new Queue()
    const log = []
    const numberOfServices = 100
    const allPromises = []

    // when
    for (let i = 0; i < numberOfServices; i++) {
      const serviceNumber = i
      allPromises.push(
        queueUnderTest.enqueue(serviceNumber)
          .then(({item, done}) => {
            log.push({serviceNumber, item})
            done()
          })
      )
    }

    // then
    return Promise.all(allPromises)
      .then(() => {
        for (let i = 0; i < numberOfServices; i++) {
          expect(log[i].serviceNumber, 'expected services to have appended to log in order').to.equal(i)
          expect(log[i].item, 'expected service to be invoked with the item given').to.equal(i)
        }
      })
  })

  it('when services complete asynchronously, should execute services serially, in the order in which they are registered. @slow', () => {
    // given
    const queueUnderTest = new Queue()
    const log = []
    const numberOfServices = 3
    const allPromises = []

    // when
    for (let i = 0; i < numberOfServices; i++) {
      const serviceNumber = i
      allPromises.push(
        queueUnderTest.enqueue(serviceNumber)
          .then(({item, done}) => {
            log.push(2 * serviceNumber)
            return Promise.delay((numberOfServices - serviceNumber) * 100)
              .then(() => {
                log.push((2 * serviceNumber) + 1)
                done()
              })
          })
      )
    }

    // then
    return Promise.all(allPromises)
      .then(() => {
        for (let i = 0; i < (2 * numberOfServices); i++) {
          expect(log[i], 'expected services to have appended to log in order').to.equal(i)
        }
      })
  })

  it('should support registering services from another service', () => {
    // given
    const initialPromises = []
    const log = []
    const queueUnderTest = new Queue()
    let innerPromise

    // when
    initialPromises.push(queueUnderTest.enqueue(0)
      .then(({done}) => {
        log.push(0)
        innerPromise = queueUnderTest.enqueue(2)
          .then(({done}) => {
            log.push(2)
            done()
          })
        done()
      })
    )
    initialPromises.push(queueUnderTest.enqueue(1)
      .then(({done}) => {
        log.push(1)
        done()
      })
    )

    // then
    return Promise.all(initialPromises)
      .then(() => innerPromise)
      .then(() => {
        expect(log).to.deep.equal([0, 1, 2])
      })
  })

  it('should support adding services "while" others are running. @slow', () => {
    // given
    const queueUnderTest = new Queue()
    const log = []
    const asyncPromises = []
    const numInitialServices = 10
    const numAsyncServices = 4
    const initialPromises = R.range(0, numInitialServices)
      .map(() => queueUnderTest.enqueue()
        .then(({done}) => {
          setTimeout(done, 100)
        })
      )

    // when
    R.range(0, numAsyncServices)
      .forEach((i) => {
        initialPromises.push(Promise.delay(i * 125)
          .then(() => {
            asyncPromises.push(queueUnderTest.enqueue()
              .then(({done}) => {
                log.push(i)
                done()
              })
            )
          })
        )
      })

    // then
    Promise.all(initialPromises)
      .then(() => {
        Promise.all(asyncPromises)
          .then(() => {
            for (let i = 0; i < numAsyncServices; i++) {
              expect(log[i], 'expected services to have appended to log in order').to.equal(i)
            }
          })
      })
  })

  it('should reject when enqueuing with an item that cannot be serialized', () => {
    // given
    const queueUnderTest = new Queue()
    const nonSerializableObject = {}
    nonSerializableObject.circularRef = nonSerializableObject

    // when
    const p = queueUnderTest.enqueue(nonSerializableObject)
      .then(({done}) => {
        // just in case
        done()
      })

    // then
    return expect(p).to.be.rejected
  })

  it('should handle done being called multiple times', () => {
    // given
    const queueUnderTest = new Queue()
    const promises = []
    const log = []
    const pendingDones = []

    // when
    promises.push(queueUnderTest.enqueue()
      .then(({done}) => {
        log.push(0)
        done()
        done()
      }))

    R.range(1, 3).forEach((i) => {
      promises.push(queueUnderTest.enqueue().then(({done}) => {
        log.push(i)
        pendingDones.push(done)
      }))
    })

    // then
    return promises[0]
      .then(() => promises[1])
      .then(() => new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            expect(log).to.deep.equal([0, 1])
            resolve()
          } catch (e) {
            reject(e)
          }
        })
      }))
      .then(() => {
        pendingDones.forEach((done) => done())
        return promises[2]
      })
      .then(() => {
        expect(log).to.deep.equal([0, 1, 2])
      })
  })
})
