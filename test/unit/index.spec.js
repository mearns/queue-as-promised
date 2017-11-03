/* eslint-env mocha */

// Module under test
import {Queue} from '../../src/index'

// Support
import {expect} from 'chai'
import Promise from 'bluebird'

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

  it('when services complete asynchronously, should execute services serially, in the order in which they are registered', () => {
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
})
