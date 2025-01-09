import {DrawEyesArgs, DrawEyesArgsEnum, ServoIDs} from './types'

export function typedKeys<T extends Object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[]
}

export const makeMoveServosCommand = (
  servoPositions:
    | {id: number; position: number}
    | {ids: number[]; positions: number[]}
    | Record<number, number>,
): `SET_SERVO_POS ${string}` => {
  // {id: number; position: number}
  if ('id' in servoPositions) {
    const {id, position} = servoPositions
    return `SET_SERVO_POS ${id}=${position.toFixed()}`
  }

  // {ids: number[]; positions: number[]}
  if ('ids' in servoPositions) {
    const {ids, positions} = servoPositions
    if (ids.length !== positions.length) {
      throw new RangeError('Servo ids and positions mismatch')
    }
    return `SET_SERVO_POS ${ids.map((id, index) => `${id}=${positions[index]?.toFixed()}`).join(' ')}`
  }

  // Record<number, number>,
  return `SET_SERVO_POS ${typedKeys(servoPositions)
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
