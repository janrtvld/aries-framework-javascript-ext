/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Agent, BasicMessageRecord, ConnectionRecord } from '@aries-framework/core'
import type { Express } from 'express'

import request from 'supertest'

import { setupServer } from '../src/server'

import { getTestAgent, objectToJson } from './utils/helpers'

describe('BasicMessageController', () => {
  let app: Express
  let aliceAgent: Agent
  let bobAgent: Agent
  let bobConnectionToAlice: ConnectionRecord

  beforeAll(async () => {
    aliceAgent = await getTestAgent('Basic Message REST Agent Test Alice', 3002)
    bobAgent = await getTestAgent('Basic Message REST Agent Test Bob', 3003)
    app = await setupServer(bobAgent, { port: 3000 })

    const { outOfBandInvitation } = await aliceAgent.oob.createInvitation()
    const { outOfBandRecord: bobOOBRecord } = await bobAgent.oob.receiveInvitation(outOfBandInvitation)

    const [bobConnectionAtBobAlice] = await bobAgent.connections.findAllByOutOfBandId(bobOOBRecord.id)
    bobConnectionToAlice = await bobAgent.connections.returnWhenIsConnected(bobConnectionAtBobAlice!.id)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Send basic message to connection', () => {
    test('should give 204 no content when message is sent', async () => {
      const response = await request(app)
        .post(`/basic-messages/${bobConnectionToAlice?.id}`)
        .send({ content: 'Hello!' })

      expect(response.statusCode).toBe(204)
    })

    test('should give 404 not found when connection is not found', async () => {
      const response = await request(app)
        .post(`/basic-messages/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)
        .send({ content: 'Hello!' })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('Get basic messages', () => {
    test('should return list of basic messages filtered by connection id', async () => {
      const spy = jest.spyOn(bobAgent.basicMessages, 'findAllByQuery')
      const getResult = (): Promise<BasicMessageRecord[]> => spy.mock.results[0].value

      const response = await request(app).get(`/basic-messages/${bobConnectionToAlice.id}`)
      const result = await getResult()

      expect(response.statusCode).toBe(200)
      expect(response.body).toEqual(result.map(objectToJson))
    })
  })

  afterAll(async () => {
    await aliceAgent.shutdown()
    await aliceAgent.wallet.delete()
    await bobAgent.shutdown()
    await bobAgent.wallet.delete()
  })
})
