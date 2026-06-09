import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildReadTagDataPacket,
  buildSelectTagPacket,
  buildWriteTagDataPacket,
  bytesToHex,
  calcCrc,
} from './stpv3Protocol.js'

test('calcCrc matches the fixed select tag packet from the legacy station', () => {
  const core = '0008002001010000'
  assert.equal(calcCrc(core), 'F81A')
  assert.equal(bytesToHex(buildSelectTagPacket()), '020008002001010000F81A')
})

test('buildReadTagDataPacket uses the legacy STPv3 command code', () => {
  const packetHex = bytesToHex(buildReadTagDataPacket('E004010012345678'))

  assert.match(packetHex, /^02/)
  assert.match(packetHex, /0102/)
})

test('buildWriteTagDataPacket enforces the 48-byte legacy payload', () => {
  const payloadHex = '20'.repeat(48)

  assert.doesNotThrow(() => buildWriteTagDataPacket('E004010012345678', payloadHex))
  assert.throws(
    () => buildWriteTagDataPacket('E004010012345678', 'AABB'),
    /96 caracteres/,
  )
})
