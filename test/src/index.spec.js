/* eslint-env mocha */

// Module under test
import {Queue} from '../../src/index'

// Support
import chai, {expect} from 'chai'
import chaiAsPromised from 'chai-as-promised'
import Promise from 'bluebird'
import R from 'ramda'
import sinon from 'sinon'
import sinonChai from '../test-support/sinon-chai'

chai.use(chaiAsPromised)
chai.use(sinonChai)

function range (limit) {
  return R.range(0, limit)
}

function flushQueue (queue) {
  return queue.enqueue(() => {})
}

describe('service-queue', () => {
  it('should execute services serially, in the order in which they are registered', () => {
    // given
    const queueUnderTest = new Queue()
    const log = []
    const numberOfServices = 100

    // when
    const allPromises = range(numberOfServices).map((i) => {
      const serviceNumber = i
      return queueUnderTest.enqueue(serviceNumber, ({item}) => {
        log.push({serviceNumber, item})
      })
    })

    // then
    return Promise.all(allPromises)
      .then(() => {
        expect(log.length).to.equal(numberOfServices)
        log.forEach(({serviceNumber, item}, i) => {
          expect(serviceNumber, 'expected services to have appended to log in order').to.equal(i)
          expect(item, 'expected service to be invoked with the item given').to.equal(i)
        })
      })
  })

  it('when services complete asynchronously, should execute services serially, in the order in which they are registered. @slow', () => {
    // given
    const queueUnderTest = new Queue()
    const log = []
    const numberOfServices = 3

    // when
    const allPromises = range(numberOfServices).map((i) => {
      const serviceNumber = i
      return queueUnderTest.enqueue(serviceNumber, ({item}) => {
        log.push(2 * serviceNumber)
        return Promise.delay((numberOfServices - serviceNumber))
          .then(() => {
            log.push((2 * serviceNumber) + 1)
          })
      })
    })

    // then
    return Promise.all(allPromises)
      .then(() => {
        expect(log.length).to.equal(2 * numberOfServices)
        range(2 * numberOfServices).forEach((i) => {
          expect(log[i], 'expected services to have appended to log in order').to.equal(i)
        })
      })
  })

  it('should support registering services from another service', () => {
    // given
    const initialPromises = []
    const log = []
    const queueUnderTest = new Queue()
    let innerPromise

    // when
    initialPromises.push(queueUnderTest.enqueue(0, () => {
      log.push(0)
      innerPromise = queueUnderTest.enqueue(2, () => {
        log.push(2)
      })
    }))
    initialPromises.push(queueUnderTest.enqueue(1, () => {
      log.push(1)
    }))

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
    const initialPromises = range(numInitialServices)
      .map(() => queueUnderTest.enqueue(() => {
        return Promise.delay(10)
      }))

    // when
    range(numAsyncServices)
      .forEach((i) => {
        initialPromises.push(Promise.delay(i * 12)
          .then(() => {
            asyncPromises.push(queueUnderTest.enqueue(() => {
              log.push(i)
            }))
          })
        )
      })

    // then
    Promise.all(initialPromises)
      .then(() => {
        Promise.all(asyncPromises)
          .then(() => {
            expect(log.length).to.equal(numAsyncServices)
            log.forEach((entry, i) => {
              expect(entry, 'expected services to have appended to log in order').to.equal(i)
            })
          })
      })
  })

  it('should reject when enqueuing with an item that cannot be serialized', () => {
    // given
    const queueUnderTest = new Queue()
    const serviceSpy = sinon.spy()
    const nonSerializableObject = {}
    nonSerializableObject.circularRef = nonSerializableObject

    // when
    const p = queueUnderTest.enqueue(nonSerializableObject, serviceSpy)

    // then
    return expect(p).to.be.rejected
    .then(() => flushQueue(queueUnderTest))
    .then(() => {
      expect(serviceSpy).to.not.have.been.invoked()
    })
  })

  it('should return a rejected promise if invoked with 0 arguments', () => {
    // given
    const queueUnderTest = new Queue()

    // when
    const p = queueUnderTest.enqueue()

    // then
    return expect(p).to.be.rejected
  })

  it('should return a rejected promise if invoked with more than two arguments', () => {
    // given
    const queueUnderTest = new Queue()
    const serviceSpy = sinon.spy()

    // when
    const p = queueUnderTest.enqueue(0, serviceSpy, null)

    // then
    return expect(p).to.be.rejected
      .then(() => flushQueue(queueUnderTest))
      .then(() => {
        expect(serviceSpy).to.not.have.been.invoked()
      })
  })

  it('should return a promise that rejects if the service function throws', () => {
    // given
    const queueUnderTest = new Queue()
    const testError = new Error('TEST-ERROR')

    // when
    const p = queueUnderTest.enqueue(() => {
      throw testError
    })

    // then
    return expect(p).to.be.rejectedWith(testError)
  })

  it('should return a promise that rejects if the service returns a promise that rejects', () => {
    // given
    const queueUnderTest = new Queue()
    const testError = new Error('TEST-ERROR')

    // when
    const p = queueUnderTest.enqueue(() => {
      return Promise.delay(1).then(() => Promise.reject(testError))
    })

    // then
    return expect(p).to.be.rejectedWith(testError)
  })

  it('should still call the next service even if the service rejects', () => {
    // given
    const queueUnderTest = new Queue()
    const testError = new Error('TEST-ERROR')
    const serviceSpy = sinon.spy()

    // when
    const promises = [
      queueUnderTest.enqueue(() => {
        throw testError
      }).catch(() => null),
      queueUnderTest.enqueue(serviceSpy)
    ]

    // then
    return Promise.all(promises)
      .then(() => {
        expect(serviceSpy).to.have.been.invoked()
      })
  })
})
