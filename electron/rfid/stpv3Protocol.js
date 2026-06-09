const START_BYTE = '02'
const TAG_TYPE = '0110'
const SELECT_TAG_PACKET = '020008002001010000F81A'
const READ_FLAGS = '0060'
const READ_CMD = '0102'
const WRITE_FLAGS = '0860'
const WRITE_CMD = '0103'
const START_ADDR = '0000'
const NUM_BLOCKS = '000C'
const WRITE_DATA_LEN = '0030'
const LEGACY_PAYLOAD_HEX_LENGTH = 96
const RESPONSE_DELAY_MS = 500
const MAX_OPERATION_ATTEMPTS = 5

const hexPattern = /^[0-9A-F]+$/

const normalizeHex = (value, fieldName) => {
  const normalized = String(value ?? '')
    .replace(/[\s:-]+/g, '')
    .toUpperCase()

  if (!normalized) {
    throw new Error(`El campo ${fieldName} es obligatorio.`)
  }

  if (normalized.length % 2 !== 0 || !hexPattern.test(normalized)) {
    throw new Error(`El campo ${fieldName} debe ser una cadena hexadecimal valida.`)
  }

  return normalized
}

const padHexField = (value, length) => value.padStart(length, '0').toUpperCase()

const hexToBytes = (hexValue) => {
  const normalized = normalizeHex(hexValue, 'paquete')

  return Uint8Array.from(
    normalized.match(/.{1,2}/g).map((pair) => Number.parseInt(pair, 16)),
  )
}

const bytesToHex = (bytes) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

const parseHexBytePair = (highChar, lowChar) => {
  const parseNibble = (char) => {
    const code = char.charCodeAt(0)

    if (code >= 48 && code <= 57) {
      return code - 48
    }

    if (code >= 65 && code <= 70) {
      return code - 55
    }

    if (code >= 97 && code <= 102) {
      return code - 87
    }

    throw new Error('Caracter hexadecimal invalido en paquete STPv3.')
  }

  return (parseNibble(highChar) << 4) | parseNibble(lowChar)
}

const calcCrc = (packetCore) => {
  let crc = 0
  let charIndex = 0

  while (charIndex < packetCore.length) {
    let pair = ''
    let count = 0

    while (count < 2 && charIndex < packetCore.length) {
      pair += packetCore.charAt(charIndex)
      charIndex += 1
      count += 1
    }

    const dataByte = parseHexBytePair(pair.charAt(0), pair.charAt(1))
    let crc16 = crc

    for (let i = 0; i < 1; i += 1) {
      crc16 ^= dataByte

      for (let bit = 0; bit < 8; bit += 1) {
        if ((crc16 & 0x1) === 0x1) {
          crc16 = (crc16 >> 1) ^ 0x8408
        } else {
          crc16 >>= 1
        }
      }
    }

    crc = crc16
  }

  return padHexField(crc.toString(16), 4)
}

const buildPacketFromCore = (coreFields) => {
  const core = coreFields.join('')
  const messageLength = padHexField((core.length / 2).toString(16), 4)
  const packetCore = messageLength + core
  const crc = calcCrc(packetCore)

  return hexToBytes(`${START_BYTE}${packetCore}${crc}`)
}

const buildSelectTagPacket = () => hexToBytes(SELECT_TAG_PACKET)

const buildReadTagDataPacket = (tagId) => {
  const normalizedTagId = normalizeHex(tagId, 'tagId')
  const tagLength = padHexField((normalizedTagId.length / 2).toString(16), 2)

  return buildPacketFromCore([
    READ_FLAGS,
    READ_CMD,
    TAG_TYPE,
    tagLength,
    normalizedTagId,
    START_ADDR,
    NUM_BLOCKS,
  ])
}

const buildWriteTagDataPacket = (tagId, payloadHex) => {
  const normalizedTagId = normalizeHex(tagId, 'tagId')
  const normalizedPayload = normalizeHex(payloadHex, 'payloadHex')

  if (normalizedPayload.length !== LEGACY_PAYLOAD_HEX_LENGTH) {
    throw new Error(
      `El payloadHex debe tener ${LEGACY_PAYLOAD_HEX_LENGTH} caracteres (${LEGACY_PAYLOAD_HEX_LENGTH / 2} bytes).`,
    )
  }

  const tagIdLen = padHexField((normalizedTagId.length / 2).toString(16), 2)

  return buildPacketFromCore([
    WRITE_FLAGS,
    WRITE_CMD,
    TAG_TYPE,
    tagIdLen,
    normalizedTagId,
    START_ADDR,
    NUM_BLOCKS,
    WRITE_DATA_LEN,
    normalizedPayload,
  ])
}

const getResponseCommandCode = (responseHex) => responseHex.slice(6, 10)

const parseSelectTagResponse = (responseBytes) => {
  const responseHex = bytesToHex(responseBytes)

  if (!responseHex) {
    throw new Error('Board connection error. Check connection hardware.')
  }

  if (getResponseCommandCode(responseHex) === '8101') {
    throw new Error('No Tag in Field')
  }

  const tagIdByteLength = Number.parseInt(responseHex.slice(14, 18), 16)
  const tagId = responseHex.slice(18, 18 + tagIdByteLength * 2)

  if (!tagId) {
    throw new Error('No se pudo interpretar el tagId devuelto por el lector.')
  }

  return tagId
}

const parseReadTagDataResponse = (responseBytes) => {
  const responseHex = bytesToHex(responseBytes)

  if (getResponseCommandCode(responseHex) !== '0102') {
    throw new Error('READ FAILED')
  }

  const tagDataLen = Number.parseInt(responseHex.slice(10, 14), 16) * 2
  const tagData = responseHex.slice(14, 14 + tagDataLen)

  if (!tagData) {
    throw new Error('READ FAILED')
  }

  return tagData
}

const parseWriteTagDataResponse = (responseBytes) => {
  const responseHex = bytesToHex(responseBytes)

  if (getResponseCommandCode(responseHex) !== '0103') {
    throw new Error('WRITE FAILED')
  }

  return 'WRITE COMPLETE'
}

export {
  RESPONSE_DELAY_MS,
  MAX_OPERATION_ATTEMPTS,
  LEGACY_PAYLOAD_HEX_LENGTH,
  buildSelectTagPacket,
  buildReadTagDataPacket,
  buildWriteTagDataPacket,
  parseSelectTagResponse,
  parseReadTagDataResponse,
  parseWriteTagDataResponse,
  bytesToHex,
  calcCrc,
  normalizeHex,
}
