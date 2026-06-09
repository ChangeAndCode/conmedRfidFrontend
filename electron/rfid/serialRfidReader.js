import { SerialPort } from 'serialport'
import {
  RESPONSE_DELAY_MS,
  MAX_OPERATION_ATTEMPTS,
  buildSelectTagPacket,
  buildReadTagDataPacket,
  buildWriteTagDataPacket,
  parseSelectTagResponse,
  parseReadTagDataResponse,
  parseWriteTagDataResponse,
  normalizeHex,
} from './stpv3Protocol.js'

const SERIAL_BAUD_RATE = 38400
const READ_TIMEOUT_MS = 1500

const delay = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

const normalizePortPath = (portPath) => {
  const normalized = String(portPath ?? '').trim().toUpperCase()

  if (!/^COM\d+$/.test(normalized)) {
    throw new Error(`Puerto serial invalido: ${portPath}`)
  }

  return normalized
}

const writePacketAndReadResponse = async (port, packet) => {
  await new Promise((resolve, reject) => {
    port.write(Buffer.from(packet), (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

  await delay(RESPONSE_DELAY_MS)

  return new Promise((resolve, reject) => {
    const chunks = []
    let timeoutId = null

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      port.removeListener('data', onData)
      port.removeListener('error', onError)
    }

    const onData = (data) => {
      chunks.push(data)
      cleanup()
      resolve(Buffer.concat(chunks))
    }

    const onError = (error) => {
      cleanup()
      reject(error)
    }

    port.on('data', onData)
    port.on('error', onError)

    timeoutId = setTimeout(() => {
      cleanup()
      resolve(Buffer.alloc(0))
    }, READ_TIMEOUT_MS)
  })
}

const withSerialPort = async (portPath, operation) => {
  const normalizedPortPath = normalizePortPath(portPath)
  const port = new SerialPort({
    path: normalizedPortPath,
    baudRate: SERIAL_BAUD_RATE,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    autoOpen: false,
  })

  try {
    await new Promise((resolve, reject) => {
      port.open((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    return await operation(port)
  } finally {
    await new Promise((resolve) => {
      if (!port.isOpen) {
        resolve()
        return
      }

      port.close(() => resolve())
    })
  }
}

const executeWithRetries = async (port, buildPacket, parseResponse) => {
  let lastError = new Error('Operacion RFID fallida.')

  for (let attempt = 0; attempt < MAX_OPERATION_ATTEMPTS; attempt += 1) {
    try {
      const responseBytes = await writePacketAndReadResponse(port, buildPacket())
      return parseResponse(responseBytes)
    } catch (error) {
      lastError = error instanceof Error ? error : lastError
    }
  }

  throw lastError
}

export const readSerialTagId = async (portPath) =>
  withSerialPort(portPath, async (port) => {
    const responseBytes = await writePacketAndReadResponse(port, buildSelectTagPacket())
    return parseSelectTagResponse(responseBytes)
  })

export const readSerialPayloadHex = async (portPath) =>
  withSerialPort(portPath, async (port) => {
    const tagId = parseSelectTagResponse(
      await writePacketAndReadResponse(port, buildSelectTagPacket()),
    )

    const payloadHex = await executeWithRetries(
      port,
      () => buildReadTagDataPacket(tagId),
      parseReadTagDataResponse,
    )

    return {
      tagId,
      payloadHex,
    }
  })

export const writeSerialPayloadHex = async (portPath, tagId, payloadHex) =>
  withSerialPort(portPath, async (port) => {
    const detectedTagId = parseSelectTagResponse(
      await writePacketAndReadResponse(port, buildSelectTagPacket()),
    )
    const normalizedRequestedTagId = normalizeHex(tagId, 'tagId')

    if (detectedTagId !== normalizedRequestedTagId) {
      throw new Error(
        'La etiqueta en el lector no coincide con la detectada al iniciar la programacion.',
      )
    }

    const message = await executeWithRetries(
      port,
      () => buildWriteTagDataPacket(detectedTagId, payloadHex),
      parseWriteTagDataResponse,
    )

    return {
      tagId: detectedTagId,
      message,
    }
  })
