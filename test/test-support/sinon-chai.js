
import _sinonChai from 'sinon-chai'

export default function sinonChai (chai, utils) {
  chai.use(_sinonChai)
  chai.Assertion.addMethod('invoked', function () {
    const calledAssertion = new chai.Assertion(this._obj)
    utils.transferFlags(this, calledAssertion, false)
    calledAssertion.to.have.been.called  // eslint-disable-line no-unused-expressions
  })
}
