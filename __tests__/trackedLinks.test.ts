import { createTrackedLink } from '../src/features/collab/tracking'

describe('tracked links', () => {
  test('create tracked link', async done => {
    const longUrl = 'https://jestjs.io/docs/en/setup-teardown'
    const trackedLink = await createTrackedLink(longUrl)
    const isBitlyLink = trackedLink.includes('bit.ly')
    expect(isBitlyLink).toBe(true)
    done()
  })
})
