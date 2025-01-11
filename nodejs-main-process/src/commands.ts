import {DrawEyesArgs, DrawEyesArgsEnum, ServoIDs, ServoMoveType} from './types'

export function typedKeys<T extends Object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[]
}

export const makeMoveServosCommand = (
  servoPositions:
    | {id: number; value: number}
    | {ids: number[]; values: number[]}
    | Record<number, number | undefined>,
  type: ServoMoveType = 'POS',
): `SET_SERVO_${ServoMoveType}${string}` => {
  const template = `SET_SERVO_${type}` as `SET_SERVO_${ServoMoveType}`

  // {id: number; position: number}
  if ('id' in servoPositions) {
    const {id, value} = servoPositions
    return `${template} ${id}=${value.toFixed()}`
  }

  // {ids: number[]; positions: number[]}
  if ('ids' in servoPositions) {
    const {ids, values} = servoPositions
    if (ids.length !== values.length) {
      throw new RangeError('Servo ids and positions mismatch')
    }
    return `${template} ${ids.map((id, index) => `${id}=${values[index]?.toFixed()}`).join(' ')}`
  }

  // Record<number, number>,
  return `${template} ${typedKeys(servoPositions)
    .filter((id) => !!servoPositions[id])
    .map((id) => `${id}=${servoPositions[id]?.toFixed()}`)
    .join(' ')}`
}

export const makeDrawEyesCommand = (
  args: DrawEyesArgs,
): `DRAW_EYES ${string}` => {
  return `DRAW_EYES ${typedKeys(args)
    .map((key) => `${DrawEyesArgsEnum[key]}${args[key]}`)
    .join(' ')}`
}
